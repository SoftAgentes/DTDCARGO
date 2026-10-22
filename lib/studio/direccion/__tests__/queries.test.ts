/**
 * Tests del tablero ejecutivo de Dirección (SDD-0048).
 *
 * Cubre Acceptance §5 sobre las funciones de COMPOSICIÓN:
 *  - Posición neta = caja + CxC − CxP.
 *  - Cobertura de pagos con caja (% caja / CxP).
 *  - Forecast simple por semana (CxP venciendo en 4 ventanas de 7 días).
 *  - Derivación de alertas (vencidos / cut-off ≤3d / carga suelta >20 CBM / "Todo en orden").
 *  - Smoke de getDireccionData con stub de SupabaseClient.
 *  - SDD-0557: «Ingresos · mes» es la cifra oficial (facturado sin IVA) y el
 *    mayor queda como control contra la 4.5 de los asientos de factura;
 *    utilidad y margen, del libro. Los textos de los dos KPI salen de
 *    `textosFinancieros`, pura: «sin IVA», «libro», el lado que se compara
 *    con su nombre («4.5 de facturas: $X», «sin asientos de factura en
 *    4.5»), «otros ingresos del libro: $Y», «no comparable» y el mayor vacío
 *    (B3).
 */

import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dobleListados, type Fila } from "@/lib/studio/__tests__/listados-double";
import {
  netMarginPct,
  netPosition,
  paymentCoveragePct,
  daysUntil,
  buildForecast,
  deriveAlerts,
  firstOfMonth,
  getDireccionData,
  textosFinancieros,
  type ForecastBill,
} from "../queries";
import { resumirIngreso as resumirIngresoSinContexto } from "@/lib/studio/accounting/ingreso-periodo";
import {
  ASIENTOS_EN_OTRA_MONEDA,
  ESPERADO,
  FACTURAS_DEL_MES,
  FACTURAS_EN_USD,
  HOY,
  RANGO_MES,
  control,
  resumirIngresoConContexto as resumirIngreso,
  datosReversoGo1, lectorReversoGo1, controlReversoGo1, RANGOS_REVERSO_GO1,
} from "@/lib/studio/accounting/__tests__/ingreso-fixture";
import { ingresoDelPeriodo } from "@/lib/studio/accounting/libro-control-queries";

describe("netPosition — posición neta", () => {
  it("posición neta = caja + CxC − CxP", () => {
    expect(netPosition(10000, 4000, 6000)).toBe(8000);
  });
  it("puede ser negativa (más CxP que caja + CxC)", () => {
    expect(netPosition(2000, 1000, 5000)).toBe(-2000);
  });
  it("redondea a 2 decimales", () => {
    expect(netPosition(100.111, 0, 0)).toBe(100.11);
  });
});

describe("netMarginPct — margen neto", () => {
  it("margen = utilidad / ingresos * 100", () => {
    expect(netMarginPct(10000, 2500)).toBe(25);
  });
  it("0 ingresos → 0% (no divide por cero)", () => {
    expect(netMarginPct(0, 500)).toBe(0);
  });
  it("utilidad negativa → margen negativo", () => {
    expect(netMarginPct(1000, -200)).toBe(-20);
  });
});

describe("paymentCoveragePct — cobertura de pagos con caja", () => {
  it("cobertura = caja / CxP * 100", () => {
    expect(paymentCoveragePct(5000, 10000)).toBe(50);
  });
  it("caja >= CxP → ≥ 100%", () => {
    expect(paymentCoveragePct(12000, 10000)).toBe(120);
  });
  it("sin CxP → 100% (nada que cubrir)", () => {
    expect(paymentCoveragePct(0, 0)).toBe(100);
  });
});

describe("daysUntil", () => {
  it("fecha futura → días positivos", () => {
    expect(daysUntil("2026-06-10", "2026-06-03")).toBe(7);
  });
  it("fecha pasada → días negativos", () => {
    expect(daysUntil("2026-06-01", "2026-06-03")).toBe(-2);
  });
  it("hoy → 0", () => {
    expect(daysUntil("2026-06-03", "2026-06-03")).toBe(0);
  });
});

