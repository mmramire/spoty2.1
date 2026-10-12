/**
 * Coordinador del flujo de creación de playlist vacía (TASK-014, TC-020).
 *
 * Trazabilidad: `DISC-002 → DISC-006 → OBJ-001 → RF-001, RF-002, RNF-002,
 * RNF-003, RNF-005 → UC-001, UC-001-A1, UC-001-E1, UC-001-E2, UC-001-E3 →
 * AC-001, AC-003, AC-004, AC-005 → TASK-014 → TC-020`.
 *
 * Adaptador delgado (ARCHITECTURE §4.1, §8): el caso de uso y las peticiones
 * llegan inyectados; el coordinador construye la solicitud con el canal de
 * confirmación —pre-resuelto en `confirmada` en comando directo válido sin
 * reingreso (P-001, N-001) e interactivo, con resumen de los datos efectivos
 * y pregunta explícita, en cualquier otro flujo (DISC-006)— y con
 * `duplicadoAceptado` solo cuando procede (UC-001-A1 paso 4). Presenta el
 * resultado `Exito` y cada literal exacto de `MESSAGES` (TASK-011) según el
 * desenlace, gestiona el reingreso de longitud (UC-001-E3), el menú de
 * duplicados `1/2/0` (UC-001-A1) y traduce `Cancelado` en retorno al menú o
 * fin del flujo sin registrar ni añadir literales (BR-007, N-002).
 *
 * No decide reglas de dominio, no importa de `src/data/`, no registra y no
 * ejecuta efectos secundarios más allá de presentar por la capa de
 * presentación (RNF-002, RNF-003, RNF-006).
 */
import type {
  DesenlaceConfirmacion,
  EntradaVisibilidad,
  ErrorValidacion,
  ResultadoCreacion,
  SolicitudCreacion,
} from '../business/playlists/types.js';
import {
  recortarNombre,
  resolverDescripcionEfectiva,
  resolverVisibilidad,
} from '../business/playlists/validacion.js';
import type { CasoUsoCrearPlaylist } from './composicion-crear-playlist.js';
import { confirm, warning } from './console.js';
import { MESSAGES } from './messages.js';
import {
  type EleccionDuplicados,
  type EleccionVisibilidad,
  type EntradaPrompt,
  type ResumenCreacion,
  confirmarCreacion,
  interpretarConfirmacionS,
  promptDescripcionPlaylist,
  promptModificarDescripcion,
  promptNombrePlaylist,
  promptOpcionDuplicados,
  promptVisibilidadPlaylist,
  showError,
  showMessage,
} from './prompts.js';

/** Peticiones inyectadas del flujo de creación (TASK-012); en pruebas se doblan. */
export interface PeticionesCreacion {
  nombre(): Promise<EntradaPrompt>;
  descripcion(): Promise<EntradaPrompt>;
  visibilidad(): Promise<EleccionVisibilidad>;
  /** Con `resumen` se antepone el resumen de los datos efectivos (DISC-006). */
  confirmacion(resumen?: ResumenCreacion): Promise<EntradaPrompt>;
  opcionDuplicados(): Promise<EleccionDuplicados>;
  modificacion(): Promise<EntradaPrompt>;
}

/**
 * Disparador de comando directo (TASK-015): los indicadores ya analizados sin
 * decidir reglas de dominio. Con `confirmacionPreResuelta` la confirmación
 * viaja pre-resuelta en `confirmada` (P-001, N-001); cualquier petición
 * interactiva posterior la convierte en solicitud por el canal (reingreso).
 */
export interface EntradaDirecta {
  readonly nombre: string;
  readonly descripcion?: string;
  readonly visibilidad: EntradaVisibilidad;
  readonly confirmacionPreResuelta: boolean;
}

/** Dependencias del coordinador: caso de uso y peticiones, ambas inyectadas. */
export interface CoordinadorCreacion {
  readonly casoUso: CasoUsoCrearPlaylist;
  readonly peticiones: PeticionesCreacion;
  readonly entradaDirecta?: EntradaDirecta;
}

/**
 * Fin del flujo para el punto de entrada (TASK-015 comando, TASK-016 menú):
 * creación completada, cancelación del usuario (incluye `Ctrl+C` y opción 0)
 * o error ya presentado con su literal exacto.
 */
