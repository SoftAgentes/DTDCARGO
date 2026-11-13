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

import type { SupabaseClient } from "@supabase/supabase-js";
import { resumirIngreso, type ControlDelMayor, type ContextoControlI2, type FacturaDeIngreso, type RangoFechas } from "../ingreso-periodo";

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
  tenant_id: "t",
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
  reverses_entry_id: null,
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

/**
 * GO1 I2 · datos sintéticos del puente documental.
 * No reemplaza FACTURAS_DEL_MES ni modifica los controles heredados.
 */

type FilaReversoGo1 = Record<string, unknown>;
export type DatosReversoGo1 = {
  invoices: FilaReversoGo1[];
  journal_entries: FilaReversoGo1[];
  journal_lines: FilaReversoGo1[];
  accounts: FilaReversoGo1[];
};

export const TENANT_REVERSO_GO1 = "tenant-go1";
export const FACTURA_REVERSO_GO1 = "invoice-go1";
export const RANGOS_REVERSO_GO1 = {
  septiembre: { from: "2026-09-01", to: "2026-09-30" },
  octubre: { from: "2026-10-01", to: "2026-10-31" },
  combinado: { from: "2026-09-01", to: "2026-10-31" },
} as const;

export function datosReversoGo1(
  opts: { currency?: string; fxRate?: number | null; base?: number; venta?: number } = {},
): DatosReversoGo1 {
  const base = opts.base ?? 100;
  const venta = opts.venta ?? base;
  return {
    invoices: [{
      id: FACTURA_REVERSO_GO1, tenant_id: TENANT_REVERSO_GO1,
      invoice_code: "F-2026-0042", status: "anulada",
      issued_at: "2026-09-15", created_at: "2026-09-15T12:00:00Z",
      currency: opts.currency ?? "USD", fx_rate: opts.fxRate ?? null,
      base_amount: base, iva_amount: 0, total_amount: base, paid_amount: 0,
      fund_class: "local_revenue", deleted_at: null,
    }],
    journal_entries: [
      { id: "original-go1", tenant_id: TENANT_REVERSO_GO1, invoice_id: FACTURA_REVERSO_GO1,
        entry_code: "A-2026-0042", entry_date: "2026-09-15", status: "asentado",
        source: "invoice", reverses_entry_id: null, deleted_at: null },
      { id: "reverso-go1", tenant_id: TENANT_REVERSO_GO1, invoice_id: FACTURA_REVERSO_GO1,
        entry_code: "A-2026-0051", entry_date: "2026-10-20", status: "asentado",
        source: "invoice_reversal", reverses_entry_id: "original-go1", deleted_at: null },
    ],
    journal_lines: [
      { id: "original-ar-go1", entry_id: "original-go1", account_id: "ar-go1", debit: venta, credit: 0 },
      { id: "original-ingreso-go1", entry_id: "original-go1", account_id: "ingreso-go1", debit: 0, credit: venta },
      { id: "reverso-ar-go1", entry_id: "reverso-go1", account_id: "ar-go1", debit: 0, credit: venta },
      { id: "reverso-ingreso-go1", entry_id: "reverso-go1", account_id: "ingreso-go1", debit: venta, credit: 0 },
    ],
    accounts: [
      { id: "ar-go1", tenant_id: TENANT_REVERSO_GO1, code: "1.1.2", type: "A", parent_id: null, name: "Clientes", is_postable: true },
      { id: "ingreso-go1", tenant_id: TENANT_REVERSO_GO1, code: "4.5", type: "I", parent_id: null, name: "Ventas", is_postable: true },
    ],
  };
}

/** Preparación explícita de los controles puros heredados. Materializa filas
 * contables desde los inputs del caso (saldo/movimiento/documentos), nunca
 * calcula ajuste, diferencia, unidad o validez. Los casos I2 adversos llaman
 * al lector real con datosReversoGo1 o pasan contexto crudo modificado.
 */
