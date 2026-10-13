import { describe, expect, it, vi } from "vitest";
import {
	clasificarRespuestaSN,
	interpretarConfirmacionS,
	pedirConfirmacionSN,
} from "../src/presentation/prompts.js";

describe("confirmación (s/N) sin cancelación silenciosa", () => {
	it("BR-007 intacta: solo `s` confirma", () => {
		expect(interpretarConfirmacionS("s")).toBe(true);
		expect(interpretarConfirmacionS("S")).toBe(false);
		expect(interpretarConfirmacionS("")).toBe(false);
		expect(clasificarRespuestaSN("s")).toBe("confirmada");
		expect(clasificarRespuestaSN("N")).toBe("cancelada");
		expect(clasificarRespuestaSN("")).toBe("cancelada");
	});

	it("casi-sí (S, si, yes) pide repetir en vez de cancelar", () => {
		expect(clasificarRespuestaSN("S")).toBe("repetir");
		expect(clasificarRespuestaSN("si")).toBe("repetir");
		expect(clasificarRespuestaSN("Sí")).toBe("repetir");
		expect(clasificarRespuestaSN("yes")).toBe("repetir");
	});

	it("re-pregunta con aviso hasta `s` o cancelación", async () => {
		const escrito: string[] = [];
		const espia = vi.spyOn(process.stdout, "write").mockImplementation(((
			texto: unknown,
		) => {
			escrito.push(String(texto));
			return true;
		}) as typeof process.stdout.write);
		try {
			const lector = {
				leer: vi
					.fn()
					.mockResolvedValueOnce({ estado: "respondido", valor: "S" })
					.mockResolvedValueOnce({ estado: "respondido", valor: "s" }),
			};
			const respuesta = await pedirConfirmacionSN(lector, "¿Crear? (s/N): ");
			expect(respuesta).toEqual({ estado: "respondido", valor: "s" });
			expect(lector.leer).toHaveBeenCalledTimes(2);
			expect(
				escrito.some((linea) => linea.includes("Solo `s` en minúscula")),
			).toBe(true);
		} finally {
			espia.mockRestore();
		}
	});

	it("propaga el aborto sin repetir", async () => {
		const lector = {
			leer: vi.fn().mockResolvedValue({ estado: "abortado" }),
		};
		const respuesta = await pedirConfirmacionSN(lector, "¿Crear? (s/N): ");
		expect(respuesta).toEqual({ estado: "abortado" });
		expect(lector.leer).toHaveBeenCalledTimes(1);
	});
});
