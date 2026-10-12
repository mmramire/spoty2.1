import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function getLogDir(): string {
  const customDir = process.env.SPOTY_LOG_DIR;
  if (customDir) {
    return customDir;
  }
  return join(process.cwd(), 'data');
}

function getLogFile(): string {
  const customFile = process.env.SPOTY_LOG_FILE;
  if (customFile) {
    return customFile;
  }
  return join(getLogDir(), 'app.log');
}

const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5 MB

export const logFilePath = getLogFile();

export function logFileSetup(): void {
  const logDir = getLogDir();
  const logFile = getLogFile();

  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true });
  }

  if (existsSync(logFile)) {
    const stats = statSync(logFile);
    if (stats.size > MAX_LOG_SIZE) {
      writeFileSync(logFile, '');
    }
  }
}

export function getLogFilePath(): string {
  return getLogFile();
}
