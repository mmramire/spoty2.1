/**
 * Carga de batches de entrada desde `input/songs/*.json` (capa Data).
 *
 * El formato es estricto (ver `validacion-batch.ts`): exactamente
 * `{"source","tracks"}` y por track exactamente
 * `{"id","uri","name","artists"}`. Data lee disco y delega la
 * validación a Business para no duplicar reglas (RNF-003).
 */
import fs from "node:fs/promises";
import path from "node:path";
import { validarBatchJson } from "../../business/playlists/validacion-batch.js";
import type { BatchCanciones } from "../../business/playlists/types.js";

/** Nombre base de un archivo input disponible. */
export interface ArchivoInput {
	readonly nombre: string;
	readonly ruta: string;
}

/** Lista los `*.json` de `input/songs/` ordenados por nombre. */
export async function listarArchivosInput(
	dirInput = path.resolve("input/songs"),
): Promise<ArchivoInput[]> {
	let entradas: string[];
	try {
		entradas = await fs.readdir(dirInput);
	} catch {
		return [];
	}
	return entradas
		.filter((e) => e.toLowerCase().endsWith(".json"))
		.sort((a, b) => a.localeCompare(b))
		.map((nombre) => ({ nombre, ruta: path.join(dirInput, nombre) }));
}

export type ResultadoCargaBatch =
	| { readonly valida: true; readonly batch: BatchCanciones }
	| { readonly valida: false; readonly motivo: string };

/** Lee y valida en estricto un archivo input ya elegido. */
export async function cargarArchivoBatch(
	ruta: string,
): Promise<ResultadoCargaBatch> {
	let texto: string;
	try {
		texto = await fs.readFile(ruta, "utf-8");
	} catch {
		return { valida: false, motivo: "No se pudo leer el archivo elegido." };
	}
	let datos: unknown;
	try {
		datos = JSON.parse(texto);
	} catch {
		return { valida: false, motivo: "El archivo no es un JSON válido." };
	}
	const validado = validarBatchJson(datos);
	if (!validado.valida) return validado;
	return { valida: true, batch: validado.batch };
}
