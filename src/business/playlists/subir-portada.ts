/**
 * Caso de uso `subirPortadaAPlaylist`: reemplaza la portada de una
 * playlist recién creada (o existente) con un JPEG en Base64.
 *
 * Orden del flujo: sesión → subida (202) → éxito. Sin sesión vigente
 * no se invoca el gateway. El fallo de servicio se clasifica con
 * `clasificarErrorData` (401, 403, 429 u otro).
 *
 * Adaptador reutilizable (RNF-003): sin terminal, red, disco ni registro
 * directo; solo consume los puertos de `DependenciasCreacion`.
 */
import { clasificarErrorData } from "./errores.js";
import type { DependenciasCreacion, RegistroTecnico } from "./puertos.js";
import type { ResultadoPortada, SolicitudSubirPortada } from "./types.js";

/** Mensaje técnico del `info` de inicio (RNF-006). */
const MENSAJE_INICIO = "Inicio de subida de portada a playlist";

/** Mensaje técnico del `info` de éxito (RNF-006). */
const MENSAJE_EXITO = "Portada subida con éxito";

/** Mensaje técnico del `error` final cuando la subida no se completa. */
const MENSAJE_ERROR_FINAL = "Subida de portada no completada";

function clasificarFallo(
	error: unknown,
	registroTecnico: RegistroTecnico,
	playlistId: string,
): ResultadoPortada {
	const desenlace = clasificarErrorData(error);
	if ("causa" in desenlace) {
		registroTecnico.error(MENSAJE_ERROR_FINAL, {
			causa: desenlace.causa,
			identificador: playlistId,
		});
	}
	return desenlace;
}

/**
 * Sube la portada con el testigo de la sesión vigente.
 */
export async function subirPortadaAPlaylist(
	solicitud: SolicitudSubirPortada,
	dependencias: DependenciasCreacion,
): Promise<ResultadoPortada> {
	const sesion = await dependencias.sesionProveedor.obtenerSesionVigente();
	if (sesion === null) {
		return { resultado: "sinSesion" };
	}

	const { registroTecnico, playlistGateway } = dependencias;
	registroTecnico.info(MENSAJE_INICIO, { identificador: solicitud.playlistId });

	try {
		await playlistGateway.subirPortada({
			playlistId: solicitud.playlistId,
			base64: solicitud.base64,
			testigoSesion: sesion.testigoSesion,
		});
	} catch (error) {
		return clasificarFallo(error, registroTecnico, solicitud.playlistId);
	}

	registroTecnico.info(MENSAJE_EXITO, { identificador: solicitud.playlistId });
	return { resultado: "exito", playlistId: solicitud.playlistId };
}
