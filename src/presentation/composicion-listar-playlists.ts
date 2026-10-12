/**
 * Composición de dependencias reales del listado de playlists propias.
 *
 * Único punto de ensamblaje de la feature: aquí Presentation construye el
 * caso de uso con los puertos reales —`SesionProveedor` compartido sobre
 * `getStoredTokens` y `checkExistingSession`, `PlaylistGateway` de Data,
 * `RegistroTecnico` hacia `data/app.log` y `Espera` de temporizador— y el
 * comando directo y la opción 5 del menú invocan la misma función. El módulo
 * no decide reglas de negocio, no presenta mensajes al usuario y no usa
 * terminal, ficheros ni red directamente: solo ensambla.
 */
import { listarPlaylistsPropias } from "../business/playlists/listar-playlists.js";
import type { DependenciasCreacion } from "../business/playlists/puertos.js";
import type { ResultadoLista } from "../business/playlists/types.js";
import { crearPlaylistGateway } from "../data/http/playlists-client.js";
import { crearRegistroTecnico } from "../data/logging/registro-tecnico.js";
import { sesionDeAlmacenamiento } from "./composicion-sesion.js";

/** Caso de uso ya compuesto: se invoca sin solicitud ni dependencias. */
export type CasoUsoListarPlaylists = () => Promise<ResultadoLista>;

/**
 * Única composición de arranque: devuelve el caso de uso listo para que el
 * comando directo y la opción 5 del menú lo invoquen con la misma
 * construcción y con los mismos tipos (RNF-003).
 */
export function componerListarPlaylists(): CasoUsoListarPlaylists {
	const dependencias: DependenciasCreacion = {
		sesionProveedor: sesionDeAlmacenamiento,
		playlistGateway: crearPlaylistGateway(),
		registroTecnico: crearRegistroTecnico(),
		// El listado no aplica retardos: el puerto `Espera` se aporta sin
		// temporizador porque el caso de uso nunca lo invoca.
		espera: { esperar: () => Promise.resolve() },
	};
	return () => listarPlaylistsPropias(dependencias);
}
