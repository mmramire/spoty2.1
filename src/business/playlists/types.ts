/**
 * Contratos de dominio de la creación de playlist vacía.
 *
 * Trazabilidad: OBJ-001 → RF-001, RF-002, RNF-003 → UC-001 → AC-001, AC-002,
 * AC-003, AC-004, AC-005 → TASK-001 → TC-001.
 *
 * Este módulo no importa de Presentation, del punto de entrada ni de Data, y no
 * realiza entrada ni salida directa (RNF-003).
 */

/**
 * Descripción efectiva ya resuelta por Business: el valor aportado no vacío o,
 * en su defecto, el valor por defecto aprobado `"Playlist sin descripción"`.
 */
export type DescripcionEfectiva = string;

/**
 * Visibilidad válida: exactamente dos valores. La modalidad colaborativa no es
 * representable en ningún punto del flujo (P-001, BR-005).
 */
export type Visibilidad = 'publica' | 'privada';

/**
 * Estado de la visibilidad recibido en la solicitud en bruto. Presentation solo
 * traduce los indicadores detectados y delega el dictamen a Business: ante
 * `ausente` o `doble`, Business produce `ErrorValidacion` de visibilidad
 * (BR-005, ARCHITECTURE §4.1 y §6.3).
 */
export type EntradaVisibilidad = Visibilidad | 'ausente' | 'doble';

/**
 * Desenlace del canal de confirmación de la invocación (DISC-002): `confirmada`
 * cuando el usuario confirmó con `s` —o cuando el comando directo válido sin
 * reingreso lo aporta pre-resuelto— y `cancelada` ante `N`, otra respuesta o
 * `Ctrl+C` (BR-007, UC-001 paso 5).
 */
export type DesenlaceConfirmacion = 'confirmada' | 'cancelada';

/**
 * Canal de confirmación inyectado por Presentation dentro de la solicitud: es
 * estado de una invocación concreta, no una capacidad permanente del sistema,
 * por eso no es un quinto puerto (DISC-002, `PLANNING_OMISSION`).
 */
export type CanalConfirmacion = () => Promise<DesenlaceConfirmacion>;

/** Solicitud en bruto que Presentation traslada al caso de uso `crearPlaylistVacia`. */
export interface SolicitudCreacion {
  /** Nombre tal como lo aportó el usuario, sin recortar. */
  readonly nombre: string;
  /** Descripción opcional aportada por el usuario; puede omitirse. */
  readonly descripcion?: string;
  /** Estado detectado de los indicadores de visibilidad. */
  readonly visibilidad: EntradaVisibilidad;
  /**
   * Confirmación final de la invocación (DISC-002). El caso de uso la invoca
   * después de la validación y de los duplicados y antes de crear, porque el
   * orden aprobado la sitúa en el paso 5 de UC-001; si devuelve `cancelada` el
   * resultado es `Cancelado` sin crear ni registrar (BR-007, RNF-006).
   */
  readonly canalConfirmacion: CanalConfirmacion;
  /**
   * Señal de que el usuario eligió la opción 2 del menú de duplicados: omite la
   * comprobación ya resuelta sin repetir la `advertencia` y continúa
   * directamente a la confirmación (UC-001-A1 pasos 4/5, BR-006).
   */
  readonly duplicadoAceptado?: boolean;
}

/** Desenlace: la playlist se creó y se dispone de identificador y enlace. */
export interface Exito {
  readonly resultado: 'exito';
  readonly nombreEfectivo: string;
  readonly visibilidad: Visibilidad;
  readonly descripcionEfectiva: DescripcionEfectiva;
  readonly identificador: string;
  readonly enlace: string;
}

/** Desenlace: la entrada no superó la validación de dominio (BR-004 o BR-005). */
export interface ErrorValidacion {
  readonly resultado: 'errorValidacion';
  /** Campo que falló: longitud del nombre o visibilidad. */
  readonly campo: 'nombre' | 'visibilidad';
}

/** Desenlace: ya existe una playlist propia con el mismo nombre efectivo (BR-006). */
export interface Duplicado {
  readonly resultado: 'duplicado';
  readonly nombreEfectivo: string;
}

/** Desenlace: no hay sesión vigente; no se invoca el gateway (BR-001). */
export interface SinSesion {
  readonly resultado: 'sinSesion';
}

/**
 * Base compartida de los desenlaces que reportan una causa técnica depurada:
 * nunca contiene cuerpos de respuesta, cabeceras ni testigos (RNF-001, RNF-006).
 */
interface ConCausa {
  readonly causa: string;
}

/** Desenlace: Spotify respondió 401 (UC-001-E2). */
export interface SesionCaducada extends ConCausa {
  readonly resultado: 'sesionCaducada';
}

/** Desenlace: Spotify respondió 403 (UC-001-E2). */
export interface PermisosInsuficientes extends ConCausa {
  readonly resultado: 'permisosInsuficientes';
}

/** Desenlace: el límite 429 persistió tras agotar los reintentos (UC-001-E2). */
export interface LimiteAgotado extends ConCausa {
  readonly resultado: 'limiteAgotado';
}

/** Desenlace: fallo genérico de red o de servicio (UC-001-E2). */
export interface FalloInesperado extends ConCausa {
  readonly resultado: 'falloInesperado';
}

/** Desenlace: el usuario canceló la creación; no genera registro (BR-007). */
export interface Cancelado {
  readonly resultado: 'cancelado';
}

/**
 * Resultado de creación como unión discriminada por `resultado`, con los nueve
 * desenlaces aprobados: `Exito`, `ErrorValidacion`, `Duplicado`, `SinSesion`,
 * `SesionCaducada`, `PermisosInsuficientes`, `LimiteAgotado`, `FalloInesperado`
 * y `Cancelado` (RF-002, BR-003).
 */
export type ResultadoCreacion =
  | Exito
  | ErrorValidacion
  | Duplicado
  | SinSesion
  | SesionCaducada
  | PermisosInsuficientes
  | LimiteAgotado
  | FalloInesperado
  | Cancelado;

/** Sesión vigente mínima que Business necesita para decidir y para crear. */
export interface SesionVigente {
  /** Testigo de acceso vigente; nunca se registra ni se presenta (RNF-001). */
  readonly testigoSesion: string;
}

/** Entrada de creación que Business entrega al puerto `PlaylistGateway` (ARCHITECTURE §4.3). */
export interface EntradaCreacionPlaylist {
  readonly nombreEfectivo: string;
  readonly descripcionEfectiva: DescripcionEfectiva;
  readonly visibilidad: Visibilidad;
  readonly testigoSesion: string;
}

/** Playlist creada por Spotify: identificador y enlace devueltos por la API. */
export interface PlaylistCreada {
  readonly identificador: string;
  readonly enlace: string;
}
