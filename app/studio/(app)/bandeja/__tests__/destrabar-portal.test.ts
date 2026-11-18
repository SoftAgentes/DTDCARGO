// @vitest-environment node
/**
 * SDD-0586 (10.5, PR 1b, §10.5.20) · «Reintentar los atascados» de la ida del portal.
 *
 * Solo admin: la acción lo exige y la RPC lo vuelve a exigir con la sesión del admin (su
 * contrato está en chatwoot-portal-vuelta.migration.test.ts). Acá: quién llega a la RPC, con
 * qué cliente (la sesión, no service_role) y qué ve el admin según lo que conteste la base.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  gate: { ok: true, tenantId: "10000000-0000-4000-8000-000000000001" } as unknown,
  rpc: vi.fn(),
  admins: 0,
  revalidate: vi.fn(),
}));

vi.mock("@/lib/db/server", () => ({ createClient: async () => ({ rpc: m.rpc }) }));
vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => {
    m.admins += 1;
    return {};
  },
}));
vi.mock("@/lib/studio/rbac-guard", () => ({
  moduleViewDenial: async () => null,
  tenantAdminGate: async () => m.gate,
  getStudioAccess: async () => ({}),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: vi.fn() }) }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidate }));

import { destrabarPortal } from "../actions";

beforeEach(() => {
  m.gate = { ok: true, tenantId: "10000000-0000-4000-8000-000000000001" };
  m.admins = 0;
  m.rpc.mockReset().mockResolvedValue({ data: 2, error: null });
  m.revalidate.mockReset();
});

describe("destrabarPortal", () => {
  it("el admin destraba con su sesión: cuántos y la página se refresca", async () => {
    expect(await destrabarPortal()).toEqual({ ok: true, error: null, destrabados: 2 });
    expect(m.rpc).toHaveBeenCalledWith("chatwoot_portal_destrabar");
    // Con la sesión del admin, no con service_role: la RPC comprueba el admin y toma su tenant.
    expect(m.admins).toBe(0);
    expect(m.revalidate).toHaveBeenCalledWith("/studio/bandeja");
  });

  it("quien no es admin no llega a la base", async () => {
    m.gate = { ok: false, error: "No tienes permiso para realizar esta acción." };
    expect(await destrabarPortal()).toEqual({ ok: false, error: "denied" });
    expect(m.rpc).not.toHaveBeenCalled();
  });

  it("si la base rechaza por permiso, «denied»; si falla, «base», con el código en el log", async () => {
    const espia = vi.spyOn(console, "warn").mockImplementation(() => {});
    m.rpc.mockResolvedValueOnce({ data: null, error: { code: "42501" } });
    expect(await destrabarPortal()).toEqual({ ok: false, error: "denied" });
    m.rpc.mockResolvedValueOnce({ data: null, error: { code: "PGRST202" } });
    expect(await destrabarPortal()).toEqual({ ok: false, error: "base" });
    expect(JSON.stringify(espia.mock.calls)).toContain("PGRST202");
    expect(m.revalidate).not.toHaveBeenCalled();
    espia.mockRestore();
  });
});
