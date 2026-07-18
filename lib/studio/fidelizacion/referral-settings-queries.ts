/**
 * SDD-0159 — Lectura de la config del programa de referidos (singleton por tenant).
 *
 * La consumen los tres lugares que antes tenían $80/$60 hardcodeado: el front del
 * cliente (portal), el correo de invitación y los KPIs del Studio. Devuelve
 * SIEMPRE montos usables (fallback a DEFAULT_REFERRAL_SETTINGS) → cero regresión
 * si el tenant aún no guardó config.
 *
 * El guardado (upsert) lo hace la server action `saveReferralSettingsAction`
 * inline, igual que `saveCalculatorSettingsAction` — acá solo la lectura.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_REFERRAL_SETTINGS,
  type ReferralSettingsInput,
} from "./referral-settings-types";

type Row = {
  referrer_reward_usd: number | string;
  referred_reward_usd: number | string;
};

/**
 * Lee la config de referidos del tenant. Devuelve los montos vigentes o, si no
 * hay fila (o hay error), los defaults históricos ($80/$60).
 *
 * `tenantId`:
 *  - Studio (client autenticado): omitir → la RLS scopea a la fila del tenant.
 *  - Portal (admin/service-role, sin RLS): pasar el tenant del cliente para no
 *    depender de que exista una sola fila (multi-tenant safe).
 */
export async function getReferralSettings(
  client: SupabaseClient,
  tenantId?: string,
): Promise<ReferralSettingsInput> {
  const base = client
    .from("referral_settings")
    .select("referrer_reward_usd, referred_reward_usd");
  const { data, error } = await (
    tenantId ? base.eq("tenant_id", tenantId) : base
  ).maybeSingle<Row>();

  if (error || !data) return { ...DEFAULT_REFERRAL_SETTINGS };
  return {
    referrerRewardUsd: Number(data.referrer_reward_usd),
    referredRewardUsd: Number(data.referred_reward_usd),
  };
}
