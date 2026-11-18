/**
 * SDD-0629 · `tasasVesPorFecha`: una lectura de `fx_rate_on` por fecha distinta,
 * siempre en VES y con el tenant pedido; sin tasa o con error, null.
 */
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { tasasVesPorFecha } from "../fx-rates";

function doble(respuestas: Record<string, unknown>) {
  const llamadas: Record<string, unknown>[] = [];
  const db = {
    rpc: async (nombre: string, args: Record<string, unknown>) => {
      llamadas.push({ nombre, ...args });
      const r = respuestas[String(args.p_on)];
      if (r instanceof Error) throw r;
      if (r === undefined) return { data: null, error: { code: "22023", message: "FX_RATE_MISSING" } };
      return { data: r, error: null };
    },
  } as unknown as SupabaseClient;
  return { db, llamadas };
}

describe("tasasVesPorFecha", () => {
  it("lee cada fecha una vez, en VES, con el tenant", async () => {
    const { db, llamadas } = doble({
      "2026-11-13": [{ rate: "36.5", source: "bcv", valid_on: "2026-11-13" }],
      "2026-11-01": [{ rate: 35, source: "manual", valid_on: "2026-10-30" }],
    });
    const m = await tasasVesPorFecha(db, "t-1", ["2026-11-13", "2026-11-13T09:00:00", "2026-11-01", null]);
    expect(llamadas).toEqual([
      { nombre: "fx_rate_on", p_tenant_id: "t-1", p_currency: "VES", p_on: "2026-11-13" },
      { nombre: "fx_rate_on", p_tenant_id: "t-1", p_currency: "VES", p_on: "2026-11-01" },
    ]);
    expect(m.get("2026-11-13")).toEqual({ rate: 36.5, source: "bcv", validOn: "2026-11-13" });
    expect(m.get("2026-11-01")).toEqual({ rate: 35, source: "manual", validOn: "2026-10-30" });
  });

  it("sin tasa o con error, null (nunca un cero)", async () => {
    const { db } = doble({ "2026-11-02": new Error("red caída") });
    const m = await tasasVesPorFecha(db, "t-1", ["2026-11-01", "2026-11-02"]);
    expect(m.get("2026-11-01")).toBeNull();
    expect(m.get("2026-11-02")).toBeNull();
  });
});