describe("buildForecast — proyección de salidas 4 semanas", () => {
  const today = "2026-06-03";
  const bill = (
    due: string | null,
    total: number,
    paid = 0,
    status = "pendiente",
  ): ForecastBill => ({
    due_date: due,
    total_amount: total,
    paid_amount: paid,
    status,
  });

  it("agrupa el saldo de CxP por la semana en que vence", () => {
    const weeks = buildForecast(
      [
        bill("2026-06-04", 1000), // +1d → sem0
        bill("2026-06-12", 2000), // +9d → sem1
        bill("2026-06-20", 3000), // +17d → sem2
        bill("2026-06-28", 4000), // +25d → sem3
      ],
      today,
    );
    expect(weeks).toHaveLength(4);
    expect(weeks[0].usd).toBe(1000);
    expect(weeks[1].usd).toBe(2000);
    expect(weeks[2].usd).toBe(3000);
    expect(weeks[3].usd).toBe(4000);
    expect(weeks.map((w) => w.label)).toEqual([
      "Esta semana",
      "Sem. 2",
      "Sem. 3",
      "Sem. 4",
    ]);
  });

  it("lo YA vencido cae en 'Esta semana' (sem0)", () => {
    const weeks = buildForecast([bill("2026-05-20", 500)], today);
    expect(weeks[0].usd).toBe(500);
  });

  it("usa el SALDO (total − pagado), no el total", () => {
    const weeks = buildForecast([bill("2026-06-04", 1000, 600)], today);
    expect(weeks[0].usd).toBe(400);
  });

  it("ignora anuladas, sin saldo y sin vencimiento", () => {
    const weeks = buildForecast(
      [
        bill("2026-06-04", 1000, 0, "anulada"),
        bill("2026-06-05", 1000, 1000), // pagada (saldo 0)
        bill(null, 1000), // sin due_date
      ],
      today,
    );
    expect(weeks.every((w) => w.usd === 0)).toBe(true);
  });

  it("ignora CxP fuera del horizonte de 4 semanas (>28d)", () => {
    const weeks = buildForecast([bill("2026-08-01", 9999)], today);
    expect(weeks.every((w) => w.usd === 0)).toBe(true);
  });

  it("suma varias CxP que caen en la misma semana", () => {
    const weeks = buildForecast(
      [bill("2026-06-04", 1000), bill("2026-06-06", 500)],
      today,
    );
    expect(weeks[0].usd).toBe(1500);
  });
});

describe("deriveAlerts — alertas accionables", () => {
  const base = {
    vencido: 0,
    cutoffDays: null as number | null,
    cutoffVessel: null as string | null,
    looseCbm: 0,
  };

  it("sin nada que reportar → 'Todo en orden' (success, sin link)", () => {
    const alerts = deriveAlerts(base);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].tone).toBe("success");
    expect(alerts[0].href).toBeNull();
  });

  it("vencido > 0 → alerta danger con deep-link a tesorería", () => {
    const alerts = deriveAlerts({ ...base, vencido: 3200 });
    const a = alerts.find((x) => x.tone === "danger");
    expect(a).toBeDefined();
    expect(a?.href).toBe("/studio/tesoreria");
  });

  it("cut-off ≤ 3 días → alerta warning con deep-link a naviera", () => {
    const alerts = deriveAlerts({
      ...base,
      cutoffDays: 2,
      cutoffVessel: "MSC Anna",
    });
    const a = alerts.find((x) => x.tone === "warning");
    expect(a).toBeDefined();
    expect(a?.href).toBe("/studio/naviera");
    expect(a?.text).toContain("MSC Anna");
  });

  it("cut-off > 3 días → NO dispara alerta", () => {
    const alerts = deriveAlerts({ ...base, cutoffDays: 5 });
    expect(alerts.some((x) => x.tone === "warning")).toBe(false);
  });

  it("carga suelta > 20 CBM → alerta info con deep-link a naviera", () => {
    const alerts = deriveAlerts({ ...base, looseCbm: 24.5 });
    const a = alerts.find((x) => x.tone === "info");
    expect(a).toBeDefined();
    expect(a?.href).toBe("/studio/naviera");
  });

  it("carga suelta ≤ 20 CBM → NO dispara alerta", () => {
    const alerts = deriveAlerts({ ...base, looseCbm: 20 });
    expect(alerts.some((x) => x.tone === "info")).toBe(false);
  });

  it("múltiples condiciones → múltiples alertas, sin 'Todo en orden'", () => {
    const alerts = deriveAlerts({
      vencido: 1000,
      cutoffDays: 1,
      cutoffVessel: "Cosco",
      looseCbm: 30,
    });
    expect(alerts).toHaveLength(3);
    expect(alerts.some((x) => x.tone === "success")).toBe(false);
  });
});

