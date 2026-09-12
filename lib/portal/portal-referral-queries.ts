/**
 * Programa de Referidos del Portal — cara cliente de SDD-0051 (Fidelización &
 * Referidos). El cliente ve su código para compartir, su nivel (derivado de la
 * facturación trailing-12m USD), sus créditos y a quién refirió.
 *
 * AISLAMIENTO: el cliente NO tiene RLS sobre `referrals`. Una RPC SECURITY
 * DEFINER deriva cliente y tenant desde auth.uid() y devuelve sólo el snapshot
 * mínimo que esta capa transforma con el motor puro del dominio.
 *
 * Reusa el motor PURO de `lib/studio/fidelizacion`: tiers, progreso, reglas y
 * código de referido. La normalización USD y la ventana trailing-12m se calculan
 * dentro de la RPC para no elevar la sesión de la página.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  referralShareCode,
  tierProgress,
  type ReferralStatus,
  type TierProgress,
} from "@/lib/studio/fidelizacion/types";

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

type ReferralProgramRpcRow = {
  markbox?: unknown;
  billed_usd?: unknown;
  referrer_reward_usd?: unknown;
  referred_reward_usd?: unknown;
  referrals?: unknown;
};

/**
 * Programa del principal autenticado. La RPC no acepta markbox, client_id ni
 * tenant_id; si la sesión no corresponde a un vínculo Portal activo, retorna
 * null y la página falla cerrada.
 */
export async function getMyReferralProgram(
  db: SupabaseClient,
): Promise<PortalReferralProgram | null> {
  const { data, error } = await db.rpc("get_portal_referral_program");
  if (error) return null;

  const row = (Array.isArray(data) ? data[0] : data) as
    | ReferralProgramRpcRow
    | null;
  const markbox = String(row?.markbox ?? "").trim().toUpperCase();
  if (!row || !markbox) return null;

  const billedUsd = Math.max(0, Number(row.billed_usd) || 0);
  const referrerReward = Math.max(0, Number(row.referrer_reward_usd) || 0);
  const referredReward = Math.max(0, Number(row.referred_reward_usd) || 0);
  const rawReferrals = Array.isArray(row.referrals) ? row.referrals : [];

  const referrals = rawReferrals.map((value): PortalReferralRow => {
    const referral = value as Record<string, unknown>;
    return {
      id: String(referral.id ?? ""),
      referredName: String(referral.referred_name ?? ""),
      referredCompany: (referral.referred_company as string | null) ?? null,
      status: referral.status as ReferralStatus,
      rewardUsd: Number(referral.reward_usd) || 0,
      createdAt: String(referral.created_at ?? ""),
    };
  });

  // Espejo de creditsEarned / pendingCredits (lib/studio/fidelizacion/queries.ts):
  //  - ganados   = Σ reward_usd de los acreditados + aplicados (SDD-0137: un
  //                crédito aplicado sigue siendo ganado, ya se cobró).
  //  - en camino = referrerReward por cada uno en pipeline (ni invitado ni
  //                acreditado ni aplicado).
  const creditsEarnedUsd = referrals
    .filter((r) => r.status === "acreditado" || r.status === "aplicado")
    .reduce((sum, referral) => sum + referral.rewardUsd, 0);
  const pendingCreditsUsd = referrals
    .filter(
      (r) =>
        r.status !== "acreditado" &&
        r.status !== "aplicado" &&
        r.status !== "invitado",
    )
    .reduce((sum) => sum + referrerReward, 0);

  return {
    shareCode: referralShareCode(markbox),
    tier: tierProgress(billedUsd),
    billedUsd,
    creditsEarnedUsd,
    pendingCreditsUsd,
    referredReward,
    referrerReward,
    referrals,
  };
}
