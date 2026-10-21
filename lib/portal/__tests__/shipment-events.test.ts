/**
 * Tests de hitos del envío en el portal (SDD-0132).
 *
 * Cubre:
 *  - `stepDatesFromEvents` (puro): mapa status → fecha del PRIMER evento (el más
 *    antiguo gana; entrada en orden ascendente).
 *  - AISLAMIENTO: resolver real auth/client_users y RPC propia, selector exacto;
 *    sin principal → [] sin RPC/tabla de dominio. No prueba aislamiento SQL.
 *  - `isClientNotifiableMilestone`: el set de hitos que avisan al cliente
 *    (decisión founder) — el arribo NO está (ya avisa por su template).
 */
import { describe, it, expect } from "vitest";
import { portalDouble, portalMembership, CLIENT_A, TENANT_A } from "./portal-tenant-double";
import {
  stepDatesFromEvents,
  listMyShipmentEvents,
  type PortalShipmentEvent,
} from "../shipment-events-queries";
import { isClientNotifiableMilestone } from "@/lib/studio/shipment-milestone-notify";

function stub(opts: { markbox: string | null }) {
  const member = portalMembership();
  if (typeof member.clients !== "object" || member.clients === null || Array.isArray(member.clients)) throw new Error("fixture principal");
  const double = portalDouble({ tables: { client_users: opts.markbox === null ? [] : [
    { ...member, clients: { ...member.clients, markbox: opts.markbox } },
  ] }, rpc: { client_consolidation_portal_events: (args: Record<string, unknown>) => ({
    available: true, complete: true, observedAt: "2026-10-21T12:00:00Z",
    principal: { tenantId: TENANT_A, clientId: CLIENT_A, markbox: opts.markbox },
    view: "history", shipmentId: args.p_shipment_id, limit: args.p_limit, events: [],
  }) } });
  return double;
}
describe("stepDatesFromEvents", () => {
  it("mapea status → fecha del primer evento (el más antiguo gana)", () => {
    const events: PortalShipmentEvent[] = [
      { id: "1", status: "in_warehouse", occurredAt: "2026-06-10T00:00:00Z", note: null },
      { id: "2", status: "shipped", occurredAt: "2026-06-20T00:00:00Z", note: null },
      // repetido: NO debe pisar la fecha más antigua
      { id: "3", status: "in_warehouse", occurredAt: "2026-06-12T00:00:00Z", note: null },
    ];
    const map = stepDatesFromEvents(events);
    expect(map.in_warehouse).toBe("2026-06-10T00:00:00Z");
    expect(map.shipped).toBe("2026-06-20T00:00:00Z");
    expect(map.delivered).toBeUndefined();
  });

  it("lista vacía → mapa vacío", () => {
    expect(stepDatesFromEvents([])).toEqual({});
  });
});

describe("listMyShipmentEvents · aislamiento", () => {
  it("resuelve el principal real y pide historia del selector exacto", async () => {
    const double = stub({ markbox: "DTD-0007" });
    await expect(listMyShipmentEvents(double.db, "ship-1")).resolves.toEqual([]);
    expect(double.rpcCalls).toEqual([{ name: "client_consolidation_portal_events", args: { p_shipment_id: "ship-1", p_limit: null } }]);
    expect(double.on("client_users")[0].filters).toEqual(expect.arrayContaining([
      { column: "auth_user_id", op: "eq", value: "11111111-1111-4111-8111-111111111111" },
      { column: "status", op: "eq", value: "active" },
    ]));
    expect(double.on("shipment_events")).toEqual([]);
  });

  it("sin markbox → [] sin tocar la tabla", async () => {
    const double = stub({ markbox: null });
    const res = await listMyShipmentEvents(double.db, "ship-1");
    expect(res).toEqual([]);
    expect(double.rpcCalls).toEqual([]);
    expect(double.on("shipment_events")).toEqual([]);
  });
});

describe("isClientNotifiableMilestone", () => {
  it("avisa en recibido/embarcado/reparto/entregado", () => {
    expect(isClientNotifiableMilestone("in_warehouse")).toBe(true);
    expect(isClientNotifiableMilestone("shipped")).toBe(true);
    expect(isClientNotifiableMilestone("out_for_delivery")).toBe(true);
    expect(isClientNotifiableMilestone("delivered")).toBe(true);
  });
  it("NO avisa en arribo (ya avisa por template) ni en estados intermedios", () => {
    expect(isClientNotifiableMilestone("arrived_destination")).toBe(false);
    expect(isClientNotifiableMilestone("in_transit")).toBe(false);
    expect(isClientNotifiableMilestone("in_customs")).toBe(false);
    expect(isClientNotifiableMilestone("draft")).toBe(false);
  });
});
