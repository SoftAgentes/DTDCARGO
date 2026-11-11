/**
 * SDD-0574 · «Embarques sin facturar»: la regla pura (qué cuenta como
 * facturado, la pre-factura, la llegada, el orden y el resumen) y la lectura,
 * con un doble de Supabase que filtra de verdad (`eq`, `is`, `in`, `range`) y
 * devuelve copias.
 */
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  clasificarSinFacturar,
  reporteSinFacturar,
  type EnvioReporte,
  type FacturaReporte,
  type RecepcionReporte,
} from "../sin-facturar";

const HOY = new Date("2026-10-20T12:00:00Z");

const rec = (id: string, markbox: string | null, shipment: string | null, received = "2026-10-01"): RecepcionReporte => ({
  id, receipt_code: `WR-${id}`, client_markbox: markbox, received_at: received, status: "consolidado", total_cbm: 2, shipment_id: shipment,
});
const env = (id: string, status: string, arrived: string | null = null): EnvioReporte => ({
  id, code: `C-${id}`, status, arrived_destination_at: arrived,
});
const fac = (id: string, shipment: string, markbox: string, status: string): FacturaReporte => ({
  id, invoice_code: `F-${id}`, shipment_id: shipment, client_markbox: markbox, status,
});
const tarifa = (amount = 1700, perCbm = 850, cbm = 2, minCharge = 0) => ({
  amount_to_invoice: amount, per_cbm: perCbm, cbm, min_charge: minCharge,
});

// 92 snapshots realizables por round(cbm * per_cbm, 2) de 0496, sin exceder
// numeric(12,2)/numeric(12,3)/numeric(14,2). Los resultados son oráculos literales:
// 90 * 999999999999.00 + 70000000000.00 + 1992547499.xx.
const BORDES_CENTAVOS = [
  { ultimo: 1_992_547_499.91, exacto: "90071992547409.91" }, // 2^53 - 1 centavos
  { ultimo: 1_992_547_499.92, exacto: "90071992547409.92" }, // 2^53 centavos
  { ultimo: 1_992_547_499.93, exacto: "90071992547409.93" }, // 2^53 + 1 centavos
] as const;
function tarifasBorde(ultimo: number) {
  return {
    ...Object.fromEntries(Array.from({ length: 90 }, (_, i) => [`grande-${i}`, tarifa(999_999_999_999, 9_999_999_999.99, 100)])),
    complemento: tarifa(70_000_000_000, 700_000_000, 100),
    ultimo: tarifa(ultimo, ultimo, 1),
  };
}

