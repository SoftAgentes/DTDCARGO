// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  getPortalClientPrincipal: vi.fn(),
  getPortalLastReplyAt: vi.fn(),
  getNextOpenSailing: vi.fn(),
  daysUntil: vi.fn(),
}));

vi.mock("@/lib/db/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/portal/portal-queries", () => ({
  getPortalClientPrincipal: mocks.getPortalClientPrincipal,
}));
vi.mock("@/lib/portal/portal-conversation-queries", () => ({
  getPortalLastReplyAt: mocks.getPortalLastReplyAt,
}));
vi.mock("@/lib/portal/next-sailing-queries", () => ({
  getNextOpenSailing: mocks.getNextOpenSailing,
  daysUntil: mocks.daysUntil,
}));

import { getPortalShellPrivateContext } from "../portal-shell-private-context";

const client = {
  id: "client-synthetic", markbox: "DTD-SYNTHETIC", name: "Cliente sintético",
  email: null, phone: null, address: null, docKind: "empresa" as const,
  rif: null, city: null, state: null,
};
const sailing = { id: "sailing-synthetic", cutoff: "2026-09-10" };
const principal = { userId: "portal-user", tenantId: "tenant-synthetic", client };

function adminFixture() {
  return { admin: { role: "service" } };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getPortalClientPrincipal.mockResolvedValue(principal);
  mocks.getPortalLastReplyAt.mockResolvedValue("2026-09-03T12:00:00Z");
  mocks.getNextOpenSailing.mockResolvedValue(sailing);
  mocks.daysUntil.mockReturnValue(7);
});

describe("SDD0383 · contexto privado del shell Portal", () => {
  it("sin principal corta antes de construir un cliente elevado", async () => {
    mocks.getPortalClientPrincipal.mockResolvedValue(null);
    expect(await getPortalShellPrivateContext({} as never)).toBeNull();
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("deriva soporte y zarpe con un solo admin y scopes exactos", async () => {
    const { admin } = adminFixture();
    mocks.createAdminClient.mockReturnValue(admin);
    const result = await getPortalShellPrivateContext({} as never, new Date("2026-09-03T18:00:00Z"));

    expect(mocks.createAdminClient).toHaveBeenCalledOnce();
    expect(mocks.getPortalLastReplyAt).toHaveBeenCalledWith(admin, client.id);
    expect(mocks.getNextOpenSailing).toHaveBeenCalledWith(admin, "tenant-synthetic", "2026-09-03");
    expect(mocks.daysUntil).toHaveBeenCalledWith("2026-09-10", "2026-09-03");
    expect(result).toEqual({
      client,
      soporteLastReplyAt: "2026-09-03T12:00:00Z",
      sailing,
      sailingDaysToCutoff: 7,
    });
    expect(result).not.toHaveProperty("tenantId");
  });

  it("si admin no está disponible conserva cliente y fallbacks vacíos", async () => {
    mocks.createAdminClient.mockImplementation(() => { throw new Error("synthetic env"); });
    expect(await getPortalShellPrivateContext({} as never)).toEqual({
      client, soporteLastReplyAt: null, sailing: null, sailingDaysToCutoff: null,
    });
  });

  it("un fallo derivado no tumba el shell ni corta los demás derivados", async () => {
    const { admin } = adminFixture();
    mocks.createAdminClient.mockReturnValue(admin);
    mocks.getPortalLastReplyAt.mockRejectedValue(new Error("synthetic query"));
    expect(await getPortalShellPrivateContext({} as never)).toEqual({
      client, soporteLastReplyAt: null, sailing, sailingDaysToCutoff: 7,
    });
    expect(mocks.getNextOpenSailing).toHaveBeenCalled();
  });
});
