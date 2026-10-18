/**
 * Tests del gate de activación del portal (SDD-0042 · Fase 5.1).
 *
 * Cubre los 3 casos de la spec §9.2:
 *  - pendiente: sin approved + 0 envíos → { activated: false, reason: null }.
 *  - aprobado: clients.portal_approved_at set → { activated: true, reason: 'approved' }.
 *  - con-envíos: 0 approved pero ≥1 envío → { activated: true, reason: 'has_shipments' }.
 *
 * `getPortalActivation` resuelve el principal Portal de la sesión (SDD-0552:
 * antes eran las RPC `get_portal_client_id` y `get_portal_client_markbox`) para
 * leer `portal_approved_at` con su id, y cuenta envíos por su tenant y markbox.
 * Stub mínimo encadenable, igual criterio que el resto de la suite del portal.
 * El cruce entre tenants se prueba en `portal-queries-principal-scope.test.ts`.
 */
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPortalActivation } from "../portal-queries";

/**
 * Stub para `getPortalActivation`.
 *  - con `portalClientId`: `auth.getUser()` da un uid y `client_users` su vínculo
 *    activo con el cliente `portalClientId` (Shipping Mark `markbox`) en
 *    `tenant-1`, que resuelve en `.maybeSingle()`; sin él, sesión anónima.
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
  const membership = opts.portalClientId
    ? {
        client_id: opts.portalClientId,
        tenant_id: "tenant-1",
        clients: {
          id: opts.portalClientId,
          tenant_id: "tenant-1",
          markbox: opts.markbox ?? "DTD-1007",
          name: "Cliente demo",
          email: null,
          phone: null,
          address: null,
          rif: null,
          doc_kind: null,
          city: null,
          state: null,
          deleted_at: null,
        },
      }
    : null;

  const supabase = {
    auth: {
      getUser: () =>
        Promise.resolve({
          data: { user: opts.portalClientId ? { id: "user-1" } : null },
          error: null,
        }),
    },
    rpc() {
      return Promise.resolve({ data: null, error: null });
    },
    from(table: string) {
      if (table === "client_users") {
        const chain = {
          select: () => chain,
          eq: () => chain,
          maybeSingle: () => Promise.resolve({ data: membership, error: null }),
        };
        return chain;
      }
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
