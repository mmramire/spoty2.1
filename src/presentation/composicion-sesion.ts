/**
 * Sesión real compartida por las composiciones de Presentation.
 *
 * Único punto de ensamblaje del `SesionProveedor` sobre `getStoredTokens` y
 * `checkExistingSession`: sin tokens almacenados no hay sesión vigente y no
 * se consulta la red; con tokens almacenados se valida la sesión vigente y se
 * devuelve el testigo de acceso (BR-001, UC-001-E1). El módulo no decide
 * reglas de negocio, no presenta mensajes al usuario y no usa terminal,
 * ficheros ni red directamente: solo ensambla.
 */
import { checkExistingSession } from "../business/auth/flow.js";
import { getStoredTokens } from "../business/auth/tokens.js";
import type { SesionProveedor } from "../business/playlists/puertos.js";

/**
 * `SesionProveedor` real compartido por la creación y el listado de
 * playlists.
 */
export const sesionDeAlmacenamiento: SesionProveedor = {
	async obtenerSesionVigente() {
		if (getStoredTokens() === null) {
			return null;
		}
		const sesion = await checkExistingSession();
		return sesion === null
			? null
			: { testigoSesion: sesion.tokens.access_token };
	},
};

/**
 * Verificación previa de sesión para Presentation: reutiliza el mismo
 * `SesionProveedor` real de los casos de uso —tokens almacenados más
 * validación vigente contra Spotify— de modo que los coordinadores y los
 * puntos de entrada puedan comprobar que la cuenta está conectada antes de
 * pedir datos o de invocar la petición.
 */
export async function verificarSesionVigente(): Promise<boolean> {
	const sesion = await sesionDeAlmacenamiento.obtenerSesionVigente();
	return sesion !== null;
}
