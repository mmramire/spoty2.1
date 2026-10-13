import { describe, expect, it, vi } from "vitest";
import { subirPortadaAPlaylist } from "../src/business/playlists/subir-portada.js";
import { validarPortadaBytes } from "../src/business/playlists/validacion-portada.js";

function jpegBytes(size: number): Uint8Array {
	const bytes = new Uint8Array(size);
	bytes[0] = 0xff;
	bytes[1] = 0xd8;
	bytes[2] = 0xff;
	return bytes;
}

function dependenciasOk(subir = vi.fn().mockResolvedValue(undefined)) {
	return {
		sesionProveedor: {
			obtenerSesionVigente: vi.fn().mockResolvedValue({ testigoSesion: "tok" }),
		},
		playlistGateway: {
			crearPlaylist: vi.fn(),
			listarPlaylistsPropias: vi.fn(),
			agregarCanciones: vi.fn(),
			subirPortada: subir,
		},
		registroTecnico: { info: vi.fn(), advertencia: vi.fn(), error: vi.fn() },
		espera: { esperar: vi.fn() },
	};
}

describe("portada de playlist", () => {
	it("acepta JPEG dentro del tope y rechaza no-JPEG o exceso", () => {
		const bytes = jpegBytes(100);
		const base64 = Buffer.from(bytes).toString("base64");
		expect(validarPortadaBytes(bytes, base64).valida).toBe(true);

		const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
		expect(validarPortadaBytes(png, "aGk=").valida).toBe(false);

		const grande = jpegBytes(200 * 1024);
		const base64Grande = Buffer.from(grande).toString("base64");
		expect(validarPortadaBytes(grande, base64Grande).valida).toBe(false);
	});

	it("sube con el testigo vigente y registra el identificador", async () => {
		const subir = vi.fn().mockResolvedValue(undefined);
		const dependencias = dependenciasOk(subir);
		const resultado = await subirPortadaAPlaylist(
			{ playlistId: "id-1", base64: "aGk=" },
			dependencias,
		);
		expect(resultado).toEqual({ resultado: "exito", playlistId: "id-1" });
		expect(subir).toHaveBeenCalledWith({
			playlistId: "id-1",
			base64: "aGk=",
			testigoSesion: "tok",
		});
	});

	it("sin sesión no invoca el gateway", async () => {
		const subir = vi.fn();
		const dependencias = {
			...dependenciasOk(subir),
			sesionProveedor: {
				obtenerSesionVigente: vi.fn().mockResolvedValue(null),
			},
		};
		const resultado = await subirPortadaAPlaylist(
			{ playlistId: "id-1", base64: "aGk=" },
			dependencias,
		);
		expect(resultado).toEqual({ resultado: "sinSesion" });
		expect(subir).not.toHaveBeenCalled();
	});
});
