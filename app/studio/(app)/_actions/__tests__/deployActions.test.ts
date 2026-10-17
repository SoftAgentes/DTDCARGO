import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: null as { id: string } | null,
  role: null as string | null,
  getGitStatus: vi.fn(),
}));

vi.mock("@/lib/db/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: mocks.user } }) },
  }),
}));

vi.mock("@/lib/studio/rbac-guard", () => ({
  getStudioRole: async () => mocks.role,
}));

vi.mock("@/lib/studio/deploy/git-runner", () => ({
  gitAddAll: vi.fn(),
  gitCheckoutNewBranch: vi.fn(),
  gitCommit: vi.fn(),
  gitPush: vi.fn(),
  gitPushSetUpstream: vi.fn(),
  gitRevParse: vi.fn(),
  getGitStatus: mocks.getGitStatus,
  makePreviewBranchName: vi.fn(),
}));

import { getDeployStatusAction, gitPushAction } from "../deployActions";

describe("deploy actions · gate server-side", () => {
  beforeEach(() => {
    // Sin señal de despliegue y con NODE_ENV=test (Vitest) el runtime es local.
    delete process.env.VERCEL_ENV;
    delete process.env.APP_ENV;
    mocks.user = null;
    mocks.role = null;
    mocks.getGitStatus.mockReset();
    mocks.getGitStatus.mockResolvedValue({ currentBranch: "main", hasChanges: false });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rechaza una llamada sin sesión antes de tocar git", async () => {
    await expect(getDeployStatusAction()).resolves.toEqual({
      ok: false,
      error: "No autorizado.",
    });
    expect(mocks.getGitStatus).not.toHaveBeenCalled();
  });

  it("rechaza un usuario no admin antes de tocar git", async () => {
    mocks.user = { id: "user-1" };
    mocks.role = "support";
    await expect(getDeployStatusAction()).resolves.toEqual({
      ok: false,
      error: "No autorizado.",
    });
    expect(mocks.getGitStatus).not.toHaveBeenCalled();
  });

  it("preserva el acceso local para un admin autenticado", async () => {
    mocks.user = { id: "admin-1" };
    mocks.role = "admin";
    await expect(getDeployStatusAction()).resolves.toMatchObject({ ok: true });
    expect(mocks.getGitStatus).toHaveBeenCalledOnce();
  });

  /**
   * Candado de runtime (SDD-0505 · M1 de la auditoría 2026-07-31). Todos los
   * casos corren como ADMIN AUTENTICADO a propósito: si el candado faltara, el
   * admin pasaría y `getGitStatus` se llamaría. Comprobar solo el mensaje no
   * basta — una implementación que loguea y sigue también lo devolvería.
   */
  describe("rechaza fuera de local sin tocar git", () => {
    beforeEach(() => {
      mocks.user = { id: "admin-1" };
      mocks.role = "admin";
    });

    it.each([
      ["APP_ENV=production", { APP_ENV: "production" }],
      ["APP_ENV=staging", { APP_ENV: "staging" }],
      ["APP_ENV=preview", { APP_ENV: "preview" }],
      ["VERCEL_ENV=preview (candado histórico)", { VERCEL_ENV: "preview" }],
      ["VERCEL_ENV=production", { VERCEL_ENV: "production" }],
      ["NODE_ENV=production sin APP_ENV ni VERCEL_ENV (imagen Docker)", { NODE_ENV: "production" }],
    ])("%s", async (_label, env) => {
      for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
      await expect(getDeployStatusAction()).resolves.toEqual({
        ok: false,
        error: expect.stringContaining("solo funciona corriendo en local"),
      });
      expect(mocks.getGitStatus).not.toHaveBeenCalled();
    });

    it("el mensaje nombra producción, staging y preview, no solo Vercel", async () => {
      vi.stubEnv("APP_ENV", "staging");
      const result = await getDeployStatusAction();
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("inalcanzable");
      expect(result.error).toContain("producción, staging o preview");
      expect(result.error).not.toMatch(/En Vercel/);
    });

    it("gitPushAction se detiene en validate antes de git status", async () => {
      vi.stubEnv("NODE_ENV", "production");
      await expect(gitPushAction({ type: "preview" })).resolves.toEqual({
        ok: false,
        step: "validate",
        error: expect.stringContaining("solo funciona corriendo en local"),
      });
      expect(mocks.getGitStatus).not.toHaveBeenCalled();
    });

    it("APP_ENV=local explícito fuera de Vercel sí abre el bot (pnpm dev con .env local)", async () => {
      vi.stubEnv("APP_ENV", "local");
      vi.stubEnv("NODE_ENV", "production");
      await expect(getDeployStatusAction()).resolves.toMatchObject({ ok: true });
      expect(mocks.getGitStatus).toHaveBeenCalledOnce();
    });
  });
});
