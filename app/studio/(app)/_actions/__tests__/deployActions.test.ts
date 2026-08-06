import { beforeEach, describe, expect, it, vi } from "vitest";

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

import { getDeployStatusAction } from "../deployActions";

describe("deploy actions · gate server-side", () => {
  beforeEach(() => {
    delete process.env.VERCEL_ENV;
    mocks.user = null;
    mocks.role = null;
    mocks.getGitStatus.mockReset();
    mocks.getGitStatus.mockResolvedValue({ currentBranch: "main", hasChanges: false });
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
});
