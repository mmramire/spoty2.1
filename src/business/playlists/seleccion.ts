/**
 * Interpretación pura de la entrada del selector múltiple por toggle
 * (superadora sin dependencia de checkbox).
 *
 * Protocolo en Presentation (una línea por turno):
 * - `0` → cancelar
 * - `` (Enter), `ok` o `done` → confirmar selección actual
 * - `all` → marcar todas
 * - `none` → desmarcar todas
 * - `1`, `1,3`, `1 3`, `1-3` → alternar (toggle) esos índices 1-based
 * - resto → inválida (se repite sin perder la selección)
 *
 * Funciones puras y testeables (RNF-003): sin readline ni efectos.
 */

/** Entrada interpretada del selector. */
export type EntradaSeleccion =
	| { readonly tipo: "cancelar" }
	| { readonly tipo: "confirmar" }
	| { readonly tipo: "todas" }
	| { readonly tipo: "ninguna" }
	| { readonly tipo: "alternar"; readonly indices: readonly number[] }
	| { readonly tipo: "invalida" };

/** Expande `1-3` en [1,2,3]; fuera de rango se filtra después. */
function expandirRango(inicio: number, fin: number, total: number): number[] {
	const desde = Math.min(inicio, fin);
	const hasta = Math.max(inicio, fin);
	const salida: number[] = [];
	for (let i = desde; i <= hasta; i++) {
		if (i >= 1 && i <= total) salida.push(i);
	}
	return salida;
}

function parsearToken(token: string, total: number): number[] | null {
	const recortado = token.trim();
	if (recortado === "") return [];
	const rango = recortado.match(/^(\d+)\s*-\s*(\d+)$/);
	if (rango) {
		const inicio = Number.parseInt(rango[1] ?? "", 10);
		const fin = Number.parseInt(rango[2] ?? "", 10);
		if (!Number.isInteger(inicio) || !Number.isInteger(fin)) return null;
		return expandirRango(inicio, fin, total);
	}
	const numero = Number.parseInt(recortado, 10);
	if (!/^\d+$/.test(recortado) || !Number.isInteger(numero)) return null;
	if (numero < 1 || numero > total) return null;
	return [numero];
}

/**
 * Interpreta una línea del selector múltiple contra el total de playlists.
 * Nunca lanza: lo no reconocido es `invalida`.
 */
export function interpretarEntradaSeleccion(
	valor: string,
	total: number,
): EntradaSeleccion {
	const normalizada = valor.trim().toLowerCase();
	if (normalizada === "0") return { tipo: "cancelar" };
	if (normalizada === "" || normalizada === "ok" || normalizada === "done") {
		return { tipo: "confirmar" };
	}
	if (normalizada === "all" || normalizada === "todas")
		return { tipo: "todas" };
	if (normalizada === "none" || normalizada === "ninguna") {
		return { tipo: "ninguna" };
	}
	const tokens = valor.split(/[,\s]+/).filter((t) => t.length > 0);
	if (tokens.length === 0) return { tipo: "invalida" };
	const indices: number[] = [];
	for (const token of tokens) {
		const expandido = parsearToken(token, total);
		if (expandido === null) return { tipo: "invalida" };
		indices.push(...expandido);
	}
	if (indices.length === 0) return { tipo: "invalida" };
	return { tipo: "alternar", indices: [...new Set(indices)] };
}

/**
 * Alterna (toggle) los índices 1-based sobre la selección actual.
 * Devuelve los índices ordenados y sin duplicados.
 */
export function alternarIndices(
	actuales: readonly number[],
	aAlternar: readonly number[],
): readonly number[] {
	const conjunto = new Set(actuales);
	for (const indice of aAlternar) {
		if (conjunto.has(indice)) {
			conjunto.delete(indice);
		} else {
			conjunto.add(indice);
		}
	}
	return [...conjunto].sort((a, b) => a - b);
}
