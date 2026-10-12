/**
 * Coordinador del flujo de listado de playlists propias.
 *
 * Adaptador delgado: el caso de uso y la verificación previa de sesión llegan
 * inyectados; el coordinador comprueba que la cuenta esté conectada antes de
 * invocar la petición y presenta el resultado con los literales exactos de
 * `MESSAGES`. No decide reglas de dominio, no importa de `src/data/`, no
 * registra y no ejecuta efectos secundarios más allá de presentar por la capa
 * de presentación (RNF-002, RNF-003, RNF-006).
 */
import type {
	PlaylistResumen,
	ResultadoLista,
} from "../business/playlists/types.js";
import type { CasoUsoListarPlaylists } from "./composicion-listar-playlists.js";
import { MESSAGES } from "./messages.js";
import { showError, showMessage } from "./prompts.js";

/** Dependencias del coordinador: caso de uso y verificación, ambas inyectadas. */
export interface CoordinadorListado {
	readonly casoUso: CasoUsoListarPlaylists;
	/**
	 * Verificación previa de sesión: cuando se aporta, el coordinador
	 * comprueba que la cuenta esté conectada antes de invocar la petición;
	 * sin sesión vigente presenta el literal `noSessionError` y finaliza como
	 * error sin invocar nada.
	 */
	readonly verificarSesion?: () => Promise<boolean>;
}

/**
 * Fin del flujo para el punto de entrada (comando u opción 5 del menú):
 * listado presentado o error ya presentado con su literal exacto.
 */
export type FinalizacionListado =
	| { readonly estado: "lista" }
	| { readonly estado: "error" };

const LISTA: FinalizacionListado = { estado: "lista" };
const ERROR: FinalizacionListado = { estado: "error" };

/** Literales exactos de error por desenlace. */
const LITERALES_DE_ERROR = {
	sinSesion: MESSAGES.playlist.noSessionError,
	sesionCaducada: MESSAGES.playlist.sessionExpiredError,
	permisosInsuficientes: MESSAGES.playlist.permissionsError,
	limiteAgotado: MESSAGES.playlist.rateLimitError,
	falloInesperado: MESSAGES.playlist.unexpectedError,
} as const;

/** Presenta el desenlace de éxito: lista de playlists o aviso de lista vacía. */
function presentarExito(
	playlists: readonly PlaylistResumen[],
): FinalizacionListado {
	if (playlists.length === 0) {
		showMessage(MESSAGES.playlist.listaVacia);
	} else {
		showMessage(MESSAGES.playlist.listado(playlists));
	}
	return LISTA;
}

/**
 * Coordina el flujo de listado completo: verifica la sesión cuando se aporta
 * el verificador, invoca el caso de uso una vez y traduce el desenlace hasta
 * finalizar.
 */
export async function ejecutarFlujoListado(
	coordinador: CoordinadorListado,
): Promise<FinalizacionListado> {
	if (coordinador.verificarSesion !== undefined) {
		const sesionVigente = await coordinador.verificarSesion();
		if (!sesionVigente) {
			showError(MESSAGES.playlist.noSessionError);
			return ERROR;
		}
	}
	const resultado: ResultadoLista = await coordinador.casoUso();
	if (resultado.resultado === "exito") {
		return presentarExito(resultado.playlists);
	}
	showError(LITERALES_DE_ERROR[resultado.resultado]);
	return ERROR;
}