describe("firstOfMonth", () => {
  it("devuelve el 1° del mes en curso", () => {
    expect(firstOfMonth("2026-06-03")).toBe("2026-06-01");
  });
});

// ── Smoke de composición con stub de SupabaseClient ─────────────

/**
 * Stub keyed por tabla + rpc. Cada tabla resuelve a `{ data, count }`. Los
 * métodos de la cadena son passthrough; `maybeSingle()` y el thenable final
 * entregan data+count. `rpc()` resuelve el valor configurado.
 */
/** Tope por request del doble: el `db-max-rows` de Supabase. */
const SERVER_CAP = 1000;

function makeClient(opts: {
  tables?: Record<string, { data?: unknown[]; count?: number }>;
  rpc?: Record<string, unknown>;
}): SupabaseClient {
  const tables = opts.tables ?? {};
  const rpc = opts.rpc ?? {};
  const contables = dobleListados(Object.fromEntries(
    ["accounts", "journal_entries", "journal_lines", "invoices"].map(t => [t, tables[t]?.data ?? []]),
  ) as Record<string, Fila[]>, { serverCap: SERVER_CAP, proyectar: true }).client;
  return {
    from(table: string) {
      if (["accounts", "journal_entries", "journal_lines", "invoices"].includes(table)) return contables.from(table);
      const entry = tables[table] ?? {};
      const result = {
        data: entry.data ?? [],
        count: entry.count ?? 0,
        error: null,
      };
      const chain: Record<string, unknown> = {};
      const passthrough = () => chain;
      for (const m of [
        "select",
        "eq",
        "neq",
        "in",
        "is",
        "not",
        "lte",
        "gte",
        "order",
        "limit",
      ]) {
        chain[m] = () => passthrough();
      }
      chain.maybeSingle = () =>
        Promise.resolve({
          data: (entry.data ?? [])[0] ?? null,
          error: null,
        });
      // Terminal paginado: corta en SERVER_CAP por request igual que PostgREST.
      // Un doble más generoso que el servidor deja pasar código que en
      // producción trunca — así sobrevivió el bug del tope de 1.000 filas.
      chain.range = (desde: number, hasta: number) => {
        const todas = entry.data ?? [];
        const pedido = hasta - desde + 1;
        const trozo = todas.slice(desde, desde + Math.min(pedido, SERVER_CAP));
        return Promise.resolve({ ...result, data: trozo, error: null });
      };
      chain.then = (resolve: (v: unknown) => unknown) =>
        Promise.resolve(result).then(resolve);
      return chain;
    },
    rpc(fn: string) {
      return Promise.resolve({ data: rpc[fn] ?? null, error: null });
    },
  } as unknown as SupabaseClient;
}

