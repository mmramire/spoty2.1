import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/business/auth/tokens.js", () => ({
	getStoredTokens: vi.fn(),
}));

vi.mock("../src/business/auth/flow.js", () => ({
	checkExistingSession: vi.fn(),
}));

import { checkExistingSession } from "../src/business/auth/flow.js";
import { getStoredTokens } from "../src/business/auth/tokens.js";
import { verificarSesionParaCrearPlaylist } from "../src/presentation/composicion-crear-playlist.js";

const tokensValidos = {
	access_token: "access",
	refresh_token: "refresh",
	expires_at: Date.now() + 3600_000,
	scope: "playlist-modify-public",
	token_type: "Bearer",
};

describe("verificarSesionParaCrearPlaylist: composición real de sesión", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("sin tokens almacenados retorna false sin consultar la red", async () => {
		vi.mocked(getStoredTokens).mockReturnValue(null);

		await expect(verificarSesionParaCrearPlaylist()).resolves.toBe(false);
		expect(checkExistingSession).not.toHaveBeenCalled();
	});

	it("con tokens y sesión vigente retorna true", async () => {
		vi.mocked(getStoredTokens).mockReturnValue(tokensValidos as never);
		vi.mocked(checkExistingSession).mockResolvedValue({
			tokens: tokensValidos,
			profile: { display_name: "Usuario", email: "usuario@example.com" },
		} as never);

		await expect(verificarSesionParaCrearPlaylist()).resolves.toBe(true);
		expect(checkExistingSession).toHaveBeenCalledTimes(1);
	});

	it("con tokens pero sesión inválida retorna false", async () => {
		vi.mocked(getStoredTokens).mockReturnValue(tokensValidos as never);
		vi.mocked(checkExistingSession).mockResolvedValue(null);

		await expect(verificarSesionParaCrearPlaylist()).resolves.toBe(false);
	});
});
