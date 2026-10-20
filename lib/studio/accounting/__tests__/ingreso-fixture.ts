/**
 * SDD-0557 · Fixture compartido de la cifra oficial de ingreso.
 *
 * El MISMO conjunto de facturas pasa por los cuatro consumidores (Contabilidad
 * vía `ingresoDelPeriodo`, Reportes, Dirección y el Dashboard): con el período
 * {RANGO_MES} todos tienen que dar ESPERADO. Sin `.test` en el nombre: vitest
 * no lo corre.
 *
 * `HOY` va LEJOS de la fecha real a propósito: un lector que se olvide del
 * `hoy` inyectado y use el reloj cae en otro mes y la prueba lo delata.
 *
 * Cada factura es una trampa con nombre:
 *  - F1 suma la BASE (1000), no el total con IVA (1160). Es propia.
 *  - F2 es parcial, en VES con tasa: 36500 / 36,5 = 1000. Es de terceros.
 *  - F3 es borrador: no es ingreso.
 *  - F4 está anulada: no es ingreso.
 *  - F5 se CREÓ en el mes pero se EMITIÓ en enero: la fecha es `issued_at`.
 *  - F6 está en yuanes CON tasa: 7200 / 7,2 = 1000. Es de terceros. SDD-0572
 *    (decisión 1 de Sam; el Director, 2026-10-20): antes un yuan nunca sumaba.
 *  - F7 está en bolívares y F9 en yuanes, las dos sin tasa: no suman, son «sin
 *    convertir».
 *  - F8 está borrada y es la más grande: si entra, la cifra salta a 11000.
 *
 * F2, F6, F7 y F9 están en bolívares o yuanes: con su asiento de factura vivo
 * (`ASIENTOS_EN_OTRA_MONEDA`, o el `control()` por defecto) el control contra
 * 4.5 es «no comparable» (E1, B2, decisión 7) en los consumidores que leen el
 * mayor. Las pruebas que miden la DIFERENCIA usan `FACTURAS_EN_USD`, el mismo
 * fixture sin esas cuatro.
 */

import type { ControlDelMayor } from "../ingreso-periodo";

export const HOY = "2025-03-18";
export const RANGO_MES = { from: "2025-03-01", to: "2025-03-18" } as const;

type Factura = {
  id: string;
  invoice_code: string;
  status: string;
  issued_at: string | null;
  created_at: string;
  due_date: string | null;
  currency: string;
  fx_rate: number | null;
  base_amount: number;
  iva_amount: number;
  total_amount: number;
  paid_amount: number;
  fund_class: string;
  deleted_at: string | null;
};

const base = {
  due_date: "2025-04-30",
  fx_rate: null,
  iva_amount: 0,
  paid_amount: 0,
  fund_class: "third_party",
  deleted_at: null,
} as const;

export const FACTURAS_DEL_MES: Factura[] = [
  { ...base, id: "f1", invoice_code: "F-2025-0001", status: "emitida", currency: "USD", base_amount: 1000, iva_amount: 160, total_amount: 1160, issued_at: "2025-03-05", created_at: "2025-03-05T12:00:00Z", fund_class: "local_revenue" },
  { ...base, id: "f2", invoice_code: "F-2025-0002", status: "parcial", currency: "VES", fx_rate: 36.5, base_amount: 36500, total_amount: 36500, paid_amount: 10000, issued_at: "2025-03-10", created_at: "2025-03-10T12:00:00Z" },
  { ...base, id: "f3", invoice_code: "F-2025-0003", status: "borrador", currency: "USD", base_amount: 500, total_amount: 500, issued_at: null, created_at: "2025-03-12T12:00:00Z" },
  { ...base, id: "f4", invoice_code: "F-2025-0004", status: "anulada", currency: "USD", base_amount: 700, total_amount: 700, issued_at: "2025-03-03", created_at: "2025-03-03T12:00:00Z" },
  { ...base, id: "f5", invoice_code: "F-2025-0005", status: "emitida", currency: "USD", base_amount: 300, total_amount: 300, issued_at: "2025-01-30", created_at: "2025-03-01T12:00:00Z" },
  { ...base, id: "f6", invoice_code: "F-2025-0006", status: "emitida", currency: "CNY", fx_rate: 7.2, base_amount: 7200, total_amount: 7200, issued_at: "2025-03-08", created_at: "2025-03-08T12:00:00Z" },
  { ...base, id: "f7", invoice_code: "F-2025-0007", status: "emitida", currency: "VES", fx_rate: null, base_amount: 100, total_amount: 100, issued_at: "2025-03-09", created_at: "2025-03-09T12:00:00Z" },
  { ...base, id: "f8", invoice_code: "F-2025-0008", status: "emitida", currency: "USD", base_amount: 9000, total_amount: 9000, issued_at: "2025-03-04", created_at: "2025-03-04T12:00:00Z", deleted_at: "2025-03-06T10:00:00Z" },
  { ...base, id: "f9", invoice_code: "F-2025-0009", status: "emitida", currency: "CNY", fx_rate: null, base_amount: 720, total_amount: 720, issued_at: "2025-03-11", created_at: "2025-03-11T12:00:00Z" },
];

export const ESPERADO = {
  total: 3000,
  propio: 1000,
  terceros: 2000,
  facturas: 3,
  sinConvertir: 2,
  /** F2, F6, F7 y F9: no borrador, del período, en VES o CNY, con su asiento de factura vivo. */
  enOtraMoneda: 4,
} as const;

/** El fixture sin F2, F6, F7 ni F9: solo F1 suma (1000, propia). */
export const FACTURAS_EN_USD: Factura[] = FACTURAS_DEL_MES.filter((f) => f.currency === "USD");

export const ESPERADO_EN_USD = { total: 1000, facturas: 1 } as const;

/**
 * Los asientos `invoice` vivos de F2, F6, F7 y F9, sin líneas: los consumidores
 * que leen el mayor por un doble los suman a sus `journal_entries` para que
 * esas cuatro cuenten en «no comparable» (decisión 7). Fecha dentro del período.
 */
export const ASIENTOS_EN_OTRA_MONEDA = ["f2", "f6", "f7", "f9"].map((id) => ({
  id: `je-${id}`,
  tenant_id: "t",
  entry_code: `A-${id}`,
  entry_date: "2025-03-10",
  status: "asentado",
  source: "invoice",
  invoice_id: id,
  deleted_at: null,
}));

/** Todas las facturas del fixture: con 4.5 en movimiento, el `control()` las da por asentadas. */
const TODAS_ASENTADAS = FACTURAS_DEL_MES.map((f) => f.id);

/**
 * Un control del mayor para las pruebas puras. Por defecto, 4.5 tiene
 * movimiento si su saldo no es 0 y, con movimiento, cada factura del fixture
 * (F1 a F9) tiene su asiento de factura vivo; sin movimiento, ninguna. Una
 * prueba con facturas propias, o que necesita otra cosa, pasa la lista
 * `conAsiento` (decisión 7: solo esas cuentan en «no comparable»).
 */
export function control(
  ventas: number | null,
  ingresos: number = ventas ?? 0,
  ventasConMovimiento: boolean = ventas != null && ventas !== 0,
  conAsiento: readonly string[] = ventasConMovimiento ? TODAS_ASENTADAS : [],
): ControlDelMayor {
  return { ventas, ventasConMovimiento, ingresos, facturasConAsiento: new Set(conAsiento) };
}
