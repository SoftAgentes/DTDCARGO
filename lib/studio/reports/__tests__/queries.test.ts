/**
 * Tests de queries de Reportes & Analytics (SDD-0052 · Slice A).
 *
 * Cubre Acceptance §5:
 *  - el rango del período se aplica a `shipments` e `invoices` (gte/lte sobre
 *    created_at).
 *  - el revenue se mapea por shipment_code y se cruza al group-by.
 *  - operationalOverview produce totales + serie mensual + split por destino +
 *    tránsito por destino; on-time NO aparece.
 *  - reportByCarrier agrega bookings/sailings por carrier (desde 0096) y resuelve
 *    el nombre; EmptyState honesto ([]) sin bookings.
 *
 * Stub chainable que enruta por nombre de tabla y registra filtros (gte/lte/eq/
 * is/not/neq/in) por tabla. Cada builder es thenable (await directo) y además
 * resoluble vía `.then` para los `await query` encadenados.
 */

import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  operationalOverview,
  reportByCarrier,
  reportByRoute,
  reportByService,
} from "../queries";

type Recorded = {
  gte: [string, unknown][];
  lte: [string, unknown][];
  eq: [string, unknown][];
  is: [string, unknown][];
  not: [string, unknown, unknown][];
  neq: [string, unknown][];
};

function stub(rowsByTable: Record<string, Record<string, unknown>[]>): {
  client: SupabaseClient;
  calls: Record<string, Recorded>;
} {
  const calls: Record<string, Recorded> = {};

  const client = {
    from(table: string) {
      const rows = rowsByTable[table] ?? [];
      calls[table] = calls[table] ?? {
        gte: [],
        lte: [],
        eq: [],
        is: [],
        not: [],
        neq: [],
      };
      const rec = calls[table];
      const result = { data: rows, error: null };

      const chain: Record<string, unknown> = {
        select: () => chain,
        order: () => chain,
        limit: () => chain,
        gte: (c: string, v: unknown) => (rec.gte.push([c, v]), chain),
        lte: (c: string, v: unknown) => (rec.lte.push([c, v]), chain),
        eq: (c: string, v: unknown) => (rec.eq.push([c, v]), chain),
        is: (c: string, v: unknown) => (rec.is.push([c, v]), chain),
        not: (c: string, op: unknown, v: unknown) => (rec.not.push([c, op, v]), chain),
        neq: (c: string, v: unknown) => (rec.neq.push([c, v]), chain),
        in: () => chain,
        then: (resolve: (v: typeof result) => unknown) =>
          Promise.resolve(result).then(resolve),
      };
      return chain;
    },
  } as unknown as SupabaseClient;

  return { client, calls };
}

const TODAY = new Date("2026-06-15T00:00:00Z");

// ── Rango por período ──────────────────────────────────────────
describe("rango del período aplicado a las tablas", () => {
  it("operationalOverview filtra shipments e invoices por created_at del rango 1A", async () => {
    const { client, calls } = stub({ shipments: [], invoices: [] });
    await operationalOverview(client, "1A", TODAY);

    // 1A trailing 12m → from 2025-06-15.
    expect(calls.shipments.gte).toContainEqual(["created_at", "2025-06-15"]);
    expect(calls.shipments.lte[0][0]).toBe("created_at");
    expect(String(calls.shipments.lte[0][1])).toContain("2026-06-15");

    expect(calls.invoices.gte).toContainEqual(["created_at", "2025-06-15"]);
    // invoices excluye anuladas y exige shipment_code.
    expect(calls.invoices.neq).toContainEqual(["status", "anulada"]);
  });

  it("YTD arranca el 1° de enero", async () => {
    const { client, calls } = stub({ shipments: [], invoices: [] });
    await operationalOverview(client, "YTD", TODAY);
    expect(calls.shipments.gte).toContainEqual(["created_at", "2026-01-01"]);
  });
});

