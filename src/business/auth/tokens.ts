import { getLogger } from '../../data/logging/pino-setup.js';
import {
  deleteTokens,
  isTokenValid,
  loadTokens,
  saveTokens,
} from '../../data/storage/tokens-file.js';
import { AuthError, AuthErrorType } from './errors.js';
import type { TokenSet } from './types.js';

export function getStoredTokens(): TokenSet | null {
  const logger = getLogger();
  const tokens = loadTokens();
  if (!tokens) {
    logger.info('No stored tokens found');
    return null;
  }
  if (!isTokenValid(tokens)) {
    logger.info('Stored tokens expired');
    return null;
  }
  logger.info('Valid stored tokens found');
  return tokens;
}

export function storeTokens(
  tokens: Omit<TokenSet, 'expires_at'> & { expires_in: number }
): TokenSet {
  const logger = getLogger();
  const tokenSet: TokenSet = {
    ...tokens,
    expires_at: Date.now() + tokens.expires_in * 1000,
  };
  saveTokens(tokenSet);
  logger.info('Tokens saved successfully');
  return tokenSet;
}

export function clearStoredTokens(): void {
  const logger = getLogger();
  deleteTokens();
  logger.info('Stored tokens cleared');
}

export function validateTokensOrThrow(tokens: unknown): TokenSet {
  if (!tokens || typeof tokens !== 'object') {
    const error = new AuthError(
      AuthErrorType.TOKENS_CORRUPT,
      'Sesión guardada inválida o corrupta.'
    );
    throw error;
  }
  const t = tokens as Record<string, unknown>;
  if (
    typeof t.access_token !== 'string' ||
    typeof t.refresh_token !== 'string' ||
    typeof t.expires_at !== 'number' ||
    typeof t.scope !== 'string' ||
    typeof t.token_type !== 'string'
  ) {
    const error = new AuthError(AuthErrorType.TOKENS_CORRUPT, 'Sesión guardada incompleta.');
    throw error;
  }
  if (!isTokenValid(tokens as TokenSet)) {
    const error = new AuthError(AuthErrorType.TOKEN_EXPIRED, 'La sesión ha expirado.');
    throw error;
  }
  return tokens as TokenSet;
}
