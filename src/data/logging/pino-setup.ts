import pino from 'pino';
import { getLogFilePath, logFilePath, logFileSetup } from '../storage/log-file.js';

const isDev = process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test';
const isInteractive =
  process.stdin.isTTY && !process.argv.includes('--help') && !process.argv.includes('-h');

let logger: pino.Logger;

export function getLogger(): pino.Logger {
  if (!logger) {
    logFileSetup();
    const transports: pino.TransportTargetOptions[] = [];

    if (isDev && !isInteractive) {
      transports.push({
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
          destination: 2,
        },
        level: 'debug',
      });
    }

    transports.push({
      target: 'pino/file',
      options: { destination: getLogFilePath() },
      level: isDev ? 'debug' : 'info',
    });

    logger = pino(
      {
        level: isDev ? 'debug' : 'info',
        base: { pid: process.pid, hostname: process.env.HOSTNAME ?? 'unknown' },
        timestamp: () => `,"time":"${new Date().toLocaleString()}"`,
      },
      pino.transport({
        targets: transports,
      })
    );
  }
  return logger;
}

export function createContextLogger(context: Record<string, unknown>): pino.Logger {
  return getLogger().child(context);
}

export { logFilePath, getLogFilePath };
