/**
 * Implementación de la puerta de acceso a playlists de Spotify (capa Data).
 *
 * Trazabilidad: OBJ-001 → RF-001, RNF-001 → UC-001 → AC-001, AC-004, AC-005 →
 * TASK-002 → TC-002, TC-003.
 *
 * Cumple estructuralmente el puerto `PlaylistGateway` de Business sin
 * importarlo (RNF-003): la conformidad se comprueba por tipado estructural en
 * la prueba de integración. La sesión queda encapsulada en Data: por defecto se
 * lee de `tokens-file.ts` y en pruebas se inyecta `obtenerTestigoSesion`.
 *
 * Las respuestas HTTP se traducen a `ErrorApiSpotify` con `estado` y `causa`
 * depurada (sin cuerpos de respuesta, sin mensajes de usuario); el 429
 * incorpora `reintentoTras` leído de la cabecera `Retry-After` en segundos
 * (RNF-001, ARCHITECTURE §4.3).
 */
import { isTokenValid, loadTokens } from '../storage/tokens-file.js';

const URL_BASE = 'https://api.spotify.com/v1';
const LIMITE_PAGINA = 50;

/** Entrada de creación efectiva que acepta el gateway (forma del puerto de Business). */
export interface EntradaCreacion {
  readonly nombreEfectivo: string;
  readonly descripcionEfectiva: string;
  readonly visibilidad: 'publica' | 'privada';
  readonly testigoSesion: string;
}

/** Playlist creada: identificador y enlace devueltos por Spotify. */
export interface PlaylistCreada {
  readonly identificador: string;
  readonly enlace: string;
}

/** Gateway de playlists con la forma estructural del puerto `PlaylistGateway`. */
export interface GatewayPlaylists {
  crearPlaylist: (entrada: EntradaCreacion) => Promise<PlaylistCreada>;
  listarPlaylistsPropias: () => Promise<string[]>;
}

/** Punto de inyección de `fetch` para pruebas sin red real. */
export type FetchInyectable = (url: string, init?: RequestInit) => Promise<Response>;

/** Opciones del gateway: red simulada y obtención de testigo de sesión. */
export interface OpcionesGateway {
  readonly fetchInyectado?: FetchInyectable;
  readonly obtenerTestigoSesion?: () => string | null;
}

/**
 * Error tipado de HTTP hacia Spotify: nunca contiene cuerpos de respuesta,
 * cabeceras ni mensajes de usuario en su causa (RNF-001).
 */
export class ErrorApiSpotify extends Error {
  readonly estado: number;
  readonly causa: string;
  /** Segundos de espera del 429 según `Retry-After`; ausente si no se aportó. */
  readonly reintentoTras?: number;

  constructor(causa: string, estado: number, reintentoTras?: number) {
    super(causa);
    this.name = 'ErrorApiSpotify';
    this.causa = causa;
    this.estado = estado;
    if (reintentoTras !== undefined) {
      this.reintentoTras = reintentoTras;
    }
  }
}

function esCadena(valor: unknown): valor is string {
  return typeof valor === 'string';
}

function testigoDeAlmacenamiento(): string | null {
  const tokens = loadTokens();
  if (!tokens || !isTokenValid(tokens)) {
    return null;
  }
  return tokens.access_token;
}

function cabecerasAutorizacion(testigo: string, conTipoContenido: boolean): Record<string, string> {
  const cabeceras: Record<string, string> = { Authorization: `Bearer ${testigo}` };
  if (conTipoContenido) {
    cabeceras['Content-Type'] = 'application/json';
  }
  return cabeceras;
}

function leerReintentoTras(cabeceras: Headers): number | undefined {
  const cabecera = cabeceras.get('Retry-After');
  if (!cabecera) {
    return undefined;
  }
  const segundos = Number.parseInt(cabecera, 10);
  return Number.isNaN(segundos) ? undefined : segundos;
}

/** Traduce una respuesta no satisfactoria a error tipado sin cuerpo en la causa. */
function errorDeRespuesta(respuesta: Response): ErrorApiSpotify {
  const causa = `HTTP ${respuesta.status}`;
  if (respuesta.status === 429) {
    return new ErrorApiSpotify(causa, 429, leerReintentoTras(respuesta.headers));
  }
  return new ErrorApiSpotify(causa, respuesta.status);
}

async function solicitar(
  fetchHttp: FetchInyectable,
  url: string,
  init?: RequestInit
): Promise<Response> {
  const respuesta = await fetchHttp(url, init);
  if (!respuesta.ok) {
    throw errorDeRespuesta(respuesta);
  }
  return respuesta;
}

