export enum AuthErrorType {
  CONFIG = 'CONFIG',
  CANCELLED = 'CANCELLED',
  TRANSIENT = 'TRANSIENT',
  PERMANENT = 'PERMANENT',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  OAUTH_INVALID = 'OAUTH_INVALID',
  PORT_IN_USE = 'PORT_IN_USE',
  TOKENS_CORRUPT = 'TOKENS_CORRUPT',
}

export class AuthError extends Error {
  constructor(
    public readonly type: AuthErrorType,
    message: string,
    public readonly cause?: Error,
    public readonly retries?: number
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export function mapHttpError(status: number, message: string): AuthError {
  switch (status) {
    case 400:
      return new AuthError(AuthErrorType.PERMANENT, `Solicitud inválida: ${message}`);
    case 401:
      return new AuthError(
        AuthErrorType.TOKEN_EXPIRED,
        'La sesión ha expirado. Vuelve a conectar tu cuenta.'
      );
    case 403:
      return new AuthError(
        AuthErrorType.OAUTH_INVALID,
        'Acceso denegado. La autorización es inválida o ha sido revocada.'
      );
    case 429:
      return new AuthError(
        AuthErrorType.TRANSIENT,
        'Demasiadas peticiones. Espera un momento e inténtalo de nuevo.'
      );
    case 500:
    case 502:
    case 503:
    case 504:
      return new AuthError(
        AuthErrorType.TRANSIENT,
        'Error del servidor de Spotify. Reintentando...'
      );
    default:
      return new AuthError(AuthErrorType.PERMANENT, `Error inesperado (${status}): ${message}`);
  }
}

export function isTransientError(error: AuthError): boolean {
  return error.type === AuthErrorType.TRANSIENT;
}

export function isConfigError(error: unknown): error is AuthError {
  return error instanceof AuthError && error.type === AuthErrorType.CONFIG;
}

export function isCancelledError(error: unknown): error is AuthError {
  return error instanceof AuthError && error.type === AuthErrorType.CANCELLED;
}