describe("getDireccionData — composición (smoke)", () => {
  const today = "2026-06-03";

  it("compone finanzas, salud, operación, comercial, forecast y alertas", async () => {
    const client = makeClient({
      tables: {
        // Plan de cuentas: ingreso (4), ventas (4.5, la que acredita la
        // factura), caja (1.1.1).
        accounts: {
          data: [
            { id: "inc", tenant_id: "t", code: "4", name: "Ingresos", type: "I", parent_id: null, is_postable: false },
            { id: "inc1", tenant_id: "t", code: "4.5", name: "Otros ingresos por servicios", type: "I", parent_id: "inc", is_postable: true },
            { id: "caja", tenant_id: "t", code: "1.1.1", name: "Banco", type: "A", parent_id: null, is_postable: true, qbo_type: "Bank" },
            { id: "ar", tenant_id: "t", code: "1.1.2", name: "Clientes", type: "A", parent_id: null, is_postable: true },
          ],
        },
        // Asientos asentados (P&L del mes) + saldos vivos (caja). El asiento
        // es de factura: su 4.5 es el control del ingreso.
        journal_entries: { data: [{ id: "je1", tenant_id: "t", invoice_id: "f1", entry_date: "2026-06-02", status: "asentado", source: "invoice", deleted_at: null, reverses_entry_id: null }] },
        journal_lines: {
          data: [
            { id: "ingreso-je1", entry_id: "je1", account_id: "inc1", debit: 0, credit: 10000 }, // ingreso
            { id: "caja-je1", entry_id: "je1", account_id: "caja", debit: 8000, credit: 0 }, // caja
            { id: "ar-je1", entry_id: "je1", account_id: "ar", debit: 2000, credit: 0 },
          ],
        },
        // Cobranzas: una factura con saldo (CxC) — receivablesQueue.
        invoices: {
          data: [
            {
              id: "f1",
              tenant_id: "t",
              status: "emitida",
              currency: "USD",
              base_amount: 4000,
              total_amount: 4000,
              paid_amount: 0,
              deleted_at: null,
              issued_at: "2026-06-02",
              due_date: "2026-06-20",
            },
          ],
        },
        collection_activities: { data: [] },
        // Tesorería: una CxP con saldo (CxP) — payablesQueue + forecast.
        supplier_bills: {
          data: [
            {
              id: "b1",
              tenant_id: "t",
              bill_code: "CXP-2026-0001",
              supplier_id: "p1",
              supplier_name: "Prov",
              expense_account_id: "5.1",
              currency: "USD",
              total_amount: 6000,
              paid_amount: 0,
              status: "pendiente",
              issue_date: "2026-06-01",
              due_date: "2026-06-12", // sem1
            },
          ],
        },
        supplier_payments: { data: [] },
        // Naviera.
        consolidations: { count: 1 },
        warehouse_receipts_cn: { data: [] },
        consolidation_items: { data: [] },
        shipments: { data: [] },
        sailings: { count: 2, data: [{ id: "s1", tenant_id: "t", vessel: "MSC", pol: "X", pod: "Y", status: "abierto", space: "alta", cutoff: "2026-06-05" }] },
        // Comercial (kommo).
        kommo_leads: {
          data: [
            { id: 1, name: "L1", price: 1500, closed_at: null },
            { id: 2, name: "L2", price: 9999, closed_at: "2026-05-30" }, // cerrado → fuera
          ],
        },
      },
      rpc: {
        shipments_dashboard_counts: {
          enTransito: 3,
          enAduana: 2,
          entregados: 10,
          conAlerta: 0,
          total: 15,
        },
      },
    });

    const data = await getDireccionData(client, today);

    // Finanzas (SDD-0557): el ingreso es lo facturado (f1, 4000); el mayor
    // (10000 en 4.5) queda al lado como control.
    expect(data.finance.ingreso.facturado.total).toBe(4000);
    expect(data.finance.ingreso.mayor?.ventas).toBe(10000);
    expect(data.finance.ingreso.diferenciaUsd).toBe(-6000);
    expect(data.finance.ingreso.rango).toEqual({ from: "2026-06-01", to: "2026-06-03" });
    // Margen del libro: utilidad del mayor / ingresos del mayor.
    expect(data.finance.margenPct).toBe(100);
    expect(data.finance.caja).toBe(8000);
    // posición neta = 8000 + 4000 − 6000 = 6000.
    expect(data.finance.posicionNeta).toBe(6000);

    // Salud.
    expect(data.health.cxc).toBe(4000);
    expect(data.health.cxp).toBe(6000);
    // cobertura = 8000 / 6000 * 100.
    expect(data.health.coberturaPct).toBeCloseTo(133.33, 1);

    // Operación: activos = enTransito + enAduana = 5.
    expect(data.ops.activos).toBe(5);
    expect(data.ops.consolidando).toBe(1);
    // cut-off 2026-06-05 vs hoy 06-03 → 2 días.
    expect(data.ops.cutoffDays).toBe(2);

    // Comercial: solo el lead abierto cuenta.
    expect(data.commercial.leadsActivos).toBe(1);
    expect(data.commercial.pipeline).toBe(1500);

    // Forecast: la CxP de 6000 vence en sem1 (+9d).
    expect(data.forecast[1].usd).toBe(6000);

    // Alertas: cut-off ≤3d dispara warning (no debe haber "Todo en orden").
    expect(data.alerts.some((a) => a.tone === "warning")).toBe(true);
    expect(data.alerts.some((a) => a.tone === "success")).toBe(false);
  });

  it("tablero vacío → ceros + 'Todo en orden'", async () => {
    const client = makeClient({
      tables: {
        accounts: { data: [] },
        journal_entries: { data: [] },
        journal_lines: { data: [] },
        invoices: { data: [] },
        collection_activities: { data: [] },
        supplier_bills: { data: [] },
        supplier_payments: { data: [] },
        consolidations: { count: 0 },
        warehouse_receipts_cn: { data: [] },
        consolidation_items: { data: [] },
        shipments: { data: [] },
        sailings: { count: 0, data: [] },
        kommo_leads: { data: [] },
      },
      rpc: { shipments_dashboard_counts: null },
    });

    const data = await getDireccionData(client, today);
    expect(data.finance.posicionNeta).toBe(0);
    expect(data.health.coberturaPct).toBe(100);
    expect(data.ops.cutoffDays).toBeNull();
    expect(data.commercial.pipeline).toBe(0);
    expect(data.forecast.every((w) => w.usd === 0)).toBe(true);
    expect(data.alerts).toHaveLength(1);
    expect(data.alerts[0].tone).toBe("success");
  });
});

