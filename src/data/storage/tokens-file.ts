import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function getTokensDir(): string {
  const customDir = process.env.SPOTY_TOKENS_DIR;
  if (customDir) {
    return customDir;
  }
  return join(process.cwd(), 'data');
}

function getTokensFile(): string {
  const customFile = process.env.SPOTY_TOKENS_FILE;
  if (customFile) {
    return customFile;
  }
  return join(getTokensDir(), 'tokens.json');
}

export interface TokenSet {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  scope: string;
  token_type: string;
}

function isValidTokenSet(obj: unknown): obj is TokenSet {
  if (!obj || typeof obj !== 'object') return false;
  const t = obj as Record<string, unknown>;
  return (
    typeof t.access_token === 'string' &&
    t.access_token.length > 0 &&
    typeof t.refresh_token === 'string' &&
    t.refresh_token.length > 0 &&
    typeof t.expires_at === 'number' &&
    t.expires_at > 0 &&
    typeof t.scope === 'string' &&
    t.scope.length > 0 &&
    typeof t.token_type === 'string' &&
    t.token_type === 'Bearer'
  );
}

export function saveTokens(tokens: TokenSet): void {
  const tokensDir = getTokensDir();
  const tokensFile = getTokensFile();

  if (!existsSync(tokensDir)) {
    mkdirSync(tokensDir, { recursive: true });
  }

  const content = JSON.stringify(tokens, null, 2);
  writeFileSync(tokensFile, content, { encoding: 'utf8', mode: 0o600 });

  try {
    chmodSync(tokensFile, 0o600);
  } catch {
    // Windows doesn't support chmod, ignore silently
  }
}

export function loadTokens(): TokenSet | null {
  const tokensFile = getTokensFile();

  if (!existsSync(tokensFile)) {
    return null;
  }

  try {
    const content = readFileSync(tokensFile, 'utf8');
    const parsed = JSON.parse(content);
    if (!isValidTokenSet(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function deleteTokens(): void {
  const tokensFile = getTokensFile();
  if (existsSync(tokensFile)) {
    try {
      rmSync(tokensFile);
    } catch {
      // ignore
    }
  }
}

export function isTokenValid(tokens: TokenSet): boolean {
  return tokens.expires_at > Date.now();
}

export function getTokensFilePath(): string {
  return getTokensFile();
}
