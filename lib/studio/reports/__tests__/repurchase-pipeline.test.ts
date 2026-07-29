/**
 * Tests de los helpers puros de F1-T07 (Comerciales · Recompra + Pipeline).
 *
 * Cubre:
 *  - daysSinceIso (pasado / null / futuro → 0).
 *  - buildRepurchase (buckets window/overdue/recent, agrupación por cliente, el
 *    último embarque manda, delivered ?? arrived ?? created, activos y cancelados
 *    excluidos, caja sin dueño ignorada, orden desc).
 *  - monthsInRange (1 mes / 3 meses / 12 / inválido → 1).
 *  - buildPipeline (agregación por estado, abierto = draft+sent, ganado =
 *    accepted, cbm null no rompe, meta escalada por meses, status raro ignorado).
 */

import { describe, it, expect } from "vitest";
import {
  buildPipeline,
  buildRepurchase,
  daysSinceIso,
  monthsInRange,
  type DateRange,
  type PipelineQuote,
  type RepurchaseShipment,
} from "../types";
import type { QuoteStatus } from "@/lib/studio/quote-types";

const TODAY = new Date("2026-07-19T12:00:00Z");

const ship = (o: Partial<RepurchaseShipment>): RepurchaseShipment => ({
  markbox: "DTD-0001",
  clientName: "Cliente Uno",
  code: "S-2026-0001",
  status: "delivered",
  created_at: "2026-01-01T00:00:00Z",
  arrived_destination_at: null,
  delivered_at: null,
  ...o,
});

// ── daysSinceIso ──────────────────────────────────────────────
describe("daysSinceIso", () => {
  it("cuenta días enteros hacia atrás", () => {
    expect(daysSinceIso("2026-07-09T12:00:00Z", TODAY)).toBe(10);
  });
  it("null → null", () => {
    expect(daysSinceIso(null, TODAY)).toBeNull();
  });
  it("fecha futura → 0 (no negativos)", () => {
    expect(daysSinceIso("2026-08-01T00:00:00Z", TODAY)).toBe(0);
  });
  it("fecha imparseable → null", () => {
    expect(daysSinceIso("no-es-fecha", TODAY)).toBeNull();
  });
});

// ── buildRepurchase ───────────────────────────────────────────
describe("buildRepurchase", () => {
  it("clasifica vencida (≥45d), ventana (30-45d) y reciente (<30d)", () => {
    const r = buildRepurchase(
      [
        ship({ markbox: "DTD-A", delivered_at: "2026-05-30T00:00:00Z" }), // 50d → overdue
        ship({ markbox: "DTD-B", delivered_at: "2026-06-14T00:00:00Z" }), // 35d → window
        ship({ markbox: "DTD-C", delivered_at: "2026-07-14T00:00:00Z" }), // 5d → recent
      ],
      TODAY,
    );
    expect(r.overdueCount).toBe(1);
    expect(r.windowCount).toBe(1);
    expect(r.recentCount).toBe(1);
    expect(r.totalWithHistory).toBe(3);
    // Solo window + overdue son accionables (van en rows), orden desc por días.
    expect(r.rows.map((x) => x.markbox)).toEqual(["DTD-A", "DTD-B"]);
    expect(r.rows[0].bucket).toBe("overdue");
    expect(r.rows[1].bucket).toBe("window");
  });

  it("un embarque en curso saca al cliente de la fuga", () => {
    const r = buildRepurchase(
      [ship({ markbox: "DTD-A", status: "in_transit", delivered_at: null })],
      TODAY,
    );
    expect(r.activeCount).toBe(1);
    expect(r.rows).toHaveLength(0);
  });

  it("agrupa por cliente y manda el embarque MÁS reciente", () => {
    const r = buildRepurchase(
      [
        ship({ markbox: "DTD-A", code: "viejo", delivered_at: "2026-01-01T00:00:00Z" }), // overdue solo
        ship({ markbox: "DTD-A", code: "nuevo", delivered_at: "2026-07-15T00:00:00Z" }), // 4d → recent
      ],
      TODAY,
    );
    expect(r.totalWithHistory).toBe(1);
    expect(r.recentCount).toBe(1);
    expect(r.rows).toHaveLength(0); // el reciente gana → no es fuga
  });

  it("usa delivered ?? arrived ?? created como fecha de cierre", () => {
    const r = buildRepurchase(
      [
        ship({
          markbox: "DTD-A",
          delivered_at: null,
          arrived_destination_at: "2026-05-30T00:00:00Z", // 50d
        }),
      ],
      TODAY,
    );
    expect(r.overdueCount).toBe(1);
    expect(r.rows[0].lastActivityIso).toBe("2026-05-30T00:00:00Z");
  });

  it("ignora cajas sin dueño y embarques cancelados", () => {
    const r = buildRepurchase(
      [
        ship({ markbox: null, clientName: "  ", delivered_at: "2026-01-01T00:00:00Z" }),
        ship({ markbox: "DTD-X", status: "cancelled", delivered_at: "2026-01-01T00:00:00Z" }),
      ],
      TODAY,
    );
    expect(r.totalWithHistory).toBe(0);
    expect(r.rows).toHaveLength(0);
  });

  it("agrupa por nombre cuando no hay markbox", () => {
    const r = buildRepurchase(
      [
        ship({ markbox: null, clientName: "Juan Pérez", code: "a", delivered_at: "2026-05-01T00:00:00Z" }),
        ship({ markbox: null, clientName: "Juan Pérez", code: "b", delivered_at: "2026-05-10T00:00:00Z" }),
      ],
      TODAY,
    );
    expect(r.totalWithHistory).toBe(1);
    expect(r.overdueCount).toBe(1);
  });
});

