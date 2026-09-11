import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { listarPackingListsComoDocumentos } from "../packing-list-queries";

/**
 * SDD-0342 · L06 migrate-first. La RPC `get_portal_packing_list_documents`
 * (0406) puede estar presente, ausente (PGRST202 mientras no se aplique),
 * denegada o inalcanzable. En todos los fallos la sección queda vacía y el
 * helper NO cae a leer `packing_list_submissions` por Shipping Mark: no hay
 * fallback admin/legacy que reabra la lectura sin tenant.
 */
function sessionDb(rpcImpl: () => Promise<unknown>) {
  const rpc = vi.fn(rpcImpl);
  const from = vi.fn(() => {
    throw new Error("lectura directa de tablas no permitida");
  });
  return { db: { rpc, from } as unknown as SupabaseClient, rpc, from };
}

describe("listarPackingListsComoDocumentos · estados de la RPC 0406", () => {
  it("RPC presente: una llamada sin argumentos y ninguna lectura directa", async () => {
    const { db, rpc, from } = sessionDb(async () => ({
      data: [
        {
          id: "pl-2",
          purchase_code: " PRE-0002 ",
          folio: null,
          submitted_at: "2026-09-03T00:00:00Z",
          boxes: null,
        },
      ],
      error: null,
    }));

    await expect(listarPackingListsComoDocumentos(db)).resolves.toEqual([
      {
        id: "pl-2",
        purchaseCode: "PRE-0002",
        folio: null,
        enviadoEl: "2026-09-03T00:00:00Z",
        cajas: 0,
      },
    ]);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("get_portal_packing_list_documents");
    expect(from).not.toHaveBeenCalled();
  });

  it("RPC presente sin filas: lista vacía", async () => {
    const { db } = sessionDb(async () => ({ data: [], error: null }));
    await expect(listarPackingListsComoDocumentos(db)).resolves.toEqual([]);
  });

  it("RPC ausente (PGRST202): lista vacía sin fallback a la tabla", async () => {
    const { db, rpc, from } = sessionDb(async () => ({
      data: null,
      error: {
        code: "PGRST202",
        message:
          "Could not find the function public.get_portal_packing_list_documents without parameters in the schema cache",
      },
    }));

    await expect(listarPackingListsComoDocumentos(db)).resolves.toEqual([]);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(from).not.toHaveBeenCalled();
  });

  it("RPC denegada (42501) o transporte caído: falla cerrado", async () => {
    const denied = sessionDb(async () => ({
      data: null,
      error: { code: "42501", message: "permission denied for function" },
    }));
    await expect(listarPackingListsComoDocumentos(denied.db)).resolves.toEqual([]);
    expect(denied.from).not.toHaveBeenCalled();

    const offline = sessionDb(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(listarPackingListsComoDocumentos(offline.db)).resolves.toEqual([]);
    expect(offline.from).not.toHaveBeenCalled();
  });
});
