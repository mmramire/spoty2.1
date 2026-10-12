/**
 * Caso de uso `listarPlaylistsPropias`: lista las playlists
 * propias del usuario con sesión vigente.
 *
 * Orden del flujo: sesión → listado → éxito, o bien desenlace de dominio.
 * Sin sesión vigente no se invoca el gateway. El fallo de servicio se
 * clasifica con `clasificarErrorData` (401, 403, 429 u otro) y emite el
 * `error` final con la causa depurada cuando el desenlace la aporta.
 *
 * Adaptador reutilizable (RNF-003): no recibe parámetros de línea de comandos
 * ni terminal, no importa Presentation y no hace red, disco ni registro
 * directo: solo consume los puertos de `DependenciasCreacion`.
 */
import { clasificarErrorData } from "./errores.js";
import type { DependenciasCreacion, RegistroTecnico } from "./puertos.js";
import type { PlaylistResumen, ResultadoLista } from "./types.js";

/** Mensaje técnico del `info` de inicio (RNF-006). */
const MENSAJE_INICIO = "Inicio de listado de playlists propias";

/** Mensaje técnico del `info` de éxito (RNF-006). */
const MENSAJE_EXITO = "Listado de playlists completado con éxito";

/** Mensaje técnico del `error` final cuando el listado no se completa. */
const MENSAJE_ERROR_FINAL = "Listado de playlists no completado";

/**
 * Clasificación del fallo de listado: traduce el error propagado a su
 * desenlace de dominio y emite el `error` final con la causa depurada cuando
 * el desenlace la aporta (los desenlaces sin causa, como `SinSesion`, no
 * registran: RNF-001).
 */
function clasificarFalloListado(
	error: unknown,
	registroTecnico: RegistroTecnico,
): ResultadoLista {
	const desenlace = clasificarErrorData(error);
	if ("causa" in desenlace) {
		registroTecnico.error(MENSAJE_ERROR_FINAL, { causa: desenlace.causa });
	}
	return desenlace;
}

/**
 * Lista las playlists propias del usuario vigente con nombre e identificador.
 *
 * - Sin sesión vigente → `SinSesion` sin invocar el gateway.
 * - Listado completado → `ListaPlaylists` con las playlists e `info` de éxito.
 * - Error de servicio → `SesionCaducada` (401), `PermisosInsuficientes`
 *   (403), `LimiteAgotado` (429) o `FalloInesperado`, cada uno con `error`
 *   final de causa depurada.
 */
export async function listarPlaylistsPropias(
	dependencias: DependenciasCreacion,
): Promise<ResultadoLista> {
	const sesion = await dependencias.sesionProveedor.obtenerSesionVigente();
	if (sesion === null) {
		return { resultado: "sinSesion" };
	}

	const { registroTecnico } = dependencias;
	registroTecnico.info(MENSAJE_INICIO);

	let playlists: readonly PlaylistResumen[];
	try {
		playlists = await dependencias.playlistGateway.listarPlaylistsPropias();
	} catch (error) {
		return clasificarFalloListado(error, registroTecnico);
	}

	registroTecnico.info(MENSAJE_EXITO);
	return { resultado: "exito", playlists: [...playlists] };
}
