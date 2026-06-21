/**
 * Tests del normalizador del Container Tracking API de SeaRates (SDD-0101 · Slice B).
 * Usa el shape REAL de la doc oficial (docs.searates.com/reference/tracking) — sin red.
 */
import { describe, it, expect } from "vitest";
import { normalizeTracking } from "../tracking-normalize";

/** Respuesta de ejemplo calcada del shape documentado por SeaRates. */
const SAMPLE = {
  status: "success",
  message: "OK",
  data: {
    metadata: {
      type: "BL",
      number: "HKA2573372",
      sealine: "CMDU",
      sealine_name: "CMA CGM",
      status: "IN_TRANSIT",
      from_cache: false,
      updated_at: "2025-10-31 09:00:25",
      cache_expires: "2025-11-01 09:00:25",
      api_calls: { total: 100, used: 1, remaining: 99 },
    },
    locations: [
      { id: 1, name: "San Antonio", country: "Chile", locode: "CLSAI", lat: -33.59, lng: -71.6 },
      { id: 3, name: "Shekou", country: "China", locode: "CNSHK", lat: 22.47, lng: 113.92 },
    ],
    route: {
      prepol: { location: 3, date: "2025-09-13 01:01:00", actual: true },
      pol: { location: 3, date: "2025-09-30 03:32:00", actual: true },
      pod: { location: 1, date: "2025-10-31 23:00:00", actual: false, predictive_eta: null },
      postpod: { location: null, date: null, actual: null },
    },
    vessels: [{ id: 1, name: "CMA CGM SAMSON", imo: 9436379 }],
    containers: [
      {
        number: "ECMU7336714",
        iso_code: "45G1",
        status: "IN_TRANSIT",
        events: [
          { order_id: 1, location: 3, description: "Empty Picked-up at Depot", date: "2025-09-13 01:29:00", actual: true, type: "land" },
          { order_id: 2, location: 3, description: "Vessel Departure", date: "2025-09-30 03:32:00", actual: true, type: "sea", voyage: "0PG9CE1MA" },
        ],
      },
    ],
    route_data: { pin: [10.5, -60.2] },
  },
};

describe("normalizeTracking — extrae el snapshot vivo", () => {
  const live = normalizeTracking(SAMPLE)!;

  it("estado + naviera + buque", () => {
    expect(live.status).toBe("IN_TRANSIT");
    expect(live.sealine).toBe("CMDU");
    expect(live.sealineName).toBe("CMA CGM");
    expect(live.vessel).toBe("CMA CGM SAMSON");
  });

  it("POL real y POD como ETA (actual=false)", () => {
    expect(live.polDate).toBe("2025-09-30 03:32:00");
    expect(live.polActual).toBe(true);
    expect(live.podEta).toBe("2025-10-31 23:00:00");
    expect(live.podActual).toBe(false);
  });

  it("última posición (route_data.pin)", () => {
    expect(live.lastLat).toBe(10.5);
    expect(live.lastLng).toBe(-60.2);
  });

  it("cuota restante reportada por SeaRates", () => {
    expect(live.apiCallsRemaining).toBe(99);
  });

  it("hitos aplanados con el lugar resuelto por id", () => {
    expect(live.milestones).toHaveLength(2);
    expect(live.milestones[0].description).toBe("Empty Picked-up at Depot");
    expect(live.milestones[0].location).toBe("Shekou"); // location id 3 → name
    expect(live.milestones[0].actual).toBe(true);
    expect(live.milestones[0].transportType).toBe("land");
  });
});

describe("normalizeTracking — defensivo", () => {
  it("null / sin data → null", () => {
    expect(normalizeTracking(null)).toBeNull();
    expect(normalizeTracking({})).toBeNull();
    expect(normalizeTracking({ status: "success" })).toBeNull();
  });

  it("data vacía → objeto con nulls y milestones vacío (no tira)", () => {
    const live = normalizeTracking({ data: {} })!;
    expect(live).not.toBeNull();
    expect(live.status).toBeNull();
    expect(live.vessel).toBeNull();
    expect(live.milestones).toEqual([]);
    expect(live.apiCallsRemaining).toBeNull();
  });

  it("error de proveedor con metadata igual deja leer milestones vacíos", () => {
    const live = normalizeTracking({ data: { metadata: { status: "NOT_FOUND" } } })!;
    expect(live.status).toBe("NOT_FOUND");
    expect(live.milestones).toEqual([]);
  });
});
