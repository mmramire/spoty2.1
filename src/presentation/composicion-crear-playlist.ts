/**
 * Composición de dependencias reales de la creación de playlist vacía.
 *
 * Trazabilidad: `OBJ-001 → RF-001, RNF-001, RNF-003, RNF-005, RNF-006 →
 * UC-001, UC-001-E1 → AC-001, AC-004 → TASK-013 → TC-019`.
 *
 * Único punto de ensamblaje de la feature (ARCHITECTURE §5): aquí Presentation
 * construye el caso de uso con los cuatro puertos reales —`SesionProveedor`
 * sobre `getStoredTokens` y `checkExistingSession`, `PlaylistGateway` de Data,
 * `RegistroTecnico` hacia `data/app.log` y `Espera` de temporizador— y el
 * comando directo y la opción 4 del menú invocan la misma función. El módulo no
 * decide reglas de negocio, no presenta mensajes al usuario y no usa terminal,
 * ficheros ni red directamente: solo ensamla. En pruebas se aíslan
 * `SPOTY_TOKENS_FILE` y `SPOTY_LOG_FILE` y la red se sustituye por un doble
 * (RNF-003, RNF-004, compatibilidad SEA sin dependencias nuevas).
 */
import { checkExistingSession } from '../business/auth/flow.js';
import { getStoredTokens } from '../business/auth/tokens.js';
import { crearPlaylistVacia } from '../business/playlists/crear-playlist.js';
import type {
  DependenciasCreacion,
  Espera,
  SesionProveedor,
} from '../business/playlists/puertos.js';
import type { ResultadoCreacion, SolicitudCreacion } from '../business/playlists/types.js';
import { crearPlaylistGateway } from '../data/http/playlists-client.js';
import { crearRegistroTecnico } from '../data/logging/registro-tecnico.js';

/** Caso de uso ya compuesto: se invoca con una solicitud, sin dependencias. */
export type CasoUsoCrearPlaylist = (solicitud: SolicitudCreacion) => Promise<ResultadoCreacion>;

/**
 * Espera real de temporizador (ARCHITECTURE §5): los retardos solo ocurren a
 * través del puerto `Espera`, de modo que ningún otro módulo usa temporizadores
 * propios para la creación.
 */
const esperaDeTemporizador: Espera = {
  esperar: (milisegundos) =>
    new Promise<void>((resolve) => {
      setTimeout(resolve, milisegundos);
    }),
};

/**
 * `SesionProveedor` sobre `getStoredTokens` y `checkExistingSession` (§5, §7):
 * sin tokens almacenados no hay sesión vigente y no se consulta la red; con
 * tokens almacenados se valida la sesión vigente y se devuelve el testigo de
 * acceso (BR-001, UC-001-E1).
 */
const sesionDeAlmacenamiento: SesionProveedor = {
  async obtenerSesionVigente() {
    if (getStoredTokens() === null) {
      return null;
    }
    const sesion = await checkExistingSession();
    return sesion === null ? null : { testigoSesion: sesion.tokens.access_token };
  },
};

/**
 * Única composición de arranque (TASK-013): devuelve el caso de uso listo para
 * que el comando directo y la opción 4 del menú lo invoken con la misma
 * construcción y con los mismos tipos (RNF-003).
 */
export function componerCrearPlaylistVacia(): CasoUsoCrearPlaylist {
  const dependencias: DependenciasCreacion = {
    sesionProveedor: sesionDeAlmacenamiento,
    playlistGateway: crearPlaylistGateway(),
    registroTecnico: crearRegistroTecnico(),
    espera: esperaDeTemporizador,
  };
  return (solicitud) => crearPlaylistVacia(solicitud, dependencias);
}
