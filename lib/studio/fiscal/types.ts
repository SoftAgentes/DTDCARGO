/**
 * Tipos + helpers PUROS del módulo Fiscal/SENIAT — Libros de IVA (SDD-0073).
 *
 * Capa de presentación sobre `invoices` (0021) + compras (`supplier_bills`,
 * 0044): NO recalcula nada que ya viva en la transacción, NO tiene tablas
 * propias (salvo la config). Server-safe (sin "use client", sin Supabase, sin
 * Zod) → lo importan tanto `page.tsx` (server) como `FiscalClient.tsx` (client)
 * sin cruzar la frontera RSC.
 *
 * PRINCIPIO RECTOR: la clasificación gravada/exenta sale SIEMPRE de la config
 * (`FiscalSettings.service_iva_treatment`), nunca de un valor hardcodeado. Y
 * cero valores fabricados: columna sin fuente real → `null` → la UI muestra "—"
 * + nota honesta (regla heredada de 0052 §3.2).
 */

import type { FiscalSettings, ServiceIvaTreatment } from "./config-types";

// ── Período mensual (el IVA se declara por mes) ────────────────

/** Período fiscal en formato `YYYY-MM`. */
export type FiscalPeriod = string;

/** Mes actual en `YYYY-MM` (UTC). Determinístico vía `today`. */
export function currentPeriod(today: Date = new Date()): FiscalPeriod {
  const y = today.getUTCFullYear();
  const m = String(today.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** ¿El string es un período `YYYY-MM` válido (mes 01–12)? */
export function isValidPeriod(raw: unknown): raw is FiscalPeriod {
  if (typeof raw !== "string") return false;
  const m = /^(\d{4})-(\d{2})$/.exec(raw);
  if (!m) return false;
  const month = Number(m[2]);
  return month >= 1 && month <= 12;
}

/** Normaliza un valor crudo del URL a un período válido (default mes actual). */
export function asPeriod(raw: unknown, today: Date = new Date()): FiscalPeriod {
  return isValidPeriod(raw) ? raw : currentPeriod(today);
}

export type DateRange = { from: string; to: string };

/**
 * Rango `{from, to}` (YYYY-MM-DD, inclusivo) del mes de un período.
 *  - `from` = día 1 del mes.
 *  - `to`   = último día del mes (28/29/30/31 según el mes; bisiesto incluido).
 *
 * Calculado en UTC para ser estable e independiente del huso del server (mismo
 * criterio que `periodRange` de Reportes). `Date.UTC(y, m, 0)` = día 0 del mes
 * `m` = último día del mes `m-1`, lo que resuelve los bordes (feb bisiesto,
 * meses de 30/31) sin tablas ni casos especiales.
 */
export function fiscalRange(period: FiscalPeriod): DateRange {
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (!m) {
    // Período inválido → caemos al mes actual (defensa; el caller normaliza con
    // asPeriod, así que esto no debería dispararse en runtime).
    const now = currentPeriod();
    return fiscalRange(now);
  }
  const year = Number(m[1]);
  const month = Number(m[2]); // 1–12
  const from = `${m[1]}-${m[2]}-01`;
  // Último día del mes: día 0 del mes siguiente (month es 1-based → en Date es
  // el índice del mes siguiente cuando se usa como `monthIndex`).
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const to = `${m[1]}-${m[2]}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

/** Etiqueta legible del período (ej. "Junio 2026"). */
const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];
export function periodLabel(period: FiscalPeriod): string {
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (!m) return period;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return period;
  return `${MONTH_NAMES[month - 1]} ${m[1]}`;
}

/** Período anterior / siguiente en `YYYY-MM` (para el selector de mes). */
export function shiftPeriod(period: FiscalPeriod, delta: number): FiscalPeriod {
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (!m) return currentPeriod();
  const year = Number(m[1]);
  const monthIdx = Number(m[2]) - 1 + delta; // 0-based + delta
  const d = new Date(Date.UTC(year, monthIdx, 1));
  const y = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${mm}`;
}

// ── Clasificación de IVA (DERIVADA de la config, nunca hardcodeada) ──

/** Cómo cae una operación gravable: exenta / gravada / tasa cero. */
export type IvaClass = "exenta" | "gravada" | "tasa_cero";

/**
 * Clasifica una operación de VENTA según la config del tenant.
 *
 * El parámetro `treatment` SALE de `FiscalSettings.service_iva_treatment` — el
 * código nunca asume el resultado. Para `mixto`, una venta concreta se decide
 * por su propio IVA: si la factura trae IVA > 0 (o alícuota > 0) es gravada; si
 * no, exenta. Así el mismo motor sirve a un tenant exento, a uno gravado y a
 * uno con cartera mixta sin tocar código.
 */
export function classifyVenta(
  treatment: ServiceIvaTreatment,
  opts: { ivaAmount: number; ivaRate: number },
): IvaClass {
  switch (treatment) {
    case "exento":
      return "exenta";
    case "tasa_cero":
      return "tasa_cero";
    case "gravado":
      return "gravada";
    case "mixto":
      return opts.ivaAmount > 0 || opts.ivaRate > 0 ? "gravada" : "exenta";
  }
}

/**
 * Alícuota efectiva (%) a aplicar/mostrar para una venta clasificada.
 *  - gravada  → la alícuota real de la factura si existe, si no la general (config).
 *  - tasa_cero → 0.
 *  - exenta   → null (no aplica alícuota; la UI muestra "Exenta").
 */
export function effectiveRate(
  klass: IvaClass,
  opts: { invoiceRate: number; generalRate: number },
): number | null {
  if (klass === "exenta") return null;
  if (klass === "tasa_cero") return 0;
  return opts.invoiceRate > 0 ? opts.invoiceRate : opts.generalRate;
}

// ── Filas de los libros ────────────────────────────────────────

/** Fila del Libro de Ventas (formato SENIAT, columnas fijas V1). */
export interface SalesBookRow {
  /** Fecha de la operación (emisión o creación). YYYY-MM-DD. */
  date: string;
  /** Nº de factura (invoice_code). */
  invoiceCode: string;
  /** Nº de control fiscal — V1 no hay fuente → null → "—" honesto. */
  controlNumber: string | null;
  /** RIF del cliente (null → "—"). */
  rif: string | null;
  /** Nombre del cliente (snapshot). */
  clientName: string;
  /** Clasificación derivada de la config. */
  ivaClass: IvaClass;
  /** Base imponible (USD funcional, sin normalizar moneda en V1). */
  base: number;
  /** Alícuota efectiva (%) o null si exenta. */
  rate: number | null;
  /** Débito fiscal (IVA). 0 en exenta/tasa cero. */
  iva: number;
  /** Total de la operación (base + iva). */
  total: number;
  /** Retención de IVA — columna preparada (V1 sin comprobantes) → null. */
  retention: number | null;
}

/** Fila del Libro de Compras (formato SENIAT, columnas fijas V1). */
export interface PurchaseBookRow {
  date: string;
  /** Nº de la factura del proveedor (reference) o código interno del bill. */
  documentNumber: string;
  /** Nº de control fiscal — V1 sin fuente → null → "—". */
  controlNumber: string | null;
  rif: string | null;
  supplierName: string;
  /** Base imponible o null si no hay fuente (modo derivado sin IVA capturado). */
  base: number | null;
  rate: number | null;
  /** Crédito fiscal (IVA de la compra) o null si no hay fuente. */
  iva: number | null;
  total: number;
  /** Retención de IVA practicada — columna preparada (V1) → null. */
  retention: number | null;
}

/** Totales de un libro (Σ base/IVA/total + desglose por alícuota). */
export interface BookTotals {
  /** Σ base imponible. */
  base: number;
  /** Σ IVA (débito o crédito). */
  iva: number;
  /** Σ total. */
  total: number;
  /** Σ base de operaciones exentas. */
  baseExenta: number;
  /** Σ base de operaciones a tasa cero. */
  baseTasaCero: number;
  /** Σ base gravada. */
  baseGravada: number;
  /** Desglose por alícuota (clave = alícuota con 2 decimales, ej "16.00"). */
  byRate: { rate: number; base: number; iva: number }[];
  /** # de filas con base/IVA conocidos (para notas honestas en compras). */
  rowsWithData: number;
  /** # total de filas. */
  rows: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Σ totales del Libro de Ventas (todas las filas tienen base/iva conocidos). */
export function salesTotals(rows: SalesBookRow[]): BookTotals {
  const byRateMap = new Map<string, { rate: number; base: number; iva: number }>();
  let base = 0;
  let iva = 0;
  let total = 0;
  let baseExenta = 0;
  let baseTasaCero = 0;
  let baseGravada = 0;

  for (const r of rows) {
    base += r.base;
    iva += r.iva;
    total += r.total;
    if (r.ivaClass === "exenta") baseExenta += r.base;
    else if (r.ivaClass === "tasa_cero") baseTasaCero += r.base;
    else baseGravada += r.base;

    if (r.ivaClass === "gravada" && r.rate != null) {
      const key = r.rate.toFixed(2);
      const cur = byRateMap.get(key) ?? { rate: r.rate, base: 0, iva: 0 };
      cur.base += r.base;
      cur.iva += r.iva;
      byRateMap.set(key, cur);
    }
  }

  return {
    base: round2(base),
    iva: round2(iva),
    total: round2(total),
    baseExenta: round2(baseExenta),
    baseTasaCero: round2(baseTasaCero),
    baseGravada: round2(baseGravada),
    byRate: [...byRateMap.values()]
      .map((x) => ({ rate: x.rate, base: round2(x.base), iva: round2(x.iva) }))
      .sort((a, b) => a.rate - b.rate),
    rowsWithData: rows.length,
    rows: rows.length,
  };
}

/**
 * Σ totales del Libro de Compras. Las filas SIN fuente de base/IVA (null) NO
 * suman a base/iva (no se fabrica), pero su `total` sí cuenta y la fila se
 * reporta en `rows` (y NO en `rowsWithData`) para la nota honesta.
 */
export function purchaseTotals(rows: PurchaseBookRow[]): BookTotals {
  const byRateMap = new Map<string, { rate: number; base: number; iva: number }>();
  let base = 0;
  let iva = 0;
  let total = 0;
  let baseGravada = 0;
  let rowsWithData = 0;

  for (const r of rows) {
    total += r.total;
    if (r.base != null && r.iva != null) {
      rowsWithData += 1;
      base += r.base;
      iva += r.iva;
      baseGravada += r.base;
      if (r.rate != null) {
        const key = r.rate.toFixed(2);
        const cur = byRateMap.get(key) ?? { rate: r.rate, base: 0, iva: 0 };
        cur.base += r.base;
        cur.iva += r.iva;
        byRateMap.set(key, cur);
      }
    }
  }

  return {
    base: round2(base),
    iva: round2(iva),
    total: round2(total),
    baseExenta: 0,
    baseTasaCero: 0,
    baseGravada: round2(baseGravada),
    byRate: [...byRateMap.values()]
      .map((x) => ({ rate: x.rate, base: round2(x.base), iva: round2(x.iva) }))
      .sort((a, b) => a.rate - b.rate),
    rowsWithData,
    rows: rows.length,
  };
}

// ── Mapeo crudo → fila (puro, testeable sin DB) ────────────────

/**
 * Forma cruda mínima de una factura para el Libro de Ventas. `rif`/`client_name`
 * llegan YA RESUELTOS por el caller (el RIF vive en `clients`, no en `invoices`
 * — la query lo resuelve por `client_markbox`). Acá son solo el valor final a
 * pintar; null → "—".
 */
export interface RawInvoice {
  invoice_code: string;
  client_name: string | null;
  rif: string | null;
  base_amount: number;
  iva_amount: number;
  iva_rate: number;
  total_amount: number;
  issued_at: string | null;
  created_at: string;
}

/**
 * Mapea una factura cruda a una fila del Libro de Ventas, clasificando según la
 * config (`settings.service_iva_treatment`). El IVA mostrado respeta la clase:
 * exenta/tasa cero → 0 (NO se arrastra un iva_amount residual).
 *
 * Coherencia columna-a-columna: si la fila es gravada pero la factura NO trae
 * IVA real (`iva_amount === 0` — típico de facturas viejas anteriores a la capa
 * fiscal), NO se fuerza la alícuota general. Hacerlo pintaría "base 1000, 16%,
 * IVA 0, total 1000", que no cuadra. Sin fuente de IVA → `rate = null` ("—") y
 * `iva = 0`; nada se recalcula (regla §3.2: sin fuente, no se fabrica).
 */
export function toSalesRow(
  inv: RawInvoice,
  settings: FiscalSettings,
): SalesBookRow {
  const klass = classifyVenta(settings.service_iva_treatment, {
    ivaAmount: inv.iva_amount,
    ivaRate: inv.iva_rate,
  });
  const iva = klass === "gravada" ? inv.iva_amount : 0;
  // Gravada sin IVA real (iva_amount === 0) → alícuota "—" (null), no la general.
  const rate =
    klass === "gravada" && inv.iva_amount === 0
      ? null
      : effectiveRate(klass, {
          invoiceRate: inv.iva_rate,
          generalRate: settings.iva_rate,
        });
  const base = inv.base_amount;
  return {
    date: inv.issued_at ?? inv.created_at.slice(0, 10),
    invoiceCode: inv.invoice_code,
    controlNumber: null, // sin fuente en V1 → "—"
    rif: inv.rif,
    clientName: inv.client_name ?? "—",
    ivaClass: klass,
    base: round2(base),
    rate,
    iva: round2(iva),
    total: round2(base + iva),
    retention: null, // columna preparada (V1 sin comprobantes)
  };
}

/** Forma cruda mínima de una compra (supplier_bills) para el Libro de Compras. */
export interface RawBill {
  bill_code: string;
  supplier_name: string | null;
  reference: string | null;
  tax_id: string | null;
  total_amount: number;
  issue_date: string | null;
  created_at: string;
}

/**
 * Mapea una compra cruda a una fila del Libro de Compras según el modo de IVA.
 *
 *  - `derivado`: hoy `supplier_bills` NO discrimina IVA (va al costo, 0044). Sin
 *    una base/IVA reales, NO se fabrica: base/iva/rate quedan null → la UI
 *    muestra "—" + nota. El `total` sí es real. (Cuando exista el dato, este
 *    helper lo deriva con la alícuota de la config.)
 *  - `capturado`: requeriría un campo explícito por compra → V2. Igual: null.
 */
export function toPurchaseRow(
  bill: RawBill,
  _settings: FiscalSettings,
): PurchaseBookRow {
  return {
    date: bill.issue_date ?? bill.created_at.slice(0, 10),
    documentNumber: bill.reference ?? bill.bill_code,
    controlNumber: null,
    rif: bill.tax_id,
    supplierName: bill.supplier_name ?? "—",
    base: null, // sin fuente discriminada en V1 → "—" honesto (§3.2)
    rate: null,
    iva: null,
    total: round2(bill.total_amount),
    retention: null,
  };
}
