/**
 * Queries del módulo Fiscal/SENIAT (SDD-0073) — config + Libros de IVA.
 *
 * Funciones PURAS que reciben un SupabaseClient. RLS filtra por tenant_id; no
 * recalculan finanzas (patrón Reportes 0052 / Dirección 0048) — leen tablas
 * existentes (`invoices` 0021, `supplier_bills` 0044) y delegan en los helpers
 * puros de `./types`, clasificando SIEMPRE según la config (`./config-types`).
 *
 * Sin N+1: una query por libro (+1 a `clients` en ventas para resolver RIF). La
 * de proveedores embebe `suppliers(tax_id)` para el RIF.
 *
 * Schema confirmado (columnas verificadas contra las migraciones):
 *  - invoices (0077): invoice_code, client_markbox, client_name, currency,
 *    base_amount, iva_amount, iva_rate, total_amount, issued_at, created_at,
 *    status, deleted_at. ⚠️ NO tiene `rif` (enlaza al cliente por
 *    client_markbox, sin FK) → el RIF se resuelve aparte contra `clients`.
 *  - clients (0006): markbox, name, rif → fuente del RIF/nombre del cliente.
 *  - supplier_bills (0088): bill_code, supplier_name, reference, currency,
 *    total_amount, issue_date, created_at, status, deleted_at, supplier_id →
 *    suppliers.tax_id.
 *  - fiscal_settings (0126): singleton por tenant (esta migración).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_FISCAL_SETTINGS,
  type DeclarationPeriod,
  type FiscalSettings,
  type InvoiceIvaMode,
  type PurchaseIvaMode,
} from "./config-types";
import {
  fiscalRange,
  toPurchaseRow,
  toSalesRow,
  type FiscalPeriod,
  type PurchaseBookRow,
  type RawBill,
  type RawInvoice,
  type SalesBookRow,
} from "./types";

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Resultado de un libro: filas + las monedas distintas presentes en el período.
 * V1 NO normaliza con fx_rate; `currencies` deja que la UI advierta cuando hay
 * más de una (los totales mezclarían monedas).
 */
export type FiscalBook<T> = {
  rows: T[];
  currencies: string[];
};

// ── Configuración fiscal (singleton por tenant) ────────────────

const SETTINGS_COLUMNS =
  "tenant_id, fiscal_module_enabled, is_special_taxpayer, iva_rate_general, iva_rate_reduced, iva_rate_export, iva_rate_luxury_surcharge, default_invoice_iva_mode, igtf_enabled, igtf_rate_fx, igtf_is_perception_agent, iva_withholding_agent, iva_withholding_pct, digital_invoicing_enabled, homologated_provider, declaration_period, purchase_iva_mode, updated_at, updated_by";

type SettingsRow = {
  tenant_id: string;
  fiscal_module_enabled: boolean;
  is_special_taxpayer: boolean;
  iva_rate_general: number | string;
  iva_rate_reduced: number | string;
  iva_rate_export: number | string;
  iva_rate_luxury_surcharge: number | string;
  default_invoice_iva_mode: InvoiceIvaMode;
  igtf_enabled: boolean;
  igtf_rate_fx: number | string;
  igtf_is_perception_agent: boolean;
  iva_withholding_agent: boolean;
  iva_withholding_pct: number | string;
  digital_invoicing_enabled: boolean;
  homologated_provider: string | null;
  declaration_period: DeclarationPeriod;
  purchase_iva_mode: PurchaseIvaMode;
  updated_at: string;
  updated_by: string | null;
};

/**
 * Lee la config fiscal del tenant logueado (singleton). Si todavía no hay row,
 * cae a `DEFAULT_FISCAL_SETTINGS` (cero-config arranca usable, spec §3.1) — el
 * módulo nunca queda inservible por falta de seed.
 *
 * ⚠️ Un error de lectura NO es lo mismo que "no hay row": ante un fallo
 * transitorio NO se cae a defaults (eso fabricaría un libro exento, IVA 0, en
 * silencio). El error se PROPAGA para que la página falle ruidosa. Solo se cae a
 * defaults cuando la consulta fue ok y simplemente no había row (data === null,
 * o el PGRST116 "no rows" de PostgREST).
 *
 * Postgres devuelve numeric como string vía PostgREST → se normaliza a number.
 */
