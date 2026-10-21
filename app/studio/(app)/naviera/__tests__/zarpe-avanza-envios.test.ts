// @vitest-environment node
/**
 * SDD-0530 · «Marcar zarpado» y «Marcar arribado» con sus envíos, desde la
 * acción real `changeConsolidationStatus`.
 *
 * La RPC `advance_consolidation_governed` se prueba de verdad en PGlite
 * (lib/studio/__tests__/naviera-zarpe-avanza-envios.migration.test.ts). Aquí la
 * responde un modelo que aplica la misma regla (`decidirAvance`) sobre la copia
 * del store de un doble de PostgREST que SÍ filtra y devuelve copias
 * (`lectores-admin-double.ts`): así, marcar dos veces ve el estado que dejó la
 * primera. El fan-out del arribo (`scheduleConsolidationEvent`) corre real
 * sobre otro doble; lo único que se espía es el motor de avisos.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { dobleLectores, type Fila, type Rpc, type Tablas } from "@/lib/studio/__tests__/lectores-admin-double";
import { AVANCE, decidirAvance, esAvanceContenedor } from "@/lib/studio/naviera/avance-por-contenedor";

const mocks = vi.hoisted(() => ({
  session: null as unknown,
  admin: null as unknown,
  denial: vi.fn(),
  revalidate: vi.fn(),
  schedule: vi.fn(),
  user: { id: "user-ops" },
  tenant: "tenant-A",
}));

vi.mock("@/lib/db/server", () => ({ createClient: async () => mocks.session }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => mocks.admin }));
vi.mock("@/lib/studio/rbac-guard", () => ({
  moduleEditDenial: (...a: unknown[]) => mocks.denial(...a),
}));
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => mocks.revalidate(...a) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({
  getUser: async () => mocks.user,
  getUserTenantId: async () => mocks.tenant,
}));
vi.mock("@/lib/studio/notifications/schedule-client-notifications", () => ({
  scheduleClientNotifications: (...a: unknown[]) => mocks.schedule(...a),
}));

import { changeConsolidationStatus, closeConsolidation } from "../actions";
import { transitionShipment } from "../../tracking/[id]/actions";

const T = "tenant-A";

function envio(id: string, code: string, status: string, extra: Fila = {}): Fila {
  return {
    id,
    tenant_id: T,
    code,
    client_markbox: `DTD-${code.slice(4)}`,
    client_name: `Cliente ${code}`,
    shipment_service: "consolidado_lcl",
    status,
    deleted_at: null,
    ...extra,
  };
}

function tablas(): Tablas {
  return {
    user_tenants: [{ user_id: "user-ops", tenant_id: T, role: "operations", disabled_at: null }],
    consolidations: [
      { id: "con-z", tenant_id: T, ref: "DTD-CONSOL-0101", status: "cerrado", deleted_at: null },
      { id: "con-a", tenant_id: T, ref: "DTD-CONSOL-0102", status: "zarpado", deleted_at: null },
      { id: "con-c", tenant_id: T, ref: "DTD-CONSOL-0103", status: "consolidando", deleted_at: null },
    ],
    consolidation_items: [
      { tenant_id: T, consolidation_id: "con-z", shipment_id: "s1", client_markbox: "DTD-101", client_name: null },
      { tenant_id: T, consolidation_id: "con-z", shipment_id: "s2", client_markbox: "DTD-102", client_name: null },
      { tenant_id: T, consolidation_id: "con-z", shipment_id: "s3", client_markbox: "DTD-103", client_name: null },
      { tenant_id: T, consolidation_id: "con-z", shipment_id: "s4", client_markbox: "DTD-104", client_name: null },
      { tenant_id: T, consolidation_id: "con-z", shipment_id: null, client_markbox: "DTD-199", client_name: null },
      { tenant_id: T, consolidation_id: "con-a", shipment_id: "a1", client_markbox: "DTD-201", client_name: null },
      { tenant_id: T, consolidation_id: "con-a", shipment_id: "a2", client_markbox: "DTD-202", client_name: null },
      { tenant_id: T, consolidation_id: "con-a", shipment_id: "a3", client_markbox: "DTD-203", client_name: null },
      { tenant_id: T, consolidation_id: "con-c", shipment_id: "c1", client_markbox: "DTD-301", client_name: null },
    ],
    shipments: [
      envio("s1", "ENV-101", "in_warehouse"),
      envio("s2", "ENV-102", "draft"),
      envio("s3", "ENV-103", "delivered"),
      envio("s4", "ENV-104", "in_warehouse", { deleted_at: "2026-10-01T00:00:00Z" }),
      envio("a1", "ENV-201", "shipped"),
      envio("a2", "ENV-202", "arrived_destination"),
      envio("a3", "ENV-203", "in_transit", { deleted_at: "2026-10-01T00:00:00Z" }),
      envio("c1", "ENV-301", "in_warehouse"),
    ],
  };
}

const ok = (data: unknown) => ({ data, error: null });
const fallo = (code: string) => ({ data: null, error: { code, message: `rpc ${code}` } });

/** Modelo de advance_consolidation_governed sobre la copia del store del doble. */
const rpcAvance: Rpc = (args, store) => {
  const to = String(args.p_to ?? "");
  if (!esAvanceContenedor(to)) return fallo("22023");
  const c = (store.consolidations ?? []).find((r) => r.id === args.p_consolidation_id && r.deleted_at == null);
  if (!c) return fallo("P0002");
  const { desde, destino } = AVANCE[to];
  const base = {
    tenant_id: c.tenant_id,
    consolidation_ref: c.ref,
    from: c.status,
    to,
    shipment_status: destino,
  };
  if (c.status === to) {
    return ok({ ...base, outcome: "already", advanced: [], skipped: [], pieces_without_shipment: 0 });
  }
  if (c.status !== desde) return fallo("40001");
  c.status = to;
  const items = (store.consolidation_items ?? []).filter((i) => i.consolidation_id === c.id);
  const ids = [...new Set(items.map((i) => i.shipment_id).filter((v): v is string => typeof v === "string"))].sort();
  const advanced: Fila[] = [];
  const skipped: Fila[] = [];
  for (const id of ids) {
    const s = (store.shipments ?? []).find((r) => r.id === id && r.tenant_id === c.tenant_id);
    if (!s) continue;
    const d = s.deleted_at ? "eliminado" : decidirAvance(String(s.shipment_service), String(s.status), destino);
    if (d !== "avanza") {
      skipped.push({ shipment_id: s.id, code: s.code, status: s.status, client_markbox: s.client_markbox, reason: d });
      continue;
    }
    advanced.push({
      shipment_id: s.id,
      code: s.code,
      from: s.status,
      client_markbox: s.client_markbox,
      client_name: s.client_name,
    });
    s.status = destino;
  }
  return ok({
    ...base,
    outcome: "transitioned",
    advanced,
    skipped,
    pieces_without_shipment: items.filter((i) => i.shipment_id == null).length,
  });
};

