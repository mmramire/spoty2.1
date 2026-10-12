import { type AccessToken, SpotifyApi } from '@spotify/web-api-ts-sdk';
import { getLogger } from '../logging/pino-setup.js';

let spotifyClient: SpotifyApi | null = null;

function createAccessToken(token: string): AccessToken {
  return {
    access_token: token,
    token_type: 'Bearer',
    expires_in: 3600,
    refresh_token: '',
    expires: Date.now() + 3600 * 1000,
  };
}

export function getSpotifyClient(accessToken?: string): SpotifyApi {
  if (!spotifyClient || accessToken) {
    spotifyClient = SpotifyApi.withAccessToken(
      process.env.SPOTIFY_CLIENT_ID ?? '',
      createAccessToken(accessToken ?? '')
    );
  }
  return spotifyClient;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
  error?: { message: string };
}

interface ProfileResponse {
  id: string;
  display_name?: string;
  email?: string;
  error?: { message: string };
}

function assertTokenResponse(data: unknown): asserts data is TokenResponse {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid token response');
  }
}

function assertProfileResponse(data: unknown): asserts data is ProfileResponse {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid profile response');
  }
}

export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}> {
  const logger = getLogger();
  const clientId = process.env.SPOTIFY_CLIENT_ID;

  if (!clientId) {
    throw new Error('SPOTIFY_CLIENT_ID not configured');
  }

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: codeVerifier,
  });

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const data = await response.json();
  assertTokenResponse(data);

  if (!response.ok) {
    logger.error({ status: response.status, error: data }, 'Token exchange failed');
    throw new TokenExchangeError(data.error?.message ?? 'Token exchange failed', response.status);
  }

  logger.info({ scope: data.scope }, 'Token exchange successful');
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? '',
    expires_in: data.expires_in,
    token_type: data.token_type,
    scope: data.scope,
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}> {
  const logger = getLogger();
  const clientId = process.env.SPOTIFY_CLIENT_ID;

  if (!clientId) {
    throw new Error('SPOTIFY_CLIENT_ID not configured');
  }

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
  });

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const data = await response.json();
  assertTokenResponse(data);

  if (!response.ok) {
    logger.error({ status: response.status, error: data }, 'Token refresh failed');
    throw new TokenExchangeError(data.error?.message ?? 'Token refresh failed', response.status);
  }

  return {
    access_token: data.access_token,
    expires_in: data.expires_in,
    token_type: data.token_type,
    scope: data.scope,
  };
}

export async function fetchUserProfile(accessToken: string): Promise<{
  display_name: string;
  email: string;
}> {
  const logger = getLogger();
  const client = getSpotifyClient(accessToken);

  try {
    const profile = await client.currentUser.profile();
    logger.info({ userId: profile.id }, 'User profile fetched');
    return {
      display_name: profile.display_name ?? profile.id,
      email: profile.email ?? '',
    };
  } catch (error) {
    if (error instanceof Response) {
      const data = await error.json();
      assertProfileResponse(data);
      logger.error({ status: error.status, error: data }, 'Failed to fetch user profile');
      throw new ProfileFetchError(data.error?.message ?? 'Failed to fetch profile', error.status);
    }
    throw error;
  }
}

export class TokenExchangeError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = 'TokenExchangeError';
  }
}

export class ProfileFetchError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = 'ProfileFetchError';
  }
}
