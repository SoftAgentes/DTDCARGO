/**
 * SDD-0543 · Facturas «por aceptar» en las pantallas de facturas del Portal.
 *
 * El loader resuelve el tenant por el id del cliente y delega en las consultas
 * legales con tenant + Shipping Mark; nunca lanza, ni siquiera cuando no se
 * puede crear el admin client. `totalPorAceptar` sólo suma cuando todo está en
 * la misma moneda. `medidaDeLaFactura` suma la medida de todos los embarques
 * cuando la factura junta varios.
 */
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const h = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  crearAdmin: vi.fn(() => {
    throw new Error("falta SUPABASE_SERVICE_ROLE_KEY");
  }),
}));

vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => h.crearAdmin(),
}));
vi.mock("../portal-legal-queries", () => ({
  listPendingAcceptanceInvoices: h.list,
  getPendingAcceptanceInvoice: h.get,
}));

import {
  loadPendingAcceptanceDetailForClient,
  loadPendingAcceptanceForClient,
  medidaDeLaFactura,
  totalPorAceptar,
} from "../pending-acceptance";

/**
 * Doble del admin client que SÍ aplica la consulta: devuelve el tenant sólo si
 * se lee `clients.tenant_id` filtrando por el id del cliente pedido. Un doble
 * que ignorara `.from()`/`.eq()` no probaría que el tenant sale del cliente.
 */
function admin(filas: Record<string, string>, opts: { lanza?: boolean } = {}): SupabaseClient {
  return {
    from: (tabla: string) => ({
      select: (cols: string) => ({
        eq: (col: string, valor: string) => ({
          maybeSingle: async () => {
            if (opts.lanza) throw new Error("boom");
            if (tabla !== "clients" || cols !== "tenant_id" || col !== "id") return { data: null, error: null };
            const tenant = filas[valor];
            return { data: tenant ? { tenant_id: tenant } : null, error: null };
          },
        }),
      }),
    }),
  } as unknown as SupabaseClient;
}

const pendiente = { code: "F-2026-0007", baseAmount: 100, totalAmount: 116, currency: "USD", shipmentCode: "DTD-A116-06", cbm: 1.02, weightKg: 408.55 };

describe("loadPendingAcceptanceForClient", () => {
  it("pasa a la consulta legal el tenant DEL cliente pedido y su Shipping Mark", async () => {
    h.list.mockReset().mockResolvedValue([pendiente]);
    const db = admin({ c1: "t1", c2: "t2" });
    const out = await loadPendingAcceptanceForClient({ clientId: "c1", markbox: "DTD-8001" }, db);
    expect(out).toEqual([pendiente]);
    expect(h.list).toHaveBeenCalledWith(db, { tenantId: "t1", markbox: "DTD-8001" });
    // Otro cliente, otro tenant: el doble filtra por id, así que la consulta recibe t2.
    await loadPendingAcceptanceForClient({ clientId: "c2", markbox: "DTD-8002" }, db);
    expect(h.list).toHaveBeenLastCalledWith(db, { tenantId: "t2", markbox: "DTD-8002" });
  });
  it("devuelve vacío sin tenant, sin marca o si algo falla", async () => {
    h.list.mockReset().mockResolvedValue([pendiente]);
    expect(await loadPendingAcceptanceForClient({ clientId: "c9", markbox: "DTD-8001" }, admin({ c1: "t1" }))).toEqual([]);
    expect(await loadPendingAcceptanceForClient({ clientId: "c1", markbox: " " }, admin({ c1: "t1" }))).toEqual([]);
    expect(await loadPendingAcceptanceForClient({ clientId: "c1", markbox: "DTD-8001" }, admin({ c1: "t1" }, { lanza: true }))).toEqual([]);
    h.list.mockRejectedValueOnce(new Error("rls"));
    expect(await loadPendingAcceptanceForClient({ clientId: "c1", markbox: "DTD-8001" }, admin({ c1: "t1" }))).toEqual([]);
  });
  it("sin admin inyectado lo crea DENTRO del try: si falta la variable de entorno no tumba «Mis facturas»", async () => {
    h.crearAdmin.mockClear();
    h.list.mockReset();
    await expect(loadPendingAcceptanceForClient({ clientId: "c1", markbox: "DTD-8001" })).resolves.toEqual([]);
    expect(h.crearAdmin).toHaveBeenCalledTimes(1);
    expect(h.list).not.toHaveBeenCalled();
    // Sin marca ni siquiera intenta crearlo.
    await expect(loadPendingAcceptanceForClient({ clientId: "c1", markbox: "" })).resolves.toEqual([]);
    expect(h.crearAdmin).toHaveBeenCalledTimes(1);
  });
});