describe("getDireccionData · ingreso oficial (SDD-0557)", () => {
  const PLAN_DIR = [
    { id: "inc", tenant_id: "t", code: "4", name: "Ingresos", type: "I", parent_id: null, is_postable: false },
    { id: "ven", tenant_id: "t", code: "4.5", name: "Otros ingresos por servicios", type: "I", parent_id: "inc", is_postable: true },
    { id: "fx", tenant_id: "t", code: "4.6", name: "Ingreso por cambio de moneda", type: "I", parent_id: "inc", is_postable: true },
    { id: "g", tenant_id: "t", code: "6", name: "Gastos", type: "G", parent_id: null, is_postable: false },
    { id: "g1", tenant_id: "t", code: "6.1", name: "Gastos generales", type: "G", parent_id: "g", is_postable: true },
    { id: "ar", tenant_id: "t", code: "1.1.2", name: "Clientes", type: "A", parent_id: null, is_postable: true },
  ];

  it("con el fixture del mes da la misma cifra que los otros consumidores; con bolívares o yuanes, no comparable", async () => {
    // El stub NO filtra: llegan la borrada (F8), el borrador, la anulada y la de
    // enero. La que las deja afuera es la regla en memoria (resumirIngreso).
    const client = makeClient({
      tables: {
        accounts: { data: PLAN_DIR },
        // je1 trae las líneas; F2, F6 y F7 tienen su asiento de factura vivo
        // (sin líneas), así cuentan en «no comparable» (decisión 7).
        journal_entries: {
          data: [{ id: "je1", tenant_id: "t", entry_date: "2025-03-05", reverses_entry_id: null, status: "asentado", source: "invoice", deleted_at: null, invoice_id: "f1" }, ...ASIENTOS_EN_OTRA_MONEDA],
        },
        journal_lines: {
          data: [
            { id: "je1-v", entry_id: "je1", account_id: "ven", debit: 0, credit: 1497 },
            { id: "je1-fx", entry_id: "je1", account_id: "fx", debit: 0, credit: 200 },
            { id: "je1-g", entry_id: "je1", account_id: "g1", debit: 700, credit: 0 },
            { id: "je1-ar", entry_id: "je1", account_id: "ar", debit: 997, credit: 0 },
            ...ASIENTOS_EN_OTRA_MONEDA.flatMap(a => [
              { id: `${a.id}-ar`, entry_id: a.id, account_id: "ar", debit: 1, credit: 0 },
              { id: `${a.id}-v`, entry_id: a.id, account_id: "ven", debit: 0, credit: 1 },
            ]),
          ],
        },
        invoices: { data: FACTURAS_DEL_MES },
      },
      rpc: { shipments_dashboard_counts: null },
    });

    const { finance } = await getDireccionData(client, HOY);
    expect(finance.ingreso.facturado.total).toBe(ESPERADO.total);
    expect(finance.ingreso.rango).toEqual(RANGO_MES);
    expect(finance.ingreso.enOtraMoneda).toBe(ESPERADO.enOtraMoneda);
    expect(finance.ingreso.diferenciaUsd).toBeNull();
    expect(textosFinancieros(finance).ingreso.detalle).toBe(
      "4.5 de facturas: no comparable, hay facturas en bolívares o yuanes · otros ingresos del libro: $200.00 · incluye fondos de terceros · 2 sin convertir",
    );
    // Utilidad y margen del libro: 1000 / 1700. Con el facturado daría 50 %.
    expect(finance.utilidad).toBe(1000);
    expect(finance.margenPct).toBe(netMarginPct(1700, 1000));
    expect(finance.margenPct).toBeCloseTo(58.82, 2);
  });

  it("solo USD: contra la 4.5 de los asientos de factura; el 4.6 y un manual a 4.5 son otros ingresos", async () => {
    const client = makeClient({
      tables: {
        accounts: { data: PLAN_DIR },
        journal_entries: {
          data: [
            { id: "je1", tenant_id: "t", invoice_id: "f1", entry_date: "2025-03-05", reverses_entry_id: null, status: "asentado", source: "invoice", deleted_at: null },
            { id: "je2", tenant_id: "t", entry_date: "2025-03-06", status: "asentado", source: "manual", deleted_at: null },
          ],
        },
        journal_lines: {
          data: [
            { id: "je1-v", entry_id: "je1", account_id: "ven", debit: 0, credit: 600 },
            { id: "je1-ar", entry_id: "je1", account_id: "ar", debit: 600, credit: 0 },
            { id: "je2-v", entry_id: "je2", account_id: "ven", debit: 0, credit: 300 }, // manual a 4.5
            { id: "je2-fx", entry_id: "je2", account_id: "fx", debit: 0, credit: 200 },
          ],
        },
        invoices: { data: FACTURAS_EN_USD },
      },
      rpc: { shipments_dashboard_counts: null },
    });

    const { finance } = await getDireccionData(client, HOY);
    expect(finance.ingreso.facturado.total).toBe(1000);
    expect(finance.ingreso.mayor).toEqual({ ventas: 600, ventasConMovimiento: true, ingresos: 1100, otrosIngresos: 500 });
    // 1000 − 600. Contra toda la 4.5 daría 100; contra todas las cuentas 4, −100.
    expect(finance.ingreso.diferenciaUsd).toBe(400);
    expect(textosFinancieros(finance).ingreso.detalle).toBe("4.5 de facturas: $600.00 · otros ingresos del libro: $500.00");
  });
});

