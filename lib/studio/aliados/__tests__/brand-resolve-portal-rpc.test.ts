import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { DTD_BRAND } from "@/lib/shared/brand-context";
import { resolveBrandForPortal } from "@/lib/studio/aliados/brand-resolve";

/**
 * L01 / SDD-0336 — casos mínimos que el test importado del origen no cubre.
 * `get_portal_brand` nace en 0401, pendiente de aplicar: mientras no exista,
 * PostgREST responde PGRST202. En ningún caso se lee una tabla directamente ni
 * se cae a un camino admin/legacy.
 */
function dbWithRpc(result: { data: unknown; error: unknown }) {
  const rpc = vi.fn().mockResolvedValue(result);
  const from = vi.fn(() => {
    throw new Error("resolveBrandForPortal no debe leer tablas directamente");
  });
  return { db: { rpc, from } as unknown as SupabaseClient, rpc, from };
}

const ALIADO_ROW = {
  trade_name: "Aliado Dos C.A.",
  brand_name: "Marca Dos",
  brand_primary: "#654321",
  brand_secondary: "#def",
  support_email: "dos@example.test",
  support_whatsapp: "+58 000 0000002",
  support_website: "https://dos.example.test",
  hide_dtd_brand: false,
};

describe("resolveBrandForPortal · RPC presente", () => {
  it("acepta la fila como objeto y pinta la marca del aliado sin enviar ids", async () => {
    const { db, rpc, from } = dbWithRpc({ data: ALIADO_ROW, error: null });

    await expect(resolveBrandForPortal(db)).resolves.toMatchObject({
      kind: "aliado",
      name: "Marca Dos",
      primary: "#654321",
      secondary: "#DEF",
      supportEmail: "dos@example.test",
      supportWebsite: "https://dos.example.test",
      hideDtd: false,
    });
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("get_portal_brand");
    expect(from).not.toHaveBeenCalled();
  });
});

describe("resolveBrandForPortal · RPC ausente o con error", () => {
  it.each([
    [
      "RPC ausente (0401 sin aplicar)",
      {
        code: "PGRST202",
        message:
          "Could not find the function public.get_portal_brand without parameters in the schema cache",
      },
    ],
    ["permiso denegado", { code: "42501", message: "permission denied for function get_portal_brand" }],
    ["transporte caído", { code: "", message: "TypeError: fetch failed" }],
  ])("%s → marca DTD completa, sin lectura directa de tablas", async (_caso, error) => {
    const { db, rpc, from } = dbWithRpc({ data: null, error });

    await expect(resolveBrandForPortal(db)).resolves.toEqual(DTD_BRAND);
    expect(rpc).toHaveBeenCalledOnce();
    expect(from).not.toHaveBeenCalled();
  });

  it("un error gana aunque llegue una fila: nunca un documento a medio pintar", async () => {
    const { db } = dbWithRpc({
      data: [ALIADO_ROW],
      error: { code: "XX000", message: "fallo interno" },
    });

    await expect(resolveBrandForPortal(db)).resolves.toEqual(DTD_BRAND);
  });
});