export async function getFiscalSettings(
  supabase: SupabaseClient,
): Promise<FiscalSettings> {
  const { data, error } = await supabase
    .from("fiscal_settings")
    .select(SETTINGS_COLUMNS)
    .maybeSingle<SettingsRow>();

  // Error real (no el "no rows" benigno) → propagar; nunca fabricar un libro
  // exento por un fallo de lectura.
  if (error && (error as { code?: string }).code !== "PGRST116") {
    throw error;
  }

  if (!data) {
    // Sin row → defaults. No tenant_id (aún no persistida). Cero-config usable.
    return {
      ...DEFAULT_FISCAL_SETTINGS,
      tenant_id: null,
      updated_at: null,
      updated_by: null,
    };
  }

  return {
    tenant_id: data.tenant_id,
    fiscal_module_enabled: !!data.fiscal_module_enabled,
    is_special_taxpayer: !!data.is_special_taxpayer,
    iva_rate_general: num(data.iva_rate_general),
    iva_rate_reduced: num(data.iva_rate_reduced),
    iva_rate_export: num(data.iva_rate_export),
    iva_rate_luxury_surcharge: num(data.iva_rate_luxury_surcharge),
    default_invoice_iva_mode: data.default_invoice_iva_mode,
    igtf_enabled: !!data.igtf_enabled,
    igtf_rate_fx: num(data.igtf_rate_fx),
    igtf_is_perception_agent: !!data.igtf_is_perception_agent,
    iva_withholding_agent: !!data.iva_withholding_agent,
    iva_withholding_pct: num(data.iva_withholding_pct),
    digital_invoicing_enabled: !!data.digital_invoicing_enabled,
    homologated_provider: data.homologated_provider,
    declaration_period: data.declaration_period,
    purchase_iva_mode: data.purchase_iva_mode,
    updated_at: data.updated_at,
    updated_by: data.updated_by,
  };
}

/**
 * Variante TOLERANTE de `getFiscalSettings` para el flujo de FACTURACIÓN.
 *
 * A diferencia de los Libros (donde un error de lectura DEBE propagarse para no
 * fabricar un libro exento), la facturación solo necesita saber si el módulo
 * está ON y el default/alícuota. Con el módulo OFF (DTD hoy) el valor se DESCARTA
 * — así que un fallo transitorio leyendo `fiscal_settings` NO debe tumbar crear/
 * editar facturas ni el listado (acoplamiento que no existía antes). Ante error
 * de lectura cae a `DEFAULT_FISCAL_SETTINGS` (módulo OFF) y loguea.
 */
export async function getFiscalSettingsSafe(
  supabase: SupabaseClient,
): Promise<FiscalSettings> {
  try {
    return await getFiscalSettings(supabase);
  } catch (e) {
    console.error(
      "[fiscal] getFiscalSettings falló en el path de facturación → uso defaults (módulo inerte):",
      e,
    );
    return {
      ...DEFAULT_FISCAL_SETTINGS,
      tenant_id: null,
      updated_at: null,
      updated_by: null,
    };
  }
}

// ── Libro de Ventas ────────────────────────────────────────────

// invoices NO tiene `rif` (0077): se enlaza al cliente por `client_markbox`
// (texto, sin FK) → el RIF/nombre se resuelven aparte contra `clients`. `currency`
// se selecciona para detectar mezcla de monedas (el libro no normaliza en V1).
// Estados emitidos solamente (ver SALE_STATUSES) — `borrador` queda fuera.
// Exportado para que los tests aserten el set seleccionado contra las columnas
// reales de invoices (0077) — evita que reaparezca el falso-verde de seleccionar
// una columna inexistente (`rif`, que NO vive en invoices sino en clients).
export const INVOICE_COLUMNS =
  "invoice_code, client_markbox, client_name, currency, iva_mode, base_amount, iva_amount, iva_rate, total_amount, issued_at, created_at, status";

// Estados que SÍ entran al libro fiscal: solo facturas EMITIDAS (en cualquier
// fase de cobro). `borrador` (no emitida) y `anulada` quedan fuera — un libro
// fiscal oficial no puede incluir base/IVA no emitidos. Mismo criterio que
// Reportes (fetchRevenueByCode) e invoiceKpis, corregido en SDD-0052.
export const SALE_STATUSES = ["emitida", "parcial", "pagada", "vencida"] as const;

/**
 * Libro de Ventas del mes: facturas EMITIDAS del período (excluye `borrador` y
 * `anulada`), clasificadas según la config. Filtra por `created_at` dentro del
 * rango mensual (mismo criterio que Reportes; `issued_at` puede ser null en
 * borradores, ya excluidos). RLS filtra el tenant. Ordena por fecha asc.
 *
 * El RIF/nombre del cliente se resuelve con UNA query extra a `clients` (por los
 * `client_markbox` del período → Map<markbox,{rif,name}>), sin N+1. Si la
 * factura no matchea un cliente vivo, RIF/nombre → "—" (cero fabricado).
 *
 * Devuelve también las monedas presentes para que la UI advierta cuando hay más
 * de una (los totales V1 no normalizan con fx_rate).
 */
