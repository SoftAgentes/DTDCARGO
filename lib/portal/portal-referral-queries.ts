/**
 * Programa de Referidos del Portal — cara cliente de SDD-0051 (Fidelización &
 * Referidos). El cliente ve su código para compartir, su nivel (derivado de la
 * facturación trailing-12m USD), sus créditos y a quién refirió.
 *
 * AISLAMIENTO: el cliente NO tiene RLS sobre `referrals` (la tabla la maneja el
 * Studio por tenant). Igual que Mensajes (SDD-0056), esta query corre con el
 * ADMIN client (service-role) pero scopeada EXPLÍCITO por el MARKBOX resuelto por
 * sesión (`getPortalClient` → `get_portal_client_id()` PRIMERO, en la page). El
 * admin nunca llega al bundle del cliente (sólo lo usa el server component).
 * Read-only.
 *
 * Reusa el motor PURO de `lib/studio/fidelizacion`: tiers, progreso, reglas,
 * código de referido y normalización USD. La regla de créditos se replica inline
 * (espejo exacto de creditsEarned/pendingCredits de fidelizacion/queries.ts) para
 * no castear el tipo Referral completo.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  REFERRAL_RULES,
  referralShareCode,
  tierProgress,
  invoiceUsdAmount,
  type ReferralStatus,
  type TierProgress,
} from "@/lib/studio/fidelizacion/types";
import type { InvoiceCurrency, InvoiceStatus } from "@/lib/studio/invoice-types";

/** Una fila de "Tus referidos" (campos mínimos — sin PII de contacto del referido). */
export type PortalReferralRow = {
  id: string;
  referredName: string;
  referredCompany: string | null;
  status: ReferralStatus;
  rewardUsd: number;
  createdAt: string;
};

export type PortalReferralProgram = {
  /** Código para compartir (REF-XXXX, determinístico desde el markbox). */
  shareCode: string;
  /** Nivel + progreso al siguiente, derivado de la facturación trailing-12m USD. */
  tier: TierProgress;
  /** Facturación trailing-12m USD-normalizada (la base del nivel). */
  billedUsd: number;
  /** Créditos ya acreditados (USD). */
  creditsEarnedUsd: number;
  /** Créditos en camino (referidos en pipeline, USD). */
  pendingCreditsUsd: number;
  /** USD de descuento para el referido en su primer embarque. */
  referredReward: number;
  /** USD de crédito para el referidor al acreditarse. */
  referrerReward: number;
  /** A quién refirió este cliente, recientes primero. */
  referrals: PortalReferralRow[];
};

// Espejo de los privados de fidelizacion/queries.ts (no exportados allá): los
// estados de factura que cuentan para el nivel + el corte trailing-12m.
const BILLABLE_STATUSES: InvoiceStatus[] = [
  "emitida",
  "parcial",
  "pagada",
  "vencida",
];
function trailingStart(now: Date): string {
  const d = new Date(now);
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Facturación trailing-12m USD de UN cliente (por markbox). Misma lógica que
 * `clientAnnualBilling` del Studio pero scopeada al cliente — el portal no puede
 * leer todo el tenant. Admin client + filtro EXPLÍCITO por markbox.
 */
async function billedUsdForClient(
  admin: SupabaseClient,
  markbox: string,
  now: Date,
): Promise<number> {
  const { data, error } = await admin
    .from("invoices")
    .select("currency, total_amount, fx_rate, status, issued_at, created_at")
    .eq("client_markbox", markbox)
    .is("deleted_at", null)
    .limit(1000);
  if (error || !data) return 0;

  const start = trailingStart(now);
  let sum = 0;
  for (const r of data as Record<string, unknown>[]) {
    if (!BILLABLE_STATUSES.includes(r.status as InvoiceStatus)) continue;
    const refDate = (
      ((r.issued_at as string | null) ?? (r.created_at as string | null)) ?? ""
    ).slice(0, 10);
    if (!refDate || refDate < start) continue;
    const usd = invoiceUsdAmount({
      currency: r.currency as InvoiceCurrency,
      total_amount: Number(r.total_amount) || 0,
      fx_rate: r.fx_rate == null ? null : Number(r.fx_rate),
    });
    if (usd > 0) sum += usd;
  }
  return sum;
}

/**
 * El programa de referidos del cliente logueado. `admin` = service-role client;
 * `markbox` = el del cliente resuelto por sesión (getPortalClient). TODO scopeado
 * EXPLÍCITO por ese markbox.
 */
export async function getMyReferralProgram(
  admin: SupabaseClient,
  markbox: string,
  now: Date = new Date(),
): Promise<PortalReferralProgram> {
  const mk = markbox.trim().toUpperCase();

  const [billedUsd, referralsRes] = await Promise.all([
    billedUsdForClient(admin, mk, now),
    admin
      .from("referrals")
      .select(
        "id, referred_name, referred_company, status, reward_usd, created_at",
      )
      .eq("referrer_markbox", mk)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const referrals = (
    (referralsRes.data as Record<string, unknown>[] | null) ?? []
  ).map(
    (r): PortalReferralRow => ({
      id: String(r.id ?? ""),
      referredName: String(r.referred_name ?? ""),
      referredCompany: (r.referred_company as string | null) ?? null,
      status: r.status as ReferralStatus,
      rewardUsd: Number(r.reward_usd) || 0,
      createdAt: String(r.created_at ?? ""),
    }),
  );

  // Espejo de creditsEarned / pendingCredits (lib/studio/fidelizacion/queries.ts):
  //  - ganados   = Σ reward_usd de los acreditados + aplicados (SDD-0137: un
  //                crédito aplicado sigue siendo ganado, ya se cobró).
  //  - en camino = referrerReward por cada uno en pipeline (ni invitado ni
  //                acreditado ni aplicado).
  const creditsEarnedUsd = referrals
    .filter((r) => r.status === "acreditado" || r.status === "aplicado")
    .reduce((s, r) => s + r.rewardUsd, 0);
  const pendingCreditsUsd = referrals
    .filter(
      (r) =>
        r.status !== "acreditado" &&
        r.status !== "aplicado" &&
        r.status !== "invitado",
    )
    .reduce((s) => s + REFERRAL_RULES.referrerReward, 0);

  return {
    shareCode: referralShareCode(mk),
    tier: tierProgress(billedUsd),
    billedUsd,
    creditsEarnedUsd,
    pendingCreditsUsd,
    referredReward: REFERRAL_RULES.referredReward,
    referrerReward: REFERRAL_RULES.referrerReward,
    referrals,
  };
}