let rpcCalls: Array<{ fn: string; args: unknown }>;
let scopeCalls: Array<{ fn: string; args: unknown }>;
let session: ReturnType<typeof dobleLectores>;
let admin: ReturnType<typeof dobleLectores>;

function montar(rpc: Rpc = rpcAvance) {
  rpcCalls = [];
  scopeCalls = [];
  session = dobleLectores(tablas(), {
    client_consolidation_scope: (args, store) => {
      scopeCalls.push({ fn: "client_consolidation_scope", args });
      const containers = args.p_container_ids;
      if (!Array.isArray(containers) || containers.some((id) => !(store.consolidations ?? []).some((c) => c.id === id && c.tenant_id === T))) return fallo("42501");
      return ok({ available: true, complete: true, checked: { receiptIds: [], shipmentIds: [], containerIds: containers, boxIds: [] },
        receiptIds: [], shipmentIds: [], containerIds: [], boxIds: [] });
    },
    advance_consolidation_governed: (args, store) => {
      rpcCalls.push({ fn: "advance_consolidation_governed", args });
      return rpc(args, store);
    },
  });
  admin = dobleLectores(tablas());
  mocks.session = session.client;
  mocks.admin = admin.client;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.denial.mockResolvedValue(null);
  mocks.schedule.mockResolvedValue({ scheduled: 1, skipped: 0 });
  montar();
});

