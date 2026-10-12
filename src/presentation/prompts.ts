import { stdin, stdout } from 'node:process';
import { type Interface, createInterface } from 'node:readline/promises';
import { validateRedirectUri } from '@/business/auth/types.js';
import type { Visibilidad } from '@/business/playlists/types.js';
import { resolverDescripcionEfectiva } from '@/business/playlists/validacion.js';
import { dim, error, info } from './console.js';
import { MESSAGES } from './messages.js';

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
    const clientId = await prompt('Introduce tu SPOTIFY_CLIENT_ID: ');
    if (clientId.length > 0) {
      return clientId;
    }
    writeLine(error('El Client ID no puede estar vacío.'));
  }
}

export async function promptRedirectUri(): Promise<string> {
  while (true) {
    const redirectUri = await prompt(
      'Introduce tu SPOTIFY_REDIRECT_URI (ej. http://127.0.0.1:8888/callback): '
    );
    const validation = validateRedirectUri(redirectUri);
    if (validation.valid) {
      return redirectUri;
    }
    writeLine(error(validation.error ?? 'URI inválida'));
    writeLine(info('Debe usar http://127.0.0.1:puerto/callback (no localhost)'));
  }
}

/** Texto del selector, alineado con la numeración real del menú (N-004). */
const SELECTOR_MENU = '\nSelecciona una opción (0-4,9): ';

/**
 * Ítems del menú (TASK-011) de los que se deriva la etiqueta de cada
 * elección: la única fuente de numeración y de texto es la línea del propio
 * ítem, sin segunda lista de etiquetas (N-004).
 */
const ITEMS_MENU: Record<string, string> = {
  '1': MESSAGES.menu.connect,
  '2': MESSAGES.menu.status,
  '3': MESSAGES.menu.download,
  '4': MESSAGES.menu.createPlaylist,
  '9': MESSAGES.menu.logout,
  '0': MESSAGES.menu.exit,
};

