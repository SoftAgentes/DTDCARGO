/**
 * Tests de los helpers puros de Reportes & Analytics (SDD-0052 · Slice A).
 *
 * Cubre Acceptance §5:
 *  - periodRange (1M/3M/1A/YTD, incluido borde de año).
 *  - transitDays (delivered / arrived fallback / null / negativo).
 *  - ratePerCbm (cbm 0 → 0).
 *  - groupByRoute / groupByService (agrupación + orden desc por revenue +
 *    desempate por count + revenue join por shipment_code).
 *  - monthlyBuckets (serie continua de meses, conteo + CBM).
 */

import { describe, it, expect } from "vitest";
import {
  asPeriod,
  groupByRoute,
  groupByService,
  monthlyBuckets,
  periodRange,
  ratePerCbm,
  routeKey,
  routeLabel,
  serviceLabel,
  transitDays,
  type ReportShipment,
} from "../types";
import type { ShipmentService } from "@/lib/shared/shipment-public";

// ── periodRange ───────────────────────────────────────────────
describe("periodRange", () => {
  const today = new Date("2026-06-15T10:00:00Z");

  it("1M = trailing 1 mes", () => {
    expect(periodRange("1M", today)).toEqual({ from: "2026-05-15", to: "2026-06-15" });
  });

  it("3M = trailing 3 meses", () => {
    expect(periodRange("3M", today)).toEqual({ from: "2026-03-15", to: "2026-06-15" });
  });

  it("1A = trailing 12 meses", () => {
    expect(periodRange("1A", today)).toEqual({ from: "2025-06-15", to: "2026-06-15" });
  });

  it("YTD = 1° de enero del año de today", () => {
    expect(periodRange("YTD", today)).toEqual({ from: "2026-01-01", to: "2026-06-15" });
  });

  it("borde de año: 1M en enero retrocede a diciembre del año anterior", () => {
    const enero = new Date("2026-01-10T00:00:00Z");
    expect(periodRange("1M", enero)).toEqual({ from: "2025-12-10", to: "2026-01-10" });
    expect(periodRange("YTD", enero)).toEqual({ from: "2026-01-01", to: "2026-01-10" });
  });

  it("borde de año: 3M en febrero cruza a noviembre del año anterior", () => {
    const feb = new Date("2026-02-05T00:00:00Z");
    expect(periodRange("3M", feb)).toEqual({ from: "2025-11-05", to: "2026-02-05" });
  });
});

describe("asPeriod", () => {
  it("normaliza valores válidos y cae a 1A por default", () => {
    expect(asPeriod("1M")).toBe("1M");
    expect(asPeriod("YTD")).toBe("YTD");
    expect(asPeriod("xx")).toBe("1A");
    expect(asPeriod(undefined)).toBe("1A");
    expect(asPeriod(123)).toBe("1A");
  });
});

// ── transitDays ───────────────────────────────────────────────
describe("transitDays", () => {
  it("usa delivered_at sobre arrived_destination_at", () => {
    const d = transitDays({
      created_at: "2026-01-01T00:00:00Z",
      arrived_destination_at: "2026-02-01T00:00:00Z",
      delivered_at: "2026-02-10T00:00:00Z",
    });
    expect(d).toBe(40); // ene 1 → feb 10
  });

  it("cae a arrived_destination_at cuando no hay delivered_at", () => {
    const d = transitDays({
      created_at: "2026-01-01T00:00:00Z",
      arrived_destination_at: "2026-02-01T00:00:00Z",
      delivered_at: null,
    });
    expect(d).toBe(31);
  });

  it("null si falta el hito de cierre", () => {
    expect(
      transitDays({
        created_at: "2026-01-01T00:00:00Z",
        arrived_destination_at: null,
        delivered_at: null,
      }),
    ).toBeNull();
  });

  it("null si el resultado es negativo (datos inconsistentes)", () => {
    expect(
      transitDays({
        created_at: "2026-03-01T00:00:00Z",
        arrived_destination_at: "2026-02-01T00:00:00Z",
        delivered_at: null,
      }),
    ).toBeNull();
  });
});

// ── ratePerCbm ────────────────────────────────────────────────
describe("ratePerCbm", () => {
  it("revenue / cbm normal", () => {
    expect(ratePerCbm(1000, 2)).toBe(500);
  });
  it("cbm 0 → 0 (sin división por cero)", () => {
    expect(ratePerCbm(1000, 0)).toBe(0);
  });
  it("cbm negativo → 0", () => {
    expect(ratePerCbm(1000, -5)).toBe(0);
  });
});

// ── routeKey / routeLabel / serviceLabel ──────────────────────
describe("routeKey / routeLabel / serviceLabel", () => {
  it("routeKey normaliza espacios y separa con ||", () => {
    expect(routeKey(" Yiwu ", "Pto Cabello")).toBe("Yiwu||Pto Cabello");
    expect(routeKey(null, null)).toBe("||");
  });
  it("routeLabel muestra — para extremos vacíos", () => {
    expect(routeLabel("Yiwu", "Pto Cabello")).toBe("Yiwu → Pto Cabello");
    expect(routeLabel(null, "Maracaibo")).toBe("— → Maracaibo");
  });
  it("serviceLabel reusa SERVICE_LABELS", () => {
    expect(serviceLabel("consolidacion")).toBe("Consolidación");
    expect(serviceLabel("puerta_a_puerta_DDP")).toBe("Puerta a Puerta DDP");
  });
});

