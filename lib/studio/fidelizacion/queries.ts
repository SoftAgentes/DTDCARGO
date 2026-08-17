/**
 * Queries del módulo Fidelización & Referidos (SDD-0051 · Slice A).
 *
 * Funciones puras que reciben un SupabaseClient y confían en RLS por tenant.
 * Read-only: el motor de niveles deriva de `invoices` (no hay tabla de tiers);
 * los referidos viven en `referrals` (migración 0098).
 *
 * Supabase devuelve `numeric` como string → se coerce a number en cada lectura.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPaged } from "@/lib/db/paginate";
import {
  invoiceUsdAmount,
  REFERRAL_RULES,
  tierOf,
  TIERS,
  type Referral,
  type ReferralStatus,
  type Tier,
  type TierId,
} from "./types";
import type { InvoiceCurrency, InvoiceStatus } from "@/lib/studio/invoice-types";

// ── Motor de niveles (derivado de invoices, trailing-12m) ─────

/** Estados de factura que cuentan para la facturación (excluye borrador/anulada). */
const BILLABLE_STATUSES: InvoiceStatus[] = [
  "emitida",
  "parcial",
  "pagada",
  "vencida",
];

/** Fecha (YYYY-MM-DD) de hace 12 meses respecto a `now`. */
function trailingStart(now: Date): string {
  const d = new Date(now);
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

type BillingRow = {
  client_markbox: string;
  currency: InvoiceCurrency;
  total_amount: number;
  fx_rate: number | null;
  status: InvoiceStatus;
  issued_at: string | null;
  created_at: string | null;
};

/**
 * Facturación por cliente de los últimos 12 meses, USD-normalizada (§3.2).
 *
 * - Agrega `invoices` del tenant (RLS).
 * - Excluye `borrador` y `anulada`.
 * - Usa `issued_at` (o `created_at` como fallback) de referencia de fecha,
 *   igual que `invoiceKpis`.
 * - Normaliza cada factura a USD vía `invoiceUsdAmount` (VES/fx_rate; CNY → 0).
 *
 * Devuelve `Map<markbox, billedUsd>`.
 */
export async function clientAnnualBilling(
  supabase: SupabaseClient,
  now: Date = new Date(),
): Promise<Map<string, number>> {
  // Paginado: acá se SUMA la facturación anual por cliente, que es lo que
  // decide su nivel de fidelización. Truncar baja de nivel a quien no le toca.
  const { rows: data, complete } = await fetchAllPaged<Record<string, unknown>>(
    (d, h) =>
      supabase
        .from("invoices")
        .select(
          "client_markbox, currency, total_amount, fx_rate, status, issued_at, created_at",
        )
        .order("id", { ascending: true })
        .range(d, h),
  );
  if (!complete) {
    throw new Error("Las facturas superan el tope de lectura; la facturación anual quedaría corta.");
  }


  const start = trailingStart(now);
  const out = new Map<string, number>();

  const rows = ((data as Record<string, unknown>[] | null) ?? []).map(
    (r): BillingRow => ({
      client_markbox: String(r.client_markbox ?? ""),
      currency: r.currency as InvoiceCurrency,
      total_amount: Number(r.total_amount) || 0,
      fx_rate:
        r.fx_rate == null
          ? null
          : Number.isFinite(Number(r.fx_rate))
            ? Number(r.fx_rate)
            : null,
      status: r.status as InvoiceStatus,
      issued_at: (r.issued_at as string | null) ?? null,
      created_at: (r.created_at as string | null) ?? null,
    }),
  );

  for (const r of rows) {
    if (!BILLABLE_STATUSES.includes(r.status)) continue;
    const refDate = (r.issued_at ?? r.created_at)?.slice(0, 10);
    if (!refDate || refDate < start) continue;
    if (!r.client_markbox) continue;

    const usd = invoiceUsdAmount(r);
    if (usd <= 0) continue;

    out.set(r.client_markbox, (out.get(r.client_markbox) ?? 0) + usd);
  }

  return out;
}

export type ClientWithTier = {
  id: string;
  markbox: string;
  name: string;
  billedUsd: number;
  tier: Tier;
};

/**
 * Clientes del tenant + facturación trailing-12m USD + tier derivado.
 * Orden descendente por facturación.
 */
export async function clientsWithTier(
  supabase: SupabaseClient,
  now: Date = new Date(),
): Promise<ClientWithTier[]> {
  const billing = await clientAnnualBilling(supabase, now);

  // Paginado: la cartera completa para cruzar con la facturación.
  const { rows: data, complete } = await fetchAllPaged<Record<string, unknown>>(
    (d, h) =>
      supabase
        .from("clients")
        .select("id, markbox, name")
        .order("id", { ascending: true })
        .range(d, h),
  );
  if (!complete) {
    throw new Error("Los clientes superan el tope de lectura.");
  }


  const rows = ((data as Record<string, unknown>[] | null) ?? []).map((r) => {
    const markbox = String(r.markbox ?? "");
    const billedUsd = billing.get(markbox) ?? 0;
    return {
      id: String(r.id ?? ""),
      markbox,
      name: String(r.name ?? ""),
      billedUsd,
      tier: tierOf(billedUsd),
    };
  });

  return rows.sort((a, b) => b.billedUsd - a.billedUsd);
}

export type TierCount = { tier: Tier; count: number };

/** Distribución de clientes por nivel. */
export async function tierCounts(
  supabase: SupabaseClient,
  now: Date = new Date(),
): Promise<TierCount[]> {
  const clients = await clientsWithTier(supabase, now);
  const counts: Record<TierId, number> = {
    bronze: 0,
    silver: 0,
    gold: 0,
    platinum: 0,
  };
  for (const c of clients) counts[c.tier.id] += 1;
  return TIERS.map((t) => ({ tier: t, count: counts[t.id] }));
}

// ── Referidos (tabla referrals) ───────────────────────────────

const REFERRAL_COLUMNS =
  "id, tenant_id, referral_code, referrer_client_id, referrer_markbox, referred_name, referred_company, referred_email, referred_phone, referred_client_id, status, reward_usd, lead_id, notes, applied_invoice_id, applied_entry_id, applied_at, created_at, updated_at, deleted_at";

/** Coacciona los campos numéricos (Supabase devuelve numeric como string). */
function coerceReferral(row: Record<string, unknown>): Referral {
  return {
    ...(row as unknown as Referral),
    reward_usd: Number(row.reward_usd) || 0,
  };
}

export type ReferralFilters = {
  status?: ReferralStatus;
  q?: string;
};

/** Lista referidos con filtros opcionales. RLS filtra por tenant. */
export async function listReferrals(
  supabase: SupabaseClient,
  filters: ReferralFilters = {},
): Promise<Referral[]> {
  let query = supabase
    .from("referrals")
    .select(REFERRAL_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(500);

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  if (filters.q && filters.q.trim()) {
    const q = filters.q.trim().replace(/[,()]/g, " ").replace(/\s+/g, " ").trim();
    query = query.or(
      [
        `referral_code.ilike.%${q}%`,
        `referrer_markbox.ilike.%${q}%`,
        `referred_name.ilike.%${q}%`,
        `referred_company.ilike.%${q}%`,
      ].join(","),
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return ((data as Record<string, unknown>[] | null) ?? []).map(coerceReferral);
}

/** Referidos de un referidor (por MARKBOX). RLS filtra por tenant. */
export async function referralsByReferrer(
  supabase: SupabaseClient,
  markbox: string,
): Promise<Referral[]> {
  const { data, error } = await supabase
    .from("referrals")
    .select(REFERRAL_COLUMNS)
    .eq("referrer_markbox", markbox)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) throw error;
  return ((data as Record<string, unknown>[] | null) ?? []).map(coerceReferral);
}

export type ProgramStats = {
  total: number;
  acreditados: number;
  activos: number;
  creditsIssued: number;
  convRate: number;
};

/**
 * KPIs del programa de referidos (espejo de programStats() del Norte).
 * - activos = ni acreditado ni invitado (en pipeline).
 * - creditsIssued = suma de reward_usd de los acreditados.
 * - convRate = acreditados / total (%).
 */
export async function programStats(
  supabase: SupabaseClient,
): Promise<ProgramStats> {
  const referrals = await listReferrals(supabase);
  const total = referrals.length;
  const acreditados = referrals.filter((r) => r.status === "acreditado").length;
  const activos = referrals.filter(
    (r) => r.status !== "acreditado" && r.status !== "invitado",
  ).length;
  const creditsIssued = referrals.reduce(
    (s, r) =>
      s +
      (r.status === "acreditado" || r.status === "aplicado"
        ? r.reward_usd
        : 0),
    0,
  );
  const convRate = total ? (acreditados / total) * 100 : 0;
  return { total, acreditados, activos, creditsIssued, convRate };
}

export type TopReferrer = {
  markbox: string;
  total: number;
  acreditados: number;
  credits: number;
};

/**
 * Ranking de referidores por acreditados / total + créditos (espejo del Norte).
 * Lee de la tabla y agrega in-memory.
 */
export async function topReferrers(
  supabase: SupabaseClient,
  n = 5,
): Promise<TopReferrer[]> {
  const referrals = await listReferrals(supabase);
  const map = new Map<string, TopReferrer>();

  for (const r of referrals) {
    const m =
      map.get(r.referrer_markbox) ??
      { markbox: r.referrer_markbox, total: 0, acreditados: 0, credits: 0 };
    m.total += 1;
    if (r.status === "acreditado" || r.status === "aplicado") {
      m.acreditados += 1;
      m.credits += r.reward_usd;
    }
    map.set(r.referrer_markbox, m);
  }

  return [...map.values()]
    .sort((a, b) => b.acreditados - a.acreditados || b.total - a.total)
    .slice(0, n);
}

// ── Helpers puros sobre el set de referidos (como el Norte) ───

/**
 * Créditos ganados por un referidor (suma reward_usd). Cuenta tanto los
 * 'acreditado' (disponibles) como los 'aplicado' (ya cobrados en una factura,
 * SDD-0137): ambos son crédito GANADO por el referidor.
 */
export function creditsEarned(
  referrals: Referral[],
  markbox: string,
): number {
  return referrals
    .filter((r) => r.referrer_markbox === markbox)
    .reduce(
      (s, r) =>
        s +
        (r.status === "acreditado" || r.status === "aplicado"
          ? r.reward_usd
          : 0),
      0,
    );
}

/**
 * Créditos pendientes de aplicar a un referidor (en pipeline pero aún no
 * acreditado: ni invitado ni acreditado → cuenta la regla referrerReward).
 * Espejo de pendingCredits() del Norte.
 *
 * `referrerReward` = crédito por referido en pipeline. Default al histórico
 * (REFERRAL_RULES); el caller puede pasar el monto configurado (SDD-0159,
 * referral_settings) para que la estimación use la tarifa vigente.
 */
export function pendingCredits(
  referrals: Referral[],
  markbox: string,
  referrerReward: number = REFERRAL_RULES.referrerReward,
): number {
  return referrals
    .filter((r) => r.referrer_markbox === markbox)
    .reduce(
      (s, r) =>
        s +
        (r.status !== "acreditado" && r.status !== "invitado"
          ? referrerReward
          : 0),
      0,
    );
}
