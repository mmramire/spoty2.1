import { beforeEach, describe, expect, it, vi } from "vitest";
import { MESSAGES } from "../src/presentation/messages.js";

vi.mock("../src/presentation/prompts.js", async (importOriginal) => {
	const original =
		await importOriginal<typeof import("../src/presentation/prompts.js")>();
	return {
		...original,
		showError: vi.fn(),
		showMessage: vi.fn(),
	};
});

import { ejecutarFlujoListado } from "../src/presentation/listar-playlists.js";
import { showError, showMessage } from "../src/presentation/prompts.js";

describe("ejecutarFlujoListado: listado de playlists propias", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("sin sesión vigente finaliza como error sin invocar la petición", async () => {
		const casoUso = vi.fn();
		const verificarSesion = vi.fn().mockResolvedValue(false);

		const finalizacion = await ejecutarFlujoListado({
			casoUso,
			verificarSesion,
		});

		expect(finalizacion).toEqual({ estado: "error" });
		expect(verificarSesion).toHaveBeenCalledTimes(1);
		expect(casoUso).not.toHaveBeenCalled();
		expect(showError).toHaveBeenCalledWith(MESSAGES.playlist.noSessionError);
	});

	it("con sesión vigente y sin playlists avisa la lista vacía", async () => {
		const casoUso = vi.fn().mockResolvedValue({
			resultado: "exito",
			playlists: [],
		});
		const verificarSesion = vi.fn().mockResolvedValue(true);

		const finalizacion = await ejecutarFlujoListado({
			casoUso,
			verificarSesion,
		});

		expect(finalizacion).toEqual({ estado: "lista" });
		expect(casoUso).toHaveBeenCalledTimes(1);
		expect(showMessage).toHaveBeenCalledWith(MESSAGES.playlist.listaVacia);
	});

	it("con sesión vigente presenta los nombres de las playlists", async () => {
		const playlists = [
			{ id: "id-rock", nombre: "Rock" },
			{ id: "id-jazz", nombre: "Jazz nocturno" },
		];
		const casoUso = vi.fn().mockResolvedValue({
			resultado: "exito",
			playlists,
		});
		const verificarSesion = vi.fn().mockResolvedValue(true);

		const finalizacion = await ejecutarFlujoListado({
			casoUso,
			verificarSesion,
		});

		expect(finalizacion).toEqual({ estado: "lista" });
		expect(showMessage).toHaveBeenCalledWith(
			MESSAGES.playlist.listado(playlists),
		);
	});

	it("ante sesión caducada presenta su literal y finaliza como error", async () => {
		const casoUso = vi.fn().mockResolvedValue({
			resultado: "sesionCaducada",
			causa: "HTTP 401",
		});
		const verificarSesion = vi.fn().mockResolvedValue(true);

		const finalizacion = await ejecutarFlujoListado({
			casoUso,
			verificarSesion,
		});

		expect(finalizacion).toEqual({ estado: "error" });
		expect(showError).toHaveBeenCalledWith(
			MESSAGES.playlist.sessionExpiredError,
		);
	});

	it("sin verificador invoca la petición directamente", async () => {
		const casoUso = vi.fn().mockResolvedValue({
			resultado: "exito",
			playlists: [{ id: "id-rock", nombre: "Rock" }],
		});

		const finalizacion = await ejecutarFlujoListado({ casoUso });

		expect(finalizacion).toEqual({ estado: "lista" });
		expect(casoUso).toHaveBeenCalledTimes(1);
	});
});
