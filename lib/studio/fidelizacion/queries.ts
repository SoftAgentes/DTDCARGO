/**
 * Queries del módulo Fidelización & Referidos (SDD-0051 · Slice A).
 *
 * Funciones puras que reciben un SupabaseClient y confían en RLS por tenant.
 * Read-only: el motor de niveles deriva de `invoices` (no hay tabla de tiers);
 * los referidos viven en `referrals` (migración 0098).
 *
 * La facturación v2 conserva el decimal exacto; créditos y referidos mantienen
 * su contrato numérico existente.
 */

import { AnnualBillingError, BILLING_UNAVAILABLE, BILLING_ZERO, billingNumber, compareAnnualBilling, decodeAnnualBilling, type AnnualBilling, type AnnualBillingRead } from "@/lib/shared/annual-billing";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPaged } from "@/lib/db/paginate";
import { fechaCaracas } from "@/lib/shared/fechas-caracas";
import {
  REFERRAL_RULES,
  tierOf,
  TIERS,
  type Referral,
  type ReferralStatus,
  type Tier,
  type TierId,
} from "./types";

// ── Motor de niveles (derivado de invoices, trailing-12m) ─────

/** Agregado v2 minimizado de sesión; la lectura incompleta nunca equivale a cero. */
export async function clientAnnualBilling(
  supabase: SupabaseClient,
  now: Date = new Date(),
): Promise<Map<string, AnnualBilling>> {
  const asOf = fechaCaracas(now);
  try {
    const { rows, complete } = await fetchAllPaged<Record<string, unknown>>(
      async (d, h) => {
        const page = await supabase.rpc("studio_client_annual_billing_v2", { p_as_of: asOf })
          .order("client_markbox", { ascending: true }).range(d, h);
        if (page.error) throw new AnnualBillingError("rpc");
        if (!Array.isArray(page.data)) throw new AnnualBillingError("shape");
        return page;
      },
    );
    if (!complete) throw new AnnualBillingError("paging");
    const out = new Map<string, AnnualBilling>();
    for (const row of rows) {
      if (!row || typeof row.client_markbox !== "string" || !row.client_markbox) throw new AnnualBillingError("shape");
      if (out.has(row.client_markbox)) throw new AnnualBillingError("duplicate");
      out.set(row.client_markbox, decodeAnnualBilling(row));
    }
    return out;
  } catch (error) {
    throw error instanceof AnnualBillingError ? error : new AnnualBillingError("rpc");
  }
}

export type ClientWithTier = {
  id: string;
  markbox: string;
  name: string;
  billedUsd: number | null;
  billing: AnnualBillingRead;
  tier: Tier | null;
};

/**
 * Clientes del tenant + facturación trailing-12m USD + tier derivado.
 * Orden descendente por facturación.
 */
export async function clientsWithTier(
  supabase: SupabaseClient,
  now: Date = new Date(),
): Promise<ClientWithTier[]> {
  const billingMap = await clientAnnualBilling(supabase, now).catch(() => null);

  // Paginado: la cartera viva completa para cruzar con la facturación.
  // SDD-0509: la RLS no excluye a los eliminados; el filtro va acá.
  const { rows: data, complete } = await fetchAllPaged<Record<string, unknown>>(
    async (d, h) => {
      const page = await supabase
        .from("clients")
        .select("id, markbox, name")
        .is("deleted_at", null)
        .order("id", { ascending: true })
        .range(d, h);
      if (page.error || !Array.isArray(page.data)) throw new AnnualBillingError("rpc");
      return page;
    },
  );
  if (!complete) {
    throw new Error("Los clientes superan el tope de lectura.");
  }


  if (billingMap === null && data.length === 0) throw new AnnualBillingError("rpc");
  const seen = new Set<string>();
  const rows = data.map((r) => {
    if (typeof r.markbox !== "string" || !r.markbox || typeof r.id !== "string" || seen.has(r.markbox)) throw new AnnualBillingError("shape");
    seen.add(r.markbox);
    const markbox = String(r.markbox ?? "");
    const billing = billingMap === null ? BILLING_UNAVAILABLE : billingMap.get(markbox) ?? BILLING_ZERO;
    const billedUsd = billingNumber(billing);
    return {
      id: String(r.id ?? ""),
      markbox,
      name: String(r.name ?? ""),
      billedUsd, billing,
      tier: billedUsd === null ? null : tierOf(billedUsd),
    };
  });

  return rows.sort((a, b) => compareAnnualBilling(a.billing, b.billing));
}

export type TierCount = { tier: Tier; count: number };

/** Distribución de clientes por nivel. */
export async function tierCounts(
  supabase: SupabaseClient,
  now: Date = new Date(),
): Promise<TierCount[]> {
  const clients = await clientsWithTier(supabase, now);
  return tierCountsFromClients(clients);
}

/** La página deriva listado y distribución de la MISMA lectura. */
export function tierCountsFromClients(clients: ClientWithTier[]): TierCount[] {
  const counts: Record<TierId, number> = {
    bronze: 0,
    silver: 0,
    gold: 0,
    platinum: 0,
  };
  for (const c of clients) if (c.tier) counts[c.tier.id] += 1;
  return TIERS.map((t) => ({ tier: t, count: counts[t.id] }));
}

// ── Referidos (tabla referrals) ───────────────────────────────

const REFERRAL_COLUMNS =
  "id, tenant_id, referral_code, referrer_client_id, referrer_markbox, referred_name, referred_company, referred_email, referred_phone, referred_client_id, status, reward_usd, lead_id, notes, applied_invoice_id, applied_entry_id, applied_at, created_at, updated_at, deleted_at";
/** SDD-0567 · Columnas de la migración 0494: la acreditación a mano y la venta anulada. */
const REFERRAL_COLUMNS_0494 = `${REFERRAL_COLUMNS}, accredited_reason, sale_voided_at`;

/** Coacciona los campos numéricos (Supabase devuelve numeric como string). */
function coerceReferral(row: Record<string, unknown>): Referral {
  return {
    ...(row as unknown as Referral),
    reward_usd: Number(row.reward_usd) || 0,
    accredited_reason: (row.accredited_reason as string | null | undefined) ?? null,
    sale_voided_at: (row.sale_voided_at as string | null | undefined) ?? null,
  };
}

/**
 * Lee referidos con las columnas de la 0494 y, si la base todavía no las tiene
 * (42703, columna inexistente), vuelve a leer sin ellas. Sin la 0494 la lista se
 * ve como hoy: sin el motivo ni el aviso de la venta anulada.
 */
async function selectReferrals(
  build: (columns: string) => PromiseLike<{ data: unknown; error: { code?: string } | null }>,
): Promise<Referral[]> {
  let { data, error } = await build(REFERRAL_COLUMNS_0494);
  if (error?.code === "42703") ({ data, error } = await build(REFERRAL_COLUMNS));
  if (error) throw error;
  return ((data as Record<string, unknown>[] | null) ?? []).map(coerceReferral);
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
  return selectReferrals((columns) => {
    let query = supabase
      .from("referrals")
      .select(columns)
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
    return query;
  });
}

/** Referidos de un referidor (por MARKBOX). RLS filtra por tenant. */
export async function referralsByReferrer(
  supabase: SupabaseClient,
  markbox: string,
): Promise<Referral[]> {
  return selectReferrals((columns) =>
    supabase
      .from("referrals")
      .select(columns)
      .eq("referrer_markbox", markbox)
      .order("created_at", { ascending: false })
      .limit(500),
  );
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
