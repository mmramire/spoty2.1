/**
 * Política de reintento ante 429 para la creación de playlists (ADR-001).
 *
 * Trazabilidad: OBJ-001 → RF-002, RNF-005, RNF-006 → UC-001-E2 → AC-004 →
 * TASK-004 → TC-006.
 *
 * El error se describe de forma estructural (`ErrorConEstado`), de modo que el
 * error tipado que Data lanza satisface la política sin que Business importe de
 * Data (RNF-003). La política no espera por sí misma: `withRetry` ejecuta la
 * espera a través del puerto `Espera` inyectado (ADR-001).
 */
import type { RetryPolicy } from '../retry/retry.js';

/** Reintentos permitidos ante 429: 3, hasta 4 intentos en total (P-003, ADR-001). */
const MAX_REINTENTOS = 3;
/** Espera en milisegundos cuando `Retry-After` no aporta segundos positivos. */
const ESPERA_PREDETERMINADA_MS = 10000;
/** Estado HTTP que define el límite de peticiones de Spotify. */
const ESTADO_LIMITE = 429;

/**
 * Forma estructural del error con estado que la política admite: no depende de
 * la clase concreta que Data lanza, solo de estos campos.
 */
export interface ErrorConEstado {
  readonly estado: number;
  readonly reintentoTras?: number;
}

function esErrorConEstado(error: unknown): error is ErrorConEstado {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const candidato = error as { estado?: unknown; reintentoTras?: unknown };
  return (
    typeof candidato.estado === 'number' &&
    (candidato.reintentoTras === undefined || typeof candidato.reintentoTras === 'number')
  );
}

/**
 * Política 429 de esta feature: máximo 3 reintentos, espera de
 * `reintentoTras * 1000` ms cuando `Retry-After` es mayor que 0 y de 10000 ms
 * en su ausencia, sin temporizadores propios (ADR-001, UC-001-E2).
 */
export const politicaReintento429: RetryPolicy<ErrorConEstado> = {
  maxRetries: MAX_REINTENTOS,
  matchesError: esErrorConEstado,
  shouldRetry: (error, attempt) => attempt < MAX_REINTENTOS && error.estado === ESTADO_LIMITE,
  getDelay: (error, _attempt, retryAfter) => {
    const segundos = retryAfter ?? error.reintentoTras;
    return segundos !== undefined && segundos > 0 ? segundos * 1000 : ESPERA_PREDETERMINADA_MS;
  },
  getRetryAfter: (error) => error.reintentoTras,
  getStatus: (error) => error.estado,
};
