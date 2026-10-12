/**
 * Clasificación de errores de Data en resultados de dominio.
 *
 * Trazabilidad: OBJ-001 → RF-002, RNF-001 → UC-001-E1, UC-001-E2 → AC-004 →
 * TASK-007 → TC-009.
 *
 * Función pura sin efectos secundarios: no compone mensajes de usuario (los
 * literales aprobados de RF-002 los elige Presentation), no registra, no espera
 * ni accede a red, ficheros ni terminal (RNF-003, RNF-005). El error de Data se
 * describe de forma estructural —igual que en `politica-reintento.ts`— de modo
 * que Business no importa de Data (RNF-003).
 *
 * La causa devuelta siempre pasa por depuración: sin cuerpos de respuesta, sin
 * cabeceras y sin testigos (RNF-001, AC-004).
 */
import type {
  FalloInesperado,
  LimiteAgotado,
  PermisosInsuficientes,
  SesionCaducada,
  SinSesion,
} from './types.js';

/** Desenlace de dominio derivado de un error de Data o de la ausencia de sesión. */
export type DesenlaceErrorData =
  | SinSesion
  | SesionCaducada
  | PermisosInsuficientes
  | LimiteAgotadoConReintento
  | FalloInesperado;

/**
 * `LimiteAgotado` con el dato de reintento de `Retry-After` conservado para la
 * política de reintentos del caso de uso (TASK-009). Es subtipo del desenlace
 * aprobado de TASK-001, que no se modifica.
 */
export interface LimiteAgotadoConReintento extends LimiteAgotado {
  readonly reintentoTras?: number;
}

/**
 * Forma estructural del error tipado de Data: no depende de la clase concreta
 * que Data lanza, solo de estos campos (RNF-003).
 */
export interface ErrorTipadoData {
  readonly estado: number;
  readonly causa?: string;
  readonly reintentoTras?: number;
}

/** Estados HTTP que definen los desenlaces de UC-001-E2. */
const ESTADO_SESION_CADUCADA = 401;
const ESTADO_PERMISOS_INSUFICIENTES = 403;
const ESTADO_LIMITE = 429;

/** Marcadores técnicos de causa, no literales de usuario. */
const CAUSA_SIN_DETALLE = 'error sin causa detallada';
const MARCA_DATO_OMITIDO = '[dato omitido]';
const MARCA_CUERPO_OMITIDO = '[cuerpo omitido]';
const SUFIJO_TRUNCADO = '...';
/** Tope de la causa: un cuerpo de respuesta jamás llega completo al dominio. */
const LONGITUD_MAXIMA_CAUSA = 200;

/** Patrones de testigo, cabecera o credencial (RNF-001). */
const PATRONES_SECRETOS: readonly RegExp[] = [
  /\bbearer\s+[^,;\s"']+/gi,
  /\bauthorization\b"?\s*[:=]\s*[^,;\n]*/gi,
  /\b(set-cookie|cookie)\b"?\s*[:=]\s*[^,;\n]*/gi,
  /\b(access_token|refresh_token|id_token)\b"?\s*[:=]\s*"?[^,;\s"'}]+/gi,
  /\beyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}/g,
];
/** Fragmentos JSON embebidos: se tratan como cuerpo de respuesta (RNF-001). */
const PATRON_CUERPO_JSON = /\{[^{}]*\}/g;

function esErrorTipadoData(error: unknown): error is ErrorTipadoData {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const candidato = error as { estado?: unknown; causa?: unknown; reintentoTras?: unknown };
  return (
    typeof candidato.estado === 'number' &&
    (candidato.causa === undefined || typeof candidato.causa === 'string') &&
    (candidato.reintentoTras === undefined || typeof candidato.reintentoTras === 'number')
  );
}

/** Origen textual de la causa: campo propio, mensaje del error o ausencia. */
function origenDeCausa(error: unknown): string | undefined {
  if (typeof error === 'string') {
    return error;
  }
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }
  const candidato = error as { causa?: unknown; message?: unknown };
  if (typeof candidato.causa === 'string') {
    return candidato.causa;
  }
  return typeof candidato.message === 'string' ? candidato.message : undefined;
}

