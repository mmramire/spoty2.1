import { stdin, stdout } from "node:process";
import { type Interface, createInterface } from "node:readline/promises";
import { validateRedirectUri } from "@/business/auth/types.js";
import {
	alternarIndices,
	interpretarEntradaSeleccion,
} from "@/business/playlists/seleccion.js";
import type {
	PlaylistResumen,
	Visibilidad,
} from "@/business/playlists/types.js";
import { resolverDescripcionEfectiva } from "@/business/playlists/validacion.js";
import { bold, cyan, dim, error, green, info, warning } from "./console.js";
import { MESSAGES } from "./messages.js";

let rl: Interface | null = null;

function getReadline(): Interface {
	if (!rl) {
		rl = createInterface({ input: stdin, output: stdout });
	}
	return rl;
}

function writeLine(message: string): void {
	stdout.write(`${message}\n`);
}

export async function prompt(text: string): Promise<string> {
	const readline = getReadline();
	const answer = await readline.question(text);
	return answer.trim();
}

export async function promptClientId(): Promise<string> {
	while (true) {
		const clientId = await prompt("Introduce tu SPOTIFY_CLIENT_ID: ");
		if (clientId.length > 0) {
			return clientId;
		}
		writeLine(error("El Client ID no puede estar vacío."));
	}
}

export async function promptRedirectUri(): Promise<string> {
	while (true) {
		const redirectUri = await prompt(
			"Introduce tu SPOTIFY_REDIRECT_URI (ej. http://127.0.0.1:8888/callback): ",
		);
		const validation = validateRedirectUri(redirectUri);
		if (validation.valid) {
			return redirectUri;
		}
		writeLine(error(validation.error ?? "URI inválida"));
		writeLine(
			info("Debe usar http://127.0.0.1:puerto/callback (no localhost)"),
		);
	}
}

/** Texto del selector, alineado con la numeración real del menú (N-004). */
const SELECTOR_MENU = "\nSelecciona una opción (0-6,9): ";

/**
 * Ítems del menú (TASK-011) de los que se deriva la etiqueta de cada
 * elección: la única fuente de numeración y de texto es la línea del propio
 * ítem, sin segunda lista de etiquetas (N-004).
 */
const ITEMS_MENU: Record<string, string> = {
	"1": MESSAGES.menu.connect,
	"2": MESSAGES.menu.status,
	"3": MESSAGES.menu.download,
	"4": MESSAGES.menu.createPlaylist,
	"5": MESSAGES.menu.listPlaylists,
	"6": MESSAGES.menu.addSongs,
	"9": MESSAGES.menu.logout,
	"0": MESSAGES.menu.exit,
};

/** Etiqueta visible de un ítem del menú: el número visible lo aporta la línea. */
function etiquetaDeItem(item: string): string {
	return item.replace(/^\d+\.\s*/, "");
}

export async function promptMenuChoice(): Promise<string> {
	const choice = await prompt(SELECTOR_MENU);
	const item = ITEMS_MENU[choice];
	if (item) {
		writeLine(dim(`  → ${etiquetaDeItem(item)}`));
	}
	return choice;
}

export async function confirmExit(): Promise<boolean> {
	const answer = await prompt("¿Estás seguro de que quieres salir? (s/N): ");
	return answer.toLowerCase() === "s";
}

export function closeReadline(): void {
	if (rl) {
		rl.close();
		rl = null;
	}
}

export function showMessage(message: string): void {
	writeLine(message);
}

export function showError(message: string): void {
	writeLine(error(message));
}

export function showInfo(message: string): void {
	writeLine(info(message));
}

export function showDim(message: string): void {
	writeLine(dim(message));
}

// ─── Creación de playlist vacía (TASK-012, TC-018) ───────────────────────────
// Peticiones, confirmaciones y elecciones del flujo de creación. La interpretación
// de las respuestas se separa en funciones puras y la entrada se sustituye en
// pruebas mediante un doble de `LectorEntrada` (sin teclado real).

