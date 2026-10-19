/**
 * SDD-0557 · Lectores de los controles del libro (lado servidor).
 *
 * Todo con el cliente de SESIÓN y la RLS vigente: solo lectura, sin RPC, sin
 * migración. Cada lectura que se suma o se cuenta pagina con `fetchAllPaged`
 * y LANZA con nombre si queda incompleta: un total equivocado con cara de
 * verdad es peor que un error (lib/db/paginate.ts).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllByIds, fetchAllPaged } from "@/lib/db/paginate";
import {
  accountBalances,
  computeBalances,
  listAccounts,
  type AccountBalanceMap,
} from "@/lib/studio/account-queries";
import type { Account } from "@/lib/studio/account-types";
import { balanceSheet, profitAndLoss } from "./reports";
import {
  controlDelMayor,
  ESTADOS_DE_INGRESO,
  resumirIngreso,
  type ControlDelMayor,
  type FacturaDeIngreso,
  type IngresoPeriodo,
  type RangoFechas,
} from "./ingreso-periodo";
import {
  asientosPorDocumento,
  balanceDeComprobacion,
  cruzarDocumentosConAsientos,
  CUENTA_CLIENTES,
  CUENTA_PROVEEDORES,
  filasDelDiario,
  ORIGEN_POR_TIPO,
  type AsientoDeDocumento,
  type AsientoDelDiario,
  type CuadreDelLibro,
  type DocumentoContable,
  type FilaDiario,
  type RangoDelDiario,
  type ReportesDelLibro,
} from "./libro-control";
import { cuadreSubdiario, type SaldoDeCuenta } from "./subdiario";

type Fila = Record<string, unknown>;
type Pagina = Parameters<typeof fetchAllPaged>[0];

/** Lee completo o lanza con el nombre de lo que no se pudo leer. */
async function leerCompleto<T>(nombre: string, page: Pagina): Promise<T[]> {
  const { rows, complete } = await fetchAllPaged<T>(page);
  if (!complete) {
    throw new Error(
      `${nombre}: la lectura supera el tope; el control no se puede calcular completo.`,
    );
  }
  return rows;
}

const str = (v: unknown): string => (v == null ? "" : String(v));
const strOrNull = (v: unknown): string | null => (v == null ? null : String(v));
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Los saldos del rango con SOLO las líneas de los asientos de factura
 * (`source = 'invoice'`), asentados y vivos. Es el lado del mayor que se
 * compara con lo facturado: un asiento manual a 4.5, o de cualquier otro
 * origen, no es una venta facturada y queda en «otros ingresos del mayor».
 * El filtro va en SQL y se repite en memoria, también sobre las líneas.
 */
export async function saldosDeFacturas(
  supabase: SupabaseClient,
  rango: RangoFechas,
  accounts: Account[],
): Promise<AccountBalanceMap> {
  const asientos = await leerCompleto<Fila>("Control del mayor · asientos de factura", (d, h) =>
    supabase
      .from("journal_entries")
      .select("id, status, source, deleted_at")
      .eq("status", "asentado")
      .is("deleted_at", null)
      .eq("source", ORIGEN_POR_TIPO.factura)
      .gte("entry_date", rango.from)
      .lte("entry_date", rango.to)
      .order("id", { ascending: true })
      .range(d, h),
  );
  const ids = asientos
    .filter(
      (a) =>
        a.status === "asentado" && a.deleted_at == null && a.source === ORIGEN_POR_TIPO.factura,
    )
    .map((a) => str(a.id));
  if (ids.length === 0) return computeBalances(accounts, []);

  const { rows: lineas, complete } = await fetchAllByIds<Fila>(ids, (lote, d, h) =>
    supabase
      .from("journal_lines")
      .select("id, entry_id, account_id, debit, credit")
      .in("entry_id", lote)
      .order("id", { ascending: true })
      .range(d, h),
  );
  if (!complete) {
    throw new Error(
      "Control del mayor · líneas de factura: la lectura supera el tope; el control no se puede calcular completo.",
    );
  }
  const deFactura = new Set(ids);
  return computeBalances(
    accounts,
    lineas
      .filter((l) => deFactura.has(str(l.entry_id)))
      .map((l) => ({ account_id: str(l.account_id), debit: num(l.debit), credit: num(l.credit) })),
  );
}

