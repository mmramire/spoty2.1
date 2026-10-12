import { type IncomingMessage, type ServerResponse, createServer } from 'node:http';
import { URL } from 'node:url';
import open from 'open';
import { exchangeCodeForTokens } from '../../data/http/spotify-client.js';
import { getLogger } from '../../data/logging/pino-setup.js';
import { withRetry } from '../retry/retry.js';
import { AuthError, AuthErrorType } from './errors.js';
import {
  buildAuthUrl,
  generateCodeChallenge,
  generateCodeVerifier,
  generateState,
} from './pkce.js';
import { getUserProfile } from './profile.js';
import { clearStoredTokens, getStoredTokens, storeTokens } from './tokens.js';
import {
  type AuthConfig,
  type TokenSet,
  type UserProfile,
  extractPortFromRedirectUri,
  validateRedirectUri,
} from './types.js';

const CALLBACK_TIMEOUT = 300000;

export interface CallbackData {
  code?: string;
  error?: string;
  state?: string;
}

export async function runAuthFlow(
  config: AuthConfig
): Promise<{ tokens: TokenSet; profile: UserProfile }> {
  const logger = getLogger();

  const validation = validateRedirectUri(config.redirectUri);
  if (!validation.valid) {
    throw new AuthError(AuthErrorType.CONFIG, `Redirect URI inválida: ${validation.error}`);
  }

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = generateState();

  const authUrl = buildAuthUrl(config, codeChallenge, state);
  logger.info({ authUrl }, 'Opening browser for authorization');

  try {
    await open(authUrl, { wait: false });
  } catch {
    logger.warn('Could not open browser automatically');
  }

  const callbackData = await startCallbackServer(config.redirectUri, state, CALLBACK_TIMEOUT);

  if (callbackData.error) {
    if (callbackData.error === 'access_denied') {
      logger.info('User cancelled authorization');
      throw new AuthError(AuthErrorType.CANCELLED, 'Autorización cancelada por el usuario');
    }
    throw new AuthError(AuthErrorType.PERMANENT, `Error en autorización: ${callbackData.error}`);
  }

  if (!callbackData.code) {
    throw new AuthError(
      AuthErrorType.PERMANENT,
      'Respuesta de Spotify inválida: no se recibió código de autorización'
    );
  }

  const authCode = callbackData.code;

  const tokenData = await withRetry(
    () => exchangeCodeForTokens(authCode, codeVerifier, config.redirectUri),
    undefined,
    { step: 'token_exchange' }
  );

  const tokens = storeTokens(tokenData);
  logger.info('Tokens stored successfully');

  const profile = await getUserProfile(tokens.access_token);
  logger.info({ displayName: profile.display_name }, 'User profile retrieved');

  return { tokens, profile };
}

export async function checkExistingSession(): Promise<{
  tokens: TokenSet;
  profile: UserProfile;
} | null> {
  const logger = getLogger();
  const tokens = getStoredTokens();
  if (!tokens) {
    return null;
  }

  try {
    const profile = await getUserProfile(tokens.access_token);
    return { tokens, profile };
  } catch (error) {
    if (error instanceof AuthError && error.type === AuthErrorType.TOKEN_EXPIRED) {
      logger.info('Stored tokens expired, will need re-auth');
      clearStoredTokens();
      return null;
    }
    if (error instanceof AuthError && error.type === AuthErrorType.OAUTH_INVALID) {
      logger.info('Stored tokens invalid (revoked), clearing');
      clearStoredTokens();
      return null;
    }
    logger.warn(
      { error: error instanceof Error ? error.message : String(error) },
      'Error checking session, treating as invalid'
    );
    clearStoredTokens();
    return null;
  }
}

export function startCallbackServer(
  redirectUri: string,
  expectedState: string,
  timeoutMs: number
): Promise<CallbackData> {
  return new Promise((resolve, reject) => {
    const logger = getLogger();
    const port = extractPortFromRedirectUri(redirectUri);

    const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url ?? '', `http://127.0.0.1:${port}`);
      if (url.pathname === '/callback') {
        const code = url.searchParams.get('code') ?? undefined;
        const error = url.searchParams.get('error') ?? undefined;
        const state = url.searchParams.get('state') ?? undefined;

        if (state !== expectedState) {
          server.close();
          return reject(
            new AuthError(AuthErrorType.PERMANENT, 'Error de seguridad: estado inválido (CSRF)')
          );
        }

        server.close();
        resolve({ code, error, state });
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('Autorización completada. Puedes cerrar esta ventana.');
        return;
      }
      res.writeHead(404);
      res.end('Not found');
    });

    server.listen(port, '127.0.0.1', () => {
      logger.info({ port }, 'Callback server started');
    });

    const timeout = setTimeout(() => {
      server.close();
      reject(
        new AuthError(AuthErrorType.TRANSIENT, 'Tiempo de espera agotado para la autorización')
      );
    }, timeoutMs);

    server.on('error', (err: NodeJS.ErrnoException) => {
      clearTimeout(timeout);
      if (err.code === 'EADDRINUSE') {
        reject(
          new AuthError(
            AuthErrorType.PORT_IN_USE,
            `Puerto ${port} en uso. Cierra la app que lo usa o cambia SPOTIFY_REDIRECT_URI.`
          )
        );
      } else {
        reject(new AuthError(AuthErrorType.TRANSIENT, `Error del servidor: ${err.message}`));
      }
    });

    server.on('close', () => {
      clearTimeout(timeout);
    });
  });
}