describe("clasificarSinFacturar", () => {
  const envios = [
    env("s1", "in_transit"),
    env("s2", "arrived_destination"),
    env("s3", "in_customs", "2026-10-15T00:00:00Z"),
    env("s4", "cancelled"),
  ];

  it("una factura fiscal viva del mismo envío y Shipping Mark (normalizado) la saca del reporte", () => {
    for (const status of ["emitida", "parcial", "pagada", "vencida"]) {
      const { filas } = clasificarSinFacturar({
        recepciones: [rec("r1", " dtd-0001 ", "s1")],
        envios,
        facturas: [fac("f1", "s1", "DTD-0001", status)],
        tarifas: {},
        hoy: HOY,
      });
      expect(filas, status).toEqual([]);
    }
  });

  it("también normaliza el Shipping Mark de la factura", () => {
    const { filas } = clasificarSinFacturar({
      recepciones: [rec("r1", "DTD-0001", "s1")],
      envios,
      facturas: [fac("f1", "s1", " dtd-0001 ", "emitida")],
      tarifas: {},
      hoy: HOY,
    });
    expect(filas).toEqual([]);
  });

  it("la factura de otro cliente del mismo contenedor no la cubre", () => {
    const { filas } = clasificarSinFacturar({
      recepciones: [rec("r1", "DTD-0001", "s1")],
      envios,
      facturas: [fac("f1", "s1", "DTD-0002", "emitida")],
      tarifas: { r1: tarifa() },
      hoy: HOY,
    });
    expect(filas.map((f) => f.receiptId)).toEqual(["r1"]);
  });

  it("un borrador es pre-factura (se dice, pero no cubre) y una anulada no cuenta", () => {
    const { filas } = clasificarSinFacturar({
      recepciones: [rec("r1", "DTD-0001", "s1"), rec("r2", "DTD-0002", "s1")],
      envios,
      facturas: [fac("b1", "s1", "DTD-0001", "borrador"), fac("a1", "s1", "DTD-0002", "anulada")],
      tarifas: {},
      hoy: HOY,
    });
    expect(filas.map((f) => [f.receiptId, f.preFactura])).toEqual([["r1", "F-b1"], ["r2", null]]);
  });

  it("estados: llegó (por estado o por fecha de llegada), sin tarifa y en camino", () => {
    const { filas, resumen } = clasificarSinFacturar({
      recepciones: [
        rec("camino", "DTD-0001", "s1"),
        rec("llego", "DTD-0001", "s2"),
        rec("aduana", "DTD-0001", "s3"),
        rec("sinTarifa", "DTD-0001", null),
      ],
      envios,
      facturas: [],
      tarifas: {
        camino: tarifa(1000, 500),
        llego: tarifa(300.1, 150.05),
        aduana: tarifa(200.2, 100.1),
      },
      hoy: HOY,
    });
    expect(filas.map((f) => [f.receiptId, f.estado])).toEqual([
      ["llego", "llego_sin_factura"],
      ["aduana", "llego_sin_factura"],
      ["sinTarifa", "sin_tarifa"],
      ["camino", "en_camino"],
    ]);
    expect(resumen).toEqual({
      llego_sin_factura: { cantidad: 2, subtotalConocido: "500.30", sinTarifa: 0, aFacturar: "500.30" },
      sin_tarifa: { cantidad: 1, subtotalConocido: "0.00", sinTarifa: 1, aFacturar: null },
      en_camino: { cantidad: 1, subtotalConocido: "1000.00", sinTarifa: 0, aFacturar: "1000.00" },
    });
  });

  it("días: desde la llegada si llegó con fecha; si no, desde la recepción", () => {
    const { filas } = clasificarSinFacturar({
      recepciones: [rec("aduana", "DTD-0001", "s3", "2026-09-01"), rec("camino", "DTD-0001", "s1", "2026-10-10")],
      envios,
      facturas: [],
      tarifas: {},
      hoy: HOY,
    });
    expect(Object.fromEntries(filas.map((f) => [f.receiptId, f.dias]))).toEqual({ aduana: 5, camino: 10 });
  });

  it("fuera: envío cancelado y recepción sin Shipping Mark", () => {
    const { filas } = clasificarSinFacturar({
      recepciones: [rec("r1", "DTD-0001", "s4"), rec("r2", "  ", "s1"), rec("r3", null, null)],
      envios,
      facturas: [],
      tarifas: {},
      hoy: HOY,
    });
    expect(filas).toEqual([]);
  });

  it("orden: lo más urgente primero y, dentro, lo más viejo", () => {
    const { filas } = clasificarSinFacturar({
      recepciones: [rec("nuevo", "DTD-0001", null, "2026-10-19"), rec("viejo", "DTD-0001", null, "2026-09-01")],
      envios,
      facturas: [],
      tarifas: {},
      hoy: HOY,
    });
    expect(filas.map((f) => f.receiptId)).toEqual(["viejo", "nuevo"]);
  });

  it("F1: llegada sin tarifa conserva prioridad, faltante y total desconocido, no cero", () => {
    const r = clasificarSinFacturar({
      recepciones: [rec("llegada", "DTD-0001", "s2")], envios,
      facturas: [], tarifas: {}, hoy: HOY,
    });
    expect(r.filas[0]).toMatchObject({ estado: "llego_sin_factura", aFacturar: null });
    expect(r.resumen.llego_sin_factura).toEqual({ cantidad: 1, subtotalConocido: "0.00", sinTarifa: 1, aFacturar: null });
    expect(r).toHaveProperty("total", { cantidad: 1, subtotalConocido: "0.00", sinTarifa: 1, aFacturar: null });
    expect(r.resumen.sin_tarifa.cantidad).toBe(0); // grupo exclusivo, no contador transversal
  });

  it("F1: mezcla 1700 + desconocido mantiene subtotal y cuenta cada faltante por grupo y global", () => {
    const r = clasificarSinFacturar({
      recepciones: [rec("conocida", "DTD-0001", "s2"), rec("faltante", "DTD-0002", "s2"), rec("pendiente", "DTD-0003", null), rec("camino", "DTD-0004", "s1")],
      envios, facturas: [], tarifas: { conocida: tarifa(), camino: tarifa(25.27, 25.27, 1) }, hoy: HOY,
    });
    expect(r.resumen.llego_sin_factura).toEqual({ cantidad: 2, subtotalConocido: "1700.00", sinTarifa: 1, aFacturar: null });
    expect(r.resumen.en_camino).toEqual({ cantidad: 1, subtotalConocido: "25.27", sinTarifa: 0, aFacturar: "25.27" });
    expect(r.resumen.sin_tarifa).toEqual({ cantidad: 1, subtotalConocido: "0.00", sinTarifa: 1, aFacturar: null });
    expect(r).toHaveProperty("total", { cantidad: 4, subtotalConocido: "1725.27", sinTarifa: 2, aFacturar: null });
  });

  it("F1: cero generado conocido conserva cero y no inventa una tarifa ausente", () => {
    const r = clasificarSinFacturar({
      recepciones: [rec("cero", "DTD-0001", "s2")], envios,
      facturas: [], tarifas: { cero: tarifa(0, 1, 0.001) }, hoy: HOY,
    });
    expect(r.filas[0].aFacturar).toBe(0);
    expect(r.resumen.llego_sin_factura).toEqual({ cantidad: 1, subtotalConocido: "0.00", sinTarifa: 0, aFacturar: "0.00" });
    expect(r).toHaveProperty("total", { cantidad: 1, subtotalConocido: "0.00", sinTarifa: 0, aFacturar: "0.00" });
  });

  it("F1: centavos de importes ya generados se suman sin convertirlos en tarifas nuevas", () => {
    const r = clasificarSinFacturar({
      recepciones: [rec("a", "DTD-0001", "s2"), rec("b", "DTD-0002", "s2")],
      envios, facturas: [], tarifas: { a: tarifa(0.1, 1, 0.1), b: tarifa(0.2, 1, 0.2) }, hoy: HOY,
    });
    expect(r.filas.map((f) => f.aFacturar)).toEqual([0.1, 0.2]);
    expect(r.resumen.llego_sin_factura).toEqual({ cantidad: 2, subtotalConocido: "0.30", sinTarifa: 0, aFacturar: "0.30" });
    expect(r).toHaveProperty("total", { cantidad: 2, subtotalConocido: "0.30", sinTarifa: 0, aFacturar: "0.30" });
  });

  it.each(BORDES_CENTAVOS)("F1 precisión: 92 importes válidos conservan $exacto exacto por grupo/global y en JSON", ({ ultimo, exacto }) => {
    const tarifas = tarifasBorde(ultimo);
    const r = clasificarSinFacturar({
      recepciones: Object.keys(tarifas).map((id) => rec(id, `DTD-${id}`, "s2")),
      envios, facturas: [], tarifas, hoy: HOY,
    });
    const esperado = { cantidad: 92, subtotalConocido: exacto, sinTarifa: 0, aFacturar: exacto };
    expect(r.resumen.llego_sin_factura).toEqual(esperado);
    expect(r).toHaveProperty("total", esperado);
    expect(JSON.parse(JSON.stringify(r))).toHaveProperty("total", esperado); // BigInt no cruza el DTO.
    expect(r.filas.find((fila) => fila.receiptId === "ultimo")?.aFacturar).toBe(ultimo);
  });

  it("F1 precisión: magnitud grande más tarifa ausente conserva subtotal exacto y un solo faltante", () => {
    const tarifas = tarifasBorde(1_992_547_499.93);
    const r = clasificarSinFacturar({
      recepciones: [...Object.keys(tarifas), "faltante"].map((id) => rec(id, `DTD-${id}`, "s2")),
      envios, facturas: [], tarifas, hoy: HOY,
    });
    const esperado = { cantidad: 93, subtotalConocido: "90071992547409.93", sinTarifa: 1, aFacturar: null };
    expect(r.resumen.llego_sin_factura).toEqual(esperado);
    expect(r).toHaveProperty("total", esperado);
  });

  it("F1/F3 precisión: 60000 filas observadas conservan centavos sin certificar completa una lectura cortada", () => {
    const recepciones = Array.from({ length: 60_000 }, (_, i) => rec(`grande-${i}`, `DTD-${i}`, "s2"));
    const tarifas = Object.fromEntries(recepciones.map(({ id }) => [id, tarifa(999_999_999_999, 9_999_999_999.99, 100)]));
    const r = clasificarSinFacturar({ recepciones, envios, facturas: [], tarifas, hoy: HOY, lecturaCompleta: false });
    const esperado = { cantidad: 60_000, subtotalConocido: "59999999999940000.00", sinTarifa: 0, aFacturar: null };
    expect(r.resumen.llego_sin_factura).toEqual(esperado);
    expect(r).toHaveProperty("total", esperado);
    for (const grupo of Object.values(r.resumen)) expect(grupo.aFacturar).toBeNull();
  });

  it.each([3, 2, null])("F2: conserva CBM congelado e importe 1700 con CBM actual %s", (actual) => {
    const r = clasificarSinFacturar({
      recepciones: [{ ...rec("r1", "DTD-0001", "s1"), total_cbm: actual }], envios,
      facturas: [], tarifas: { r1: tarifa() }, hoy: HOY,
    });
    expect(r.filas[0]).toMatchObject({ cbm: actual, cbmCongelado: 2, minimo: 0, perCbm: 850, aFacturar: 1700 });
  });

  it("F2: conserva el mínimo y el monto fuente aunque excedan CBM por tarifa", () => {
    const r = clasificarSinFacturar({
      recepciones: [{ ...rec("min", "DTD-0001", "s1"), total_cbm: 3 }], envios,
      facturas: [], tarifas: { min: tarifa(100, 850, 0.1, 100) }, hoy: HOY,
    });
    expect(r.filas[0]).toMatchObject({ cbm: 3, cbmCongelado: 0.1, minimo: 100, perCbm: 850, aFacturar: 100 });
  });

  it("F3: el vacío completo elegible sí tiene cero conocido", () => {
    const r = clasificarSinFacturar({ recepciones: [], envios: [], facturas: [], tarifas: {}, hoy: HOY });
    expect(r.filas).toEqual([]);
    expect(r).toHaveProperty("total", { cantidad: 0, subtotalConocido: "0.00", sinTarifa: 0, aFacturar: "0.00" });
  });

  it("F3: la regla conserva subtotal observado pero un corte invalida el total de todos los grupos", () => {
    const input = {
      recepciones: [rec("r1", "DTD-0001", "s2")], envios,
      facturas: [], tarifas: { r1: tarifa() }, hoy: HOY, lecturaCompleta: false,
    };
    const r = clasificarSinFacturar(input);
    expect(r.resumen.llego_sin_factura).toEqual({ cantidad: 1, subtotalConocido: "1700.00", sinTarifa: 0, aFacturar: null });
    expect(r).toHaveProperty("total", { cantidad: 1, subtotalConocido: "1700.00", sinTarifa: 0, aFacturar: null });
    for (const grupo of Object.values(r.resumen)) expect(grupo.aFacturar).toBeNull();
  });
});

