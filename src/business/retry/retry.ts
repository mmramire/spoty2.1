import { getLogger } from '../../data/logging/pino-setup.js';
import { AuthError, isTransientError } from '../auth/errors.js';
import type { CamposRegistro, Espera, RegistroTecnico } from '../playlists/puertos.js';

const MAX_RETRIES = 2;

/**
 * Política de reintento tipada sobre el error `E` que maneja cada flujo.
 *
 * `matchesError`, `getRetryAfter` y `getStatus` son opcionales para conservar
 * sin cambios las políticas ya existentes (TC-005); cuando se omiten, el error
 * pertenece a la política solo si es `AuthError` y no se extraen estado ni
 * `Retry-After` adicionales.
 */
export interface RetryPolicy<E = AuthError> {
  maxRetries: number;
  shouldRetry: (error: E, attempt: number) => boolean;
  getDelay: (error: E, attempt: number, retryAfter?: number) => number;
  /** Dominio de errores de la política; por defecto, únicamente `AuthError`. */
  matchesError?: (error: unknown) => error is E;
  /** Segundos de espera `Retry-After` cuando el error los aporta. */
  getRetryAfter?: (error: E) => number | undefined;
  /** Estado HTTP que acompaña a cada reintento en el registro. */
  getStatus?: (error: E) => number | undefined;
}

/**
 * Inyectables de `withRetry` (ADR-001): la espera y el registro se resuelven
 * fuera de la función, de modo que Business no usa temporizadores propios ni
 * Pino directamente cuando se aportan los puertos `Espera` y `RegistroTecnico`.
 */
export interface InyectablesRetry {
  readonly espera?: Espera;
  readonly registro?: RegistroTecnico;
}

export const defaultRetryPolicy: RetryPolicy = {
  maxRetries: MAX_RETRIES,
  shouldRetry: (error: AuthError, attempt: number) => {
    if (attempt >= MAX_RETRIES) return false;
    return isTransientError(error);
  },
  getDelay: (_error: AuthError, attempt: number, retryAfter?: number) => {
    if (retryAfter && retryAfter > 0) {
      return (retryAfter + 1) * 1000;
    }
    return Math.min(1000 * 2 ** attempt, 10000);
  },
  getRetryAfter: (error: AuthError) => extractRetryAfter(error),
};

/** Espera predefecto: temporizador propio, idéntica al comportamiento anterior. */
const esperaPredefinida: Espera = {
  esperar: (milisegundos) =>
    new Promise<void>((resolve) => {
      setTimeout(resolve, milisegundos);
    }),
};

/** Emisión de eventos de reintento: ruta Pino por defecto o puerto `RegistroTecnico`. */
interface RetryReporter {
  onRetry: (attempt: number, delay: number, status?: number) => void;
  onFailure?: (attempt: number, error: unknown) => void;
  onReject?: (attempt: number, error: unknown) => void;
}

/** Ruta por defecto del flujo de autenticación: conserva el registro Pino actual. */
function pinoReporter(context: Record<string, unknown>): RetryReporter {
  const logger = getLogger();
  return {
    onFailure: (attempt, error) => {
      logger.warn({ ...context, attempt, error: mensajeDe(error) }, 'Operation failed');
    },
    onReject: (_attempt, error) => {
      logger.error(
        { ...context, error: mensajeDe(error) },
        'Max retries exceeded or non-retryable error'
      );
    },
    onRetry: (attempt, delay) => {
      logger.info({ ...context, delay, attempt }, 'Retrying after delay');
    },
  };
}

/**
 * Ruta con el puerto `RegistroTecnico`: cada reintento emite `advertencia` con
 * intento, estado y espera aplicada (RNF-006). El error final lo emite el caso
 * de uso al clasificar el desenlace.
 */
function portReporter(registro: RegistroTecnico): RetryReporter {
  return {
    onRetry: (attempt, delay, status) => {
      const campos: CamposRegistro =
        status === undefined ? { intento: attempt } : { intento: attempt, estado: status };
      registro.advertencia(`Reintento ${attempt} programado; espera de ${delay} ms`, campos);
    },
  };
}

function mensajeDe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function esErrorDePolitica<E>(error: unknown, politica: RetryPolicy<E>): boolean {
  if (politica.matchesError) {
    return politica.matchesError(error);
  }
  return error instanceof AuthError;
}

/**
 * Ejecuta `operation` aplicando la política de reintento. Sin política se
 * conserva el comportamiento de autenticación (2 reintentos, retroceso
 * exponencial y `(retryAfter + 1) * 1000`); con inyectables, la espera pasa por
 * `Espera` y la advertencia de cada reintento por `RegistroTecnico` (ADR-001).
 */
export async function withRetry<T, E = AuthError>(
  operation: () => Promise<T>,
  policy: RetryPolicy<E> | undefined = undefined,
  context: Record<string, unknown> = {},
  inyectables: InyectablesRetry = {}
): Promise<T> {
  // Sin política explícita E se resuelve como AuthError (flujo de autenticación).
  const politica: RetryPolicy<E> = policy ?? (defaultRetryPolicy as unknown as RetryPolicy<E>);
  const reporter: RetryReporter = inyectables.registro
    ? portReporter(inyectables.registro)
    : pinoReporter(context);
  const espera: Espera = inyectables.espera ?? esperaPredefinida;
  return bucleConReintento(operation, politica, reporter, espera);
}

async function bucleConReintento<T, E>(
  operation: () => Promise<T>,
  politica: RetryPolicy<E>,
  reporter: RetryReporter,
  espera: Espera
): Promise<T> {
  let attempt = 0;

  while (true) {
    try {
      return await operation();
    } catch (error) {
      if (!esErrorDePolitica(error, politica)) {
        throw error;
      }
      const fallo = error as E;
      const intento = attempt + 1;
      reporter.onFailure?.(intento, error);

      if (!politica.shouldRetry(fallo, attempt)) {
        reporter.onReject?.(intento, error);
        throw error;
      }

      const delay = politica.getDelay(fallo, attempt, politica.getRetryAfter?.(fallo));
      reporter.onRetry(intento, delay, politica.getStatus?.(fallo));
      await espera.esperar(delay);
      attempt++;
    }
  }
}

function extractRetryAfter(error: AuthError): number | undefined {
  if (error.cause && 'status' in error.cause && error.cause.status === 429) {
    return 1;
  }
  return undefined;
}
