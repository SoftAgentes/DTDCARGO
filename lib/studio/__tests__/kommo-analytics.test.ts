/**
 * Tests de las funciones PURAS del Tablero CRM (SDD-0078).
 *
 * Cubren el diagnóstico de SDD-0062 hecho cómputo: cementerio (antigüedad),
 * salud del embudo + cuello, concentración de cartera, conversión por estados
 * de sistema, cobertura de email y el contraste de valor Kommo vs ERP.
 */

import { describe, it, expect } from "vitest";
import {
  agingBuckets,
  funnelHealth,
  ownershipDistribution,
  conversionStats,
  emailCoverage,
  valueContrast,
  KOMMO_WON_STATUS_ID,
  KOMMO_LOST_STATUS_ID,
  type AnalyticsLead,
} from "../kommo-analytics";
import type { KommoPipelineRow, KommoStatusRow } from "../kommo-types";

const DAY = 86_400_000;
const NOW = Date.parse("2026-06-14T00:00:00Z");
const daysAgo = (n: number) => new Date(NOW - n * DAY).toISOString();

function lead(p: Partial<AnalyticsLead>): AnalyticsLead {
  return {
    id: p.id ?? 1,
    status_id: p.status_id ?? null,
    pipeline_id: p.pipeline_id ?? null,
    price: p.price ?? 0,
    responsible_user_id: p.responsible_user_id ?? null,
    kommo_updated_at: p.kommo_updated_at ?? null,
  };
}

describe("agingBuckets", () => {
  it("reparte por antigüedad, calcula % y mediana, ignora fechas inválidas", () => {
    const leads = [
      { kommo_updated_at: daysAgo(10) }, // fresh
      { kommo_updated_at: daysAgo(60) }, // 30–90
      { kommo_updated_at: daysAgo(120) }, // 90–180
      { kommo_updated_at: daysAgo(250) }, // 180–365
      { kommo_updated_at: daysAgo(400) }, // > 365
      { kommo_updated_at: null }, // excluido
      { kommo_updated_at: "no-es-fecha" }, // excluido
    ];
    const r = agingBuckets(leads, NOW);
    expect(r.withDate).toBe(5);
    expect(r.medianDays).toBe(120); // mediana de [10,60,120,250,400]
    const by = Object.fromEntries(r.buckets.map((b) => [b.key, b.count]));
    expect(by).toEqual({ fresh: 1, d30: 1, d90: 1, d180: 1, d365: 1 });
    expect(r.buckets.every((b) => Math.abs(b.pct - 20) < 1e-9)).toBe(true);
  });

  it("buckets vacíos → mediana 0 y % 0 sin dividir por cero", () => {
    const r = agingBuckets([], NOW);
    expect(r.withDate).toBe(0);
    expect(r.medianDays).toBe(0);
    expect(r.buckets.every((b) => b.count === 0 && b.pct === 0)).toBe(true);
  });

  it("mediana con cantidad par promedia los dos centrales", () => {
    const leads = [
      { kommo_updated_at: daysAgo(10) },
      { kommo_updated_at: daysAgo(20) },
      { kommo_updated_at: daysAgo(40) },
      { kommo_updated_at: daysAgo(60) },
    ];
    expect(agingBuckets(leads, NOW).medianDays).toBe(30); // (20+40)/2
  });
});

describe("funnelHealth", () => {
  const pipelines: KommoPipelineRow[] = [
    { id: 1, name: "Embudo de ventas", sort: 0, is_main: true },
    { id: 2, name: "Carga", sort: 1, is_main: false },
  ];
  const statuses: KommoStatusRow[] = [
    { id: 10, pipeline_id: 1, name: "Primer contacto", sort: 0, color: null, type: 0 },
    { id: 11, pipeline_id: 1, name: "Atención al cliente", sort: 1, color: null, type: 0 },
    { id: 12, pipeline_id: 1, name: "Tomar decisión", sort: 2, color: null, type: 0 },
    { id: 20, pipeline_id: 2, name: "Otra", sort: 0, color: null, type: 0 },
  ];

  it("usa el embudo principal, cuenta por etapa y marca el cuello", () => {
    const leads = [
      lead({ id: 1, pipeline_id: 1, status_id: 10 }),
      ...Array.from({ length: 5 }, (_, i) =>
        lead({ id: 100 + i, pipeline_id: 1, status_id: 11 }),
      ),
      lead({ id: 2, pipeline_id: 2, status_id: 20 }), // otro embudo → excluido
    ];
    const r = funnelHealth(leads, pipelines, statuses);
    expect(r.pipelineName).toBe("Embudo de ventas");
    expect(r.total).toBe(6); // solo el embudo principal
    expect(r.stages).toHaveLength(3);

    const atencion = r.stages.find((s) => s.id === 11)!;
    expect(atencion.count).toBe(5);
    expect(atencion.isBottleneck).toBe(true);
    expect(atencion.tone).toBe("var(--danger)");
    expect(Math.round(atencion.pct)).toBe(83);

    const decision = r.stages.find((s) => s.id === 12)!;
    expect(decision.count).toBe(0);
    expect(decision.isBottleneck).toBe(false);
  });

  it("sin embudos → resultado vacío seguro", () => {
    const r = funnelHealth([], [], []);
    expect(r).toEqual({ pipelineId: null, pipelineName: "—", total: 0, stages: [] });
  });
});