export async function salesBook(
  supabase: SupabaseClient,
  period: FiscalPeriod,
  settings: FiscalSettings,
): Promise<FiscalBook<SalesBookRow>> {
  const range = fiscalRange(period);
  const { data, error } = await supabase
    .from("invoices")
    .select(INVOICE_COLUMNS)
    .is("deleted_at", null)
    .in("status", SALE_STATUSES as unknown as string[])
    .gte("created_at", range.from)
    .lte("created_at", `${range.to}T23:59:59.999Z`)
    .order("created_at", { ascending: true })
    .limit(20000);
  if (error) throw error;

  const raw = (data as Record<string, unknown>[] | null) ?? [];

  // Resolver RIF + nombre desde clients (1 query por los markbox del período).
  const clientByMarkbox = await fetchClientsByMarkbox(
    supabase,
    raw
      .map((r) => (r.client_markbox as string | null) ?? null)
      .filter((m): m is string => !!m),
  );

  const currencies = new Set<string>();
  const rows = raw.map((r) => {
    const currency = (r.currency as string | null) ?? null;
    if (currency) currencies.add(currency);
    const markbox = (r.client_markbox as string | null) ?? null;
    const client = markbox ? clientByMarkbox.get(markbox) : undefined;
    const inv: RawInvoice = {
      invoice_code: String(r.invoice_code ?? ""),
      // RIF SIEMPRE del cliente (clients.rif); nunca de invoices (no existe).
      rif: client?.rif ?? null,
      // Nombre: snapshot de la factura primero (refleja el momento); si falta,
      // el del cliente; si tampoco, "—".
      client_name: (r.client_name as string | null) ?? client?.name ?? null,
      // Modo de IVA de la factura (§8 #3); null → hereda el default del tenant.
      iva_mode: (r.iva_mode as InvoiceIvaMode | null) ?? null,
      base_amount: num(r.base_amount),
      iva_amount: num(r.iva_amount),
      iva_rate: num(r.iva_rate),
      total_amount: num(r.total_amount),
      issued_at: (r.issued_at as string | null) ?? null,
      created_at: String(r.created_at ?? ""),
      currency,
    };
    return toSalesRow(inv, settings);
  });

  return { rows, currencies: [...currencies].sort() };
}

/**
 * Mapa markbox → {rif, name} para un set de markboxes (de-duplicado). Una sola
 * query a `clients` (RLS filtra el tenant). Markboxes vacíos → mapa vacío.
 */
async function fetchClientsByMarkbox(
  supabase: SupabaseClient,
  markboxes: string[],
): Promise<Map<string, { rif: string | null; name: string | null }>> {
  const unique = [...new Set(markboxes)];
  const map = new Map<string, { rif: string | null; name: string | null }>();
  if (unique.length === 0) return map;

  const { data, error } = await supabase
    .from("clients")
    .select("markbox, name, rif")
    .is("deleted_at", null)
    .in("markbox", unique)
    .limit(20000);
  if (error) throw error;

  for (const r of (data as Record<string, unknown>[] | null) ?? []) {
    const markbox = (r.markbox as string | null) ?? null;
    if (!markbox) continue;
    map.set(markbox, {
      rif: (r.rif as string | null) ?? null,
      name: (r.name as string | null) ?? null,
    });
  }
  return map;
}

// ── Libro de Compras ───────────────────────────────────────────

// Embebe el RIF del proveedor (suppliers.tax_id) en la misma query → sin N+1.
// `currency` se selecciona para detectar mezcla de monedas (no se normaliza V1).
const BILL_COLUMNS =
  "bill_code, supplier_name, reference, currency, total_amount, issue_date, created_at, status, suppliers(tax_id)";

/**
 * Libro de Compras del mes: compras (`supplier_bills`) del período (excluye
 * `anulada`), filtradas por `issue_date` dentro del rango mensual (las CxP sí
 * tienen issue_date real). El IVA se interpreta según `settings.purchase_iva_mode`:
 *  - `derivado`/`capturado`: hoy `supplier_bills` no discrimina IVA (va al
 *    costo, 0044) → base/iva quedan null → la UI muestra "—" + nota honesta
 *    (§3.2). El total siempre es real. RLS filtra el tenant. Sin N+1.
 *
 * Devuelve también las monedas presentes para que la UI advierta cuando hay más
 * de una (los totales V1 no normalizan con fx_rate).
 */
export async function purchaseBook(
  supabase: SupabaseClient,
  period: FiscalPeriod,
  settings: FiscalSettings,
): Promise<FiscalBook<PurchaseBookRow>> {
  const range = fiscalRange(period);
  const { data, error } = await supabase
    .from("supplier_bills")
    .select(BILL_COLUMNS)
    .is("deleted_at", null)
    .neq("status", "anulada")
    .gte("issue_date", range.from)
    .lte("issue_date", range.to)
    .order("issue_date", { ascending: true })
    .limit(20000);
  if (error) throw error;

  const currencies = new Set<string>();
  const rows = ((data as Record<string, unknown>[] | null) ?? []).map((r) => {
    const currency = (r.currency as string | null) ?? null;
    if (currency) currencies.add(currency);
    // El embed PostgREST puede venir como objeto o array según la relación.
    const supplier = r.suppliers as { tax_id?: string | null } | { tax_id?: string | null }[] | null;
    const taxId = Array.isArray(supplier)
      ? (supplier[0]?.tax_id ?? null)
      : (supplier?.tax_id ?? null);
    const raw: RawBill = {
      bill_code: String(r.bill_code ?? ""),
      supplier_name: (r.supplier_name as string | null) ?? null,
      reference: (r.reference as string | null) ?? null,
      tax_id: taxId,
      total_amount: num(r.total_amount),
      issue_date: (r.issue_date as string | null) ?? null,
      created_at: String(r.created_at ?? ""),
      currency,
    };
    return toPurchaseRow(raw, settings);
  });

  return { rows, currencies: [...currencies].sort() };
}