describe("loadPendingAcceptanceDetailForClient", () => {
  it("busca por código con tenant y marca; null si no es suya", async () => {
    h.get.mockReset().mockResolvedValue({ ...pendiente, invoiceId: "i1", shipmentId: "s1", clientName: "X", ivaRate: 16, ivaAmount: 16, fxRate: null, lines: [], notes: null, embarques: [] });
    const db = admin({ c1: "t1" });
    const out = await loadPendingAcceptanceDetailForClient({ clientId: "c1", markbox: "DTD-8001", code: "F-2026-0007" }, db);
    expect(out?.code).toBe("F-2026-0007");
    expect(h.get).toHaveBeenCalledWith(db, { tenantId: "t1", markbox: "DTD-8001", code: "F-2026-0007" });
    h.get.mockResolvedValueOnce(null);
    expect(await loadPendingAcceptanceDetailForClient({ clientId: "c1", markbox: "DTD-8001", code: "F-2026-0008" }, db)).toBeNull();
    expect(await loadPendingAcceptanceDetailForClient({ clientId: "c1", markbox: "DTD-8001", code: "" }, db)).toBeNull();
    expect(await loadPendingAcceptanceDetailForClient({ clientId: "c1", markbox: "DTD-8001", code: "F-1" }, admin({ c1: "t1" }, { lanza: true }))).toBeNull();
  });
  it("sin admin inyectado y sin variable de entorno devuelve null en vez de tumbar el detalle", async () => {
    h.crearAdmin.mockClear();
    await expect(loadPendingAcceptanceDetailForClient({ clientId: "c1", markbox: "DTD-8001", code: "F-2026-0007" })).resolves.toBeNull();
    expect(h.crearAdmin).toHaveBeenCalledTimes(1);
  });
});

describe("totalPorAceptar", () => {
  it("suma en una sola moneda y se niega a mezclar", () => {
    expect(totalPorAceptar([])).toBeNull();
    expect(totalPorAceptar([{ ...pendiente, totalAmount: 10.005 }, { ...pendiente, totalAmount: 5 }])).toEqual({ total: 15.01, currency: "USD" });
    expect(totalPorAceptar([pendiente, { ...pendiente, currency: "VES" }])).toBeNull();
  });
});

describe("medidaDeLaFactura", () => {
  it("con un solo embarque (o sin códigos en las líneas) vale la medida del envío enlazado", () => {
    expect(medidaDeLaFactura({ embarques: [], cbm: 1.02, weightKg: 408.55 })).toEqual({ varios: false, codigos: [], cbm: 1.02, weightKg: 408.55 });
    expect(medidaDeLaFactura({ embarques: [{ code: "DTD-A116-06", cbm: 1.02, weightKg: 408.55 }], cbm: 1.02, weightKg: 408.55 })).toEqual({
      varios: false,
      codigos: ["DTD-A116-06"],
      cbm: 1.02,
      weightKg: 408.55,
    });
  });
  it("con varios embarques suma la medida de todos (3 decimales en m³, 2 en kg) y no inventa 0 cuando ninguno la trae", () => {
    const embarques = [
      { code: "DTD-A116-06", cbm: 1.022, weightKg: 408.55 },
      { code: "DTD-A116-08", cbm: 0.5, weightKg: 120 },
      { code: "DTD-A116-09", cbm: null, weightKg: null },
    ];
    expect(medidaDeLaFactura({ embarques, cbm: 1.022, weightKg: 408.55 })).toEqual({
      varios: true,
      codigos: ["DTD-A116-06", "DTD-A116-08", "DTD-A116-09"],
      cbm: 1.522,
      weightKg: 528.55,
    });
    expect(medidaDeLaFactura({ embarques: embarques.map((e) => ({ ...e, cbm: null, weightKg: null })), cbm: null, weightKg: null })).toMatchObject({
      varios: true,
      cbm: null,
      weightKg: null,
    });
    // 0.1 + 0.2 no sale 0.30000000000000004.
    expect(medidaDeLaFactura({ embarques: [{ code: "a", cbm: 0.1, weightKg: 0.1 }, { code: "b", cbm: 0.2, weightKg: 0.2 }], cbm: null, weightKg: null })).toMatchObject({ cbm: 0.3, weightKg: 0.3 });
  });
});