export type FinalizacionCreacion =
  | { readonly estado: 'creada' }
  | { readonly estado: 'cancelada' }
  | { readonly estado: 'error' };

const CREADA: FinalizacionCreacion = { estado: 'creada' };
const CANCELADA: FinalizacionCreacion = { estado: 'cancelada' };
const ERROR: FinalizacionCreacion = { estado: 'error' };

/** Literales exactos de error por desenlace (TASK-011, RNF-002, UC-001-E1/E2). */
const LITERALES_DE_ERROR = {
  sinSesion: MESSAGES.playlist.noSessionError,
  sesionCaducada: MESSAGES.playlist.sessionExpiredError,
  permisosInsuficientes: MESSAGES.playlist.permissionsError,
  limiteAgotado: MESSAGES.playlist.rateLimitError,
  falloInesperado: MESSAGES.playlist.unexpectedError,
} as const;

/** Datos en bruto de la solicitud; su validez la decide Business (RNF-003). */
interface DatosSolicitud {
  readonly nombre: string;
  readonly descripcion?: string;
  readonly visibilidad: EntradaVisibilidad;
}

/** Estado del flujo de una invocación del coordinador. */
interface Flujo {
  readonly casoUso: CasoUsoCrearPlaylist;
  readonly peticiones: PeticionesCreacion;
  readonly entradaDirecta?: EntradaDirecta;
  /** `true` mientras la confirmación siga pre-resuelta (comando directo sin reingreso). */
  canalPreResuelto: boolean;
}

/** Paso del bucle: reinvocar el caso de uso o finalizar el flujo. */
type PasoFlujo =
  | {
      readonly tipo: 'reinvocar';
      readonly solicitud: SolicitudCreacion;
      readonly datos: DatosSolicitud;
    }
  | { readonly tipo: 'finalizar'; readonly finalizacion: FinalizacionCreacion };

const finalizar = (finalizacion: FinalizacionCreacion): PasoFlujo => ({
  tipo: 'finalizar',
  finalizacion,
});

const reinvocar = (solicitud: SolicitudCreacion, datos: DatosSolicitud): PasoFlujo => ({
  tipo: 'reinvocar',
  solicitud,
  datos,
});

/**
 * Resumen de los datos efectivos de la solicitud que precede a la pregunta
 * final (DISC-006). Los valores los resuelve Business (`recortarNombre`,
 * `resolverVisibilidad`, `resolverDescripcionEfectiva`); si la visibilidad no
 * está resuelta —inalcanzable en el flujo real, porque Business la rechaza
 * antes de solicitar la confirmación— se confirma sin resumen (formato aprobado).
 */
function resumenDe(datos: DatosSolicitud): ResumenCreacion | undefined {
  const visibilidad = resolverVisibilidad(datos.visibilidad);
  if (typeof visibilidad !== 'string') {
    return undefined;
  }
  return {
    nombreEfectivo: recortarNombre(datos.nombre),
    visibilidad,
    descripcionEfectiva: resolverDescripcionEfectiva(datos.descripcion),
  };
}

/**
 * Canal de confirmación de la invocación (DISC-002, BR-007): mientras la
 * confirmación esté pre-resuelta —comando directo válido sin reingreso—
 * resuelve `confirmada` sin peticiones; en cualquier flujo interactivo
 * solicita el resumen y `(s/N): ` y devuelve `cancelada` ante `N`, otra
 * respuesta o `Ctrl+C`, sin crear ni registrar.
 */
async function resolverCanal(flujo: Flujo, datos: DatosSolicitud): Promise<DesenlaceConfirmacion> {
  if (flujo.canalPreResuelto) {
    return 'confirmada';
  }
  const respuesta = await flujo.peticiones.confirmacion(resumenDe(datos));
  if (respuesta.estado === 'abortado') {
    return 'cancelada';
  }
  return interpretarConfirmacionS(respuesta.valor) ? 'confirmada' : 'cancelada';
}

/** Toda petición interactiva convierte la confirmación en solicitud por el canal. */
async function pedir<T>(flujo: Flujo, peticion: () => Promise<T>): Promise<T> {
  flujo.canalPreResuelto = false;
  return peticion();
}