export function contextoDeControl(
  facturas: readonly FacturaDeIngreso[], rango: RangoFechas, mayor: ControlDelMayor,
): ContextoControlI2 {
  const documentos: Record<string, unknown>[] = [];
  const asientos: Record<string, unknown>[] = [];
  const lineas: Record<string, unknown>[] = [];
  const cuentas = [
    { id: "prep-ar", tenant_id: "t", code: "1.1.2", type: "A", parent_id: null },
    { id: "prep-ventas", tenant_id: "t", code: "4.5", type: "I", parent_id: null },
  ];
  function asiento(doc: Record<string, unknown>, importe: number, ordinal: string, conLineas = true) {
    if (!documentos.some(d => d.id === doc.id)) documentos.push(doc);
    const id = `prep-${ordinal}`;
    asientos.push({ id, tenant_id: "t", invoice_id: doc.id, entry_date: rango.from,
      source: "invoice", status: "asentado", deleted_at: null, reverses_entry_id: null });
    // El B3 heredado con Set de cabeceras pero sin movimiento representa una
    // cabecera HUÉRFANA, no un asiento balanceado fuera de4.5. Se conserva el
    // dato adverso y su discrepancia con el viejo oráculo queda documentada.
    if (!conLineas) return;
    const d = Math.max(importe, 0); const h = Math.max(-importe, 0);
    lineas.push({ id: `${id}-ar`, entry_id: id, account_id: "prep-ar", debit: d, credit: h },
      { id: `${id}-contra`, entry_id: id, account_id: "prep-ventas", debit: h, credit: d });
  }
  // Cada nominal con asiento lleva líneas reales. El resto del saldo es otro
  // documento USD emitido antes del rango, de modo que no amplía el oficial.
  let usado = 0;
  for (const f of facturas) {
    if (!mayor.facturasConAsiento.has(f.id) || f.deleted_at != null || f.status === "borrador"
      || !f.issued_at || f.issued_at.slice(0, 10) < rango.from || f.issued_at.slice(0, 10) > rango.to
      || (f.currency !== "VES" && f.currency !== "CNY")) continue;
    const doc = { ...f, tenant_id: "t", deleted_at: null };
    asiento(doc, 1, f.id, mayor.ventasConMovimiento);
    if (f.status === "anulada") {
      const original = asientos[asientos.length - 1];
      const id = `${original.id}-reverso`;
      asientos.push({ ...original, id, source: "invoice_reversal", reverses_entry_id: original.id });
      lineas.push(...lineas.filter(l => l.entry_id === original.id).map(l => ({ ...l,
        id: `${l.id}-reverso`, entry_id: id, debit: l.credit, credit: l.debit })));
    } else if (mayor.ventasConMovimiento) usado += 1;
  }
  const resto = (mayor.ventas ?? 0) - usado;
  const doc = { id: "prep-fuera-del-rango", tenant_id: "t", status: "emitida", issued_at: "2000-01-01",
    currency: "USD", fx_rate: null, base_amount: Math.abs(resto), deleted_at: null };
  if (resto !== 0) asiento(doc, resto, "saldo");
  else if (mayor.ventasConMovimiento && lineas.length === 0) {
    asiento(doc, 1, "ida"); asiento(doc, -1, "vuelta");
  }
  return { completo: true, documentos, asientos, lineas, cuentas };
}

export function resumirIngresoConContexto(
  facturas: readonly FacturaDeIngreso[], rango: RangoFechas, mayor: ControlDelMayor | null,
) {
  return resumirIngreso(facturas, rango, mayor, mayor ? contextoDeControl(facturas, rango, mayor) : undefined);
}

/** Filas de preparación para el lector; el doble aplica filtros y proyección. */
export function tablasDeControl(facturas: readonly FacturaDeIngreso[], rango: RangoFechas, mayor: ControlDelMayor) {
  const c = contextoDeControl(facturas, rango, mayor);
  return {
    invoices: [...facturas.map(f => ({ ...f, tenant_id: "t" })),
      ...c.documentos.filter(d => !facturas.some(f => f.id === d.id))],
    journal_entries: c.asientos.map(a => ({ ...a })), journal_lines: c.lineas.map(l => ({ ...l })),
    accounts: c.cuentas.map(a => ({ ...a })),
  };
}

/** Sólo agrega el nominal de líneas de 4.5; nunca calcula el ajuste documental. */
export function controlReversoGo1(
  datos: DatosReversoGo1,
  rango: { from: string; to: string },
): ControlDelMayor {
  const entradas = datos.journal_entries.filter((a) =>
    a.tenant_id === TENANT_REVERSO_GO1 && a.status === "asentado" && a.deleted_at === null
    && String(a.entry_date) >= rango.from && String(a.entry_date) <= rango.to);
  const ids = new Set(entradas.map((a) => a.id));
  const lineas = datos.journal_lines.filter((l) => ids.has(l.entry_id) && l.account_id === "ingreso-go1");
  const ventas = lineas.reduce((sum, l) => sum + Number(l.credit) - Number(l.debit), 0);
  return {
    ventas, ingresos: ventas,
    ventasConMovimiento: lineas.some((l) => Number(l.debit) !== 0 || Number(l.credit) !== 0),
    facturasConAsiento: new Set(entradas.filter((a) => a.source === "invoice").map((a) => String(a.invoice_id))),
  };
}