describe("textosFinancieros · los KPI de ingreso y utilidad (SDD-0557)", () => {
  const ingreso = (facturas: Parameters<typeof resumirIngreso>[0], ctl: ReturnType<typeof control> | null) =>
    resumirIngreso(facturas, RANGO_MES, ctl);
  const textos = (i: ReturnType<typeof ingreso>, utilidad = 400, margenPct = 40) =>
    textosFinancieros({ ingreso: i, utilidad, margenPct });

  it("«sin IVA» con el rango y «libro» en la utilidad", () => {
    const t = textos(ingreso(FACTURAS_EN_USD, control(1000)));
    expect(t.ingreso).toEqual({
      label: "Ingresos · mes",
      valor: "$1,000.00",
      periodo: "Facturado sin IVA · 2025-03-01 → 2025-03-18",
      detalle: "cuadra con 4.5 de facturas: $1,000.00",
    });
    expect(t.utilidad).toEqual({
      label: "Utilidad neta · libro",
      valor: "$400.00",
      sub: "Margen 40.0% sobre los ingresos del libro",
    });
  });

  it("el mayor tiene menos o más: «4.5 de facturas: $X», el lado que se compara con su nombre", () => {
    expect(textos(ingreso(FACTURAS_EN_USD, control(600))).ingreso.detalle).toBe("4.5 de facturas: $600.00");
    expect(textos(ingreso(FACTURAS_EN_USD, control(1600))).ingreso.detalle).toBe("4.5 de facturas: $1,600.00");
  });

  it("no comparable (K1) y sin movimiento (K2): nunca «cuadra», y 4.5 sin cifra en dólares", () => {
    const nc = textos(ingreso(FACTURAS_DEL_MES, control(2000))).ingreso.detalle;
    expect(nc).toMatch(/^4\.5 de facturas: no comparable, hay facturas en bolívares o yuanes/);
    expect(nc).not.toMatch(/cuadra/);
    expect(nc).not.toContain("$2,000.00");
    const sm = textos(ingreso([], control(0, 0, false))).ingreso;
    expect(sm.detalle).toBe("sin asientos de factura en 4.5");
    expect(sm.valor).toBe("$0.00");
  });

  it("el mayor vacío con una factura en VES (B3): «sin asientos de factura en 4.5», no «no comparable»", () => {
    const ves = [{ id: "v1", status: "emitida", issued_at: "2025-03-05", currency: "VES", fx_rate: 36.5, base_amount: 36500, fund_class: "local_revenue" }];
    const t = textos(ingreso(ves, control(0, 0, false))).ingreso;
    expect(t.valor).toBe("$1,000.00");
    expect(t.detalle).toBe("sin asientos de factura en 4.5");
  });

  it("4.5 con asientos de factura que suman 0 no es «sin asientos»: dice «4.5 de facturas: $0.00»", () => {
    // El vacío se define por movimiento, no por saldo: un debe y un haber que
    // se anulan son asientos de factura que existen.
    const t = textos(ingreso(FACTURAS_EN_USD, control(0, 0, true))).ingreso;
    expect(t.detalle).toBe("4.5 de facturas: $0.00");
  });

  it("no comparable: la utilidad avisa que el libro mezcla el nominal en bolívares o yuanes", () => {
    const t = textos(ingreso(FACTURAS_DEL_MES, control(2000)));
    expect(t.utilidad.sub).toBe(
      "Margen 40.0% sobre los ingresos del libro · mezcla el nominal de facturas en bolívares o yuanes",
    );
    expect(textos(ingreso(FACTURAS_EN_USD, control(1000))).utilidad.sub).toBe("Margen 40.0% sobre los ingresos del libro");
  });

  it("un manual a 4.5 sin facturas: el libro tiene ingresos y se dicen aparte, sin llamarlos «sin movimiento en el libro»", () => {
    const t = textos(ingreso([], control(0, 700, false)), 700, 100);
    expect(t.ingreso.detalle).toBe("sin asientos de factura en 4.5 · otros ingresos del libro: $700.00");
    expect(t.ingreso.detalle).not.toMatch(/sin movimiento en el libro/);
    expect(t.utilidad.sub).toBe("Margen 100.0% sobre los ingresos del libro");
  });

  it("sin cuenta 4.5 y sin mayor", () => {
    expect(textos(ingreso(FACTURAS_EN_USD, control(null, 500))).ingreso.detalle).toBe(
      "sin cuenta 4.5 en el plan de cuentas · otros ingresos del libro: $500.00",
    );
    expect(textos(ingreso(FACTURAS_EN_USD, null)).ingreso.detalle).toBe("");
  });

  it("avisos de terceros y sin convertir, unidos al control", () => {
    const f2 = FACTURAS_DEL_MES.filter((f) => f.id === "f1" || f.id === "f5");
    // F1 propia y F5 fuera del mes: sin terceros. Con una de terceros en el mes, el aviso.
    expect(textos(ingreso(f2, control(1000))).ingreso.detalle).toBe("cuadra con 4.5 de facturas: $1,000.00");
    const conTerceros = [...f2, { ...FACTURAS_DEL_MES[0], id: "f9", fund_class: "third_party", base_amount: 50 }];
    expect(textos(ingreso(conTerceros, control(1050))).ingreso.detalle).toBe(
      "cuadra con 4.5 de facturas: $1,050.00 · incluye fondos de terceros",
    );
  });
});