// ── La lectura ────────────────────────────────────────────────────────────────

type Fila = Record<string, unknown>;

type OpcionesDoble = {
  maxRows?: Partial<Record<string, number>>;
  errores?: Record<string, { code: string; message: string }>;
  llamadas?: { tabla: string; desde: number; hasta: number }[];
};

function doble(tablas: Record<string, Fila[]>, faltan: string[] = [], opciones: OpcionesDoble = {}): SupabaseClient {
  return {
    from: (tabla: string) => {
      const filtros: ((r: Fila) => boolean)[] = [];
      let desde = 0;
      let hasta = Infinity;
      const c: Record<string, unknown> = {};
      const filas = () => (tablas[tabla] ?? []).filter((r) => filtros.every((f) => f(r))).slice(desde, hasta + 1).slice(0, opciones.maxRows?.[tabla] ?? Infinity).map((r) => ({ ...r }));
      c.select = () => c;
      c.eq = (col: string, v: unknown) => (filtros.push((r) => r[col] === v), c);
      c.is = (col: string, v: null) => (filtros.push((r) => (r[col] ?? null) === v), c);
      c.in = (col: string, vs: unknown[]) => (filtros.push((r) => vs.includes(r[col])), c);
      c.order = () => c;
      c.range = (a: number, b: number) => ((desde = a), (hasta = b), c);
      c.then = (ok: (v: unknown) => unknown) => {
        opciones.llamadas?.push({ tabla, desde, hasta });
        return ok(opciones.errores?.[tabla]
          ? { data: null, error: opciones.errores[tabla] }
          : faltan.includes(tabla)
          ? { data: null, error: { code: "42P01", message: "no existe" } }
          : { data: filas(), error: null });
      };
      return c;
    },
  } as unknown as SupabaseClient;
}

