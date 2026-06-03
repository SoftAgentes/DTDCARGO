/**
 * Tests del gate de activación del portal (SDD-0042 · Fase 5.1).
 *
 * Cubre los 3 casos de la spec §9.2:
 *  - pendiente: sin approved + 0 envíos → { activated: false, reason: null }.
 *  - aprobado: clients.portal_approved_at set → { activated: true, reason: 'approved' }.
 *  - con-envíos: 0 approved pero ≥1 envío → { activated: true, reason: 'has_shipments' }.
 *
 * `getPortalActivation` resuelve el client_id del portal (helper aislada) para leer
 * `portal_approved_at`, y cuenta envíos por markbox. Stub mínimo encadenable, igual
 * criterio que el resto de la suite del portal.
 */
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPortalActivation } from "../portal-queries";

/**
 * Stub para `getPortalActivation`.
 *  - rpc("get_portal_client_id") → portalClientId
 *  - rpc("get_portal_client_markbox") → markbox
 *  - from("clients")...maybeSingle() → { portal_approved_at }
 *  - from("shipments")...{count, head} → resuelve en `.is()` con { count }
 *
 * El builder de `clients` resuelve en `.maybeSingle()`; el de `shipments` (count
 * query, head:true) resuelve en `.is()` (último eslabón de esa cadena).
 */
function stub(opts: {
  portalClientId: string | null;
  markbox?: string | null;
  approvedAt?: string | null;
  shipmentCount?: number;
}): { supabase: SupabaseClient; touchedShipments: () => boolean } {
  let touchedShipments = false;

  const supabase = {
    rpc(fn: string) {
      if (fn === "get_portal_client_id") {
        return Promise.resolve({ data: opts.portalClientId, error: null });
      }
      if (fn === "get_portal_client_markbox") {
        return Promise.resolve({ data: opts.markbox ?? null, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
    from(table: string) {
      if (table === "shipments") {
        touchedShipments = true;
        // count query: select(...,{count,head}).eq().is() → resuelve en is()
        const chain = {
          select: () => chain,
          eq: () => chain,
          is: () =>
            Promise.resolve({ count: opts.shipmentCount ?? 0, error: null }),
        };
        return chain;
      }
      // clients: select().eq().maybeSingle()
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: () =>
          Promise.resolve({
            data: { portal_approved_at: opts.approvedAt ?? null },
            error: null,
          }),
      };
      return chain;
    },
  } as unknown as SupabaseClient;

  return { supabase, touchedShipments: () => touchedShipments };
}

describe("getPortalActivation — gate de activación", () => {
  it("pendiente: sin aprobación y 0 envíos → no activada", async () => {
    const { supabase } = stub({
      portalClientId: "c-1",
      markbox: "DTD-1007",
      approvedAt: null,
      shipmentCount: 0,
    });
    expect(await getPortalActivation(supabase)).toEqual({
      activated: false,
      reason: null,
    });
  });

  it("aprobado: portal_approved_at set → activada por 'approved' (sin contar envíos)", async () => {
    const { supabase, touchedShipments } = stub({
      portalClientId: "c-1",
      markbox: "DTD-1007",
      approvedAt: "2026-06-02T12:00:00.000Z",
      shipmentCount: 0,
    });
    expect(await getPortalActivation(supabase)).toEqual({
      activated: true,
      reason: "approved",
    });
    // Si ya está aprobada no necesita contar envíos (corta antes).
    expect(touchedShipments()).toBe(false);
  });

  it("con-envíos: 0 aprobación pero ≥1 envío → activada por 'has_shipments'", async () => {
    const { supabase } = stub({
      portalClientId: "c-1",
      markbox: "DTD-1007",
      approvedAt: null,
      shipmentCount: 2,
    });
    expect(await getPortalActivation(supabase)).toEqual({
      activated: true,
      reason: "has_shipments",
    });
  });

  it("principal no-cliente (sin client_id del portal) → no activada, sin tocar shipments", async () => {
    const { supabase, touchedShipments } = stub({ portalClientId: null });
    expect(await getPortalActivation(supabase)).toEqual({
      activated: false,
      reason: null,
    });
    expect(touchedShipments()).toBe(false);
  });
});
