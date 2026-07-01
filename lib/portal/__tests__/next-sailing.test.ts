/**
 * Tests del próximo zarpe / cut-off del portal (SDD-0133).
 *
 * Cubre:
 *  - `daysUntil` (puro): días de calendario al cut-off (>= 0), null si no parseable.
 *  - `portalSpaceLabel`: label de espacio de cara al cliente.
 *  - `getNextOpenSailing`: filtra status='abierto' + cutoff >= hoy + tenant, mapea
 *    la fila; error/sin fila → null.
 */
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  daysUntil,
  portalSpaceLabel,
  getNextOpenSailing,
} from "../next-sailing-queries";

describe("daysUntil", () => {
  it("mismo día → 0", () => {
    expect(daysUntil("2026-07-01", "2026-07-01")).toBe(0);
  });
  it("futuro → días completos", () => {
    expect(daysUntil("2026-07-10", "2026-07-01")).toBe(9);
  });
  it("pasado → 0 (nunca negativo)", () => {
    expect(daysUntil("2026-06-25", "2026-07-01")).toBe(0);
  });
  it("null / no parseable → null", () => {
    expect(daysUntil(null, "2026-07-01")).toBeNull();
    expect(daysUntil("no-fecha", "2026-07-01")).toBeNull();
  });
});

describe("portalSpaceLabel", () => {
  it("traduce cada nivel a copy del cliente", () => {
    expect(portalSpaceLabel("alta")).toBe("Buen espacio disponible");
    expect(portalSpaceLabel("media")).toBe("Espacio limitado");
    expect(portalSpaceLabel("baja")).toBe("Poco espacio");
    expect(portalSpaceLabel("cerrada")).toBe("Cupo cerrado");
  });
});

function stub(row: Record<string, unknown> | null) {
  const eqCalls: [string, unknown][] = [];
  const gteCalls: [string, unknown][] = [];
  const builder: Record<string, unknown> = {};
  Object.assign(builder, {
    select: () => builder,
    eq: (col: string, val: unknown) => {
      eqCalls.push([col, val]);
      return builder;
    },
    gte: (col: string, val: unknown) => {
      gteCalls.push([col, val]);
      return builder;
    },
    is: () => builder,
    order: () => builder,
    limit: () => builder,
    maybeSingle: () => Promise.resolve({ data: row, error: null }),
  });
  const admin = { from: () => builder } as unknown as SupabaseClient;
  return { admin, eqCalls, gteCalls };
}

describe("getNextOpenSailing", () => {
  it("filtra abierto + cutoff>=hoy + tenant y mapea la fila", async () => {
    const { admin, eqCalls, gteCalls } = stub({
      id: "s1",
      vessel: "COSCO FORTUNE",
      pol: "NGB",
      pod: "PBL",
      etd: "2026-07-20",
      eta: "2026-08-25",
      cutoff: "2026-07-15",
      transit_days: 36,
      space: "media",
    });
    const res = await getNextOpenSailing(admin, "t1", "2026-07-01");
    expect(res?.vessel).toBe("COSCO FORTUNE");
    expect(res?.space).toBe("media");
    expect(res?.transitDays).toBe(36);
    expect(eqCalls).toContainEqual(["tenant_id", "t1"]);
    expect(eqCalls).toContainEqual(["status", "abierto"]);
    expect(gteCalls).toContainEqual(["cutoff", "2026-07-01"]);
  });

  it("sin fila → null", async () => {
    const { admin } = stub(null);
    expect(await getNextOpenSailing(admin, "t1", "2026-07-01")).toBeNull();
  });
});