describe("reporteSinFacturar (lectura)", () => {
  const tablas = (): Record<string, Fila[]> => ({
    warehouse_receipts_cn: [
      { ...rec("r1", "DTD-0001", "s1"), deleted_at: null, is_orphan: false },
      { ...rec("r2", "DTD-0002", "s1"), deleted_at: null, is_orphan: false },
      { ...rec("borrada", "DTD-0003", "s1"), deleted_at: "2026-10-02", is_orphan: false },
      { ...rec("huerfana", "DTD-0004", "s1"), deleted_at: null, is_orphan: true },
    ],
    shipments: [{ ...env("s1", "arrived_destination") }, { ...env("otro", "in_transit") }],
    invoices: [
      { ...fac("f1", "s1", "DTD-0001", "emitida"), deleted_at: null },
      { ...fac("f-borrada", "s1", "DTD-0002", "emitida"), deleted_at: "2026-10-05" },
    ],
    shipment_rate_snapshots: [
      { id: "t2", receipt_id: "r2", superseded_at: null, per_cbm: "850.00", amount_to_invoice: "1700.00", min_charge: "0", cbm: "2", included_kg_per_cbm: 500 },
      { id: "t2-vieja", receipt_id: "r2", superseded_at: "2026-10-01", per_cbm: "1.00", amount_to_invoice: "2.00", min_charge: "0", cbm: "2", included_kg_per_cbm: 500 },
    ],
  });

  it("filtra borradas, huérfanas, facturas borradas y tarifas reemplazadas", async () => {
    const r = await reporteSinFacturar(doble(tablas()), HOY);
    expect(r.completo).toBe(true);
    expect(r.tarifasDisponibles).toBe(true);
    expect(r.filas.map((f) => [f.receiptId, f.estado, f.aFacturar])).toEqual([["r2", "llego_sin_factura", 1700]]);
  });

  it("sin la 0496 lo dice y no se rompe", async () => {
    const r = await reporteSinFacturar(doble(tablas(), ["shipment_rate_snapshots"]), HOY);
    expect(r.tarifasDisponibles).toBe(false);
    expect(r.filas.map((f) => [f.receiptId, f.aFacturar])).toEqual([["r2", null]]);
    expect(r.completo).toBe(true); // falta de esquema no es corte de páginas
    expect(r.resumen.llego_sin_factura).toEqual({ cantidad: 1, subtotalConocido: "0.00", sinTarifa: 1, aFacturar: null });
    expect(r).toHaveProperty("total", { cantidad: 1, subtotalConocido: "0.00", sinTarifa: 1, aFacturar: null });
  });

  it("F2: el lector transporta CBM/mínimo de la tarifa viva, no del snapshot reemplazado", async () => {
    const t = tablas();
    t.warehouse_receipts_cn[1].total_cbm = 3;
    t.shipment_rate_snapshots[1].cbm = "99";
    t.shipment_rate_snapshots[1].min_charge = "999";
    const r = await reporteSinFacturar(doble(t), HOY);
    expect(r.filas[0]).toMatchObject({ cbm: 3, cbmCongelado: 2, minimo: 0, perCbm: 850, aFacturar: 1700 });
  });

  it.each(BORDES_CENTAVOS)("F1 precisión: lector real y normalizador de filas conservan $exacto sin sumar en Number", async ({ ultimo, exacto }) => {
    const t = tablas();
    const tarifas = tarifasBorde(ultimo);
    t.warehouse_receipts_cn = Object.keys(tarifas).map((id) => ({ ...rec(id, `DTD-${id}`, "s1"), deleted_at: null, is_orphan: false }));
    t.invoices = [];
    t.shipment_rate_snapshots = Object.entries(tarifas).map(([id, rate]) => ({
      id: `t-${id}`, receipt_id: id, superseded_at: null,
      amount_to_invoice: rate.amount_to_invoice.toFixed(2), per_cbm: rate.per_cbm.toFixed(2),
      cbm: rate.cbm.toFixed(3), min_charge: "0.00", included_kg_per_cbm: 500,
    }));
    const r = await reporteSinFacturar(doble(t), HOY);
    expect(r.completo).toBe(true);
    expect(r.tarifasDisponibles).toBe(true);
    expect(r).toHaveProperty("total", { cantidad: 92, subtotalConocido: exacto, sinTarifa: 0, aFacturar: exacto });
  });

  it("página corta no vacía sigue hasta vacío y cuenta la tarifa faltante de la segunda página", async () => {
    const t = tablas();
    t.invoices = [];
    const llamadas: NonNullable<OpcionesDoble["llamadas"]> = [];
    const r = await reporteSinFacturar(doble(t, [], { maxRows: { warehouse_receipts_cn: 1 }, llamadas }), HOY);
    expect(llamadas.filter((l) => l.tabla === "warehouse_receipts_cn").map((l) => l.desde)).toEqual([0, 1, 2]);
    expect(r.completo).toBe(true);
    expect(r.filas.map((f) => f.receiptId)).toEqual(["r1", "r2"]);
    expect(r).toHaveProperty("total", { cantidad: 2, subtotalConocido: "1700.00", sinTarifa: 1, aFacturar: null });
  });

  it("más de 500 envíos conserva el pendiente del segundo lote y el snapshot del último lote de tarifas", async () => {
    const t = tablas();
    t.warehouse_receipts_cn = Array.from({ length: 501 }, (_, i) => ({ ...rec(`r${i}`, "DTD-0001", `s${i}`), deleted_at: null, is_orphan: false }));
    t.shipments = Array.from({ length: 501 }, (_, i) => ({ ...env(`s${i}`, "arrived_destination") }));
    t.invoices = Array.from({ length: 501 }, (_, i) => ({ ...fac(`f${i}`, `s${i}`, "DTD-0001", i === 500 ? "borrador" : "emitida"), deleted_at: null }));
    t.shipment_rate_snapshots = [{ id: "ultima", receipt_id: "r500", superseded_at: null, ...tarifa(), included_kg_per_cbm: 500 }];
    const llamadas: NonNullable<OpcionesDoble["llamadas"]> = [];
    const r = await reporteSinFacturar(doble(t, [], { llamadas }), HOY);
    expect(r.completo).toBe(true);
    expect(r.filas).toHaveLength(1);
    expect(r.filas[0]).toMatchObject({ receiptId: "r500", preFactura: "F-f500", cbmCongelado: 2, aFacturar: 1700 });
    expect(llamadas.filter((l) => l.tabla === "invoices" && l.desde === 0)).toHaveLength(2);
    expect(llamadas.filter((l) => l.tabla === "shipment_rate_snapshots")).toHaveLength(4);
    expect(r).toHaveProperty("total", { cantidad: 1, subtotalConocido: "1700.00", sinTarifa: 0, aFacturar: "1700.00" });
  });

  it("F3: corte de recepciones cubiertas devuelve vacío parcial y total no concluyente", async () => {
    const t = tablas();
    t.warehouse_receipts_cn = Array.from({ length: 61 }, (_, i) => ({ ...rec(`r${i}`, "DTD-0001", "s1"), deleted_at: null, is_orphan: false }));
    const r = await reporteSinFacturar(doble(t, [], { maxRows: { warehouse_receipts_cn: 1 } }), HOY);
    expect(r.completo).toBe(false);
    expect(r.filas).toEqual([]);
    expect(r).toHaveProperty("total", { cantidad: 0, subtotalConocido: "0.00", sinTarifa: 0, aFacturar: null });
    for (const grupo of Object.values(r.resumen)) expect(grupo.aFacturar).toBeNull();
  });

  it.each(["shipments", "invoices"])("F3: corte de %s conserva lo observado sin certificar ningún total", async (tabla) => {
    const t = tablas();
    if (tabla === "shipments") {
      t.warehouse_receipts_cn = Array.from({ length: 61 }, (_, i) => ({ ...rec(`r${i}`, "DTD-0002", `s${i}`), deleted_at: null, is_orphan: false }));
      t.shipments = Array.from({ length: 61 }, (_, i) => ({ ...env(`s${i}`, "arrived_destination") }));
    } else {
      t.invoices = Array.from({ length: 61 }, (_, i) => ({ ...fac(`f${i}`, "s1", `OTRO-${i}`, "emitida"), deleted_at: null }));
    }
    const r = await reporteSinFacturar(doble(t, [], { maxRows: { [tabla]: 1 } }), HOY);
    expect(r.completo).toBe(false);
    expect(r.filas.length).toBeGreaterThan(0);
    expect(r).toHaveProperty("total.aFacturar", null);
    for (const grupo of Object.values(r.resumen)) expect(grupo.aFacturar).toBeNull();
  });

  it.each(["warehouse_receipts_cn", "shipments", "invoices", "shipment_rate_snapshots"])("error no clasificado de %s se propaga, nunca vacío exitoso", async (tabla) => {
    const error = { code: "42501", message: `Lectura denegada de ${tabla}` };
    await expect(reporteSinFacturar(doble(tablas(), [], { errores: { [tabla]: error } }), HOY)).rejects.toMatchObject({ message: error.message });
  });
});
