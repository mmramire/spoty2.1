/**
 * Caso de uso `agregarCancionesAPlaylists`: agrega un batch de URIs a
 * una o varias playlists propias ya seleccionadas.
 *
 * Orden del flujo: sesión → validación local → agregado por playlist → éxito.
 * Sin sesión vigente no se invoca el gateway. La validación local
 * (`playlists` no vacía, `uris` no vacía) no genera registro de error.
 * El fallo de servicio se clasifica con `clasificarErrorData` (401, 403,
 * 429 u otro) igual que creación y listado.
 *
 * Adaptador reutilizable (RNF-003): sin terminal, red, disco ni registro
 * directo; solo consume los puertos de `DependenciasCreacion`.
 */
import { clasificarErrorData } from "./errores.js";
import type { DependenciasCreacion, RegistroTecnico } from "./puertos.js";
import type {
	ResultadoAgregar,
	ResultadoPorPlaylist,
	SolicitudAgregarCanciones,
} from "./types.js";

/** Mensaje técnico del `info` de inicio (RNF-006). */
const MENSAJE_INICIO = "Inicio de agregado batch a playlists";

/** Mensaje técnico del `info` de éxito (RNF-006). */
const MENSAJE_EXITO = "Agregado batch completado con éxito";

/** Mensaje técnico del `error` final cuando el agregado no se completa. */
const MENSAJE_ERROR_FINAL = "Agregado batch no completado";

function clasificarFallo(
	error: unknown,
	registroTecnico: RegistroTecnico,
	playlistId?: string,
): ResultadoAgregar {
	const desenlace = clasificarErrorData(error);
	if ("causa" in desenlace) {
		registroTecnico.error(MENSAJE_ERROR_FINAL, {
			causa: desenlace.causa,
			...(playlistId === undefined ? {} : { identificador: playlistId }),
		});
	}
	return desenlace;
}

/**
 * Agrega las URIs a cada playlist seleccionada, en orden, con el testigo
 * de la sesión vigente. Si una playlist falla, se clasifica y se aborta
 * sin continuar con las restantes (fallo rápido con causa depurada).
 */
export async function agregarCancionesAPlaylists(
	solicitud: SolicitudAgregarCanciones,
	dependencias: DependenciasCreacion,
): Promise<ResultadoAgregar> {
	const sesion = await dependencias.sesionProveedor.obtenerSesionVigente();
	if (sesion === null) {
		return { resultado: "sinSesion" };
	}
	if (solicitud.playlists.length === 0) {
		return { resultado: "errorValidacion", campo: "playlists" };
	}
	if (solicitud.uris.length === 0) {
		return { resultado: "errorValidacion", campo: "uris" };
	}

	const { registroTecnico, playlistGateway } = dependencias;
	registroTecnico.info(MENSAJE_INICIO, {
		identificador: solicitud.playlists[0]?.id,
	});

	const resultados: ResultadoPorPlaylist[] = [];
	let playlistActual: string | undefined;
	try {
		for (const playlist of solicitud.playlists) {
			playlistActual = playlist.id;
			const agregadas = await playlistGateway.agregarCanciones({
				playlistId: playlist.id,
				uris: solicitud.uris,
				testigoSesion: sesion.testigoSesion,
			});
			resultados.push({ playlist, agregadas });
		}
	} catch (error) {
		return clasificarFallo(error, registroTecnico, playlistActual);
	}

	registroTecnico.info(MENSAJE_EXITO);
	return {
		resultado: "exito",
		resultados,
		totalPlaylists: solicitud.playlists.length,
		totalCanciones: solicitud.uris.length,
	};
}
