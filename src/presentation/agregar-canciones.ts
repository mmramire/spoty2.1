/**
 * Coordinador del flujo de agregado batch a playlists previamente
 * seleccionadas.
 *
 * Flujo: sesión → listar playlists → selección múltiple por toggle →
 * confirmación (s/N) listando elegidas → listar `input/songs/*.json` →
 * elegir archivo → validar batch estricto → agregar a cada playlist.
 *
 * `N` en la confirmación cancela y retorna al menú principal (BR-007).
 * Si `input/songs/` está vacía se avisa `inputVacio` y se cancela.
 * Adaptador delgado (RNF-002, RNF-003): no decide reglas de dominio,
 * no importa de `src/data/` salvo tipos, y presenta con `MESSAGES`.
 */
import type { agregarCancionesAPlaylists } from "../business/playlists/agregar-canciones.js";
import type {
	PlaylistResumen,
	ResultadoAgregar,
	ResultadoLista,
} from "../business/playlists/types.js";
import type {
	ArchivoInput,
	ResultadoCargaBatch,
	cargarArchivoBatch,
	listarArchivosInput,
} from "../data/input/batch-loader.js";
import { confirm, green, section } from "./console.js";
import { MESSAGES } from "./messages.js";
import {
	type EleccionArchivo,
	type EleccionMultiple,
	type EntradaPrompt,
	type LectorEntrada,
	interpretarConfirmacionS,
	showError,
	showMessage,
} from "./prompts.js";

/** Caso de uso de listado ya compuesto. */
export type CasoUsoListar = () => Promise<ResultadoLista>;
/** Caso de uso de agregado ya compuesto. */
export type CasoUsoAgregar = (
	solicitud: Parameters<typeof agregarCancionesAPlaylists>[0],
) => Promise<ResultadoAgregar>;

/** Peticiones inyectadas del flujo batch; en pruebas se doblan. */
export interface PeticionesAgregar {
	seleccionMultiple(nombres: readonly string[]): Promise<EleccionMultiple>;
	confirmacion(texto: string): Promise<EntradaPrompt>;
	archivoInput(nombres: readonly string[]): Promise<EleccionArchivo>;
}

/** Carga de archivos input inyectada para pruebas sin disco real. */
export interface CargaInput {
	listar: typeof listarArchivosInput;
	cargar: typeof cargarArchivoBatch;
}

export interface CoordinadorAgregar {
	readonly casoUsoListar: CasoUsoListar;
	readonly casoUsoAgregar: CasoUsoAgregar;
	readonly peticiones: PeticionesAgregar;
	readonly carga: CargaInput;
	readonly lector: LectorEntrada;
	readonly verificarSesion?: () => Promise<boolean>;
}

export type FinalizacionAgregar =
	| { readonly estado: "cargada" }
	| { readonly estado: "cancelada" }
	| { readonly estado: "error" };

const CARGADA: FinalizacionAgregar = { estado: "cargada" };
const CANCELADA: FinalizacionAgregar = { estado: "cancelada" };
const ERROR: FinalizacionAgregar = { estado: "error" };

const LITERALES_DE_ERROR = {
	sinSesion: MESSAGES.playlist.noSessionError,
	sesionCaducada: MESSAGES.playlist.sessionExpiredError,
	permisosInsuficientes: MESSAGES.playlist.permissionsError,
	limiteAgotado: MESSAGES.playlist.rateLimitError,
	falloInesperado: MESSAGES.playlist.unexpectedError,
} as const;

/** Literales del agregado: no mencionan "crear", sino "agregar canciones". */
const LITERALES_DE_ERROR_AGREGADO = {
	sinSesion: MESSAGES.playlist.noSessionError,
	sesionCaducada: MESSAGES.playlist.sessionExpiredError,
	permisosInsuficientes: MESSAGES.playlist.agregarPermisosError,
	limiteAgotado: MESSAGES.playlist.rateLimitError,
	falloInesperado: MESSAGES.playlist.agregarInesperadoError,
} as const;

function cancelarConAviso(): FinalizacionAgregar {
	showMessage(MESSAGES.playlist.cargaCancelada);
	return CANCELADA;
}