/** Resultado de una petición: respuesta del usuario o aborto por `Ctrl+C`. */
export type EntradaPrompt =
	| { readonly estado: "respondido"; readonly valor: string }
	| { readonly estado: "abortado" };

/** Elección de la lista de visibilidad, con la opción pública preseleccionada. */
export type EleccionVisibilidad =
	| { readonly estado: "seleccionada"; readonly visibilidad: Visibilidad }
	| { readonly estado: "abortado" };

/** Opciones válidas del menú de duplicados (UC-001-A1, únicamente 0, 1 y 2). */
export type OpcionDuplicados = "0" | "1" | "2";

/** Elección del menú de duplicados. */
export type EleccionDuplicados =
	| { readonly estado: "elegida"; readonly opcion: OpcionDuplicados }
	| { readonly estado: "abortado" };

/** Punto de inyección de la entrada: en pruebas se sustituye por un doble. */
export interface LectorEntrada {
	leer(texto: string): Promise<EntradaPrompt>;
}

/** Formato literal de la confirmación final: solo `s` en minúscula confirma (BR-007). */
export const FORMATO_CONFIRMACION = "(s/N): ";

/**
 * Datos efectivos que el resumen previo de la confirmación presenta (DISC-006):
 * nombre recortado, visibilidad y descripción efectiva ya resueltos por Business.
 */
export interface ResumenCreacion {
	readonly nombreEfectivo: string;
	readonly visibilidad: Visibilidad;
	readonly descripcionEfectiva: string;
}

// Texto de la lista de visibilidad: el literal de la lista no está fijado por la
// especificación (RNF-002 fija las peticiones y la pregunta de modificación);
// este texto solo presenta la opción pública como preseleccionada (P-002, BR-005).
const LISTA_VISIBILIDAD =
	"Visibilidad de la playlist:\n  1. Pública (preseleccionada)\n  2. Privada\nElección [Enter = 1]: ";

/** BR-007: solo `s` en minúscula confirma; `S`, `N`, vacío u otra respuesta no. */
export function interpretarConfirmacionS(respuesta: string): boolean {
	return respuesta.trim() === "s";
}

/**
 * Clasificación fina de `(s/N)`: solo `s` confirma (BR-007); un casi-sí
 * (`S`, `si`, `sí`, `y`, `yes`, en cualquier capitalización) pide repetir
 * con aviso en vez de cancelar en silencio; el resto cancela.
 */
export type RespuestaSN = "confirmada" | "repetir" | "cancelada";

/** Casi-sí en minúsculas (la `s` exacta ya confirmó antes de llegar aquí). */
const CASI_SI = new Set(["s", "si", "sí", "y", "yes"]);

export function clasificarRespuestaSN(respuesta: string): RespuestaSN {
	const valor = respuesta.trim();
	if (valor === "s") return "confirmada";
	if (CASI_SI.has(valor.toLowerCase())) return "repetir";
	return "cancelada";
}

/**
 * Lee `(s/N)` repitiendo con aviso ante casi-sí; el aborto se propaga.
 * Devuelve la respuesta en bruto: el llamado sigue interpretando con
 * `interpretarConfirmacionS`, que ya solo puede recibir `s` o cancelación.
 */
export async function pedirConfirmacionSN(
	lector: LectorEntrada,
	texto: string,
): Promise<EntradaPrompt> {
	for (;;) {
		const respuesta = await lector.leer(texto);
		if (respuesta.estado === "abortado") return respuesta;
		if (clasificarRespuestaSN(respuesta.valor) !== "repetir") {
			return respuesta;
		}
		showMessage(warning(MESSAGES.playlist.reintentoConfirmacion));
	}
}

/**
 * P-002/BR-005: `Enter` (preselección), `1` y `2` eligen; el resto no es válido.
 * La equivalencia con `--public`/`--private` es total: `1` → `publica`, `2` → `privada`.
 */
export function interpretarVisibilidad(respuesta: string): Visibilidad | null {
	const eleccion = respuesta.trim();
	if (eleccion === "" || eleccion === "1") return "publica";
	if (eleccion === "2") return "privada";
	return null;
}