/**
 * El control del mayor de un rango (ingreso-periodo.ts, `controlDelMayor`):
 * `balances` son los saldos del rango con todos los orígenes, que el llamador
 * ya leyó para su P&L; acá se leen los de los asientos de factura.
 */
export async function controlDelPeriodo(
  supabase: SupabaseClient,
  rango: RangoFechas,
  accounts: Account[],
  balances: AccountBalanceMap,
): Promise<ControlDelMayor> {
  const deFacturas = await saldosDeFacturas(supabase, rango, accounts);
  return controlDelMayor(accounts, balances, deFacturas);
}

/**
 * La cifra oficial de ingreso del período (ingreso-periodo.ts). El filtro va en
 * SQL por eficiencia y la regla lo repite en memoria. Trae también las
 * anuladas: no suman, pero una anulada en VES o CNY puede conservar su asiento
 * al nominal y vuelve «no comparable» el control (E1). `opts.mayor`:
 *  - un control ya calculado (`controlDelPeriodo`: Reportes y Dirección ya
 *    tienen los saldos del rango);
 *  - null para no leer el mayor;
 *  - sin pasar, se calcula con los saldos del mismo rango.
 */
export async function ingresoDelPeriodo(
  supabase: SupabaseClient,
  rango: RangoFechas,
  opts: { mayor?: ControlDelMayor | null } = {},
): Promise<IngresoPeriodo> {
  const facturas = await leerCompleto<FacturaDeIngreso>(
    "Ingreso del período · facturas",
    (d, h) =>
      supabase
        .from("invoices")
        .select("id, status, issued_at, currency, fx_rate, base_amount, fund_class, deleted_at")
        .is("deleted_at", null)
        .in("status", [...ESTADOS_DE_INGRESO, "anulada"])
        .gte("issued_at", rango.from)
        .lte("issued_at", rango.to)
        .order("id", { ascending: true })
        .range(d, h),
  );

  let mayor = opts.mayor;
  if (mayor === undefined) {
    const [accounts, balances] = await Promise.all([
      listAccounts(supabase),
      accountBalances(supabase, { fromDate: rango.from, upToDate: rango.to }),
    ]);
    mayor = await controlDelPeriodo(supabase, rango, accounts, balances);
  }
  return resumirIngreso(facturas, rango, mayor);
}

/**
 * Contabilidad › Reportes: P&L del período, balance general y de comprobación
 * al corte (= hasta) y la cifra oficial con el control del mismo período.
 */
export async function reportesDelLibro(
  supabase: SupabaseClient,
  rango: RangoFechas,
): Promise<ReportesDelLibro> {
  const [accounts, delPeriodo, alCorte] = await Promise.all([
    listAccounts(supabase),
    accountBalances(supabase, { fromDate: rango.from, upToDate: rango.to }),
    accountBalances(supabase, { upToDate: rango.to }),
  ]);
  const ingreso = await ingresoDelPeriodo(supabase, rango, {
    mayor: await controlDelPeriodo(supabase, rango, accounts, delPeriodo),
  });
  return {
    rango,
    pnl: profitAndLoss(accounts, delPeriodo),
    balance: balanceSheet(accounts, alCorte),
    comprobacion: balanceDeComprobacion(accounts, alCorte, rango.to),
    ingreso,
  };
}

function saldoDeCuenta(
  accounts: Pick<Account, "id" | "code">[],
  saldos: AccountBalanceMap,
  code: string,
): SaldoDeCuenta | null {
  const a = accounts.find((x) => x.code === code);
  if (!a) return null;
  const s = saldos[a.id] ?? { debit: 0, credit: 0, balance: 0 };
  return { saldo: s.balance, debe: s.debit, haber: s.credit };
}

/**
 * Contabilidad › Por contabilizar: documentos sin asiento vivo, anulados con
 * asiento vivo y subdiario contra mayor. `saldos` son los saldos VIVOS (sin
 * rango) que la página ya leyó.
 */
