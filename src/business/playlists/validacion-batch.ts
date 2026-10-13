/**
 * Validación pura del batch de entrada `input/songs/*.json` (formato estricto 2).
 *
 * Forma estricta:
 * ```json
 * {
 *   "source": "2026-10-12_21-36-16-download_songs.json",
 *   "tracks": [
 *     { "id": "...", "uri": "spotify:track:...", "name": "...", "artists": ["..."] }
 *   ]
 * }
 * ```
 *
 * Función pura sin efectos secundarios (RNF-003): no lee disco ni red.
 * El loader de Data lee el archivo y delega aquí la validación.
 */
import type { BatchCanciones, CancionBatch } from "./types.js";

const PATRON_URI_TRACK = /^spotify:track:[A-Za-z0-9]{22}$/;
const PATRON_ID_TRACK = /^[A-Za-z0-9]{22}$/;

function esRegistro(valor: unknown): valor is Record<string, unknown> {
	return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function esCadenaNoVacia(valor: unknown): valor is string {
	return typeof valor === "string" && valor.trim().length > 0;
}

function validarCancion(
	valor: unknown,
): { valida: true; cancion: CancionBatch } | { valida: false } {
	if (!esRegistro(valor)) return { valida: false };
	const { id, uri, name, artists } = valor;
	if (!esCadenaNoVacia(id) || !PATRON_ID_TRACK.test(id.trim())) {
		return { valida: false };
	}
	if (!esCadenaNoVacia(uri) || !PATRON_URI_TRACK.test(uri.trim())) {
		return { valida: false };
	}
	if (!esCadenaNoVacia(name)) return { valida: false };
	if (!Array.isArray(artists) || artists.length === 0) return { valida: false };
	for (const artista of artists) {
		if (!esCadenaNoVacia(artista)) return { valida: false };
	}
	// Coherencia id ↔ uri: el id debe ser el sufijo del uri.
	if (uri.trim() !== `spotify:track:${id.trim()}`) return { valida: false };
	return {
		valida: true,
		cancion: {
			id: id.trim(),
			uri: uri.trim(),
			name: name.trim(),
			artists: artists.map((a) => String(a).trim()),
		},
	};
}

export type ResultadoValidacionBatch =
	| { readonly valida: true; readonly batch: BatchCanciones }
	| { readonly valida: false; readonly motivo: string };

/**
 * Valida el JSON parseado del archivo input en forma estricta.
 * Rechaza campos extra en la raíz y en cada track para que la IA
 * genere exactamente el formato acordado.
 */
export function validarBatchJson(datos: unknown): ResultadoValidacionBatch {
	if (!esRegistro(datos)) {
		return { valida: false, motivo: "El archivo debe ser un objeto JSON." };
	}
	const clavesRaiz = Object.keys(datos).sort();
	if (clavesRaiz.join(",") !== "source,tracks") {
		return {
			valida: false,
			motivo: 'El archivo debe contener exactamente {"source","tracks"}.',
		};
	}
	if (!esCadenaNoVacia(datos.source)) {
		return { valida: false, motivo: 'El campo "source" no puede estar vacío.' };
	}
	if (!Array.isArray(datos.tracks) || datos.tracks.length === 0) {
		return {
			valida: false,
			motivo: 'El campo "tracks" debe ser un array no vacío.',
		};
	}
	const canciones: CancionBatch[] = [];
	for (const item of datos.tracks) {
		if (!esRegistro(item)) {
			return { valida: false, motivo: "Cada track debe ser un objeto." };
		}
		const clavesTrack = Object.keys(item).sort();
		if (clavesTrack.join(",") !== "artists,id,name,uri") {
			return {
				valida: false,
				motivo:
					'Cada track debe contener exactamente {"id","uri","name","artists"}.',
			};
		}
		const validada = validarCancion(item);
		if (!validada.valida) {
			return {
				valida: false,
				motivo: `Track inválido: ${JSON.stringify(item).slice(0, 120)}.`,
			};
		}
		canciones.push(validada.cancion);
	}
	return {
		valida: true,
		batch: {
			source: String(datos.source).trim(),
			tracks: canciones,
			uris: canciones.map((c) => c.uri),
		},
	};
}
