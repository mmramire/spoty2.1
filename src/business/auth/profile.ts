import { ProfileFetchError, fetchUserProfile } from '../../data/http/spotify-client.js';
import { getLogger } from '../../data/logging/pino-setup.js';
import { AuthError, AuthErrorType } from './errors.js';
import type { UserProfile } from './types.js';

export async function getUserProfile(accessToken: string): Promise<UserProfile> {
  const _logger = getLogger();
  try {
    const profile = await fetchUserProfile(accessToken);
    return profile;
  } catch (error) {
    if (error instanceof ProfileFetchError) {
      if (error.status === 401) {
        throw new AuthError(
          AuthErrorType.TOKEN_EXPIRED,
          'La sesión ha expirado. Vuelve a conectar tu cuenta.',
          error
        );
      }
      if (error.status === 403) {
        throw new AuthError(
          AuthErrorType.OAUTH_INVALID,
          'Acceso denegado. La autorización ha sido revocada.',
          error
        );
      }
      throw new AuthError(
        AuthErrorType.PERMANENT,
        `Error al obtener perfil: ${error.message}`,
        error
      );
    }
    throw error;
  }
}