export async function cuadreDelLibro(
  supabase: SupabaseClient,
  ctx: { accounts: Pick<Account, "id" | "code">[]; saldos: AccountBalanceMap; hoy: string },
): Promise<CuadreDelLibro> {
  const [facturas, recibos, cxp, pagos, asientos] = await Promise.all([
    // Sin borradores (no se asientan por diseño) y sin borradas.
    leerCompleto<Fila>("Por contabilizar · facturas", (d, h) =>
      supabase
        .from("invoices")
        .select("id, invoice_code, status, issued_at, currency, fx_rate, total_amount, paid_amount")
        .is("deleted_at", null)
        .in("status", [...ESTADOS_DE_INGRESO, "anulada"])
        .order("id", { ascending: true })
        .range(d, h),
    ),
    // Los anulados también: anular un recibo es `deleted_at` y la RLS de
    // SELECT no lo filtra (0470), así que se trae a propósito.
    leerCompleto<Fila>("Por contabilizar · recibos", (d, h) =>
      supabase
        .from("payment_receipts")
        .select("id, receipt_code, received_at, currency, amount, journal_entry_id, deleted_at")
        .order("id", { ascending: true })
        .range(d, h),
    ),
    leerCompleto<Fila>("Por contabilizar · CxP", (d, h) =>
      supabase
        .from("supplier_bills")
        .select("id, bill_code, issue_date, currency, fx_rate, total_amount, paid_amount, status, journal_entry_id")
        .is("deleted_at", null)
        .order("id", { ascending: true })
        .range(d, h),
    ),
    leerCompleto<Fila>("Por contabilizar · pagos a proveedor", (d, h) =>
      supabase
        .from("supplier_payments")
        .select("id, payment_code, paid_at, currency, amount, journal_entry_id, deleted_at")
        .order("id", { ascending: true })
        .range(d, h),
    ),
    // Solo los orígenes documentales: un `referral_credit` también guarda
    // `invoice_id` y no es el asiento de venta.
    leerCompleto<Fila>("Por contabilizar · asientos", (d, h) =>
      supabase
        .from("journal_entries")
        .select("id, status, source, invoice_id, receipt_id, bill_id, supplier_payment_id, deleted_at")
        .is("deleted_at", null)
        .in("status", ["asentado", "anulado"])
        .in("source", Object.values(ORIGEN_POR_TIPO))
        .order("id", { ascending: true })
        .range(d, h),
    ),
  ]);

  const docs: DocumentoContable[] = [
    ...facturas.map((f) => ({
      tipo: "factura" as const,
      id: str(f.id),
      codigo: str(f.invoice_code),
      fecha: strOrNull(f.issued_at),
      moneda: str(f.currency),
      monto: num(f.total_amount),
      vivo: f.status !== "anulada",
    })),
    ...recibos.map((r) => ({
      tipo: "recibo" as const,
      id: str(r.id),
      codigo: str(r.receipt_code),
      fecha: strOrNull(r.received_at),
      moneda: str(r.currency),
      monto: num(r.amount),
      vivo: r.deleted_at == null,
      journal_entry_id: strOrNull(r.journal_entry_id),
    })),
    ...cxp.map((b) => ({
      tipo: "cxp" as const,
      id: str(b.id),
      codigo: str(b.bill_code),
      fecha: strOrNull(b.issue_date),
      moneda: str(b.currency),
      monto: num(b.total_amount),
      vivo: b.status !== "anulada",
      journal_entry_id: strOrNull(b.journal_entry_id),
    })),
    ...pagos.map((p) => ({
      tipo: "pago_proveedor" as const,
      id: str(p.id),
      codigo: str(p.payment_code),
      fecha: strOrNull(p.paid_at),
      moneda: str(p.currency),
      monto: num(p.amount),
      vivo: p.deleted_at == null,
      journal_entry_id: strOrNull(p.journal_entry_id),
    })),
  ];
  const vinculos: AsientoDeDocumento[] = asientos.map((a) => ({
    id: str(a.id),
    status: str(a.status),
    source: str(a.source),
    deleted_at: strOrNull(a.deleted_at),
    invoice_id: strOrNull(a.invoice_id),
    receipt_id: strOrNull(a.receipt_id),
    bill_id: strOrNull(a.bill_id),
    supplier_payment_id: strOrNull(a.supplier_payment_id),
  }));

  const porDocumento = asientosPorDocumento(docs, vinculos);
  const recibosNoUsdConAsiento = docs.filter(
    (d) =>
      d.tipo === "recibo" &&
      d.vivo &&
      (d.moneda === "VES" || d.moneda === "CNY") &&
      (porDocumento.get(`recibo:${d.id}`)?.vivos ?? 0) > 0,
  ).length;

  return {
    fecha: ctx.hoy,
    documentos: cruzarDocumentosConAsientos(docs, vinculos),
    subdiario: cuadreSubdiario({
      fecha: ctx.hoy,
      facturas: facturas.map((f) => ({
        status: str(f.status),
        currency: str(f.currency),
        fx_rate: (f.fx_rate as number | null) ?? null,
        total_amount: num(f.total_amount),
        paid_amount: num(f.paid_amount),
      })),
      cxp: cxp.map((b) => ({
        status: str(b.status),
        currency: str(b.currency),
        fx_rate: (b.fx_rate as number | null) ?? null,
        total_amount: num(b.total_amount),
        paid_amount: num(b.paid_amount),
      })),
      recibosNoUsdConAsiento,
      mayorClientes: saldoDeCuenta(ctx.accounts, ctx.saldos, CUENTA_CLIENTES),
      mayorProveedores: saldoDeCuenta(ctx.accounts, ctx.saldos, CUENTA_PROVEEDORES),
    }),
  };
}

