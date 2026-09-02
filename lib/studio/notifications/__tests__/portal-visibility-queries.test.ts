/**
 * SDD-0337 — el Portal consulta los hitos ocultos por una RPC sin parámetros y
 * degrada mostrando todo ante cualquier error.
 */
import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getHiddenPortalStatusesForPortal } from "../portal-visibility-queries";

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
});