/**
 * Doble de sesión para ingresoDelPeriodo: aplica RLS sintética, filtros,
 * columnas planas y paginación de la query real. No calcula resultados I2.
 * Una proyección relacional aún no modelada produce un error de preparación
 * explícito; ese error nunca puede contabilizarse como ROJO funcional.
 */
export function lectorReversoGo1(
  datos: DatosReversoGo1,
  opts: { errorTabla?: string; limiteServidor?: number } = {},
) {
  const consultas: { tabla: string; columnas: string; filtros: [string, string, unknown][]; desde: number; hasta: number }[] = [];
  function from(tabla: string) {
    if (!(tabla in datos)) throw new Error("Doble GO1: tabla no modelada: " + tabla);
    const filtros: [string, string, unknown][] = [];
    let columnas = "*";
    let desde = 0;
    let hasta = Number.MAX_SAFE_INTEGER;
    let orden = "id";
    function respuesta() {
      consultas.push({ tabla, columnas, filtros: [...filtros], desde, hasta });
      if (tabla === opts.errorTabla) return { data: null, error: { message: "fallo-lectura-sintetico-go1", code: "08006" } };
      if (/[()!]/.test(columnas)) throw new Error("Doble GO1: proyección relacional no modelada: " + columnas);
      const origen = datos[tabla as keyof DatosReversoGo1];
      const filas = origen.filter((fila) => {
        // El cliente de sesión no revela cabeceras/documentos/cuentas ajenos.
        if ("tenant_id" in fila && fila.tenant_id !== TENANT_REVERSO_GO1) return false;
        return filtros.every(([op, col, valor]) => {
          const actual = fila[col];
          if (op === "eq") return actual === valor;
          if (op === "is") return actual === valor;
          if (op === "in") return (valor as readonly unknown[]).includes(actual);
          if (op === "gte") return actual != null && String(actual) >= String(valor);
          if (op === "lte") return actual != null && String(actual) <= String(valor);
          return false;
        });
      }).sort((a, b) => String(a[orden] ?? "").localeCompare(String(b[orden] ?? "")));
      const fin = Math.min(hasta + 1, desde + (opts.limiteServidor ?? Number.MAX_SAFE_INTEGER));
      const seleccion = filas.slice(desde, fin);
      const keys = columnas.split(",").map((k) => k.trim()).filter(Boolean);
      return {
        data: seleccion.map((fila) => columnas === "*" ? { ...fila } : Object.fromEntries(keys.map((k) => [k, fila[k]]))),
        error: null,
      };
    }
    const chain = {
      select(cols: string) { columnas = cols; return chain; },
      eq(col: string, valor: unknown) { filtros.push(["eq", col, valor]); return chain; },
      is(col: string, valor: unknown) { filtros.push(["is", col, valor]); return chain; },
      in(col: string, valor: readonly unknown[]) { filtros.push(["in", col, valor]); return chain; },
      gte(col: string, valor: unknown) { filtros.push(["gte", col, valor]); return chain; },
      lte(col: string, valor: unknown) { filtros.push(["lte", col, valor]); return chain; },
      order(col: string) { orden = col; return chain; },
      range(inicio: number, fin: number) { desde = inicio; hasta = fin; return chain; },
      limit(cantidad: number) { hasta = desde + cantidad - 1; return chain; },
      maybeSingle() {
        const r = respuesta();
        return Promise.resolve({ ...r, data: r.data?.[0] ?? null });
      },
      then<TResult1 = ReturnType<typeof respuesta>, TResult2 = never>(
        fulfilled?: ((value: ReturnType<typeof respuesta>) => TResult1 | PromiseLike<TResult1>) | null,
        rejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
      ) {
        return Promise.resolve().then(respuesta).then(fulfilled, rejected);
      },
    };
    return chain;
  }
  return { client: { from } as unknown as SupabaseClient, consultas };
}
