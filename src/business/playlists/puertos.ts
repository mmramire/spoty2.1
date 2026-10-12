/**
 * Puertos que Business define y que Data implementa (ARCHITECTURE §5).
 *
 * Trazabilidad: OBJ-001 → RF-001, RF-002, RNF-003 → UC-001 → AC-001, AC-002,
 * AC-003, AC-004, AC-005 → TASK-001 → TC-001.
 *
 * Este módulo no importa de Presentation, del punto de entrada ni de Data, y no
 * usa Pino, red ni sistema de ficheros directamente (RNF-003).
 */
import type {
  DescripcionEfectiva,
  EntradaCreacionPlaylist,
  PlaylistCreada,
  SesionVigente,
  Visibilidad,
} from './types.js';

/**
 * Campos estructurados admitidos por el registro técnico (RNF-006). El conjunto
 * cerrado impide que testigos, cabeceras o cuerpos de respuesta lleguen al
 * registro (RNF-001).
 */
export interface CamposRegistro {
  readonly nombre?: string;
  readonly visibilidad?: Visibilidad;
  readonly descripcionEfectiva?: DescripcionEfectiva;
  readonly identificador?: string;
  readonly intento?: number;
  readonly estado?: number;
  readonly causa?: string;
}

/** Sesión vigente: devuelve `null` cuando no hay sesión utilizable (BR-001). */
export interface SesionProveedor {
  obtenerSesionVigente: () => Promise<SesionVigente | null>;
}

/** Puerta de acceso a playlists: Data la implementa; Business solo la consume. */
export interface PlaylistGateway {
  crearPlaylist: (entrada: EntradaCreacionPlaylist) => Promise<PlaylistCreada>;
  listarPlaylistsPropias: () => Promise<string[]>;
}

/** Registro técnico: Data lo implementa sobre Pino; Business emite la intención. */
export interface RegistroTecnico {
  info: (mensaje: string, campos?: CamposRegistro) => void;
  advertencia: (mensaje: string, campos?: CamposRegistro) => void;
  error: (mensaje: string, campos?: CamposRegistro) => void;
}

/** Espera inyectable: evita temporizadores propios en Business y protege las pruebas. */
export interface Espera {
  esperar: (milisegundos: number) => Promise<void>;
}

/** Dependencias inyectadas que recibe el caso de uso `crearPlaylistVacia` (UC-001). */
export interface DependenciasCreacion {
  readonly sesionProveedor: SesionProveedor;
  readonly playlistGateway: PlaylistGateway;
  readonly registroTecnico: RegistroTecnico;
  readonly espera: Espera;
}