/** UC-001-A1: el menú de duplicados acepta únicamente `0`, `1` y `2`. */
export function interpretarOpcionDuplicados(
	respuesta: string,
): OpcionDuplicados | null {
	const eleccion = respuesta.trim();
	if (eleccion === "0" || eleccion === "1" || eleccion === "2") return eleccion;
	return null;
}

const lectorReadline: LectorEntrada = { leer: leerConReadline };

/** Lectura sobre `readline` real; `Ctrl+C` (señal `SIGINT`) resuelve como aborto. */
async function leerConReadline(texto: string): Promise<EntradaPrompt> {
	const readline = getReadline();
	return new Promise<EntradaPrompt>((resolve, rechazar) => {
		const alInterrumpir = (): void => {
			quitar();
			resolve({ estado: "abortado" });
		};
		const quitar = (): void => {
			readline.removeListener("SIGINT", alInterrumpir);
		};
		readline.once("SIGINT", alInterrumpir);
		readline.question(texto).then(
			(valor) => {
				quitar();
				resolve({ estado: "respondido", valor });
			},
			(motivo: unknown) => {
				quitar();
				rechazar(motivo);
			},
		);
	});
}

/**
 * Pide hasta obtener una respuesta que el `interpretar` acepte (no nula); el aborto
 * del lector se propaga sin repetir. Compartido por la lista de visibilidad y el
 * menú de duplicados, que reentran de forma idéntica.
 */
async function pedirHastaValidar<T>(
	lector: LectorEntrada,
	texto: string,
	interpretar: (valor: string) => T | null,
): Promise<{ estado: "valido"; valor: T } | { estado: "abortado" }> {
	while (true) {
		const respuesta = await lector.leer(texto);
		if (respuesta.estado === "abortado") return respuesta;
		const valor = interpretar(respuesta.valor);
		if (valor !== null) return { estado: "valido", valor };
	}
}

/** Petición de nombre con el literal aprobado; el valor viaja en bruto hacia la solicitud. */
export async function promptNombrePlaylist(
	lector: LectorEntrada = lectorReadline,
): Promise<EntradaPrompt> {
	return lector.leer(MESSAGES.playlist.namePrompt);
}

/**
 * Petición de descripción con el literal aprobado. `Enter` o solo espacios producen
 * el valor por defecto resuelto por el predicado de Business (RNF-003, RF-001).
 */
export async function promptDescripcionPlaylist(
	lector: LectorEntrada = lectorReadline,
): Promise<EntradaPrompt> {
	const respuesta = await lector.leer(MESSAGES.playlist.descriptionPrompt);
	if (respuesta.estado === "abortado") return respuesta;
	return {
		estado: "respondido",
		valor: resolverDescripcionEfectiva(respuesta.valor),
	};
}

/** Lista de visibilidad con la pública preseleccionada; repite hasta elegir válida. */
export async function promptVisibilidadPlaylist(
	lector: LectorEntrada = lectorReadline,
): Promise<EleccionVisibilidad> {
	const eleccion = await pedirHastaValidar(
		lector,
		LISTA_VISIBILIDAD,
		interpretarVisibilidad,
	);
	if (eleccion.estado === "abortado") return eleccion;
	return { estado: "seleccionada", visibilidad: eleccion.valor };
}

/**
 * Texto de la confirmación final (DISC-006): con resumen antepone la línea de
 * resumen y la pregunta explícita antes del formato `(s/N): `; sin resumen —
 * visibilidad no resuelta, inalcanzable en el flujo real— conserva el formato
 * aprobado sin más.
 */
export function textoConfirmacion(resumen?: ResumenCreacion): string {
	if (resumen === undefined) {
		return FORMATO_CONFIRMACION;
	}
	const resumenLiteral = MESSAGES.playlist.summary(
		resumen.nombreEfectivo,
		resumen.visibilidad,
		resumen.descripcionEfectiva,
	);
	return `${resumenLiteral}\n${MESSAGES.playlist.confirmPrompt}${FORMATO_CONFIRMACION}`;
}

/**
 * Confirmación final con el formato `(s/N): ` y, cuando procede, el resumen de
 * los datos efectivos; la interpretación la hace el llamado (BR-007, DISC-006).
 */
