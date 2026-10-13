/**
 * Carga de portadas desde `input/covers/*` (capa Data).
 *
 * Acepta `*.jpg`/`*.jpeg`, valida JPEG real y tope de 256 KB de
 * payload Base64 delegando en Business (`validacion-portada.ts`).
 */
import fs from "node:fs/promises";
import path from "node:path";
import { validarPortadaBytes } from "../../business/playlists/validacion-portada.js";

/** Imagen candidata disponible en `input/covers/`. */
export interface ArchivoPortada {
	readonly nombre: string;
	readonly ruta: string;
}

/** Lista los JPEG de `input/covers/` ordenados por nombre. */
export async function listarPortadas(
	dirCovers = path.resolve("input/covers"),
): Promise<ArchivoPortada[]> {
	let entradas: string[];
	try {
		entradas = await fs.readdir(dirCovers);
	} catch {
		return [];
	}
	return entradas
		.filter((e) => /\.jpe?g$/i.test(e))
		.sort((a, b) => a.localeCompare(b))
		.map((nombre) => ({ nombre, ruta: path.join(dirCovers, nombre) }));
}

export type ResultadoCargaPortada =
	| { readonly valida: true; readonly base64: string }
	| { readonly valida: false; readonly motivo: string };

/** Lee y valida en estricto una portada ya elegida. */
export async function cargarPortada(
	ruta: string,
): Promise<ResultadoCargaPortada> {
	let bytes: Buffer;
	try {
		bytes = await fs.readFile(ruta);
	} catch {
		return { valida: false, motivo: "No se pudo leer la imagen elegida." };
	}
	const base64 = bytes.toString("base64");
	const validada = validarPortadaBytes(bytes, base64);
	if (!validada.valida) return validada;
	return { valida: true, base64: validada.base64 };
}
