/**
 * Tests de hitos del envío en el portal (SDD-0132).
 *
 * Cubre:
 *  - `stepDatesFromEvents` (puro): mapa status → fecha del PRIMER evento (el más
 *    antiguo gana; entrada en orden ascendente).
 *  - AISLAMIENTO: `listMyShipmentEvents` resuelve el markbox PRIMERO y filtra
 *    explícito por shipment_id + `shipments.client_markbox`; sin markbox → [] sin
 *    tocar la tabla.
 *  - `isClientNotifiableMilestone`: el set de hitos que avisan al cliente
 *    (decisión founder) — el arribo NO está (ya avisa por su template).
 */
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  stepDatesFromEvents,
  listMyShipmentEvents,
  type PortalShipmentEvent,
} from "../shipment-events-queries";
import { isClientNotifiableMilestone } from "@/lib/studio/shipment-milestone-notify";

function stub(opts: { markbox: string | null; rows?: Record<string, unknown>[] }) {
  const eqCalls: [string, unknown][] = [];
  let touchedTable: string | null = null;
  const builder: Record<string, unknown> = {};
  Object.assign(builder, {
    select: () => builder,
    eq: (col: string, val: unknown) => {
      eqCalls.push([col, val]);
      return builder;
    },
    is: () => builder,
    order: () => Promise.resolve({ data: opts.rows ?? [], error: null }),
    limit: () => Promise.resolve({ data: opts.rows ?? [], error: null }),
  });
  const supabase = {
    rpc: (fn: string) =>
      fn === "get_portal_client_markbox"
        ? Promise.resolve({ data: opts.markbox, error: null })
        : Promise.resolve({ data: null, error: null }),
    from: (table: string) => {
      touchedTable = table;
      return builder;
    },
  } as unknown as SupabaseClient;
  return { supabase, eqCalls, touchedTable: () => touchedTable };
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
  it("filtra por shipment_id + markbox del cliente", async () => {
    const { supabase, eqCalls, touchedTable } = stub({ markbox: "DTD-0007", rows: [] });
    await listMyShipmentEvents(supabase, "ship-1");
    expect(touchedTable()).toBe("shipment_events");
    expect(eqCalls).toContainEqual(["shipment_id", "ship-1"]);
    expect(eqCalls).toContainEqual(["shipments.client_markbox", "DTD-0007"]);
  });

  it("sin markbox → [] sin tocar la tabla", async () => {
    const { supabase, touchedTable } = stub({ markbox: null });
    const res = await listMyShipmentEvents(supabase, "ship-1");
    expect(res).toEqual([]);
    expect(touchedTable()).toBeNull();
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
