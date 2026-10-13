import { describe, expect, it, vi } from "vitest";
import { agregarCancionesAPlaylists } from "../src/business/playlists/agregar-canciones.js";
import {
	alternarIndices,
	interpretarEntradaSeleccion,
} from "../src/business/playlists/seleccion.js";
import { validarBatchJson } from "../src/business/playlists/validacion-batch.js";

const PLAYLISTS = [
	{ id: "id-1", nombre: "PRUEBA-001" },
	{ id: "id-2", nombre: "Rock" },
	{ id: "id-3", nombre: "Jazz" },
];

function dependenciasOk(agregar = vi.fn().mockResolvedValue(2)) {
	return {
		sesionProveedor: {
			obtenerSesionVigente: vi.fn().mockResolvedValue({ testigoSesion: "tok" }),
		},
		playlistGateway: {
			crearPlaylist: vi.fn(),
			listarPlaylistsPropias: vi.fn(),
			agregarCanciones: agregar,
			subirPortada: vi.fn(),
		},
		registroTecnico: { info: vi.fn(), advertencia: vi.fn(), error: vi.fn() },
		espera: { esperar: vi.fn() },
	};
}

describe("batch estricto + toggle + agregado", () => {
	it("valida el formato estricto 2 y rechaza campos extra", () => {
		const ok = validarBatchJson({
			source: "2026-10-12_21-36-16-download_songs.json",
			tracks: [
				{
					id: "1Bc6DBlULAm002j4GeXP68",
					uri: "spotify:track:1Bc6DBlULAm002j4GeXP68",
					name: "Diane",
					artists: ["Miles Davis Quintet"],
				},
			],
		});
		expect(ok.valida).toBe(true);

		const extra = validarBatchJson({
			source: "x",
			tracks: [
				{
					id: "1Bc6DBlULAm002j4GeXP68",
					uri: "spotify:track:1Bc6DBlULAm002j4GeXP68",
					name: "Diane",
					artists: ["Miles Davis Quintet"],
					extra: 1,
				},
			],
		});
		expect(extra.valida).toBe(false);
	});

	it("toggle interpreta 1,3 / all / Enter / 0", () => {
		expect(interpretarEntradaSeleccion("1,3", 3)).toEqual({
			tipo: "alternar",
			indices: [1, 3],
		});
		expect(interpretarEntradaSeleccion("all", 3)).toEqual({ tipo: "todas" });
		expect(interpretarEntradaSeleccion("", 3)).toEqual({ tipo: "confirmar" });
		expect(interpretarEntradaSeleccion("0", 3)).toEqual({ tipo: "cancelar" });
		expect(interpretarEntradaSeleccion("9", 3)).toEqual({ tipo: "invalida" });
		expect(alternarIndices([1], [1, 2])).toEqual([2]);
	});

	it("agrega a cada playlist seleccionada con el testigo vigente", async () => {
		const agregar = vi.fn().mockResolvedValue(2);
		const primera = PLAYLISTS[0];
		const segunda = PLAYLISTS[1];
		if (primera === undefined || segunda === undefined) {
			throw new Error("fixtures incompletos");
		}
		const resultado = await agregarCancionesAPlaylists(
			{
				playlists: [primera, segunda],
				uris: [
					"spotify:track:1Bc6DBlULAm002j4GeXP68",
					"spotify:track:6otAMbr9eiTRksxQaLgNnX",
				],
			},
			dependenciasOk(agregar),
		);
		expect(resultado.resultado).toBe("exito");
		expect(agregar).toHaveBeenCalledTimes(2);
		expect(agregar).toHaveBeenCalledWith({
			playlistId: "id-1",
			uris: [
				"spotify:track:1Bc6DBlULAm002j4GeXP68",
				"spotify:track:6otAMbr9eiTRksxQaLgNnX",
			],
			testigoSesion: "tok",
		});
	});

	it("sin playlists o sin uris es errorValidacion sin llamar al gateway", async () => {
		const agregar = vi.fn();
		const sinPlaylists = await agregarCancionesAPlaylists(
			{ playlists: [], uris: ["spotify:track:1Bc6DBlULAm002j4GeXP68"] },
			dependenciasOk(agregar),
		);
		expect(sinPlaylists).toEqual({
			resultado: "errorValidacion",
			campo: "playlists",
		});
		expect(agregar).not.toHaveBeenCalled();
	});
});
