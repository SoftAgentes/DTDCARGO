import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  denial: null as string | null,
  modules: [] as string[],
  reauthorize: vi.fn(),
  finalize: vi.fn(),
  sign: vi.fn(),
}));

vi.mock("@/lib/db/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: mocks.user } }) },
  }),
}));

vi.mock("@/lib/studio/rbac-guard", () => ({
  moduleEditDenial: async (_client: unknown, moduleId: string) => {
    mocks.modules.push(moduleId);
    return mocks.denial;
  },
}));

vi.mock("@/lib/studio/attachments/pilot-gate", () => ({
  requireAttachmentsPilot: () => undefined,
}));

vi.mock("@/lib/studio/attachments/service", () => ({
  reauthorizeAttachment: mocks.reauthorize,
  finalizeAttachment: mocks.finalize,
  createTusAuthorization: mocks.sign,
  directTusEndpoint: () => "https://storage.example.test/upload/resumable",
}));

import { POST as reauthorize } from "../[id]/reauthorize/route";
import { POST as finalize } from "../[id]/finalize/route";

const context = {
  params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }),
};

describe("mutaciones de adjuntos · RBAC de Gastos", () => {
  beforeEach(() => {
    mocks.user = { id: "user-1" };
    mocks.denial = null;
    mocks.modules = [];
    mocks.reauthorize.mockReset();
    mocks.finalize.mockReset();
    mocks.sign.mockReset();
    mocks.reauthorize.mockResolvedValue({
      bucketId: "erp-attachments",
      objectKey:
        "10000000-0000-4000-8000-000000000001/expense/20000000-0000-4000-8000-000000000001/30000000-0000-4000-8000-000000000001.pdf",
      expiresAt: "2026-09-04T12:00:00Z",
    });
    mocks.finalize.mockResolvedValue("30000000-0000-4000-8000-000000000001");
    mocks.sign.mockResolvedValue("signed-token");
  });

  it("rechaza reautorización y finalización antes de firmar o tocar la reserva", async () => {
    mocks.denial = "No tienes permiso para realizar esta acción.";

    const reauthorizeResponse = await reauthorize({} as Request, context);
    const finalizeResponse = await finalize({} as Request, context);

    expect(reauthorizeResponse.status).toBe(403);
    expect(finalizeResponse.status).toBe(403);
    expect(mocks.modules).toEqual(["expenses", "expenses"]);
    expect(mocks.reauthorize).not.toHaveBeenCalled();
    expect(mocks.finalize).not.toHaveBeenCalled();
    expect(mocks.sign).not.toHaveBeenCalled();
  });

  it("preserva ambos caminos cuando el rol sí puede editar Gastos", async () => {
    const reauthorizeResponse = await reauthorize({} as Request, context);
    const finalizeResponse = await finalize({} as Request, context);

    expect(reauthorizeResponse.status).toBe(200);
    expect(finalizeResponse.status).toBe(200);
    expect(mocks.modules).toEqual(["expenses", "expenses"]);
    expect(mocks.reauthorize).toHaveBeenCalledTimes(2);
    expect(mocks.finalize).toHaveBeenCalledOnce();
    expect(mocks.sign).toHaveBeenCalledOnce();
  });
});
