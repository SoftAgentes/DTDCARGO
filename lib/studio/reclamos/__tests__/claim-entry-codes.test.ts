// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listClaimEntryCodes } from "../claims-queries";

/**
 * SDD-0624 · Reclamos lee el código del asiento por la RPC
 * `claim_indemnity_entry_codes` (la 0528 cierra la lectura cruda de
 * journal_entries a quien no tiene el dinero). Si la base aún no tiene la RPC,
 * cae a la lectura de siempre; cualquier otro error devuelve un mapa vacío.
 */
function doble(opts: {
  rpc: { data: unknown; error: { code?: string; message?: string } | null };
  tabla?: { data: unknown; error: unknown };
}) {
  const from = vi.fn(() => {
    const b: Record<string, unknown> = {};
    for (const m of ["select", "in", "eq"]) b[m] = () => b;
    b.is = async () => opts.tabla ?? { data: [], error: null };
    return b;
  });
  const rpc = vi.fn(async () => opts.rpc);
  return { supabase: { rpc, from } as unknown as SupabaseClient, rpc, from };
}

describe("listClaimEntryCodes (SDD-0624)", () => {
  it("usa la RPC y no lee journal_entries", async () => {
    const { supabase, rpc, from } = doble({
      rpc: { data: [{ claim_id: "c1", entry_code: "A-1" }], error: null },
    });
    const out = await listClaimEntryCodes(supabase, ["c1"]);
    expect(rpc).toHaveBeenCalledWith("claim_indemnity_entry_codes", { p_claim_ids: ["c1"] });
    expect(from).not.toHaveBeenCalled();
    expect(out.get("c1")).toBe("A-1");
  });

  it("base sin la 0528 (PGRST202): cae a la lectura de siempre", async () => {
    const { supabase, from } = doble({
      rpc: { data: null, error: { code: "PGRST202", message: "not found" } },
      tabla: { data: [{ claim_id: "c1", entry_code: "A-viejo" }], error: null },
    });
    const out = await listClaimEntryCodes(supabase, ["c1"]);
    expect(from).toHaveBeenCalledWith("journal_entries");
    expect(out.get("c1")).toBe("A-viejo");
  });

  it("otro error de la RPC: mapa vacío, sin leer la tabla", async () => {
    const { supabase, from } = doble({
      rpc: { data: null, error: { code: "42501", message: "permission denied" } },
    });
    const out = await listClaimEntryCodes(supabase, ["c1"]);
    expect(from).not.toHaveBeenCalled();
    expect(out.size).toBe(0);
  });

  it("sin reclamos no llama a nada", async () => {
    const { supabase, rpc } = doble({ rpc: { data: [], error: null } });
    const out = await listClaimEntryCodes(supabase, []);
    expect(rpc).not.toHaveBeenCalled();
    expect(out.size).toBe(0);
  });
});