function crearFlujo(coordinador: CoordinadorCreacion): Flujo {
  return {
    casoUso: coordinador.casoUso,
    peticiones: coordinador.peticiones,
    entradaDirecta: coordinador.entradaDirecta,
    canalPreResuelto: coordinador.entradaDirecta?.confirmacionPreResuelta === true,
  };
}

/**
 * La solicitud lleva su propio canal, construido con los datos de esta
 * invocación: así la confirmación puede presentar su resumen (DISC-006).
 */
function construirSolicitud(
  datos: DatosSolicitud,
  flujo: Flujo,
  duplicadoAceptado = false
): SolicitudCreacion {
  return {
    nombre: datos.nombre,
    descripcion: datos.descripcion,
    visibilidad: datos.visibilidad,
    canalConfirmacion: async () => resolverCanal(flujo, datos),
    ...(duplicadoAceptado ? { duplicadoAceptado: true } : {}),
  };
}

/**
 * UC-001 paso 3: en comando directo se usan los indicadores analizados; en
 * menú se piden nombre, descripción y visibilidad en ese orden. El aborto con
 * `Ctrl+C` en cualquier petición termina el flujo sin invocar el caso de uso.
 */
async function datosIniciales(flujo: Flujo): Promise<DatosSolicitud | null> {
  const entrada = flujo.entradaDirecta;
  if (entrada !== undefined) {
    return {
      nombre: entrada.nombre,
      descripcion: entrada.descripcion,
      visibilidad: entrada.visibilidad,
    };
  }
  const nombre = await pedir(flujo, () => flujo.peticiones.nombre());
  if (nombre.estado === 'abortado') {
    return null;
  }
  const descripcion = await pedir(flujo, () => flujo.peticiones.descripcion());
  if (descripcion.estado === 'abortado') {
    return null;
  }
  const visibilidad = await pedir(flujo, () => flujo.peticiones.visibilidad());
  if (visibilidad.estado === 'abortado') {
    return null;
  }
  return {
    nombre: nombre.valor,
    descripcion: descripcion.valor,
    visibilidad: visibilidad.visibilidad,
  };
}

/**
 * UC-001-E3: la longitud inválida muestra su literal exacto y repite la
 * petición de nombre conservando descripción y visibilidad; la visibilidad
 * inválida muestra su literal y no continúa hasta corregir la invocación.
 */
async function evaluarValidacion(
  resultado: ErrorValidacion,
  datos: DatosSolicitud,
  flujo: Flujo
): Promise<PasoFlujo> {
  if (resultado.campo === 'visibilidad') {
    showError(MESSAGES.playlist.visibilityFlagError);
    return finalizar(ERROR);
  }
  showError(MESSAGES.playlist.nameLengthError);
  const nombre = await pedir(flujo, () => flujo.peticiones.nombre());
  if (nombre.estado === 'abortado') {
    return finalizar(CANCELADA);
  }
  const datosNuevo = { ...datos, nombre: nombre.valor };
  return reinvocar(construirSolicitud(datosNuevo, flujo), datosNuevo);
}

/**
 * UC-001-A1 paso 3: con `1` se repite el nombre y se pregunta si se modifica
 * descripción y visibilidad; con `s` se repiten esas peticiones y con otra
 * respuesta se conservan los valores antes de reinvocar sin duplicadoAceptado.
 */
async function modificarTrasDuplicado(datos: DatosSolicitud, flujo: Flujo): Promise<PasoFlujo> {
  const nombre = await pedir(flujo, () => flujo.peticiones.nombre());
  if (nombre.estado === 'abortado') {
    return finalizar(CANCELADA);
  }
  const modificacion = await pedir(flujo, () => flujo.peticiones.modificacion());
  if (modificacion.estado === 'abortado') {
    return finalizar(CANCELADA);
  }
  const datosNuevo = { ...datos, nombre: nombre.valor };
  if (!interpretarConfirmacionS(modificacion.valor)) {
    return reinvocar(construirSolicitud(datosNuevo, flujo), datosNuevo);
  }
  const descripcion = await pedir(flujo, () => flujo.peticiones.descripcion());
  if (descripcion.estado === 'abortado') {
    return finalizar(CANCELADA);
  }
  const visibilidad = await pedir(flujo, () => flujo.peticiones.visibilidad());
  if (visibilidad.estado === 'abortado') {
    return finalizar(CANCELADA);
  }
  const datosModificados = {
    nombre: nombre.valor,
    descripcion: descripcion.valor,
    visibilidad: visibilidad.visibilidad,
  };
  return reinvocar(construirSolicitud(datosModificados, flujo), datosModificados);
}

