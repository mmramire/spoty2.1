/**
 * Composición de dependencias reales del agregado batch a playlists.
 *
 * Ensambla listado + agregado con el gateway real, registro técnico y
 * peticiones de terminal con `LectorEntrada` real. Sin reglas de negocio.
 */
import { agregarCancionesAPlaylists } from "../business/playlists/agregar-canciones.js";
import { listarPlaylistsPropias } from "../business/playlists/listar-playlists.js";
import type { DependenciasCreacion } from "../business/playlists/puertos.js";
import { crearPlaylistGateway } from "../data/http/playlists-client.js";
import {
	cargarArchivoBatch,
	listarArchivosInput,
} from "../data/input/batch-loader.js";
import { crearRegistroTecnico } from "../data/logging/registro-tecnico.js";
import {
	type CoordinadorAgregar,
	ejecutarFlujoAgregar,
} from "./agregar-canciones.js";
import { sesionDeAlmacenamiento } from "./composicion-sesion.js";
import {
	type EntradaPrompt,
	pedirConfirmacionSN,
	prompt,
	promptArchivoInput,
	promptSeleccionMultiple,
} from "./prompts.js";

function dependenciasReales(): DependenciasCreacion {
	return {
		sesionProveedor: sesionDeAlmacenamiento,
		playlistGateway: crearPlaylistGateway(),
		registroTecnico: crearRegistroTecnico(),
		espera: { esperar: () => Promise.resolve() },
	};
}

/** Lector real sobre readline para el flujo batch. */
const lectorReal = {
	async leer(texto: string): Promise<EntradaPrompt> {
		const valor = await prompt(texto);
		return { estado: "respondido" as const, valor };
	},
};

/**
 * Ejecuta el flujo batch con dependencias reales (menú / comando directo).
 */
export async function ejecutarAgregadoReal(
	verificarSesion: () => Promise<boolean>,
) {
	const dependencias = dependenciasReales();
	return ejecutarFlujoAgregar({
		casoUsoListar: () => listarPlaylistsPropias(dependencias),
		casoUsoAgregar: (solicitud) =>
			agregarCancionesAPlaylists(solicitud, dependencias),
		peticiones: {
			seleccionMultiple: (nombres) => promptSeleccionMultiple(nombres),
			confirmacion: (texto) => pedirConfirmacionSN(lectorReal, texto),
			archivoInput: (nombres) => promptArchivoInput(nombres),
		},
		carga: { listar: listarArchivosInput, cargar: cargarArchivoBatch },
		lector: lectorReal,
		verificarSesion,
	});
}
