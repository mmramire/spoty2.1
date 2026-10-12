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

import {
	type PeticionesCreacion,
	ejecutarFlujoCreacion,
} from "../src/presentation/crear-playlist.js";
import { showError } from "../src/presentation/prompts.js";

function crearPeticionesAbortadas(contador: {
	llamadas: number;
}): PeticionesCreacion {
	const contar = async <T>(valor: T): Promise<T> => {
		contador.llamadas += 1;
		return valor;
	};
	return {
		nombre: () => contar({ estado: "abortado" } as const),
		descripcion: () => contar({ estado: "abortado" } as const),
		visibilidad: () => contar({ estado: "abortado" } as const),
		confirmacion: () => contar({ estado: "abortado" } as const),
		opcionDuplicados: () => contar({ estado: "abortado" } as const),
		modificacion: () => contar({ estado: "abortado" } as const),
	};
}

describe("ejecutarFlujoCreacion: validación previa de sesión (UC-001-E1)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("sin sesión vigente finaliza como error sin pedir el formulario ni invocar la petición", async () => {
		const contador = { llamadas: 0 };
		const casoUso = vi.fn();
		const verificarSesion = vi.fn().mockResolvedValue(false);

		const finalizacion = await ejecutarFlujoCreacion({
			casoUso,
			peticiones: crearPeticionesAbortadas(contador),
			verificarSesion,
		});

		expect(finalizacion).toEqual({ estado: "error" });
		expect(verificarSesion).toHaveBeenCalledTimes(1);
		expect(contador.llamadas).toBe(0);
		expect(casoUso).not.toHaveBeenCalled();
		expect(showError).toHaveBeenCalledWith(MESSAGES.playlist.noSessionError);
	});

	it("sin sesión vigente tampoco invoca la petición en comando directo con entrada pre-resuelta", async () => {
		const contador = { llamadas: 0 };
		const casoUso = vi.fn();
		const verificarSesion = vi.fn().mockResolvedValue(false);

		const finalizacion = await ejecutarFlujoCreacion({
			casoUso,
			peticiones: crearPeticionesAbortadas(contador),
			entradaDirecta: {
				nombre: "Mi playlist",
				descripcion: "Descripción",
				visibilidad: "publica",
				confirmacionPreResuelta: true,
			},
			verificarSesion,
		});

		expect(finalizacion).toEqual({ estado: "error" });
		expect(casoUso).not.toHaveBeenCalled();
		expect(showError).toHaveBeenCalledWith(MESSAGES.playlist.noSessionError);
	});

	it("con sesión vigente continúa con el flujo (pide el formulario)", async () => {
		const contador = { llamadas: 0 };
		const casoUso = vi.fn();
		const verificarSesion = vi.fn().mockResolvedValue(true);

		const finalizacion = await ejecutarFlujoCreacion({
			casoUso,
			peticiones: crearPeticionesAbortadas(contador),
			verificarSesion,
		});

		// El formulario abortado en la primera petición cancela sin invocar el caso de uso.
		expect(finalizacion).toEqual({ estado: "cancelada" });
		expect(verificarSesion).toHaveBeenCalledTimes(1);
		expect(contador.llamadas).toBeGreaterThan(0);
		expect(casoUso).not.toHaveBeenCalled();
		expect(showError).not.toHaveBeenCalledWith(
			MESSAGES.playlist.noSessionError,
		);
	});

	it("sin verificador mantiene el comportamiento anterior (pide el formulario)", async () => {
		const contador = { llamadas: 0 };
		const casoUso = vi.fn();

		const finalizacion = await ejecutarFlujoCreacion({
			casoUso,
			peticiones: crearPeticionesAbortadas(contador),
		});

		expect(finalizacion).toEqual({ estado: "cancelada" });
		expect(contador.llamadas).toBeGreaterThan(0);
	});
});
