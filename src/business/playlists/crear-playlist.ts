/**
 * Caso de uso `crearPlaylistVacia`: sesión, validación, duplicados,
 * confirmación y creación con las dependencias inyectadas.
 *
 * Trazabilidad: `DISC-002 → OBJ-001 → RF-001, RF-002, RNF-001, RNF-003,
 * RNF-005, RNF-006 → UC-001, UC-001-A1, UC-001-E1, UC-001-E2, UC-001-E3 →
 * AC-001, AC-004, AC-005 → TASK-008, TASK-009 → TC-010, TC-011, TC-012,
 * TC-013, TC-014, TC-015`.
 *
 * Orden obligatorio del flujo (UC-001, ARCHITECTURE §6): sesión → validación →
 * listado/duplicados → confirmación → `info` de inicio → creación (con la
 * política de reintento ante 429, ADR-001) → `info` de éxito, o bien `error`
 * final con causa depurada ante fallo de servicio (ARCHITECTURE §6.6).
 *
 * Adaptador reutilizable por clientes no CLI (RNF-003, ARCHITECTURE §8): no
 * recibe parámetros de línea de comandos ni terminal, no importa Presentation,
 * y no hace red, disco ni registro directo: solo consume los cuatro puertos de
 * `DependenciasCreacion` y el canal de confirmación inyectado en la solicitud
 * (DISC-002). Los mensajes técnicos de registro no son literales de usuario
 * (RF-002 los compone Presentation a partir del resultado).
 */
import { withRetry } from '../retry/retry.js';
import { clasificarErrorData } from './errores.js';
import { politicaReintento429 } from './politica-reintento.js';
import type { DependenciasCreacion, RegistroTecnico } from './puertos.js';
import type {
  DescripcionEfectiva,
  Duplicado,
  ErrorValidacion,
  PlaylistCreada,
  ResultadoCreacion,
  SesionVigente,
  SolicitudCreacion,
  Visibilidad,
} from './types.js';
import {
  esDuplicadoPropio,
  esLongitudValida,
  recortarNombre,
  resolverDescripcionEfectiva,
  resolverVisibilidad,
} from './validacion.js';

/** Mensaje técnico del `info` de inicio (RNF-006, ARCHITECTURE §10). */
const MENSAJE_INICIO = 'Inicio de creación de playlist vacía';

/** Mensaje técnico del `info` de éxito (RNF-006, ARCHITECTURE §10). */
const MENSAJE_EXITO = 'Playlist creada con éxito';

/** Mensaje técnico de la `advertencia` por duplicado (RNF-006, BR-006). */
const MENSAJE_DUPLICADO = 'Duplicado detectado contra listas propias';

/** Mensaje técnico del `error` final cuando la creación no se completa (UC-001-E2). */
const MENSAJE_ERROR_FINAL = 'Creación de playlist no completada';

/** Entrada que superó la validación de dominio y ya está lista para crear. */
interface EntradaValidada {
  readonly nombreEfectivo: string;
  readonly visibilidad: Visibilidad;
  readonly descripcionEfectiva: DescripcionEfectiva;
}

/**
 * BR-004 y BR-005: valida longitud del nombre y visibilidad en ese orden, sin
 * efectos secundarios. Mientras la entrada siga inválida no se lista ni se crea
 * (UC-001-E3) y no se llega a invocar el canal de confirmación.
 */
function validarEntrada(solicitud: SolicitudCreacion): EntradaValidada | ErrorValidacion {
  if (!esLongitudValida(solicitud.nombre)) {
    return { resultado: 'errorValidacion', campo: 'nombre' };
  }
  const visibilidad = resolverVisibilidad(solicitud.visibilidad);
  if (typeof visibilidad !== 'string') {
    return visibilidad;
  }
  return {
    nombreEfectivo: recortarNombre(solicitud.nombre),
    visibilidad,
    descripcionEfectiva: resolverDescripcionEfectiva(solicitud.descripcion),
  };
}

/**
 * BR-006 (UC-001-A1): lista propias solo con nombre sintácticamente válido y
 * devuelve `Duplicado` con el nombre efectivo, emitiendo la `advertencia` con el
 * nombre (RNF-006). Con `duplicadoAceptado: true` la comprobación ya resuelta
 * por la opción 2 se omite por completo —sin repetir la advertencia— y se
 * continúa directamente a la confirmación.
 */
async function comprobarDuplicado(
  solicitud: SolicitudCreacion,
  entrada: EntradaValidada,
  dependencias: DependenciasCreacion
): Promise<Duplicado | null> {
  if (solicitud.duplicadoAceptado === true) {
    return null;
  }
  const propias = await dependencias.playlistGateway.listarPlaylistsPropias();
  if (!esDuplicadoPropio(entrada.nombreEfectivo, propias)) {
    return null;
  }
  dependencias.registroTecnico.advertencia(MENSAJE_DUPLICADO, {
    nombre: entrada.nombreEfectivo,
  });
  return { resultado: 'duplicado', nombreEfectivo: entrada.nombreEfectivo };
}

