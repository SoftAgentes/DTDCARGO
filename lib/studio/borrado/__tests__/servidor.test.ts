/**
 * SDD-0522 · Las lecturas de bloqueos para la UI (`leerInfo*`): `null` si no
 * se pudo leer, para que la pantalla no ofrezca borrar lo que no comprobó.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { eliminarRecepciones, leerInfoEmbarques, leerInfoRecepciones } from "../servidor";

type Reply = { data: unknown; error: { code?: string; message: string } | null };

function cliente(responder: (fn: string, args: Record<string, unknown>) => Reply) {
  const llamadas: { fn: string; args: Record<string, unknown> }[] = [];
  const client = {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      llamadas.push({ fn, args: { ...args } });
      return responder(fn, args);
    },
  } as unknown as SupabaseClient;
  return { client, llamadas };
}

describe("leerInfoEmbarques", () => {
  it("arma bloqueos y avisos por id con la RPC de lectura", async () => {
    const { client, llamadas } = cliente(() => ({
      data: [
        { shipment_id: "a", code: "S-1", blockers: { invoices: 1 }, warnings: { documents: 2 } },
        { shipment_id: "b", code: "S-2", blockers: {}, warnings: {} },
      ],
      error: null,
    }));
    expect(await leerInfoEmbarques(client, ["a", "b", "a"])).toEqual({
      a: { bloqueos: { invoices: 1 }, avisos: { documents: 2 } },
      b: { bloqueos: {}, avisos: {} },
    });
    expect(llamadas).toEqual([{ fn: "shipment_delete_blockers", args: { p_ids: ["a", "b"] } }]);
  });

  it("sin ids no llama", async () => {
    const { client, llamadas } = cliente(() => ({ data: [], error: null }));
    expect(await leerInfoEmbarques(client, [])).toEqual({});
    expect(llamadas).toEqual([]);
  });

  it("error (sin la 0476, sin permiso) o forma rara: null", async () => {
    const consola = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await leerInfoEmbarques(cliente(() => ({ data: null, error: { code: "PGRST202", message: "x" } })).client, ["a"])).toBeNull();
    // Un error manda aunque venga con datos: no se ofrece borrar a medias.
    expect(await leerInfoEmbarques(cliente(() => ({ data: [], error: { code: "57014", message: "timeout" } })).client, ["a"])).toBeNull();
    expect(await leerInfoEmbarques(cliente(() => ({ data: { no: "arreglo" }, error: null })).client, ["a"])).toBeNull();
    expect(await leerInfoEmbarques(cliente(() => ({ data: [{ code: "S-1" }], error: null })).client, ["a"])).toBeNull();
    consola.mockRestore();
  });

  it("lee en tramos de 500, el tope de la base", async () => {
    const ids = Array.from({ length: 1001 }, (_, i) => `id-${i}`);
    const { client, llamadas } = cliente((_, args) => ({
      data: (args.p_ids as string[]).map((id) => ({ shipment_id: id, blockers: {}, warnings: {} })),
      error: null,
    }));
    const info = await leerInfoEmbarques(client, ids);
    expect(Object.keys(info ?? {})).toHaveLength(1001);
    expect(llamadas.map((l) => (l.args.p_ids as string[]).length)).toEqual([500, 500, 1]);
  });
});

describe("recepciones", () => {
  it("leerInfoRecepciones usa su RPC y la clave receipt_id", async () => {
    const { client, llamadas } = cliente(() => ({
      data: [{ receipt_id: "r", code: "WR-1", blockers: { purchase: 1 }, warnings: { boxes: 3 } }],
      error: null,
    }));
    expect(await leerInfoRecepciones(client, ["r"])).toEqual({ r: { bloqueos: { purchase: 1 }, avisos: { boxes: 3 } } });
    expect(llamadas[0].fn).toBe("warehouse_receipt_cn_delete_blockers");
  });

  it("eliminarRecepciones manda ids y motivo a la RPC de borrado", async () => {
    const { client, llamadas } = cliente(() => ({
      data: [{ receipt_id: "r", code: "WR-1", outcome: "deleted", blockers: {} }],
      error: null,
    }));
    expect(await eliminarRecepciones(client, ["r"], "Recepción de prueba")).toEqual({
      estado: "eliminado",
      codigos: ["WR-1"],
    });
    expect(llamadas).toEqual([
      { fn: "soft_delete_warehouse_receipts_cn_with_audit_reason", args: { p_ids: ["r"], p_reason: "Recepción de prueba" } },
    ]);
  });
});
