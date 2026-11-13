// @vitest-environment node
/**
 * SDD-0156 · Slice D — resolveShipmentEta / resolveShipmentEtd y el parser de
 * fechas heterogéneas (ISO de SeaRates vs `date` de Postgres).
 */
import { describe, it, expect, vi } from "vitest";

const navieraMock = {
  getShipmentTrackingSnapshot: vi.fn(),
  getShipmentNaviera: vi.fn(),
};
vi.mock("@/lib/studio/naviera-tracking/queries", () => ({
  getShipmentTrackingSnapshot: (...a: unknown[]) =>
    navieraMock.getShipmentTrackingSnapshot(...a),
  getShipmentNaviera: (...a: unknown[]) => navieraMock.getShipmentNaviera(...a),
}));

import {
  parseFlexibleDate,
  resolveShipmentEta,
  resolveShipmentEtd,
} from "../resolve-shipment-eta";

/** Admin mock: shipments.client_markbox null (corta la fuente 3). */
const admin = {
  from: () => ({
    select: () => ({
      eq: () => ({
        maybeSingle: () => Promise.resolve({ data: { client_markbox: null } }),
      }),
    }),
  }),
} as never;

describe("parseFlexibleDate", () => {
  it("parsea 'date' de Postgres a mediodía UTC (estable ante TZ)", () => {
    const d = parseFlexibleDate("2026-03-15");
    expect(d?.toISOString()).toBe("2026-03-15T12:00:00.000Z");
  });
  it("parsea ISO completo de SeaRates", () => {
    const d = parseFlexibleDate("2026-03-15T08:30:00.000Z");
    expect(d?.toISOString()).toBe("2026-03-15T08:30:00.000Z");
  });
  it("null / vacío / basura → null", () => {
    expect(parseFlexibleDate(null)).toBeNull();
    expect(parseFlexibleDate("  ")).toBeNull();
    expect(parseFlexibleDate("no-es-fecha")).toBeNull();
  });
});

describe("resolveShipmentEta", () => {
  it("prefiere pod_eta de SeaRates sobre sailings.eta", async () => {
    navieraMock.getShipmentTrackingSnapshot.mockResolvedValue({
      podEta: "2026-04-01T00:00:00.000Z",
    });
    navieraMock.getShipmentNaviera.mockResolvedValue({ eta: "2026-05-01" });
    const d = await resolveShipmentEta(admin, "s-1");
    expect(d?.toISOString()).toBe("2026-04-01T00:00:00.000Z");
  });

  it("cae a sailings.eta cuando no hay pod_eta", async () => {
    navieraMock.getShipmentTrackingSnapshot.mockResolvedValue({ podEta: null });
    navieraMock.getShipmentNaviera.mockResolvedValue({ eta: "2026-05-01" });
    const d = await resolveShipmentEta(admin, "s-1");
    expect(d?.toISOString()).toBe("2026-05-01T12:00:00.000Z");
  });

  it("sin ninguna fuente → null (la regla anclada en ETA se salta)", async () => {
    navieraMock.getShipmentTrackingSnapshot.mockResolvedValue(null);
    navieraMock.getShipmentNaviera.mockResolvedValue(null);
    const d = await resolveShipmentEta(admin, "s-1");
    expect(d).toBeNull();
  });

  it("degrada limpio si una fuente throwea", async () => {
    navieraMock.getShipmentTrackingSnapshot.mockRejectedValue(new Error("boom"));
    navieraMock.getShipmentNaviera.mockResolvedValue({ eta: "2026-06-10" });
    const d = await resolveShipmentEta(admin, "s-1");
    expect(d?.toISOString()).toBe("2026-06-10T12:00:00.000Z");
  });
});

describe("resolveShipmentEtd", () => {
  it("resuelve sailings.etd", async () => {
    navieraMock.getShipmentNaviera.mockResolvedValue({ etd: "2026-02-20" });
    const d = await resolveShipmentEtd(admin, "s-1");
    expect(d?.toISOString()).toBe("2026-02-20T12:00:00.000Z");
  });
  it("sin etd → null", async () => {
    navieraMock.getShipmentNaviera.mockResolvedValue({ etd: null });
    expect(await resolveShipmentEtd(admin, "s-1")).toBeNull();
  });
});

// ── SDD-0627 · cuarta fuente: ETA estimada desde el zarpe ──────────────────
function adminPorTabla(dataByTable: Record<string, unknown>) {
  function from(table: string) {
    const result = { data: dataByTable[table] ?? null, error: null };
    const builder: unknown = new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === "then") {
            return (res: (v: unknown) => unknown) => Promise.resolve(result).then(res);
          }
          return () => builder;
        },
      },
    );
    return builder;
  }
  return { from } as never;
}

describe("SDD-0627 · resolveShipmentEta con la ETA estimada desde el zarpe", () => {
  const datos = {
    shipments: { status: "shipped", shipment_service: "consolidado_lcl", client_markbox: null },
    shipment_events: { occurred_at: "2026-11-01T00:00:00Z" },
  };

  it("apagada por defecto: sin fuentes reales devuelve null aunque haya zarpe", async () => {
    navieraMock.getShipmentTrackingSnapshot.mockResolvedValue(null);
    navieraMock.getShipmentNaviera.mockResolvedValue({ transitDays: 30, pod: "PBL" });
    expect(await resolveShipmentEta(adminPorTabla(datos), "s1")).toBeNull();
  });

  it("encendida: zarpe + días de tránsito del zarpe", async () => {
    navieraMock.getShipmentTrackingSnapshot.mockResolvedValue(null);
    navieraMock.getShipmentNaviera.mockResolvedValue({ transitDays: 30, pod: "PBL" });
    const d = await resolveShipmentEta(adminPorTabla(datos), "s1", { estimadaDesdeZarpe: true });
    expect(d?.toISOString().slice(0, 10)).toBe("2026-12-01");
  });

  it("encendida: una ETA de la naviera manda sobre la estimada", async () => {
    navieraMock.getShipmentTrackingSnapshot.mockResolvedValue(null);
    navieraMock.getShipmentNaviera.mockResolvedValue({ eta: "2026-12-20", transitDays: 30 });
    const d = await resolveShipmentEta(adminPorTabla(datos), "s1", { estimadaDesdeZarpe: true });
    expect(d?.toISOString().slice(0, 10)).toBe("2026-12-20");
  });

  it("encendida: antes del zarpe no estima", async () => {
    navieraMock.getShipmentTrackingSnapshot.mockResolvedValue(null);
    navieraMock.getShipmentNaviera.mockResolvedValue({ transitDays: 30 });
    const d = await resolveShipmentEta(
      adminPorTabla({ ...datos, shipments: { status: "consolidating", shipment_service: "consolidado_lcl" } }),
      "s1",
      { estimadaDesdeZarpe: true },
    );
    expect(d).toBeNull();
  });
});
