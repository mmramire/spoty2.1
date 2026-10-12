export interface AuthConfig {
  clientId: string;
  redirectUri: string;
  scopes: string[];
}

export interface TokenSet {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  scope: string;
  token_type: string;
}

export interface UserProfile {
  display_name: string;
  email: string;
}

export interface AuthResult {
  tokens: TokenSet;
  profile: UserProfile;
}

export const REQUIRED_SCOPES = [
  'user-read-private',
  'user-read-email',
  'user-library-read',
  'user-library-modify',
  'playlist-read-private',
  'playlist-modify-private',
  'playlist-modify-public',
  'playlist-read-collaborative',
] as const;

export const SCOPES_STRING = REQUIRED_SCOPES.join(' ');

export function getAuthConfig(): AuthConfig {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    throw new ConfigError('Missing required environment variables');
  }

  return {
    clientId,
    redirectUri,
    scopes: [...REQUIRED_SCOPES],
  };
}

export function validateRedirectUri(uri: string): { valid: boolean; error?: string } {
  try {
    const url = new URL(uri);
    if (url.protocol !== 'http:') {
      return { valid: false, error: 'Redirect URI must use HTTP protocol' };
    }
    if (url.hostname === 'localhost') {
      return { valid: false, error: 'localhost is not allowed. Use 127.0.0.1 instead' };
    }
    if (url.hostname !== '127.0.0.1') {
      return { valid: false, error: 'Redirect URI must use 127.0.0.1 for local development' };
    }
    if (!url.pathname.endsWith('/callback')) {
      return { valid: false, error: 'Redirect URI must end with /callback' };
    }
    const port = Number.parseInt(url.port, 10);
    if (!port || port < 1 || port > 65535) {
      return { valid: false, error: 'Invalid port in redirect URI' };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid redirect URI format' };
  }
}

export function extractPortFromRedirectUri(uri: string): number {
  const url = new URL(uri);
  return Number.parseInt(url.port, 10);
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}