/**
 * El diario COMPLETO, sin el tope de 500 de la pantalla: solo asientos
 * asentados y vivos (así cuadra con el balance de comprobación al corte), una
 * fila por línea. `from`/`to` opcionales sobre `entry_date`.
 */
export async function leerDiarioCompleto(
  supabase: SupabaseClient,
  rango: RangoDelDiario,
): Promise<FilaDiario[]> {
  const [cabeceras, cuentas] = await Promise.all([
    leerCompleto<Fila>("Diario · asientos", (d, h) => {
      let q = supabase
        .from("journal_entries")
        .select("id, entry_code, entry_date, memo, source")
        .eq("status", "asentado")
        .is("deleted_at", null);
      if (rango.from) q = q.gte("entry_date", rango.from);
      if (rango.to) q = q.lte("entry_date", rango.to);
      return q.order("id", { ascending: true }).range(d, h);
    }),
    listAccounts(supabase),
  ]);

  const ids = cabeceras.map((c) => str(c.id));
  const { rows: lineas, complete } = await fetchAllByIds<Fila>(ids, (lote, d, h) =>
    supabase
      .from("journal_lines")
      .select("id, entry_id, account_id, debit, credit, line_memo")
      .in("entry_id", lote)
      .order("id", { ascending: true })
      .range(d, h),
  );
  if (!complete) {
    throw new Error(
      "Diario · líneas: la lectura supera el tope; el diario saldría incompleto.",
    );
  }

  const porAsiento = new Map<string, NonNullable<AsientoDelDiario["lines"]>>();
  for (const l of lineas) {
    const k = str(l.entry_id);
    const lista = porAsiento.get(k) ?? [];
    lista.push({
      id: str(l.id),
      account_id: str(l.account_id),
      debit: num(l.debit),
      credit: num(l.credit),
      line_memo: strOrNull(l.line_memo),
    });
    porAsiento.set(k, lista);
  }

  const asientos: AsientoDelDiario[] = cabeceras.map((c) => ({
    id: str(c.id),
    entry_code: str(c.entry_code),
    entry_date: str(c.entry_date),
    memo: strOrNull(c.memo),
    source: str(c.source) || "manual",
    lines: porAsiento.get(str(c.id)) ?? [],
  }));
  const mapaCuentas = new Map(cuentas.map((a) => [a.id, { code: a.code, name: a.name }]));
  return filasDelDiario(asientos, mapaCuentas);
}
