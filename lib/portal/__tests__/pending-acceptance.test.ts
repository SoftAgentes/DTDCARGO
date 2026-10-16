/**
 * SDD-0543 · Facturas «por aceptar» en las pantallas de facturas del Portal.
 *
 * El loader resuelve el tenant por el id del cliente y delega en las consultas
 * legales con tenant + Shipping Mark; nunca lanza. `totalPorAceptar` sólo suma
 * cuando todo está en la misma moneda.
 */
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const h = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
}));

vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => {
    throw new Error("en estas pruebas el admin se inyecta");
  },
}));
vi.mock("../portal-legal-queries", () => ({
  listPendingAcceptanceInvoices: h.list,
  getPendingAcceptanceInvoice: h.get,
}));

import {
  loadPendingAcceptanceDetailForClient,
  loadPendingAcceptanceForClient,
  totalPorAceptar,
} from "../pending-acceptance";

function admin(tenantId: string | null, opts: { lanza?: boolean } = {}): SupabaseClient {
  const maybeSingle = async () => {
    if (opts.lanza) throw new Error("boom");
    return { data: tenantId ? { tenant_id: tenantId } : null, error: null };
  };
  const eq = () => ({ maybeSingle });
  const select = () => ({ eq });
  return { from: () => ({ select }) } as unknown as SupabaseClient;
}

const pendiente = { code: "F-2026-0007", baseAmount: 100, totalAmount: 116, currency: "USD", shipmentCode: "DTD-A116-06", cbm: 1.02, weightKg: 408.55 };

describe("loadPendingAcceptanceForClient", () => {
  it("pasa tenant y Shipping Mark a la consulta legal", async () => {
    h.list.mockReset().mockResolvedValue([pendiente]);
    const out = await loadPendingAcceptanceForClient({ clientId: "c1", markbox: "DTD-8001" }, admin("t1"));
    expect(out).toEqual([pendiente]);
    expect(h.list).toHaveBeenCalledWith(expect.anything(), { tenantId: "t1", markbox: "DTD-8001" });
  });
  it("devuelve vacío sin tenant, sin marca o si algo falla", async () => {
    h.list.mockReset().mockResolvedValue([pendiente]);
    expect(await loadPendingAcceptanceForClient({ clientId: "c1", markbox: "DTD-8001" }, admin(null))).toEqual([]);
    expect(await loadPendingAcceptanceForClient({ clientId: "c1", markbox: " " }, admin("t1"))).toEqual([]);
    expect(await loadPendingAcceptanceForClient({ clientId: "c1", markbox: "DTD-8001" }, admin("t1", { lanza: true }))).toEqual([]);
    h.list.mockRejectedValueOnce(new Error("rls"));
    expect(await loadPendingAcceptanceForClient({ clientId: "c1", markbox: "DTD-8001" }, admin("t1"))).toEqual([]);
  });
});

describe("loadPendingAcceptanceDetailForClient", () => {
  it("busca por código con tenant y marca; null si no es suya", async () => {
    h.get.mockReset().mockResolvedValue({ ...pendiente, invoiceId: "i1", shipmentId: "s1", clientName: "X", ivaRate: 16, ivaAmount: 16, fxRate: null, lines: [], notes: null });
    const out = await loadPendingAcceptanceDetailForClient({ clientId: "c1", markbox: "DTD-8001", code: "F-2026-0007" }, admin("t1"));
    expect(out?.code).toBe("F-2026-0007");
    expect(h.get).toHaveBeenCalledWith(expect.anything(), { tenantId: "t1", markbox: "DTD-8001", code: "F-2026-0007" });
    h.get.mockResolvedValueOnce(null);
    expect(await loadPendingAcceptanceDetailForClient({ clientId: "c1", markbox: "DTD-8001", code: "F-2026-0008" }, admin("t1"))).toBeNull();
    expect(await loadPendingAcceptanceDetailForClient({ clientId: "c1", markbox: "DTD-8001", code: "" }, admin("t1"))).toBeNull();
    expect(await loadPendingAcceptanceDetailForClient({ clientId: "c1", markbox: "DTD-8001", code: "F-1" }, admin("t1", { lanza: true }))).toBeNull();
  });
});

describe("totalPorAceptar", () => {
  it("suma en una sola moneda y se niega a mezclar", () => {
    expect(totalPorAceptar([])).toBeNull();
    expect(totalPorAceptar([{ ...pendiente, totalAmount: 10.005 }, { ...pendiente, totalAmount: 5 }])).toEqual({ total: 15.01, currency: "USD" });
    expect(totalPorAceptar([pendiente, { ...pendiente, currency: "VES" }])).toBeNull();
  });
});