/** Etiqueta visible de un ítem del menú: el número visible lo aporta la línea. */
function etiquetaDeItem(item: string): string {
  return item.replace(/^\d+\.\s*/, '');
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
  const answer = await prompt('¿Estás seguro de que quieres salir? (s/N): ');
  return answer.toLowerCase() === 's';
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
  | { readonly estado: 'respondido'; readonly valor: string }
  | { readonly estado: 'abortado' };

/** Elección de la lista de visibilidad, con la opción pública preseleccionada. */
export type EleccionVisibilidad =
  | { readonly estado: 'seleccionada'; readonly visibilidad: Visibilidad }
  | { readonly estado: 'abortado' };

/** Opciones válidas del menú de duplicados (UC-001-A1, únicamente 0, 1 y 2). */
export type OpcionDuplicados = '0' | '1' | '2';

/** Elección del menú de duplicados. */
export type EleccionDuplicados =
  | { readonly estado: 'elegida'; readonly opcion: OpcionDuplicados }
  | { readonly estado: 'abortado' };

/** Punto de inyección de la entrada: en pruebas se sustituye por un doble. */
export interface LectorEntrada {
  leer(texto: string): Promise<EntradaPrompt>;
}

/** Formato literal de la confirmación final: solo `s` en minúscula confirma (BR-007). */
export const FORMATO_CONFIRMACION = '(s/N): ';

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
  'Visibilidad de la playlist:\n  1. Pública (preseleccionada)\n  2. Privada\nElección [Enter = 1]: ';

/** BR-007: solo `s` en minúscula confirma; `S`, `N`, vacío u otra respuesta no. */
export function interpretarConfirmacionS(respuesta: string): boolean {
  return respuesta.trim() === 's';
}

/**
 * P-002/BR-005: `Enter` (preselección), `1` y `2` eligen; el resto no es válido.
 * La equivalencia con `--public`/`--private` es total: `1` → `publica`, `2` → `privada`.
 */
export function interpretarVisibilidad(respuesta: string): Visibilidad | null {
  const eleccion = respuesta.trim();
  if (eleccion === '' || eleccion === '1') return 'publica';
  if (eleccion === '2') return 'privada';
  return null;
}

/** UC-001-A1: el menú de duplicados acepta únicamente `0`, `1` y `2`. */
export function interpretarOpcionDuplicados(respuesta: string): OpcionDuplicados | null {
  const eleccion = respuesta.trim();
  if (eleccion === '0' || eleccion === '1' || eleccion === '2') return eleccion;
  return null;
}

const lectorReadline: LectorEntrada = { leer: leerConReadline };

/** Lectura sobre `readline` real; `Ctrl+C` (señal `SIGINT`) resuelve como aborto. */
async function leerConReadline(texto: string): Promise<EntradaPrompt> {
  const readline = getReadline();
  return new Promise<EntradaPrompt>((resolve, rechazar) => {
    const alInterrumpir = (): void => {
      quitar();
      resolve({ estado: 'abortado' });
    };
    const quitar = (): void => {
      readline.removeListener('SIGINT', alInterrumpir);
    };
    readline.once('SIGINT', alInterrumpir);
    readline.question(texto).then(
      (valor) => {
        quitar();
        resolve({ estado: 'respondido', valor });
      },
      (motivo: unknown) => {
        quitar();
        rechazar(motivo);
      }
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
  interpretar: (valor: string) => T | null
): Promise<{ estado: 'valido'; valor: T } | { estado: 'abortado' }> {
  while (true) {
    const respuesta = await lector.leer(texto);
    if (respuesta.estado === 'abortado') return respuesta;
    const valor = interpretar(respuesta.valor);
    if (valor !== null) return { estado: 'valido', valor };
  }
}

/** Petición de nombre con el literal aprobado; el valor viaja en bruto hacia la solicitud. */
export async function promptNombrePlaylist(
  lector: LectorEntrada = lectorReadline
): Promise<EntradaPrompt> {
  return lector.leer(MESSAGES.playlist.namePrompt);
}

/**
 * Petición de descripción con el literal aprobado. `Enter` o solo espacios producen
 * el valor por defecto resuelto por el predicado de Business (RNF-003, RF-001).
 */
export async function promptDescripcionPlaylist(
  lector: LectorEntrada = lectorReadline
): Promise<EntradaPrompt> {
  const respuesta = await lector.leer(MESSAGES.playlist.descriptionPrompt);
  if (respuesta.estado === 'abortado') return respuesta;
  return { estado: 'respondido', valor: resolverDescripcionEfectiva(respuesta.valor) };
}

/** Lista de visibilidad con la pública preseleccionada; repite hasta elegir válida. */
export async function promptVisibilidadPlaylist(
  lector: LectorEntrada = lectorReadline
): Promise<EleccionVisibilidad> {
  const eleccion = await pedirHastaValidar(lector, LISTA_VISIBILIDAD, interpretarVisibilidad);
  if (eleccion.estado === 'abortado') return eleccion;
  return { estado: 'seleccionada', visibilidad: eleccion.valor };
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
    resumen.descripcionEfectiva
  );
  return `${resumenLiteral}\n${MESSAGES.playlist.confirmPrompt}${FORMATO_CONFIRMACION}`;
}

/**
 * Confirmación final con el formato `(s/N): ` y, cuando procede, el resumen de
 * los datos efectivos; la interpretación la hace el llamado (BR-007, DISC-006).
 */
export async function confirmarCreacion(
  resumen?: ResumenCreacion,
  lector: LectorEntrada = lectorReadline
): Promise<EntradaPrompt> {
  return lector.leer(textoConfirmacion(resumen));
}

/** Menú de duplicados con el literal aprobado; acepta únicamente `0`, `1` y `2`. */
export async function promptOpcionDuplicados(
  lector: LectorEntrada = lectorReadline
): Promise<EleccionDuplicados> {
  const eleccion = await pedirHastaValidar(
    lector,
    MESSAGES.playlist.duplicateMenu,
    interpretarOpcionDuplicados
  );
  if (eleccion.estado === 'abortado') return eleccion;
  return { estado: 'elegida', opcion: eleccion.valor };
}

/** Pregunta de modificación con el literal aprobado; interpreta con la convención `s/N`. */
export async function promptModificarDescripcion(
  lector: LectorEntrada = lectorReadline
): Promise<EntradaPrompt> {
  return lector.leer(MESSAGES.playlist.modifyPrompt);
}