// ── factory de shipment ───────────────────────────────────────
function ship(p: Partial<ReportShipment>): ReportShipment {
  return {
    id: p.id ?? crypto.randomUUID(),
    code: p.code ?? "S-2026-0001",
    origin: p.origin ?? "Yiwu",
    destination: p.destination ?? "Pto Cabello",
    shipment_service: (p.shipment_service ?? "consolidacion") as ShipmentService,
    status: p.status ?? "in_transit",
    cbm: p.cbm ?? 1,
    created_at: p.created_at ?? "2026-03-01T00:00:00Z",
    arrived_destination_at: p.arrived_destination_at ?? null,
    delivered_at: p.delivered_at ?? null,
    ...p,
  };
}

// ── groupByRoute ──────────────────────────────────────────────
describe("groupByRoute", () => {
  it("agrupa por origen→destino, cruza revenue por code y ordena desc por revenue", () => {
    const shipments = [
      ship({ code: "A1", origin: "Yiwu", destination: "Pto Cabello", cbm: 10 }),
      ship({ code: "A2", origin: "Yiwu", destination: "Pto Cabello", cbm: 5 }),
      ship({ code: "B1", origin: "Shenzhen", destination: "La Guaira", cbm: 4 }),
    ];
    const revenue = new Map<string, number>([
      ["A1", 8000],
      ["A2", 2000],
      ["B1", 9000],
    ]);
    const rows = groupByRoute(shipments, revenue);

    // Yiwu agrupa A1+A2 = 10000 de revenue → va primero pese a que B1 (9000)
    // tiene una sola ruta con monto unitario mayor.
    expect(rows[0].label).toBe("Yiwu → Pto Cabello");
    expect(rows[0].revenue).toBe(10000);
    expect(rows[0].count).toBe(2);
    expect(rows[0].cbm).toBe(15); // 10 + 5
    expect(rows[0].rate).toBe(Math.round(10000 / 15)); // USD/CBM
    // La Guaira queda segunda (9000).
    expect(rows[1].label).toBe("Shenzhen → La Guaira");
    expect(rows[1].revenue).toBe(9000);
    expect(rows[1].count).toBe(1);
  });

  it("desempata por count cuando el revenue es igual", () => {
    const shipments = [
      ship({ code: "X1", origin: "A", destination: "Z", cbm: 1 }),
      ship({ code: "Y1", origin: "B", destination: "Z", cbm: 1 }),
      ship({ code: "Y2", origin: "B", destination: "Z", cbm: 1 }),
    ];
    const revenue = new Map<string, number>([
      ["X1", 1000],
      ["Y1", 500],
      ["Y2", 500],
    ]);
    const rows = groupByRoute(shipments, revenue);
    // Ambas rutas suman 1000 de revenue → gana B→Z por tener 2 embarques.
    expect(rows[0].label).toBe("B → Z");
    expect(rows[0].count).toBe(2);
    expect(rows[1].label).toBe("A → Z");
  });

  it("avgTransit null si ningún embarque del grupo es medible", () => {
    const shipments = [ship({ code: "N1", arrived_destination_at: null, delivered_at: null })];
    const rows = groupByRoute(shipments, new Map());
    expect(rows[0].avgTransit).toBeNull();
    expect(rows[0].revenue).toBe(0); // sin entrada en el mapa → 0
  });
});

// ── groupByService ────────────────────────────────────────────
describe("groupByService", () => {
  it("agrupa por servicio + revenue join + orden desc", () => {
    const shipments = [
      ship({ code: "S1", shipment_service: "consolidacion", cbm: 2 }),
      ship({ code: "S2", shipment_service: "consolidacion", cbm: 3 }),
      ship({ code: "F1", shipment_service: "reserva_FCL", cbm: 50 }),
    ];
    const revenue = new Map<string, number>([
      ["S1", 1000],
      ["S2", 1000],
      ["F1", 5000],
    ]);
    const rows = groupByService(shipments, revenue);

    expect(rows[0].service).toBe("reserva_FCL");
    expect(rows[0].revenue).toBe(5000);
    expect(rows[1].service).toBe("consolidacion");
    expect(rows[1].revenue).toBe(2000);
    expect(rows[1].count).toBe(2);
    expect(rows[1].cbm).toBe(5);
    expect(rows[1].label).toBe("Consolidación");
  });
});

// ── monthlyBuckets ────────────────────────────────────────────
describe("monthlyBuckets", () => {
  it("serie continua de meses entre from y to (incluye meses vacíos)", () => {
    const rows = [
      ship({ created_at: "2026-01-10T00:00:00Z", cbm: 2 }),
      ship({ created_at: "2026-01-20T00:00:00Z", cbm: 3 }),
      ship({ created_at: "2026-03-05T00:00:00Z", cbm: 1 }),
    ];
    const buckets = monthlyBuckets(rows, { from: "2026-01-01", to: "2026-03-31" });

    expect(buckets.map((b) => b.month)).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(buckets[0].count).toBe(2);
    expect(buckets[0].cbm).toBe(5);
    expect(buckets[1].count).toBe(0); // febrero vacío pero presente
    expect(buckets[1].cbm).toBe(0);
    expect(buckets[2].count).toBe(1);
    expect(buckets[0].label).toBe("ENE 26");
  });

  it("ignora embarques fuera del rango de meses", () => {
    const rows = [
      ship({ created_at: "2025-12-31T00:00:00Z", cbm: 9 }), // fuera
      ship({ created_at: "2026-02-15T00:00:00Z", cbm: 4 }),
    ];
    const buckets = monthlyBuckets(rows, { from: "2026-02-01", to: "2026-02-28" });
    expect(buckets).toHaveLength(1);
    expect(buckets[0].count).toBe(1);
    expect(buckets[0].cbm).toBe(4);
  });

  it("rango invertido → []", () => {
    expect(monthlyBuckets([], { from: "2026-05-01", to: "2026-01-01" })).toEqual([]);
  });
});