// ── monthsInRange ─────────────────────────────────────────────
describe("monthsInRange", () => {
  it("un mes calendario → 1", () => {
    expect(monthsInRange({ from: "2026-07-01", to: "2026-07-31" })).toBe(1);
  });
  it("tres meses → 3", () => {
    expect(monthsInRange({ from: "2026-05-15", to: "2026-07-15" })).toBe(3);
  });
  it("año completo → 12", () => {
    expect(monthsInRange({ from: "2026-01-01", to: "2026-12-31" })).toBe(12);
  });
  it("rango inválido → 1", () => {
    expect(monthsInRange({ from: "x", to: "y" })).toBe(1);
  });
});

// ── buildPipeline ─────────────────────────────────────────────
describe("buildPipeline", () => {
  const range: DateRange = { from: "2026-07-01", to: "2026-07-31" }; // 1 mes
  const quotes: PipelineQuote[] = [
    { status: "draft", cbm: 10, total_usd: 8000 },
    { status: "sent", cbm: 20, total_usd: 16000 },
    { status: "accepted", cbm: 5, total_usd: 4000 },
    { status: "rejected", cbm: 3, total_usd: 2000 },
    { status: "expired", cbm: 2, total_usd: 1000 },
  ];

  it("suma el pipeline abierto (draft+sent) en CBM y USD", () => {
    const p = buildPipeline(quotes, range);
    expect(p.openCount).toBe(2);
    expect(p.openCbm).toBe(30);
    expect(p.openUsd).toBe(24000);
  });

  it("aísla lo ganado (accepted)", () => {
    const p = buildPipeline(quotes, range);
    expect(p.wonCount).toBe(1);
    expect(p.wonUsd).toBe(4000);
  });

  it("desglosa por estado en orden fijo, incluyendo los vacíos", () => {
    const p = buildPipeline([], range);
    expect(p.byStatus.map((s) => s.status)).toEqual([
      "draft",
      "sent",
      "accepted",
      "rejected",
      "expired",
    ]);
    expect(p.byStatus.filter((s) => s.open).map((s) => s.status)).toEqual(["draft", "sent"]);
    expect(p.openCbm).toBe(0);
  });

  it("escala la meta por meses del rango", () => {
    const p1 = buildPipeline(quotes, range); // 1 mes → 30 CBM/mes
    expect(p1.months).toBe(1);
    expect(p1.avgMonthlyOpenCbm).toBe(30);
    expect(p1.pctOfTarget).toBe(22.6); // 30/133

    const p3 = buildPipeline(quotes, { from: "2026-05-01", to: "2026-07-31" }); // 3 meses
    expect(p3.months).toBe(3);
    expect(p3.avgMonthlyOpenCbm).toBe(10);
    expect(p3.pctOfTarget).toBe(7.5); // 10/133
  });

  it("un CBM null (FCL flat) no rompe: suma el USD, no el CBM", () => {
    const p = buildPipeline([{ status: "sent", cbm: null, total_usd: 5000 }], range);
    expect(p.openCbm).toBe(0);
    expect(p.openUsd).toBe(5000);
    expect(p.openCount).toBe(1);
  });

  it("ignora estados fuera del enum (defensivo)", () => {
    const p = buildPipeline(
      [{ status: "weird" as QuoteStatus, cbm: 99, total_usd: 9999 }],
      range,
    );
    expect(p.openCbm).toBe(0);
    expect(p.byStatus.reduce((s, r) => s + r.count, 0)).toBe(0);
  });
});
