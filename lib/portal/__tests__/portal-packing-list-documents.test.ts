// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { listarPackingListsComoDocumentos } from "../packing-list-queries";

function dbWithRpc(data: unknown, error: unknown = null) {
  const rpc = vi.fn().mockResolvedValue({ data, error });
  return { db: { rpc } as unknown as SupabaseClient, rpc };
}

describe("listarPackingListsComoDocumentos por principal", () => {
  it("consulta sin ids y mapea el snapshot mínimo", async () => {
    const { db, rpc } = dbWithRpc([
      {
        id: "pl-1",
        purchase_code: "PRE-0001",
        folio: "DTD-PL-2026-0001",
        submitted_at: "2026-09-02T00:00:00Z",
        boxes: "4",
      },
    ]);

    await expect(listarPackingListsComoDocumentos(db)).resolves.toEqual([
      {
        id: "pl-1",
        purchaseCode: "PRE-0001",
        folio: "DTD-PL-2026-0001",
        enviadoEl: "2026-09-02T00:00:00Z",
        cajas: 4,
      },
    ]);
    expect(rpc).toHaveBeenCalledWith("get_portal_packing_list_documents");
  });

  it("omite filas sin código y falla cerrado ante error", async () => {
    const { db } = dbWithRpc([{ id: "pl-1", purchase_code: "" }]);
    await expect(listarPackingListsComoDocumentos(db)).resolves.toEqual([]);

    const failed = dbWithRpc(null, { message: "boom" });
    await expect(listarPackingListsComoDocumentos(failed.db)).resolves.toEqual([]);
  });
});