describe("I2 · Dirección conserva el oficial y explica el puente", () => {
  it("el reverso explica ajuste/base/diferencia sin cambiar utilidad o margen", async () => {
    const d = datosReversoGo1(); const rango = RANGOS_REVERSO_GO1.octubre;
    const ingreso = await ingresoDelPeriodo(lectorReversoGo1(d).client, rango, { mayor: controlReversoGo1(d, rango) });
    const t = textosFinancieros({ ingreso, utilidad: 400, margenPct: 40 });
    expect(t.ingreso.valor).toBe("$0.00");
    expect(t.ingreso.detalle).toContain("ajuste por anulaciones: -$100.00; base comparada: -$100.00; diferencia: $0.00");
    expect(t.utilidad).toEqual({ label: "Utilidad neta · libro", valor: "$400.00", sub: "Margen 40.0% sobre los ingresos del libro" });
  });
  it("el contexto ausente muestra unidad sin verificar y causa, sin inventar bolívares", () => {
    const ingreso = resumirIngresoSinContexto([], RANGO_MES, control(0, 0, true));
    const t = textosFinancieros({ ingreso, utilidad: 0, margenPct: 0 });
    expect(t.ingreso.detalle).toContain("unidad sin verificar");
    expect(t.ingreso.detalle).toContain("requiere revisión");
    expect(t.ingreso.detalle).toContain("No se leyó el contexto");
    expect(t.ingreso.detalle).not.toMatch(/bolívares|yuanes|cuadra/);
  });
});