describe("ownershipDistribution", () => {
  it("ordena desc, calcula %, detecta el dominante y rotula null", () => {
    const leads = [
      ...Array.from({ length: 8 }, (_, i) =>
        lead({ id: i, responsible_user_id: 9976747 }),
      ),
      lead({ id: 50, responsible_user_id: 123 }),
      lead({ id: 51, responsible_user_id: null }),
    ];
    const r = ownershipDistribution(leads);
    expect(r.total).toBe(10);
    expect(r.dominant?.id).toBe(9976747);
    expect(r.dominant?.count).toBe(8);
    expect(r.dominant?.pct).toBe(80);
    expect(r.dominant?.label).toBe("Asesor #9976747");
    expect(r.owners.find((o) => o.id === null)?.label).toBe("Sin asignar");
    // orden descendente por cantidad
    expect(r.owners[0].count).toBeGreaterThanOrEqual(r.owners[1].count);
  });

  it("usa nameById para el nombre real del asesor; fallback a 'Asesor #id'", () => {
    const leads = [
      lead({ id: 1, responsible_user_id: 100 }),
      lead({ id: 2, responsible_user_id: 100 }),
      lead({ id: 3, responsible_user_id: 200 }), // sin nombre en el mapa → fallback
      lead({ id: 4, responsible_user_id: null }), // sin asignar
    ];
    const nameById = new Map<number, string>([[100, "María Pérez"]]);
    const r = ownershipDistribution(leads, nameById);
    expect(r.owners.find((o) => o.id === 100)?.label).toBe("María Pérez");
    expect(r.owners.find((o) => o.id === 200)?.label).toBe("Asesor #200");
    expect(r.owners.find((o) => o.id === null)?.label).toBe("Sin asignar");
  });
});

describe("conversionStats", () => {
  it("cuenta won/lost por estados de sistema y calcula tasas", () => {
    const leads = [
      lead({ id: 1, status_id: KOMMO_WON_STATUS_ID }),
      lead({ id: 2, status_id: KOMMO_LOST_STATUS_ID }),
      lead({ id: 3, status_id: KOMMO_LOST_STATUS_ID }),
      ...Array.from({ length: 7 }, (_, i) => lead({ id: 10 + i, status_id: 11 })),
    ];
    const r = conversionStats(leads);
    expect(r).toEqual({
      total: 10,
      won: 1,
      lost: 2,
      closed: 3,
      open: 7,
      closedRatePct: 30,
      wonRatePct: 10,
    });
  });
});

describe("emailCoverage", () => {
  it("cuenta contactos con EMAIL en custom_fields", () => {
    const contacts = [
      { custom_fields: [{ field_code: "EMAIL", values: [{ value: "a@b.com" }] }] },
      { custom_fields: [{ field_code: "PHONE", values: [{ value: "+58 412" }] }] },
      { custom_fields: null },
    ];
    const r = emailCoverage(contacts);
    expect(r.total).toBe(3);
    expect(r.withEmail).toBe(1);
    expect(Math.round(r.pct)).toBe(33);
  });
});

describe("valueContrast", () => {
  it("suma el price de Kommo y la facturación ERP de los leads convertidos", () => {
    const leads = [
      lead({ id: 1, price: 0 }),
      lead({ id: 2, price: 0 }),
      lead({ id: 3, price: 50 }),
    ];
    const convertedMarkboxByLead = { 1: "DTD-0001", 2: "DTD-0002", 3: "DTD-0003" };
    const billing = new Map<string, number>([
      ["DTD-0001", 1000],
      ["DTD-0002", 0], // convertido pero sin facturación
      // DTD-0003 ausente → 0
    ]);
    const r = valueContrast(leads, convertedMarkboxByLead, billing);
    expect(r.kommoPipelineValueUsd).toBe(50);
    expect(r.erpBilledUsd).toBe(1000);
    expect(r.convertedCount).toBe(3);
    expect(r.convertedWithBilling).toBe(1);
  });
});
