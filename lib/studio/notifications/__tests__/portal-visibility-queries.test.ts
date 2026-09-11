/**
 * SDD-0156 · Slice D — getHiddenPortalStatuses: qué hitos oculta el stepper del
 * portal según la config, con precedencia override-cliente → default-tenant.
 *
 * SDD-0337 — el Portal consulta los hitos ocultos por una RPC sin parámetros y
 * degrada mostrando todo ante cualquier error, incluida la RPC todavía ausente.
 */
import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getHiddenPortalStatuses,
  getHiddenPortalStatusesForPortal,
} from "../portal-visibility-queries";

type RuleRow = {
  trigger_event: string;
  client_id: string | null;
  visible_in_portal: boolean;
};

/** Admin mock que devuelve `rows` para la query de reglas (o error). */
function makeAdmin(rows: RuleRow[], error: unknown = null) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          like: () => ({
            or: () => Promise.resolve({ data: error ? null : rows, error }),
          }),
        }),
      }),
    }),
  } as never;
}

describe("getHiddenPortalStatuses", () => {
  it("oculta el status con visible_in_portal=false (default del tenant)", async () => {
    const admin = makeAdmin([
      { trigger_event: "status:in_customs", client_id: null, visible_in_portal: false },
      { trigger_event: "status:shipped", client_id: null, visible_in_portal: true },
    ]);
    const hidden = await getHiddenPortalStatuses(admin, "t-1", null);
    expect(hidden.has("in_customs")).toBe(true);
    expect(hidden.has("shipped")).toBe(false);
  });

  it("el override del cliente gana al default (default oculta, override muestra)", async () => {
    const admin = makeAdmin([
      { trigger_event: "status:in_customs", client_id: null, visible_in_portal: false },
      { trigger_event: "status:in_customs", client_id: "c-1", visible_in_portal: true },
    ]);
    const hidden = await getHiddenPortalStatuses(admin, "t-1", "c-1");
    expect(hidden.has("in_customs")).toBe(false); // el override lo re-muestra
  });

  it("el override oculta aunque el default muestre", async () => {
    const admin = makeAdmin([
      { trigger_event: "status:delivered", client_id: null, visible_in_portal: true },
      { trigger_event: "status:delivered", client_id: "c-1", visible_in_portal: false },
    ]);
    const hidden = await getHiddenPortalStatuses(admin, "t-1", "c-1");
    expect(hidden.has("delivered")).toBe(true);
  });

  it("sin reglas → nada oculto (todo visible)", async () => {
    const hidden = await getHiddenPortalStatuses(makeAdmin([]), "t-1", null);
    expect(hidden.size).toBe(0);
  });

  it("falla-seguro: ante error devuelve set vacío (no oculta de más)", async () => {
    const admin = makeAdmin([], { message: "boom" });
    const hidden = await getHiddenPortalStatuses(admin, "t-1", null);
    expect(hidden.size).toBe(0);
  });
});

function makePortal(data: unknown, error: unknown = null) {
  const rpc = vi.fn().mockResolvedValue({ data, error });
  return { db: { rpc } as unknown as SupabaseClient, rpc };
}

describe("getHiddenPortalStatusesForPortal", () => {
  it("consulta la RPC ligada al principal sin enviar ids", async () => {
    const { db, rpc } = makePortal([
      { status: "in_customs" },
      { status: "delivered" },
    ]);

    const hidden = await getHiddenPortalStatusesForPortal(db);

    expect([...hidden]).toEqual(["in_customs", "delivered"]);
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("get_portal_hidden_shipment_statuses");
  });

  it.each([
    { data: [], error: null },
    { data: null, error: { message: "boom" } },
  ])("falla-seguro mostrando todos los hitos", async ({ data, error }) => {
    const { db } = makePortal(data, error);
    await expect(getHiddenPortalStatusesForPortal(db)).resolves.toEqual(new Set());
  });

  // L02 es migrate-first: sin 0402 aplicada, PostgREST responde PGRST202. La
  // página no rompe, pero el set vacío MUESTRA todos los hitos, incluidos los
  // que una regla del tenant oculta.
  it("RPC ausente (PGRST202): set vacío, muestra todos los hitos", async () => {
    const { db, rpc } = makePortal(null, {
      code: "PGRST202",
      message:
        "Could not find the function public.get_portal_hidden_shipment_statuses without parameters in the schema cache",
    });

    await expect(getHiddenPortalStatusesForPortal(db)).resolves.toEqual(new Set());
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("get_portal_hidden_shipment_statuses");
  });

  it("fallo de transporte (promesa rechazada): set vacío sin propagar", async () => {
    const rpc = vi.fn().mockRejectedValue(new Error("fetch failed"));
    const db = { rpc } as unknown as SupabaseClient;

    await expect(getHiddenPortalStatusesForPortal(db)).resolves.toEqual(new Set());
    expect(rpc).toHaveBeenCalledOnce();
  });
});
