/**
 * SDD-0543 · Facturas «por aceptar» en las pantallas de facturas del Portal.
 *
 * El loader toma tenant + Shipping Mark del principal Portal ya resuelto por
 * sesión (SDD-0549) y delega en las consultas legales; NO relee
 * `clients.tenant_id` con el admin client. Nunca lanza, ni siquiera cuando no se
 * puede crear el admin client. `totalPorAceptar` sólo suma cuando todo está en
 * la misma moneda. `medidaDeLaFactura` suma la medida de todos los embarques
 * cuando la factura junta varios.
 */
import { describe, expect, it, vi } from "vitest";
import { CLIENT_A, MARKBOX, TENANT_A, TENANT_B, portalDouble, type PortalDouble } from "./portal-tenant-double";

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
 * Doble del admin client que SÍ aplica la consulta (`portal-tenant-double`).
 * Siembra en `clients` un tenant LEGADO distinto del del principal: si el
 * loader volviera a leer `clients.tenant_id` (el patrón que la 0397 quitó de la
 * acción), la consulta legal recibiría ese tenant y no el del principal.
 */
function admin(): PortalDouble {
  return portalDouble({
    tables: { clients: [{ id: CLIENT_A, tenant_id: TENANT_B, markbox: MARKBOX, deleted_at: null }] },
  });
}

/** Lo que la página pasa: el principal Portal resuelto por sesión. */
const principal = { tenantId: TENANT_A, client: { id: CLIENT_A, markbox: MARKBOX } };
/** Mismo principal con la forma vieja del parámetro, por si el loader la leyera. */
const principalConRefVieja = { ...principal, clientId: CLIENT_A, markbox: MARKBOX };

const pendiente = { code: "F-2026-0007", baseAmount: 100, totalAmount: 116, currency: "USD", shipmentCode: "DTD-A116-06", cbm: 1.02, weightKg: 408.55 };

describe("loadPendingAcceptanceForClient", () => {
  it("pasa a la consulta legal el tenant y el Shipping Mark DEL principal, sin releer clients", async () => {
    h.list.mockReset().mockResolvedValue([pendiente]);
    const db = admin();
    const out = await loadPendingAcceptanceForClient(principalConRefVieja, db.db);
    expect(out).toEqual([pendiente]);
    expect(h.list).toHaveBeenCalledTimes(1);
    expect(h.list).toHaveBeenCalledWith(db.db, { tenantId: TENANT_A, markbox: MARKBOX });
    expect(db.operations).toEqual([]);
  });
  it("devuelve vacío sin tenant, sin marca o si algo falla", async () => {
    h.list.mockReset().mockResolvedValue([pendiente]);
    const db = admin();
    expect(await loadPendingAcceptanceForClient({ ...principal, tenantId: " " }, db.db)).toEqual([]);
    expect(await loadPendingAcceptanceForClient({ ...principal, client: { markbox: " " } }, db.db)).toEqual([]);
    expect(h.list).not.toHaveBeenCalled();
    h.list.mockRejectedValueOnce(new Error("rls"));
    expect(await loadPendingAcceptanceForClient(principal, db.db)).toEqual([]);
    expect(db.operations).toEqual([]);
  });
  it("sin admin inyectado lo crea DENTRO del try: si falta la variable de entorno no tumba «Mis facturas»", async () => {
    h.crearAdmin.mockClear();
    h.list.mockReset();
    await expect(loadPendingAcceptanceForClient(principal)).resolves.toEqual([]);
    expect(h.crearAdmin).toHaveBeenCalledTimes(1);
    expect(h.list).not.toHaveBeenCalled();
    // Sin marca ni siquiera intenta crearlo.
    await expect(loadPendingAcceptanceForClient({ ...principal, client: { markbox: "" } })).resolves.toEqual([]);
    expect(h.crearAdmin).toHaveBeenCalledTimes(1);
  });
});

describe("loadPendingAcceptanceDetailForClient", () => {
  it("busca por código con tenant y marca del principal, sin releer clients; null si no es suya", async () => {
    h.get.mockReset().mockResolvedValue({ ...pendiente, invoiceId: "i1", shipmentId: "s1", clientName: "X", ivaRate: 16, ivaAmount: 16, fxRate: null, lines: [], notes: null, embarques: [] });
    const db = admin();
    const out = await loadPendingAcceptanceDetailForClient(principalConRefVieja, " F-2026-0007 ", db.db);
    expect(out?.code).toBe("F-2026-0007");
    expect(h.get).toHaveBeenCalledWith(db.db, { tenantId: TENANT_A, markbox: MARKBOX, code: "F-2026-0007" });
    h.get.mockResolvedValueOnce(null);
    expect(await loadPendingAcceptanceDetailForClient(principal, "F-2026-0008", db.db)).toBeNull();
    expect(await loadPendingAcceptanceDetailForClient(principal, "", db.db)).toBeNull();
    expect(await loadPendingAcceptanceDetailForClient({ ...principal, tenantId: "" }, "F-2026-0007", db.db)).toBeNull();
    h.get.mockRejectedValueOnce(new Error("boom"));
    expect(await loadPendingAcceptanceDetailForClient(principal, "F-1", db.db)).toBeNull();
    expect(db.operations).toEqual([]);
  });
  it("sin admin inyectado y sin variable de entorno devuelve null en vez de tumbar el detalle", async () => {
    h.crearAdmin.mockClear();
    await expect(loadPendingAcceptanceDetailForClient(principal, "F-2026-0007")).resolves.toBeNull();
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