// ── Revenue join + overview ────────────────────────────────────
describe("operationalOverview", () => {
  const shipments = [
    {
      id: "1", code: "A1", origin: "Yiwu", destination: "Pto Cabello",
      shipment_service: "consolidacion", status: "in_transit", volume_m3: 10,
      created_at: "2026-03-01T00:00:00Z", arrived_destination_at: null, delivered_at: null,
    },
    {
      id: "2", code: "A2", origin: "Yiwu", destination: "Pto Cabello",
      shipment_service: "consolidacion", status: "delivered", volume_m3: 5,
      created_at: "2026-04-01T00:00:00Z",
      arrived_destination_at: "2026-05-01T00:00:00Z", delivered_at: "2026-05-10T00:00:00Z",
    },
    {
      id: "3", code: "B1", origin: "Shenzhen", destination: "La Guaira",
      shipment_service: "reserva_FCL", status: "draft", volume_m3: 50,
      created_at: "2026-04-15T00:00:00Z", arrived_destination_at: null, delivered_at: null,
    },
  ];
  const invoices = [
    { shipment_code: "A1", total_amount: 8000, currency: "USD", fx_rate: null, status: "emitida" },
    { shipment_code: "A2", total_amount: 2000, currency: "USD", fx_rate: null, status: "pagada" },
    // VES con fx → 1000 USD para B1
    { shipment_code: "B1", total_amount: 36500, currency: "VES", fx_rate: 36.5, status: "vencida" },
  ];

  it("totales reales: embarques, CBM, revenue USD-normalizado, activos", async () => {
    const { client } = stub({ shipments, invoices });
    const ov = await operationalOverview(client, "1A", TODAY);

    expect(ov.shipments).toBe(3);
    expect(ov.cbm).toBe(65); // 10 + 5 + 50
    expect(ov.revenueUsd).toBe(11000); // 8000 + 2000 + 1000
    // activos: in_transit cuenta; delivered y draft NO.
    expect(ov.active).toBe(1);
  });

  it("split por destino con % + tránsito por destino (sin on-time)", async () => {
    const { client } = stub({ shipments, invoices });
    const ov = await operationalOverview(client, "1A", TODAY);

    const pto = ov.portSplit.find((p) => p.port === "Pto Cabello");
    expect(pto?.count).toBe(2);
    expect(pto?.pct).toBeCloseTo(66.7, 0);

    // Solo A2 tiene hito de cierre (entregado) → tránsito de Pto Cabello.
    const transit = ov.transitByPort.find((t) => t.port === "Pto Cabello");
    expect(transit?.count).toBe(1);
    expect(transit?.avgTransit).toBe(39); // abr 1 → may 10

    // on-time no existe en el objeto.
    expect("onTime" in ov).toBe(false);
  });

  it("serie mensual cubre el rango", async () => {
    const { client } = stub({ shipments, invoices });
    const ov = await operationalOverview(client, "1A", TODAY);
    // El mes de creación de A1 (2026-03) debe estar presente con count 1.
    const marzo = ov.monthly.find((m) => m.month === "2026-03");
    expect(marzo?.count).toBe(1);
  });
});

// ── reportByRoute / reportByService usan revenue join ──────────
describe("reportByRoute / reportByService", () => {
  const shipments = [
    {
      id: "1", code: "A1", origin: "Yiwu", destination: "Pto Cabello",
      shipment_service: "consolidacion", status: "in_transit", volume_m3: 10,
      created_at: "2026-03-01T00:00:00Z", arrived_destination_at: null, delivered_at: null,
    },
    {
      id: "2", code: "B1", origin: "Shenzhen", destination: "La Guaira",
      shipment_service: "reserva_FCL", status: "shipped", volume_m3: 40,
      created_at: "2026-03-02T00:00:00Z", arrived_destination_at: null, delivered_at: null,
    },
  ];
  const invoices = [
    { shipment_code: "A1", total_amount: 3000, currency: "USD", fx_rate: null, status: "emitida" },
    { shipment_code: "B1", total_amount: 9000, currency: "USD", fx_rate: null, status: "emitida" },
  ];

  it("reportByRoute mapea revenue por shipment_code y ordena desc", async () => {
    const { client } = stub({ shipments, invoices });
    const rows = await reportByRoute(client, "1A", TODAY);
    expect(rows[0].label).toBe("Shenzhen → La Guaira");
    expect(rows[0].revenue).toBe(9000);
    expect(rows[1].revenue).toBe(3000);
  });

  it("reportByService agrupa por servicio con su revenue", async () => {
    const { client } = stub({ shipments, invoices });
    const rows = await reportByService(client, "1A", TODAY);
    expect(rows[0].service).toBe("reserva_FCL");
    expect(rows[0].revenue).toBe(9000);
    expect(rows[1].service).toBe("consolidacion");
    expect(rows[1].revenue).toBe(3000);
  });
});

// ── reportByCarrier (bookings/sailings 0096) ───────────────────
describe("reportByCarrier", () => {
  it("agrega bookings + sailings por carrier y resuelve el nombre", async () => {
    const bookings = [
      { carrier_id: "c1" },
      { carrier_id: "c1" },
      { carrier_id: "c2" },
    ];
    const sailings = [{ carrier_id: "c1" }, { carrier_id: "c2" }];
    const carriers = [
      { id: "c1", name: "COSCO" },
      { id: "c2", name: "MSC" },
    ];
    const { client } = stub({ bookings, sailings, carriers });
    const rows = await reportByCarrier(client, "1A", TODAY);

    expect(rows[0].name).toBe("COSCO"); // 2 bookings
    expect(rows[0].bookings).toBe(2);
    expect(rows[0].sailings).toBe(1);
    expect(rows[1].name).toBe("MSC");
    expect(rows[1].bookings).toBe(1);
  });

  it("carrier_id null agrupa como 'Sin naviera asignada'", async () => {
    const bookings = [{ carrier_id: null }];
    const { client } = stub({ bookings, sailings: [], carriers: [] });
    const rows = await reportByCarrier(client, "1A", TODAY);
    expect(rows[0].carrierId).toBeNull();
    expect(rows[0].name).toBe("Sin naviera asignada");
    expect(rows[0].bookings).toBe(1);
  });

  it("EmptyState honesto: sin bookings ni sailings → []", async () => {
    const { client } = stub({ bookings: [], sailings: [], carriers: [] });
    const rows = await reportByCarrier(client, "1A", TODAY);
    expect(rows).toEqual([]);
  });
});
