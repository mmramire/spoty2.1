/**
 * Validación pura de portadas `input/covers/*` (formato Spotify).
 *
 * Reglas (doc oficial `upload-custom-playlist-cover`):
 * - JPEG real (magic bytes `FF D8 FF`), extensión orientativa.
 * - Payload Base64 ≤ 256 KB (crudo ≤ 192 KB).
 *
 * Función pura sin efectos secundarios (RNF-003): Data lee el archivo
 * y delega aquí la validación.
 */

/** Tope del payload Base64 en caracteres (256 KB). */
export const MAX_BASE64_CHARS = 256 * 1024;

/** Tope del archivo crudo en bytes (lo que cabe en 256 KB de Base64). */
export const MAX_RAW_BYTES = Math.floor(MAX_BASE64_CHARS / 4) * 3;

export type ResultadoValidacionPortada =
	| { readonly valida: true; readonly base64: string }
	| { readonly valida: false; readonly motivo: string };

function esJpeg(bytes: Uint8Array): boolean {
	return (
		bytes.length >= 3 &&
		bytes[0] === 0xff &&
		bytes[1] === 0xd8 &&
		bytes[2] === 0xff
	);
}

/**
 * Valida los bytes crudos de un candidato a portada y devuelve el
 * Base64 listo para `PUT /playlists/{id}/images`.
 */
export function validarPortadaBytes(
	bytes: Uint8Array,
	base64: string,
): ResultadoValidacionPortada {
	if (bytes.length === 0) {
		return { valida: false, motivo: "El archivo está vacío." };
	}
	if (!esJpeg(bytes)) {
		return { valida: false, motivo: "El archivo no es un JPEG válido." };
	}
	if (bytes.length > MAX_RAW_BYTES || base64.length > MAX_BASE64_CHARS) {
		return {
			valida: false,
			motivo: "La imagen supera los 256 KB de payload Base64.",
		};
	}
	return { valida: true, base64 };
}