/** Las llamadas al motor de avisos: [evento, shipmentId]. */
function avisos(): Array<[string, string]> {
  return mocks.schedule.mock.calls.map((c) => {
    const ev = c[2] as { event: string; ancla: { shipmentId: string } };
    return [ev.event, ev.ancla.shipmentId];
  });
}

describe("zarpar el contenedor", () => {
  it("avanza los envíos que puede, programa su aviso y devuelve el resumen", async () => {
    const r = await changeConsolidationStatus("con-z", "zarpado");

    expect(r.error).toBeUndefined();
    expect(r.ok).toBe(true);
    expect(rpcCalls).toEqual([
      { fn: "advance_consolidation_governed", args: { p_consolidation_id: "con-z", p_to: "zarpado" } },
    ]);
    // El aviso de embarque sólo para los dos que avanzaron, con la llamada de Tracking.
    expect(avisos()).toEqual([
      ["status:shipped", "s1"],
      ["status:shipped", "s2"],
    ]);
    const primera = mocks.schedule.mock.calls[0];
    expect(primera[0]).toBe(admin.client);
    expect(primera[1]).toBe(T);
    expect(primera[2]).toMatchObject({
      ancla: { kind: "shipment", shipmentId: "s1", shipmentCode: "ENV-101" },
      clientMarkbox: "DTD-101",
      clientName: "Cliente ENV-101",
      event: "status:shipped",
    });
    expect(r.avance).toMatchObject({
      outcome: "transitioned",
      to: "zarpado",
      destinoTexto: "Embarcado",
      consolidationRef: "DTD-CONSOL-0101",
      avanzados: [
        { code: "ENV-101", clientMarkbox: "DTD-101" },
        { code: "ENV-102", clientMarkbox: "DTD-102" },
      ],
      saltados: [
        { code: "ENV-103", motivo: "entregado", motivoTexto: "Ya está entregado" },
        { code: "ENV-104", motivo: "eliminado" },
      ],
      piezasSinEnvio: 1,
      avisosProgramados: 2,
    });
    // Zarpar no tiene aviso del contenedor (no es «consolidated» ni «received_ve»).
    expect(r.avisados).toBeUndefined();
    expect(r.avance?.avisosLlegada).toBeUndefined();
    expect(mocks.revalidate).toHaveBeenCalledWith("/studio/naviera");
    expect(mocks.revalidate).toHaveBeenCalledWith("/studio/tracking");
  });

  it("cuenta sólo los avisos que de verdad quedaron en la agenda", async () => {
    mocks.schedule.mockImplementation(async (_a: unknown, _t: unknown, ev: { ancla: { shipmentId: string } }) =>
      ev.ancla.shipmentId === "s2" ? { scheduled: 0, skipped: 1 } : { scheduled: 1, skipped: 0 });
    const r = await changeConsolidationStatus("con-z", "zarpado");
    expect(r.avance?.avisosProgramados).toBe(1);
  });

  it("marcar zarpado dos veces no avanza ni avisa dos veces", async () => {
    const primera = await changeConsolidationStatus("con-z", "zarpado");
    const segunda = await changeConsolidationStatus("con-z", "zarpado");

    expect(primera.avance?.outcome).toBe("transitioned");
    expect(segunda.ok).toBe(true);
    expect(segunda.avance).toMatchObject({ outcome: "already", avanzados: [], saltados: [], avisosProgramados: 0 });
    expect(rpcCalls).toHaveLength(2);
    expect(mocks.schedule).toHaveBeenCalledTimes(2); // los dos de la primera, ninguno de la segunda
    expect(session.store.shipments.find((s) => s.id === "s1")?.status).toBe("shipped");
  });

  it("un contenedor que no está cerrado no zarpa y no avisa a nadie", async () => {
    const r = await changeConsolidationStatus("con-c", "zarpado");
    expect(r.ok).toBeUndefined();
    expect(r.error).toBe("El contenedor cambió de estado mientras tanto. Actualiza la página y vuelve a intentarlo.");
    expect(mocks.schedule).not.toHaveBeenCalled();
    expect(session.store.shipments.find((s) => s.id === "c1")?.status).toBe("in_warehouse");
  });
});