export async function confirmarCreacion(
	resumen?: ResumenCreacion,
	lector: LectorEntrada = lectorReadline,
): Promise<EntradaPrompt> {
	return pedirConfirmacionSN(lector, textoConfirmacion(resumen));
}

/** Menú de duplicados con el literal aprobado; acepta únicamente `0`, `1` y `2`. */
export async function promptOpcionDuplicados(
	lector: LectorEntrada = lectorReadline,
): Promise<EleccionDuplicados> {
	const eleccion = await pedirHastaValidar(
		lector,
		MESSAGES.playlist.duplicateMenu,
		interpretarOpcionDuplicados,
	);
	if (eleccion.estado === "abortado") return eleccion;
	return { estado: "elegida", opcion: eleccion.valor };
}

/** Pregunta de modificación con el literal aprobado; repite ante casi-sí. */
export async function promptModificarDescripcion(
	lector: LectorEntrada = lectorReadline,
): Promise<EntradaPrompt> {
	return pedirConfirmacionSN(lector, MESSAGES.playlist.modifyPrompt);
}

/** Opt-in de portada tras crear: pregunta `(s/N)`; repite ante casi-sí. */
export async function promptPortadaOptIn(
	lector: LectorEntrada = lectorReadline,
): Promise<EntradaPrompt> {
	return pedirConfirmacionSN(
		lector,
		`${MESSAGES.playlist.portadaPregunta}${FORMATO_CONFIRMACION}`,
	);
}

// ─── Agregado batch a playlists ─────────────────────────────────────────────

/** Resultado del selector múltiple por toggle (sin dependencia externa). */
export type EleccionMultiple =
	| { readonly estado: "elegidas"; readonly indices: readonly number[] }
	| { readonly estado: "cancelado" }
	| { readonly estado: "abortado" };

/** Elección de archivo input por número. */
export type EleccionArchivo =
	| { readonly estado: "elegido"; readonly indice: number }
	| { readonly estado: "cancelado" }
	| { readonly estado: "abortado" };

/**
 * Selector múltiple por toggle sin dependencia externa.
 * Muestra la lista numerada con marca [x]/[ ] y en la parte inferior
 * el contador de seleccionadas. Devuelve índices 1-based elegidos.
 */
export async function promptSeleccionMultiple(
	nombres: readonly string[],
	lector: LectorEntrada = lectorReadline,
): Promise<EleccionMultiple> {
	let seleccion: readonly number[] = [];
	for (;;) {
		const lineas = nombres.map((nombre, i) => {
			const marcada = seleccion.includes(i + 1);
			const marca = marcada ? green("[x]") : dim("[ ]");
			return `  ${cyan(`${i + 1}.`)} ${marca} "${marcada ? bold(nombre) : nombre}"`;
		});
		const seleccionadas = seleccion.map(
			(ix) => ({ id: "", nombre: nombres[ix - 1] ?? "" }) as PlaylistResumen,
		);
		const contador = bold(MESSAGES.playlist.seleccionContador(seleccionadas));
		const ayuda =
			seleccion.length === 0
				? dim("> Marca números (ej. 1,3) | 0 cancela: ")
				: dim(
						`> Enter confirma (${seleccion.length}) | número marca/desmarca | 0 cancela: `,
					);
		const respuesta = await lector.leer(
			`\n${MESSAGES.playlist.seleccionLeyenda}\n\n${lineas.join("\n")}\n\n${contador}\n${ayuda}`,
		);
		if (respuesta.estado === "abortado") return { estado: "abortado" };
		const entrada = interpretarEntradaSeleccion(
			respuesta.valor,
			nombres.length,
		);
		switch (entrada.tipo) {
			case "cancelar":
				return { estado: "cancelado" };
			case "confirmar":
				if (seleccion.length === 0) {
					showMessage(MESSAGES.playlist.seleccionSinElegir);
					break;
				}
				return { estado: "elegidas", indices: seleccion };
			case "todas":
				seleccion = nombres.map((_, i) => i + 1);
				break;
			case "ninguna":
				seleccion = [];
				break;
			case "alternar":
				seleccion = alternarIndices(seleccion, entrada.indices);
				break;
			case "invalida":
				break;
		}
	}
}

