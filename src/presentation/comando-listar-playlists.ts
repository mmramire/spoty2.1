/**
 * Comando directo `spoty list-playlists`.
 *
 * Punto de entrada funcional del listado por comando directo: delega en la
 * composición real y en el coordinador del flujo, que verifica previamente
 * que la cuenta esté conectada y gestiona cada desenlace con su literal
 * exacto de `MESSAGES`. El módulo no presenta literales propios.
 */
import { componerListarPlaylists } from "./composicion-listar-playlists.js";
import { verificarSesionVigente } from "./composicion-sesion.js";
import {
	type CoordinadorListado,
	type FinalizacionListado,
	ejecutarFlujoListado,
} from "./listar-playlists.js";

/**
 * Ejecuta el comando delegando en la composición real y en el coordinador
 * del flujo.
 */
export async function ejecutarComandoListarPlaylists(): Promise<FinalizacionListado> {
	const coordinador: CoordinadorListado = {
		casoUso: componerListarPlaylists(),
		verificarSesion: verificarSesionVigente,
	};
	return ejecutarFlujoListado(coordinador);
}