describe("arribar el contenedor", () => {
  it("avanza a En aduana, programa su aviso y el «llegó a Venezuela» de siempre", async () => {
    const r = await changeConsolidationStatus("con-a", "arribado");

    expect(r.ok).toBe(true);
    expect(rpcCalls[0].args).toEqual({ p_consolidation_id: "con-a", p_to: "arribado" });
    // status:in_customs sólo para a1; received_ve para los envíos VIVOS del
    // contenedor (a1 y a2; a3 está eliminado): el fan-out real filtra.
    expect(avisos()).toEqual([
      ["status:in_customs", "a1"],
      ["received_ve", "a1"],
      ["received_ve", "a2"],
    ]);
    expect(r.avance).toMatchObject({
      to: "arribado",
      destinoTexto: "En aduana",
      avanzados: [{ code: "ENV-201" }],
      saltados: [
        { code: "ENV-202", motivo: "mas_avanzado" },
        { code: "ENV-203", motivo: "eliminado" },
      ],
      avisosProgramados: 1,
      avisosLlegada: 2,
    });
    expect(r.avisados).toBe(2);
    expect(mocks.revalidate).toHaveBeenCalledWith("/studio/ve");
  });

  it("si ya estaba arribado no vuelve a mandar «llegó a Venezuela»", async () => {
    await changeConsolidationStatus("con-a", "arribado");
    mocks.schedule.mockClear();
    const r = await changeConsolidationStatus("con-a", "arribado");
    expect(r.avance?.outcome).toBe("already");
    expect(mocks.schedule).not.toHaveBeenCalled();
    expect(r.avisados).toBeUndefined();
  });
});

