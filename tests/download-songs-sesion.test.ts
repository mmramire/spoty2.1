import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/business/auth/tokens.js", () => ({
	getStoredTokens: vi.fn(),
}));

vi.mock("../src/business/auth/flow.js", () => ({
	checkExistingSession: vi.fn(),
}));

vi.mock("../src/data/download-songs.service.js", () => ({
	fetchAllSavedTracks: vi.fn(),
}));

vi.mock("../src/business/auth/profile.js", () => ({
	getUserProfile: vi.fn(),
}));

import * as os from "node:os";
import * as path from "node:path";
import { checkExistingSession } from "../src/business/auth/flow.js";
import { getUserProfile } from "../src/business/auth/profile.js";
import { getStoredTokens } from "../src/business/auth/tokens.js";
import { downloadSongs } from "../src/business/download-songs.js";
import { fetchAllSavedTracks } from "../src/data/download-songs.service.js";

const tokensValidos = {
	access_token: "access",
	refresh_token: "refresh",
	expires_at: Date.now() + 3600_000,
	scope: "user-library-read user-read-email",
	token_type: "Bearer",
};

const sesionVigente = {
	tokens: tokensValidos,
	profile: { display_name: "Usuario", email: "usuario@example.com" },
};

describe("downloadSongs: validación previa de sesión", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("sin tokens guardados falla sin validar la sesión ni pedir la biblioteca", async () => {
		vi.mocked(getStoredTokens).mockReturnValue(null);

		const resultado = await downloadSongs({});

		expect(resultado.success).toBe(false);
		expect(checkExistingSession).not.toHaveBeenCalled();
		expect(fetchAllSavedTracks).not.toHaveBeenCalled();
	});

	it("con tokens pero sin sesión vigente falla antes de la petición de descarga", async () => {
		vi.mocked(getStoredTokens).mockReturnValue(tokensValidos as never);
		vi.mocked(checkExistingSession).mockResolvedValue(null);

		const resultado = await downloadSongs({});

		expect(resultado).toMatchObject({ success: false, totalTracks: 0 });
		expect(resultado.error).toMatch(/sesi.n activa/i);
		expect(checkExistingSession).toHaveBeenCalledTimes(1);
		expect(fetchAllSavedTracks).not.toHaveBeenCalled();
		expect(getUserProfile).not.toHaveBeenCalled();
	});

	it("con sesión vigente procede a descargar la biblioteca", async () => {
		vi.mocked(getStoredTokens).mockReturnValue(tokensValidos as never);
		vi.mocked(checkExistingSession).mockResolvedValue(sesionVigente as never);
		vi.mocked(fetchAllSavedTracks).mockResolvedValue([]);
		vi.mocked(getUserProfile).mockResolvedValue({
			display_name: "Usuario",
			email: "usuario@example.com",
		} as never);

		const outputDir = path.join(os.tmpdir(), `spoty-test-${Date.now()}`);
		const resultado = await downloadSongs({ outputDir });

		expect(resultado.success).toBe(true);
		expect(checkExistingSession).toHaveBeenCalledTimes(1);
		expect(fetchAllSavedTracks).toHaveBeenCalledTimes(1);
	});
});
