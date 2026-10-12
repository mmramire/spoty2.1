/**
 * Predicados puros de validación de nombre, descripción, visibilidad y
 * duplicados contra listas propias.
 *
 * Trazabilidad:
 * - OBJ-001 → RF-001 → UC-001, UC-001-E3 → AC-002, AC-005 → TASK-005 → TC-007.
 * - OBJ-001 → RF-001 → UC-001-A1 → AC-005 → TASK-006 → TC-008.
 *
 * Funciones puras sin efectos secundarios: sin red, sin disco y sin terminal
 * (RNF-003, RNF-005). Este módulo no importa de Presentation, del punto de
 * entrada ni de Data, y no declara tipos inseguros.
 */
import type {
  DescripcionEfectiva,
  EntradaVisibilidad,
  ErrorValidacion,
  Visibilidad,
} from './types.js';

/** Longitud mínima de nombre en caracteres visibles tras recorte (BR-004). */
const LONGITUD_MINIMA = 3;

/** Longitud máxima de nombre en caracteres visibles tras recorte (BR-004). */
const LONGITUD_MAXIMA = 100;

/** Descripción por defecto aprobada cuando no se aporta ninguna (RF-001, P-004). */
const DESCRIPCION_POR_DEFECTO = 'Playlist sin descripción';

/**
 * Recorte único de espacios en extremos. La ausencia equivale a cadena vacía:
 * nombre ausente en comando directo y descripción omitida (P-004, RF-001).
 */
function recortar(texto: string | undefined): string {
  return (texto ?? '').trim();
}

/** Cuenta caracteres visibles como puntos de código, sin mitades sueltas de surrogate. */
function contarVisibles(texto: string): number {
  return [...texto].length;
}

/** Nombre efectivo: valor aportado con los espacios extremos eliminados (BR-004). */
export function recortarNombre(nombre: string): string {
  return recortar(nombre);
}

/**
 * BR-004: `true` cuando el nombre, recortado en extremos, mide de 3 a 100
 * caracteres visibles. Vacío, solo espacios y nombre ausente quedan rechazados.
 */
export function esLongitudValida(nombre: string | undefined): boolean {
  const longitud = contarVisibles(recortar(nombre));
  return longitud >= LONGITUD_MINIMA && longitud <= LONGITUD_MAXIMA;
}

/**
 * RF-001: valor aportado no vacío o `"Playlist sin descripción"` cuando la
 * descripción es vacía o solo espacios (definición general de vacío de P-004).
 */
export function resolverDescripcionEfectiva(descripcion?: string): DescripcionEfectiva {
  const texto = recortar(descripcion);
  return texto === '' ? DESCRIPCION_POR_DEFECTO : texto;
}

/**
 * BR-005: visibilidad obligatoria y excluyente. Un único indicador produce la
 * visibilidad; la ausencia o la doble presencia produce `ErrorValidacion` de
 * visibilidad. La modalidad colaborativa no es representable (P-001).
 */
export function resolverVisibilidad(entrada: EntradaVisibilidad): Visibilidad | ErrorValidacion {
  if (entrada === 'ausente' || entrada === 'doble') {
    return { resultado: 'errorValidacion', campo: 'visibilidad' };
  }
  return entrada;
}

/**
 * BR-006 (UC-001-A1): `true` únicamente cuando, tras recortar espacios en
 * extremos, el nombre efectivo es exactamente igual —y sensible a mayúsculas—
 * a alguno de los nombres de la lista de propias recibida (`Viaje 2026 `
 * coincide con `Viaje 2026`; `Viaje` no coincide con `viaje`).
 *
 * Solo recibe las listas propias ya filtradas por Data, de modo que las listas
 * ajenas homónimas no cuentan: no llegan a este predicado. Función pura, sin
 * red, sin disco y sin mutar la lista recibida.
 */
export function esDuplicadoPropio(nombreEfectivo: string, propias: readonly string[]): boolean {
  const objetivo = recortar(nombreEfectivo);
  return propias.some((propia) => recortar(propia) === objetivo);
}