describe("permisos y fallos", () => {
  it("sin edición de Naviera no llama la RPC", async () => {
    mocks.denial.mockImplementation(async (_s: unknown, mod: string) =>
      mod === "naviera" ? "No tienes permiso para realizar esta acción." : null);
    const r = await changeConsolidationStatus("con-z", "zarpado");
    expect(r.error).toBe("No tienes permiso para realizar esta acción.");
    expect(rpcCalls).toEqual([]);
    expect(mocks.schedule).not.toHaveBeenCalled();
  });

  it("sin edición de Tracking no llama la RPC: se cambian estados de envíos", async () => {
    mocks.denial.mockImplementation(async (_s: unknown, mod: string) =>
      mod === "tracking" ? "No tienes permiso para realizar esta acción." : null);
    const r = await changeConsolidationStatus("con-z", "zarpado");
    expect(r.error).toBe("No tienes permiso para realizar esta acción.");
    expect(mocks.denial).toHaveBeenCalledWith(session.client, "naviera");
    expect(mocks.denial).toHaveBeenCalledWith(session.client, "tracking");
    expect(rpcCalls).toEqual([]);
  });

  it("cerrar el contenedor legacy no exige Tracking ni pasa por la RPC de avance", async () => {
    mocks.denial.mockImplementation(async (_s: unknown, mod: string) =>
      mod === "tracking" ? "No tienes permiso para realizar esta acción." : null);
    const r = await closeConsolidation("con-c");
    expect(r.ok).toBe(true);
    expect(rpcCalls).toEqual([]);
    expect(scopeCalls).toEqual([{ fn: "client_consolidation_scope", args: { p_receipt_ids: [], p_shipment_ids: [], p_container_ids: ["con-c"], p_box_ids: [] } }]);
    expect(session.store.consolidations.find((c) => c.id === "con-c")?.status).toBe("cerrado");
    // El aviso «consolidated» de siempre, para el envío vivo del contenedor.
    expect(avisos()).toEqual([["consolidated", "c1"]]);
  });

  it.each([
    ["42501", "No tienes permiso para cambiar el estado de este contenedor."],
    ["P0002", "El contenedor ya no está disponible."],
    ["PGRST202", "No se pudo cambiar el estado del contenedor. No cambió nada; vuelve a intentarlo."],
  ])("si la RPC falla con %s no se avisa a nadie", async (code, mensaje) => {
    montar(() => fallo(code));
    const r = await changeConsolidationStatus("con-z", "zarpado");
    expect(r.error).toBe(mensaje);
    expect(mocks.schedule).not.toHaveBeenCalled();
  });

  it("si la RPC devuelve algo que no se entiende, no se avisa a nadie", async () => {
    montar(() => ok({ outcome: "transitioned", to: "zarpado" }));
    const r = await changeConsolidationStatus("con-z", "zarpado");
    expect(r.error).toBe(
      "El contenedor cambió, pero no se pudo leer el resultado. Revisa los envíos en Tracking.",
    );
    expect(mocks.schedule).not.toHaveBeenCalled();
  });
});

describe("el aviso sale por el mismo camino que Tracking", () => {
  it("zarpar programa exactamente lo que programaría transitionShipment para ese envío", async () => {
    // Tracking: un cliente mínimo para transitionShipment (lee el envío,
    // actualiza el estado e inserta el evento).
    const filaTracking = { ...envio("s1", "ENV-101", "in_warehouse") };
    mocks.session = {
      rpc: async (name: string, args: Record<string, unknown>) => name === "client_consolidation_scope" && Array.isArray(args.p_shipment_ids)
        && args.p_shipment_ids.length === 1 && args.p_shipment_ids[0] === "s1"
        ? ok({ available: true, complete: true, checked: { shipmentIds: ["s1"], containerIds: [], receiptIds: [], boxIds: [] },
          shipmentIds: [], containerIds: [], receiptIds: [], boxIds: [] }) : fallo("PGRST202"),
      from(table: string) {
        const b = {
          select: () => b,
          eq: () => b,
          update: () => b,
          maybeSingle: async () => ({ data: table === "shipments" ? filaTracking : null, error: null }),
          insert: async () => ({ error: null }),
          then: (res: (v: { error: null }) => unknown) => Promise.resolve({ error: null }).then(res),
        };
        return b;
      },
    };
    const deTracking = await transitionShipment("s1", "shipped");
    expect(deTracking).toEqual({ ok: true });
    expect(mocks.schedule).toHaveBeenCalledTimes(1);
    const tracking = mocks.schedule.mock.calls[0];

    mocks.schedule.mockClear();
    montar();
    await changeConsolidationStatus("con-z", "zarpado");
    const naviera = mocks.schedule.mock.calls.find((c) => (c[2] as { ancla: { shipmentId: string } }).ancla.shipmentId === "s1")!;

    expect(naviera[1]).toBe(tracking[1]);
    const sinHora = (ev: Record<string, unknown>) => {
      const { eventTime, ...resto } = ev;
      expect(eventTime).toBeInstanceOf(Date);
      return resto;
    };
    expect(sinHora(naviera[2] as Record<string, unknown>)).toEqual(sinHora(tracking[2] as Record<string, unknown>));
  });
});
