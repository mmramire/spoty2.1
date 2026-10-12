import type { Visibilidad } from '../business/playlists/types.js';
import { getLogFilePath } from '../data/logging/pino-setup.js';

// Forma visible aprobada de la visibilidad en el mensaje de éxito (RF-002): los valores de
// dominio son `publica`/`privada` y el literal aprobado los escribe con tilde.
const VISIBILIDAD_EXIBIBLE: Record<Visibilidad, string> = {
  publica: 'pública',
  privada: 'privada',
};

export const MESSAGES = {
  welcome: '=== spoty - Conexión a Spotify ===',
  menu: {
    title: '\nSelecciona una opción:',
    connect: '1. Conectar con Spotify',
    status: '2. Ver estado de conexión',
    download: '3. Descargar biblioteca',
    createPlaylist: '4. Crear playlist vacía',
    logout: '9. Cerrar sesión',
    exit: '0. Salir',
    hint: '(navega con 0-3,9, Ctrl+C para cancelar)',
    hintCreatePlaylist: '(navega con 0-4,9, Ctrl+C para cancelar)',
  },
  config: {
    missingClientId: 'Falta SPOTIFY_CLIENT_ID. Obténlo en https://developer.spotify.com/dashboard',
    missingRedirectUri:
      'Falta SPOTIFY_REDIRECT_URI. Configúralo en https://developer.spotify.com/dashboard',
    invalidRedirectUri: (error: string) =>
      `SPOTIFY_REDIRECT_URI inválida: ${error}. Debe ser http://127.0.0.1:puerto/callback`,
    enterClientId: 'Introduce tu SPOTIFY_CLIENT_ID: ',
    enterRedirectUri: 'Introduce tu SPOTIFY_REDIRECT_URI (ej. http://127.0.0.1:8888/callback): ',
    configSaved: 'Configuración guardada correctamente.',
  },
  auth: {
    starting: 'Iniciando flujo de autorización...',
    openingBrowser: 'Abriendo navegador para autorizar la aplicación...',
    browserFallback:
      'No se pudo abrir el navegador automáticamente. Copia y pega esta URL en tu navegador:',
    waitingCallback: 'Esperando autorización en el navegador... (tienes 5 minutos)',
    callbackReceived: 'Autorización recibida. Intercambiando código por tokens...',
    success: (displayName: string, email: string) =>
      `Conectado correctamente a Spotify como ${displayName} (${email})`,
    cancelled: 'Autorización cancelada por el usuario',
    sessionValid: (displayName: string, email: string) =>
      `Sesión activa: ${displayName} (${email})`,
    sessionExpired: 'La sesión ha expirado. Iniciando nueva autenticación...',
    sessionInvalid: 'Sesión guardada inválida. Iniciando nueva autenticación...',
    logoutSuccess: 'Sesión cerrada correctamente.',
    logoutConfirm: '¿Estás seguro de que quieres cerrar la sesión? (s/N): ',
  },
  errors: {
    generic: (description: string) =>
      `Error al conectar con Spotify: ${description}. Ver ${getLogFilePath()} para más información`,
    portInUse: (port: number) =>
      `Puerto ${port} en uso. Cierra la app que lo usa o cambia SPOTIFY_REDIRECT_URI.`,
    timeout: 'Tiempo de espera agotado para la autorización.',
    retrying: (description: string, attempt: number) =>
      `Error temporal: ${description}. Reintentando (${attempt}/2)...`,
    retriesExhausted: (description: string) =>
      `Error al conectar con Spotify: ${description}. Ver ${getLogFilePath()} para más información`,
    configRequired: 'Configuración requerida. Ejecuta "spoty connect" para configurar.',
    invalidOption: 'Opción inválida. Intenta de nuevo.',
    interrupt: '\nInterrumpido por el usuario.',
  },
  // Literales aprobados de la creación de playlist vacía (RF-002, RNF-002, TASK-011).
  playlist: {
    created: (
      nombre: string,
      visibilidad: Visibilidad,
      descripcion: string,
      identificador: string,
      enlace: string
    ) =>
      `Playlist creada: "${nombre}" (${VISIBILIDAD_EXIBIBLE[visibilidad]}, ` +
      `descripción: "${descripcion}", id: ${identificador}, enlace: ${enlace})`,
    nameLengthError:
      'Error en longitud del nombre de la playlist, mínimo 3, máximo 100 caracteres totales.',
    visibilityFlagError: 'Se debe declarar flag único en comando --public o --private',
    noSessionError: 'No hay sesión activa. Conecta con Spotify con la opción 1',
    sessionExpiredError: 'Sesión caducada. Vuelve a conectar con Spotify.',
    permissionsError: 'Permisos insuficientes para crear la playlist.',
    rateLimitError: 'Vuelva a intentarlo más tarde',
    unexpectedError: 'No se pudo crear la playlist por un error inesperado.',
    duplicate: (nombre: string) => `Ya existe una playlist llamada "${nombre}".`,
    duplicateMenu:
      '¿Qué deseas hacer? 1. Modificar nombre 2. Crear de todos modos con el mismo nombre ' +
      '0. Cancelar sin crear / Elige (0-2):',
    cancelled: 'Creación cancelada. No se creó ninguna playlist.',
    namePrompt: 'Nombre de la playlist (3-100 caracteres):',
    descriptionPrompt: 'Descripción (opcional, Enter para usar "Playlist sin descripción"):',
    modifyPrompt: '¿Deseas modificar descripción y visibilidad? (s/N): ',
    // DISC-006: resumen previo y pregunta explícita de la confirmación final.
    summary: (nombre: string, visibilidad: Visibilidad, descripcion: string) =>
      `Resumen de la playlist: "${nombre}" (${VISIBILIDAD_EXIBIBLE[visibilidad]}, ` +
      `descripción: "${descripcion}")`,
    confirmPrompt: '¿Crear la playlist con estos datos? ',
  },
} as const;