/**
 * Elige un archivo de `input/songs/*.json` con el mismo toggle que playlists
 * (selección simple): número marca ese archivo, `Enter` confirma,
 * `0` cancela. Abajo se ve el elegido.
 */
export async function promptArchivoInput(
	nombres: readonly string[],
	lector: LectorEntrada = lectorReadline,
): Promise<EleccionArchivo> {
	let elegido: number | null = null;
	for (;;) {
		const lineas = nombres.map((nombre, i) => {
			const marcado = elegido === i + 1;
			const marca = marcado ? green("[x]") : dim("[ ]");
			return `  ${cyan(`${i + 1}.`)} ${marca} ${marcado ? bold(nombre) : nombre}`;
		});
		const pie = bold(
			elegido === null
				? "Elegido: ninguno"
				: `Elegido: ${nombres[elegido - 1]}`,
		);
		const ayuda = dim(
			elegido === null
				? "> Marca número de archivo | 0 cancela: "
				: "> Enter confirma | número cambia elección | 0 cancela: ",
		);
		const respuesta = await lector.leer(
			`\n${MESSAGES.playlist.inputLeyenda}\n\n${lineas.join("\n")}\n\n${pie}\n${ayuda}`,
		);
		if (respuesta.estado === "abortado") return { estado: "abortado" };
		const valor = respuesta.valor.trim().toLowerCase();
		if (valor === "0") return { estado: "cancelado" };
		if (valor === "" || valor === "ok" || valor === "done") {
			if (elegido === null) {
				showMessage(MESSAGES.playlist.inputSinElegir);
				continue;
			}
			return { estado: "elegido", indice: elegido };
		}
		if (/^\d+$/.test(valor)) {
			const numero = Number.parseInt(valor, 10);
			if (numero >= 1 && numero <= nombres.length) {
				elegido = elegido === numero ? null : numero;
				continue;
			}
		}
		showMessage(MESSAGES.playlist.inputInvalido);
	}
}

/**
 * Elige una portada de `input/covers/*` con el mismo toggle simple:
 * número marca, `Enter` confirma, `0` omite. Abajo se ve la elegida.
 */
export async function promptElegirPortada(
	nombres: readonly string[],
	lector: LectorEntrada = lectorReadline,
): Promise<EleccionArchivo> {
	let elegido: number | null = null;
	for (;;) {
		const lineas = nombres.map((nombre, i) => {
			const marcado = elegido === i + 1;
			const marca = marcado ? green("[x]") : dim("[ ]");
			return `  ${cyan(`${i + 1}.`)} ${marca} ${marcado ? bold(nombre) : nombre}`;
		});
		const pie = bold(
			elegido === null
				? "Elegida: ninguna"
				: `Elegida: ${nombres[elegido - 1]}`,
		);
		const ayuda = dim(
			elegido === null
				? "> Marca número de imagen | 0 omite: "
				: "> Enter confirma | número cambia elección | 0 omite: ",
		);
		const respuesta = await lector.leer(
			`\n${MESSAGES.playlist.portadaLeyenda}\n\n${lineas.join("\n")}\n\n${pie}\n${ayuda}`,
		);
		if (respuesta.estado === "abortado") return { estado: "abortado" };
		const valor = respuesta.valor.trim().toLowerCase();
		if (valor === "0") return { estado: "cancelado" };
		if (valor === "" || valor === "ok" || valor === "done") {
			if (elegido === null) {
				showMessage(MESSAGES.playlist.portadaSinElegir);
				continue;
			}
			return { estado: "elegido", indice: elegido };
		}
		if (/^\d+$/.test(valor)) {
			const numero = Number.parseInt(valor, 10);
			if (numero >= 1 && numero <= nombres.length) {
				elegido = elegido === numero ? null : numero;
				continue;
			}
		}
		showMessage(MESSAGES.playlist.portadaInvalida);
	}
}