/**
 * Resuelve el identificador del usuario vigente con `GET /me`. Solo lo usa el
 * listado de propias: la creación ya no resuelve usuario porque ordena con
 * `POST /me/playlists` (DISC-005; el punto `/users/{id}/playlists` está retirado
 * y devuelve 403 en aplicaciones de desarrollo).
 */
async function obtenerUsuario(fetchHttp: FetchInyectable, testigo: string): Promise<string> {
  const respuesta = await solicitar(fetchHttp, `${URL_BASE}/me`, {
    headers: cabecerasAutorizacion(testigo, false),
  });
  const datos = (await respuesta.json()) as { id?: unknown };
  if (!esCadena(datos.id)) {
    throw new ErrorApiSpotify(`HTTP ${respuesta.status}`, respuesta.status);
  }
  return datos.id;
}

async function leerPlaylistCreadada(respuesta: Response): Promise<PlaylistCreada> {
  const datos = (await respuesta.json()) as {
    id?: unknown;
    external_urls?: { spotify?: unknown };
  };
  const identificador = datos.id;
  const enlace = datos.external_urls?.spotify;
  if (!esCadena(identificador) || !esCadena(enlace)) {
    throw new ErrorApiSpotify(`HTTP ${respuesta.status}`, respuesta.status);
  }
  return { identificador, enlace };
}

/**
 * Orden de creación con `POST /me/playlists` (DISC-005): sin `GET /me` previo,
 * sin identificador de usuario y sin `collaborative` (P-001, BR-005). El cuerpo
 * lleva únicamente `name`, `description` y `public` (RNF-001: sin secretos ni
 * registros propios en este módulo).
 */
async function crearPlaylist(
  entrada: EntradaCreacion,
  fetchHttp: FetchInyectable
): Promise<PlaylistCreada> {
  const respuesta = await solicitar(fetchHttp, `${URL_BASE}/me/playlists`, {
    method: 'POST',
    headers: cabecerasAutorizacion(entrada.testigoSesion, true),
    body: JSON.stringify({
      name: entrada.nombreEfectivo,
      description: entrada.descripcionEfectiva,
      public: entrada.visibilidad === 'publica',
    }),
  });
  return leerPlaylistCreadada(respuesta);
}

interface ItemPagina {
  readonly name?: unknown;
  readonly owner?: { readonly id?: unknown };
}

interface PaginaPlaylists {
  readonly items?: readonly ItemPagina[];
  readonly next?: string | null;
}

function nombresPropiosDePagina(pagina: PaginaPlaylists, usuarioId: string): string[] {
  const items = pagina.items ?? [];
  const nombres: string[] = [];
  for (const item of items) {
    if (item?.owner?.id === usuarioId && esCadena(item.name)) {
      nombres.push(item.name);
    }
  }
  return nombres;
}

async function listarPlaylistsPropias(
  fetchHttp: FetchInyectable,
  obtenerTestigo: () => string | null
): Promise<string[]> {
  const testigo = obtenerTestigo();
  if (!testigo) {
    throw new ErrorApiSpotify('HTTP 401', 401);
  }
  const usuarioId = await obtenerUsuario(fetchHttp, testigo);
  const propias: string[] = [];
  let url: string | null = `${URL_BASE}/me/playlists?limit=${LIMITE_PAGINA}`;
  while (url) {
    const respuesta = await solicitar(fetchHttp, url, {
      headers: cabecerasAutorizacion(testigo, false),
    });
    const pagina = (await respuesta.json()) as PaginaPlaylists;
    propias.push(...nombresPropiosDePagina(pagina, usuarioId));
    url = pagina.next ?? null;
  }
  return propias;
}

/**
 * Crea el gateway de playlists. Sin opciones usa `fetch` global y el testigo
 * de sesión almacenado en `tokens-file.ts` (sesión encapsulada en Data).
 */
export function crearPlaylistGateway(opciones: OpcionesGateway = {}): GatewayPlaylists {
  const fetchHttp: FetchInyectable = opciones.fetchInyectado ?? ((url, init) => fetch(url, init));
  const obtenerTestigo = opciones.obtenerTestigoSesion ?? testigoDeAlmacenamiento;
  return {
    crearPlaylist: (entrada) => crearPlaylist(entrada, fetchHttp),
    listarPlaylistsPropias: () => listarPlaylistsPropias(fetchHttp, obtenerTestigo),
  };
}
