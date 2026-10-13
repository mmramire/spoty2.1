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

import { ejecutarFlujoCreacion } from "../src/presentation/crear-playlist.js";
import { showMessage } from "../src/presentation/prompts.js";

function peticionesFijas(confirmaciones: string[], opciones: string[]) {
	const colaConfirmacion = [...confirmaciones];
	const colaOpciones = [...opciones];
	return {
		nombre: vi.fn(),
		descripcion: vi.fn(),
		visibilidad: vi.fn(),
		confirmacion: vi.fn().mockImplementation(() =>
			Promise.resolve({
				estado: "respondido",
				valor: colaConfirmacion.shift() ?? "N",
			}),
		),
		opcionDuplicados: vi.fn().mockImplementation(() =>
			Promise.resolve({
				estado: "elegida",
				opcion: colaOpciones.shift() ?? "0",
			}),
		),
		modificacion: vi.fn(),
	};
}

describe("duplicado aceptado + N vuelve al menú de duplicados", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("tras el 2, N conserva datos y permite elegir 1 para renombrar", async () => {
		// 1) duplicado → 2 (crear igual) → N en confirmación → menú → 1 →
		// renombra a PRUEBA-002 → s → creada.
		const casoUso = vi
			.fn()
			.mockResolvedValueOnce({
				resultado: "duplicado",
				nombreEfectivo: "PRUEBA-001",
			})
			.mockResolvedValueOnce({ resultado: "cancelado" })
			.mockResolvedValueOnce({
				resultado: "exito",
				nombreEfectivo: "PRUEBA-002",
				visibilidad: "publica",
				descripcionEfectiva: "Descripción",
				identificador: "id-2",
				enlace: "enlace-2",
			});
		const peticiones = {
			...peticionesFijas([], ["2", "1"]),
			nombre: vi
				.fn()
				.mockResolvedValue({ estado: "respondido", valor: "PRUEBA-002" }),
			modificacion: vi
				.fn()
				.mockResolvedValue({ estado: "respondido", valor: "N" }),
		};

		const finalizacion = await ejecutarFlujoCreacion({
			casoUso,
			peticiones,
			entradaDirecta: {
				nombre: "PRUEBA-001",
				descripcion: "Descripción",
				visibilidad: "publica",
				confirmacionPreResuelta: false,
			},
		});

		expect(finalizacion).toEqual({ estado: "creada" });
		// Segunda invocación al caso de uso con duplicado aceptado.
		expect(casoUso.mock.calls[1]?.[0]).toMatchObject({
			duplicadoAceptado: true,
		});
		// Tras renombrar se reinvoca sin el flag.
		expect(
			casoUso.mock.calls[2]?.[0] as { duplicadoAceptado?: boolean },
		).not.toHaveProperty("duplicadoAceptado");
	});

	it("tras el 2, 0 en el menú cancela todo", async () => {
		const casoUso = vi
			.fn()
			.mockResolvedValueOnce({
				resultado: "duplicado",
				nombreEfectivo: "PRUEBA-001",
			})
			.mockResolvedValueOnce({ resultado: "cancelado" });
		const peticiones = peticionesFijas(["N"], ["2", "0"]);

		const finalizacion = await ejecutarFlujoCreacion({
			casoUso,
			peticiones,
			entradaDirecta: {
				nombre: "PRUEBA-001",
				descripcion: "Descripción",
				visibilidad: "publica",
				confirmacionPreResuelta: false,
			},
		});

		expect(finalizacion).toEqual({ estado: "cancelada" });
		expect(casoUso).toHaveBeenCalledTimes(2);
		expect(showMessage).toHaveBeenCalledWith(MESSAGES.playlist.cancelled);
	});
});