/**
 * Envoltura de reintentos (TASK-004, ADR-001): la ordenación de creación se
 * ejecuta bajo `politicaReintento429` con `Espera` y `RegistroTecnico`
 * inyectados —sin temporizadores propios ni Pino en Business (RNF-003,
 * RNF-005)— emitiendo la `advertencia` de cada reintento con intento y estado
 * (RNF-006). Solo los reintentos 429 se reintentan: cualquier otro error se
 * propaga de inmediato a la clasificación.
 */
async function crearConPoliticaReintento(
  entrada: EntradaValidada,
  sesion: SesionVigente,
  dependencias: DependenciasCreacion
): Promise<PlaylistCreada> {
  const { playlistGateway, registroTecnico, espera } = dependencias;
  const { nombreEfectivo, visibilidad, descripcionEfectiva } = entrada;
  return withRetry(
    () =>
      playlistGateway.crearPlaylist({
        nombreEfectivo,
        descripcionEfectiva,
        visibilidad,
        testigoSesion: sesion.testigoSesion,
      }),
    politicaReintento429,
    {},
    { espera, registro: registroTecnico }
  );
}

/**
 * Clasificación del fallo de creación (UC-001-E2, ARCHITECTURE §6.6): traduce
 * el error propagado a su desenlace de dominio y emite el `error` final con la
 * causa depurada cuando el desenlace la aporta (los desenlaces sin causa, como
 * `SinSesion`, no registran: RNF-001, AC-004).
 */
function clasificarFalloCreacion(
  error: unknown,
  registroTecnico: RegistroTecnico
): ResultadoCreacion {
  const desenlace = clasificarErrorData(error);
  if ('causa' in desenlace) {
    registroTecnico.error(MENSAJE_ERROR_FINAL, { causa: desenlace.causa });
  }
  return desenlace;
}

/**
 * Tras la confirmación ya no hay posibilidad de cancelación: se emite el `info`
 * de inicio, se ordena la creación bajo la política de reintento de TASK-004
 * (ADR-001) y, si completa, se emite el `info` de éxito con nombre,
 * visibilidad, descripción efectiva e identificador (RNF-006, RNF-001).
 *
 * UC-001-E2: si el gateway rechaza, el error se clasifica con
 * `clasificarErrorData` (401, 403, 429 persistente o fallo genérico) y se
 * emite el `error` final con la causa depurada cuando el desenlace la aporta.
 */
async function crearTrasConfirmacion(
  entrada: EntradaValidada,
  sesion: SesionVigente,
  dependencias: DependenciasCreacion
): Promise<ResultadoCreacion> {
  const { registroTecnico } = dependencias;
  const { nombreEfectivo, visibilidad, descripcionEfectiva } = entrada;
  const datos = { nombre: nombreEfectivo, visibilidad, descripcionEfectiva };
  registroTecnico.info(MENSAJE_INICIO, datos);

  let creada: PlaylistCreada;
  try {
    creada = await crearConPoliticaReintento(entrada, sesion, dependencias);
  } catch (error) {
    return clasificarFalloCreacion(error, registroTecnico);
  }

  registroTecnico.info(MENSAJE_EXITO, { ...datos, identificador: creada.identificador });
  return {
    resultado: 'exito',
    nombreEfectivo,
    visibilidad,
    descripcionEfectiva,
    identificador: creada.identificador,
    enlace: creada.enlace,
  };
}

/**
 * Crea una playlist vacía con la solicitud en bruto y las dependencias
 * inyectadas, produciendo uno de los desenlaces de `ResultadoCreacion`.
 *
 * - Sin sesión vigente → `SinSesion` sin invocar el gateway (BR-001).
 * - Entrada inválida → `ErrorValidacion` sin listar ni crear (BR-004, BR-005).
 * - Duplicado → `Duplicado` con `advertencia`, salvo duplicado aceptado.
 * - Canal `cancelada` → `Cancelado` sin crear y sin ningún registro (BR-007).
 * - Canal `confirmada` → `info` de inicio, creación con la política de
 *   reintento 429 e `info` de éxito (RNF-006).
 * - Error de servicio → UC-001-E2: `SesionCaducada` (401),
 *   `PermisosInsuficientes` (403), `LimiteAgotado` (429 tras agotar los
 *   reintentos) o `FalloInesperado`, cada uno con `error` final de causa
 *   depurada (AC-004, TASK-009).
 */
export async function crearPlaylistVacia(
  solicitud: SolicitudCreacion,
  dependencias: DependenciasCreacion
): Promise<ResultadoCreacion> {
  const sesion = await dependencias.sesionProveedor.obtenerSesionVigente();
  if (sesion === null) {
    return { resultado: 'sinSesion' };
  }

  const entrada = validarEntrada(solicitud);
  if ('resultado' in entrada) {
    return entrada;
  }

  const duplicado = await comprobarDuplicado(solicitud, entrada, dependencias);
  if (duplicado !== null) {
    return duplicado;
  }

  const confirmacion = await solicitud.canalConfirmacion();
  if (confirmacion === 'cancelada') {
    return { resultado: 'cancelado' };
  }

  return crearTrasConfirmacion(entrada, sesion, dependencias);
}
