// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { DTD_BRAND } from "@/lib/shared/brand-context";
import { resolveBrandForPortal } from "@/lib/studio/aliados/brand-resolve";

function dbWithRpc(data: unknown, error: unknown = null) {
  const rpc = vi.fn().mockResolvedValue({ data, error });
  return { db: { rpc } as unknown as SupabaseClient, rpc };
}

describe("resolveBrandForPortal", () => {
  it("consulta la RPC ligada al principal sin enviar ids", async () => {
    const { db, rpc } = dbWithRpc([
      {
        trade_name: "Aliado Uno",
        brand_name: "Marca Uno",
        brand_primary: "#123456",
        brand_secondary: "#abc",
        support_email: "soporte@example.test",
        support_whatsapp: "+58 000 0000000",
        support_website: "https://example.test",
        hide_dtd_brand: true,
      },
    ]);

    await expect(resolveBrandForPortal(db)).resolves.toMatchObject({
      kind: "aliado",
      name: "Marca Uno",
      primary: "#123456",
      secondary: "#ABC",
      hideDtd: true,
    });
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("get_portal_brand");
  });

  it.each([
    { data: [], error: null },
    { data: null, error: { message: "no disponible" } },
  ])("cae a DTD sin aliado o ante error", async ({ data, error }) => {
    const { db } = dbWithRpc(data, error);
    await expect(resolveBrandForPortal(db)).resolves.toEqual(DTD_BRAND);
  });
});
