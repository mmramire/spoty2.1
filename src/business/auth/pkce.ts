import { createHash, randomBytes } from 'node:crypto';

const CODE_VERIFIER_LENGTH = 64;
const STATE_LENGTH = 32;

export function generateCodeVerifier(): string {
  const bytes = randomBytes(CODE_VERIFIER_LENGTH);
  return base64URLEncode(bytes);
}

export function generateCodeChallenge(codeVerifier: string): string {
  const hash = createHash('sha256').update(codeVerifier).digest();
  return base64URLEncode(hash);
}

export function generateState(): string {
  const bytes = randomBytes(STATE_LENGTH);
  return base64URLEncode(bytes);
}

function base64URLEncode(buffer: Buffer | Uint8Array): string {
  return Buffer.from(buffer)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export function buildAuthUrl(
  config: { clientId: string; redirectUri: string; scopes: string[] },
  codeChallenge: string,
  state: string
): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scopes.join(' '),
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
  });
  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}