/**
 * UC-001-A1: muestra el literal del duplicado con el nombre efectivo y el menú
 * `1/2/0`. Con `2` se reinvoca con `duplicadoAceptado: true` —Business omite
 * la comprobación ya resuelta y solicita la confirmación por el canal—; con
 * `0` se muestra la cancelación sin invocar el caso de uso ni añadir registro.
 */
async function evaluarDuplicado(
  nombreEfectivo: string,
  datos: DatosSolicitud,
  flujo: Flujo
): Promise<PasoFlujo> {
  showMessage(warning(MESSAGES.playlist.duplicate(nombreEfectivo)));
  const eleccion = await pedir(flujo, () => flujo.peticiones.opcionDuplicados());
  if (eleccion.estado === 'abortado') {
    return finalizar(CANCELADA);
  }
  if (eleccion.opcion === '0') {
    showMessage(MESSAGES.playlist.cancelled);
    return finalizar(CANCELADA);
  }
  if (eleccion.opcion === '2') {
    return reinvocar(construirSolicitud(datos, flujo, true), datos);
  }
  return modificarTrasDuplicado(datos, flujo);
}

/** Presenta cada desenlace con su literal exacto (TASK-011, AC-001, AC-004). */
async function evaluarDesenlace(
  resultado: ResultadoCreacion,
  datos: DatosSolicitud,
  flujo: Flujo
): Promise<PasoFlujo> {
  switch (resultado.resultado) {
    case 'exito':
      showMessage(
        confirm(
          MESSAGES.playlist.created(
            resultado.nombreEfectivo,
            resultado.visibilidad,
            resultado.descripcionEfectiva,
            resultado.identificador,
            resultado.enlace
          )
        )
      );
      return finalizar(CREADA);
    case 'errorValidacion':
      return evaluarValidacion(resultado, datos, flujo);
    case 'duplicado':
      return evaluarDuplicado(resultado.nombreEfectivo, datos, flujo);
    case 'cancelado':
      // BR-007: retorno al menú o fin del flujo sin registrar ni literales.
      return finalizar(CANCELADA);
    default:
      showError(LITERALES_DE_ERROR[resultado.resultado]);
      return finalizar(ERROR);
  }
}

/**
 * Coordina el flujo de creación completo: construye la solicitud con el canal
 * de confirmación inyectado, invoca el caso de uso y traduce cada desenlace
 * hasta finalizar, reinvocando en los bucles de reingreso y de duplicados
 * (UC-001, UC-001-A1, UC-001-E3; ARCHITECTURE §6.2, §6.4, §6.5, §6.7).
 */
export async function ejecutarFlujoCreacion(
  coordinador: CoordinadorCreacion
): Promise<FinalizacionCreacion> {
  const flujo = crearFlujo(coordinador);
  const datosInicia = await datosIniciales(flujo);
  if (datosInicia === null) {
    return CANCELADA;
  }
  let solicitud = construirSolicitud(datosInicia, flujo);
  let datos = datosInicia;
  for (;;) {
    const resultado = await flujo.casoUso(solicitud);
    const paso = await evaluarDesenlace(resultado, datos, flujo);
    if (paso.tipo === 'finalizar') {
      return paso.finalizacion;
    }
    solicitud = paso.solicitud;
    datos = paso.datos;
  }
}

/** Peticiones sobre `readline` real de `prompts.ts` (TASK-012) para producción. */
export const peticionesDeTerminal: PeticionesCreacion = {
  nombre: () => promptNombrePlaylist(),
  descripcion: () => promptDescripcionPlaylist(),
  visibilidad: () => promptVisibilidadPlaylist(),
  confirmacion: (resumen) => confirmarCreacion(resumen),
  opcionDuplicados: () => promptOpcionDuplicados(),
  modificacion: () => promptModificarDescripcion(),
};
