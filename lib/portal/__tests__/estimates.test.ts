/**
 * Tests de "Estimados" del portal (SDD-0061 · read-only).
 *
 *  - `listMyEstimates`: mapea filas de `quotes` a `PortalEstimateRow`, ordena por
 *    fecha (lo garantiza el `.order`), y AÍSLA — sin markbox del portal devuelve []
 *    (no toca `quotes`). Cubre que lee de la tabla `quotes` filtrando por markbox.
 *  - labels/tonos de estado de cara al cliente (masculino + "En revisión").
 */
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listMyEstimates } from "../portal-queries";
import {
  portalEstimateStatusLabel,
  portalEstimateStatusTone,
} from "../portal-types";

/** Stub encadenable: rpc → markbox; from(quotes).select().eq().is().order().limit() → rows. */
function stub(opts: {
  markbox: string | null;
  quotes?: Record<string, unknown>[];
}): { supabase: SupabaseClient; touched: () => string[] } {
  const touched: string[] = [];
  function builder(rows: Record<string, unknown>[]) {
    const b: Record<string, unknown> = {};
    Object.assign(b, {
      select: () => b,
      eq: () => b,
      is: () => b,
      order: () => b,
      limit: () => Promise.resolve({ data: rows, error: null }),
    });
    return b;
  }
  const supabase = {
    rpc: (fn: string) =>
      fn === "get_portal_client_markbox"
        ? Promise.resolve({ data: opts.markbox, error: null })
        : Promise.resolve({ data: null, error: null }),
    from: (table: string) => {
      touched.push(table);
      return builder(opts.quotes ?? []);
    },
  } as unknown as SupabaseClient;
  return { supabase, touched: () => touched };
}

function quoteRow(over: Record<string, unknown>): Record<string, unknown> {
  return {
    id: "q1",
    quote_code: "EST-2026-0001",
    status: "draft",
    source: "web",
    service: "puerta_a_puerta_DDP",
    origin: "Yiwu, CN",
    destination: "Valencia, VE",
    total_usd: 1250.5,
    nota: "Tengo la mercancía lista",
    converted_to_shipment_id: null,
    created_at: "2026-06-07T10:00:00.000Z",
    updated_at: "2026-06-07T10:00:00.000Z",
    ...over,
  };
}

describe("listMyEstimates", () => {
  it("mapea las filas de quotes a PortalEstimateRow", async () => {
    const { supabase, touched } = stub({
      markbox: "DTD-9001",
      quotes: [
        quoteRow({}),
        quoteRow({
          id: "q2",
          quote_code: "Q-2025-0099",
          status: "accepted",
          source: "studio",
          nota: null,
          converted_to_shipment_id: "s-1",
          total_usd: 800,
        }),
      ],
    });

    const rows = await listMyEstimates(supabase);

    expect(touched()).toContain("quotes");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      id: "q1",
      code: "EST-2026-0001",
      status: "draft",
      source: "web",
      service: "puerta_a_puerta_DDP",
      origin: "Yiwu, CN",
      destination: "Valencia, VE",
      totalUsd: 1250.5,
      nota: "Tengo la mercancía lista",
      convertedToShipmentId: null,
      createdAt: "2026-06-07T10:00:00.000Z",
      updatedAt: "2026-06-07T10:00:00.000Z",
    });
    expect(rows[1].source).toBe("studio");
    expect(rows[1].convertedToShipmentId).toBe("s-1");
  });

  it("aísla: sin markbox del portal devuelve [] y NO toca quotes", async () => {
    const { supabase, touched } = stub({ markbox: null, quotes: [quoteRow({})] });
    const rows = await listMyEstimates(supabase);
    expect(rows).toEqual([]);
    expect(touched()).not.toContain("quotes");
  });

  it("tolera total_usd nulo (→ 0)", async () => {
    const { supabase } = stub({
      markbox: "DTD-9001",
      quotes: [quoteRow({ total_usd: null })],
    });
    const rows = await listMyEstimates(supabase);
    expect(rows[0].totalUsd).toBe(0);
  });
});

describe("portalEstimateStatusLabel / Tone", () => {
  it("traduce draft a 'En revisión' (no 'Borrador')", () => {
    expect(portalEstimateStatusLabel("draft")).toBe("En revisión");
    expect(portalEstimateStatusTone("draft")).toBe("info");
  });

  it("usa masculino para los demás estados", () => {
    expect(portalEstimateStatusLabel("sent")).toBe("Enviado");
    expect(portalEstimateStatusLabel("accepted")).toBe("Aceptado");
    expect(portalEstimateStatusLabel("rejected")).toBe("Rechazado");
    expect(portalEstimateStatusLabel("expired")).toBe("Vencido");
  });

  it("mapea los tonos esperados", () => {
    expect(portalEstimateStatusTone("accepted")).toBe("success");
    expect(portalEstimateStatusTone("rejected")).toBe("danger");
    expect(portalEstimateStatusTone("expired")).toBe("warning");
  });
});