async function elegirPlaylists(
	playlists: readonly PlaylistResumen[],
	coordinador: CoordinadorAgregar,
): Promise<readonly PlaylistResumen[] | null> {
	showMessage(section("Seleccionar playlists"));
	const eleccion = await coordinador.peticiones.seleccionMultiple(
		playlists.map((p) => p.nombre),
	);
	if (eleccion.estado !== "elegidas") return null;
	return eleccion.indices
		.map((ix) => playlists[ix - 1])
		.filter((p): p is PlaylistResumen => p !== undefined);
}

async function confirmarSeleccion(
	seleccionadas: readonly PlaylistResumen[],
	coordinador: CoordinadorAgregar,
): Promise<boolean> {
	const texto = `${MESSAGES.playlist.confirmarCarga(seleccionadas)}${"(s/N): "}`;
	const respuesta = await coordinador.peticiones.confirmacion(texto);
	if (respuesta.estado === "abortado") return false;
	return interpretarConfirmacionS(respuesta.valor);
}

async function elegirArchivo(
	coordinador: CoordinadorAgregar,
): Promise<ArchivoInput | null> {
	const archivos = await coordinador.carga.listar();
	if (archivos.length === 0) {
		showMessage(MESSAGES.playlist.inputVacio);
		return null;
	}
	showMessage(section("Elegir archivo batch"));
	const eleccion = await coordinador.peticiones.archivoInput(
		archivos.map((a) => a.nombre),
	);
	if (eleccion.estado !== "elegido") return null;
	return archivos[eleccion.indice - 1] ?? null;
}

function presentarExito(
	resultado: Extract<ResultadoAgregar, { resultado: "exito" }>,
): FinalizacionAgregar {
	showMessage(
		confirm(
			MESSAGES.playlist.agregadoOk(
				resultado.totalCanciones,
				resultado.totalPlaylists,
			),
		),
	);
	for (const r of resultado.resultados) {
		showMessage(
			green(
				MESSAGES.playlist.agregadoDetalle(
					r.playlist.nombre,
					r.playlist.id,
					r.agregadas,
				),
			),
		);
	}
	return CARGADA;
}

/**
 * Ejecuta el flujo batch completo hasta finalizar.
 */
export async function ejecutarFlujoAgregar(
	coordinador: CoordinadorAgregar,
): Promise<FinalizacionAgregar> {
	if (coordinador.verificarSesion !== undefined) {
		if (!(await coordinador.verificarSesion())) {
			showError(MESSAGES.playlist.noSessionError);
			return ERROR;
		}
	}
	const listado = await coordinador.casoUsoListar();
	if (listado.resultado !== "exito") {
		showError(LITERALES_DE_ERROR[listado.resultado]);
		return ERROR;
	}
	if (listado.playlists.length === 0) {
		showMessage(MESSAGES.playlist.seleccionVacia);
		return CANCELADA;
	}
	const seleccionadas = await elegirPlaylists(listado.playlists, coordinador);
	if (seleccionadas === null || seleccionadas.length === 0) {
		return cancelarConAviso();
	}
	if (!(await confirmarSeleccion(seleccionadas, coordinador))) {
		return cancelarConAviso();
	}
	const archivo = await elegirArchivo(coordinador);
	if (archivo === null) {
		return cancelarConAviso();
	}
	const cargado: ResultadoCargaBatch = await coordinador.carga.cargar(
		archivo.ruta,
	);
	if (!cargado.valida) {
		showError(MESSAGES.playlist.batchInvalido(cargado.motivo));
		return ERROR;
	}
	const resultado = await coordinador.casoUsoAgregar({
		playlists: seleccionadas,
		uris: cargado.batch.uris,
	});
	switch (resultado.resultado) {
		case "exito":
			return presentarExito(resultado);
		case "errorValidacion":
			showError(MESSAGES.playlist.agregadoValidacion(resultado.campo));
			return ERROR;
		default:
			showError(LITERALES_DE_ERROR_AGREGADO[resultado.resultado]);
			return ERROR;
	}
}