function esCuerpoJson(texto: string): boolean {
  const recortado = texto.trim();
  if (!recortado.startsWith('{') && !recortado.startsWith('[')) {
    return false;
  }
  try {
    JSON.parse(recortado);
    return true;
  } catch {
    return false;
  }
}

/** Depura un texto: omite cuerpos JSON y patrones de testigo, cabecera o credencial. */
function depurarTexto(texto: string): string {
  if (esCuerpoJson(texto)) {
    return MARCA_CUERPO_OMITIDO;
  }
  let depurado = texto.replace(PATRON_CUERPO_JSON, MARCA_CUERPO_OMITIDO);
  for (const patron of PATRONES_SECRETOS) {
    depurado = depurado.replace(patron, MARCA_DATO_OMITIDO);
  }
  if (depurado.length > LONGITUD_MAXIMA_CAUSA) {
    return `${depurado.slice(0, LONGITUD_MAXIMA_CAUSA)}${SUFIJO_TRUNCADO}`;
  }
  return depurado;
}

/** Resuelve la causa técnica depurada que acompañará al desenlace (RNF-001). */
function depurarCausa(origen: string | undefined, estado: number | undefined): string {
  const base = origen?.trim() ?? '';
  if (base.length > 0) {
    return depurarTexto(base);
  }
  if (typeof estado === 'number' && Number.isFinite(estado)) {
    return `HTTP ${estado}`;
  }
  return CAUSA_SIN_DETALLE;
}

function limiteAgotado(
  causa: string,
  reintentoTras: number | undefined
): LimiteAgotadoConReintento {
  if (reintentoTras === undefined) {
    return { resultado: 'limiteAgotado', causa };
  }
  return { resultado: 'limiteAgotado', causa, reintentoTras };
}

/** Desenlace de fallo genérico con la causa ya resuelta y depurada (RNF-001). */
function falloInesperadoCon(causa: string): FalloInesperado {
  return { resultado: 'falloInesperado', causa };
}

/** Mapea el estado HTTP del error de Data al desenlace de dominio (UC-001-E2). */
function desenlacePorEstado(error: ErrorTipadoData): DesenlaceErrorData {
  const causa = depurarCausa(origenDeCausa(error), error.estado);
  switch (error.estado) {
    case ESTADO_SESION_CADUCADA:
      return { resultado: 'sesionCaducada', causa };
    case ESTADO_PERMISOS_INSUFICIENTES:
      return { resultado: 'permisosInsuficientes', causa };
    case ESTADO_LIMITE:
      return limiteAgotado(causa, error.reintentoTras);
    default:
      return falloInesperadoCon(causa);
  }
}

/**
 * Clasifica la ausencia de sesión o el error tipado de Data en el resultado de
 * dominio correspondiente (ARCHITECTURE §6.6):
 *
 * - `null` o `undefined` → `SinSesion` (ausencia de sesión, UC-001-E1; la misma
 *   convención que `SesionProveedor.obtenerSesionVigente()`);
 * - `401` → `SesionCaducada`;
 * - `403` → `PermisosInsuficientes`;
 * - `429` persistente tras agotar reintentos → `LimiteAgotado`, conservando
 *   `reintentoTras` para TASK-009;
 * - cualquier otro caso → `FalloInesperado` con causa depurada.
 */
export function clasificarErrorData(error: unknown): DesenlaceErrorData {
  if (error === null || error === undefined) {
    return { resultado: 'sinSesion' };
  }
  if (esErrorTipadoData(error)) {
    return desenlacePorEstado(error);
  }
  return falloInesperadoCon(depurarCausa(origenDeCausa(error), undefined));
}
