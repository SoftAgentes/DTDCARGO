"use server";

/**
 * Server actions de la Bandeja de Chatwoot (SDD-0585, paso 2.2).
 *
 *  - `pedirEnlaceSso`: enlace de un solo uso para el iframe (E2-D12). Lo pide el
 *    servidor con el token de la Platform App; el cliente solo recibe el enlace
 *    ya validado (origen del chat, `/app/login`). Deja la marca `dtd_cw_sso`.
 *  - `vincularAgente` / `desvincularAgente`: solo admin (E2-D10). El vínculo
 *    exige que el agente de Chatwoot sea de la cuenta de la empresa y tenga el
 *    MISMO correo que el usuario de Studio: el SSO entra como ese agente.
 *
 * Nunca se registra el enlace, el token ni un correo.
 */
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { getStudioAccess, moduleViewDenial, tenantAdminGate } from "@/lib/studio/rbac-guard";
import { listFeatureFlags } from "@/lib/studio/feature-flags-queries";
import { isModuleEnabled } from "@/lib/studio/feature-flags-types";
import { chatwootConfig } from "@/lib/studio/chatwoot/config";
import { obtenerAgente, obtenerEnlaceSso } from "@/lib/studio/chatwoot/platform-api";
import { getVinculoPropio } from "@/lib/studio/chatwoot/links-queries";
import { isUuid, mismoCorreo, parseChatwootUserId } from "@/lib/studio/chatwoot/chatwoot-types";
import { SSO_COOKIE, SSO_COOKIE_OPTIONS } from "@/lib/studio/chatwoot/sso-cookie";

/** Códigos de error; el cliente los traduce con `bandeja.error.<código>`. */
export type BandejaErrorCode =
  | "denied"
  | "invalid"
  | "not_member"
  | "agent_not_found"
  | "agent_other_account"
  | "email_mismatch"
  | "duplicate"
  | "unconfigured"
  | "unlinked"
  | "service";

export type EnlaceSsoResult = { ok: true; url: string } | { ok: false; error: BandejaErrorCode };

export type VinculoState = { ok: boolean; error: BandejaErrorCode | null };

export async function pedirEnlaceSso(): Promise<EnlaceSsoResult> {
  const supabase = await createClient();
  const denial = await moduleViewDenial(supabase, "bandeja");
  if (denial) return { ok: false, error: "denied" };
  // La ruta deja pasar si el flag no se puede leer (fail-open de
  // requireFeatureEnabled); acá, que entra a otro sistema, se corta si está apagado.
  if (!isModuleEnabled("bandeja", await listFeatureFlags(supabase))) {
    return { ok: false, error: "denied" };
  }
  const { tenantId, userId } = await getStudioAccess(supabase);
  if (!tenantId || !userId) return { ok: false, error: "denied" };

  const cfg = chatwootConfig();
  if (!cfg) return { ok: false, error: "unconfigured" };
  const vinculo = await getVinculoPropio(supabase, tenantId, userId);
  if (!vinculo) return { ok: false, error: "unlinked" };

  const enlace = await obtenerEnlaceSso(vinculo.chatwoot_user_id, cfg);
  if (!enlace.ok) {
    console.warn(`[bandeja] SSO no disponible: ${enlace.error}`);
    return { ok: false, error: "service" };
  }
  (await cookies()).set(SSO_COOKIE, userId, SSO_COOKIE_OPTIONS);
  return { ok: true, url: enlace.data };
}

export async function vincularAgente(_prev: VinculoState, formData: FormData): Promise<VinculoState> {
  const supabase = await createClient();
  const gate = await tenantAdminGate(supabase);
  if (!gate.ok) return { ok: false, error: "denied" };

  const userId = formData.get("user_id");
  const chatwootUserId = parseChatwootUserId(formData.get("chatwoot_user_id"));
  if (!isUuid(userId) || chatwootUserId === null) return { ok: false, error: "invalid" };

  const cfg = chatwootConfig();
  if (!cfg) return { ok: false, error: "unconfigured" };

  // El correo del usuario vive en auth.users: hace falta service_role, como en
  // Usuarios. La membresía se comprueba en el MISMO tenant del admin.
  const admin = createAdminClient();
  const { data: miembro } = await admin
    .from("user_tenants")
    .select("user_id")
    .eq("tenant_id", gate.tenantId)
    .eq("user_id", userId)
    .is("disabled_at", null)
    .maybeSingle();
  if (!miembro) return { ok: false, error: "not_member" };
  const { data: auth, error: authError } = await admin.auth.admin.getUserById(userId);
  const correo = auth?.user?.email;
  if (authError || !correo) return { ok: false, error: "not_member" };

  const agente = await obtenerAgente(chatwootUserId, cfg);
  if (!agente.ok) {
    return {
      ok: false,
      error: agente.error === "no_encontrado" || agente.error === "no_autorizado" ? "agent_not_found" : "service",
    };
  }
  if (!agente.data.accountIds.includes(cfg.accountId)) return { ok: false, error: "agent_other_account" };
  if (!mismoCorreo(agente.data.email, correo)) return { ok: false, error: "email_mismatch" };

  const { error } = await supabase.from("chatwoot_agent_links").insert({
    tenant_id: gate.tenantId,
    user_id: userId,
    chatwoot_user_id: chatwootUserId,
    created_by: gate.userId,
  });
  if (error) return { ok: false, error: error.code === "23505" ? "duplicate" : "service" };
  revalidatePath("/studio/bandeja");
  return { ok: true, error: null };
}

export async function desvincularAgente(_prev: VinculoState, formData: FormData): Promise<VinculoState> {
  const supabase = await createClient();
  const gate = await tenantAdminGate(supabase);
  if (!gate.ok) return { ok: false, error: "denied" };

  const userId = formData.get("user_id");
  if (!isUuid(userId)) return { ok: false, error: "invalid" };

  const { error } = await supabase
    .from("chatwoot_agent_links")
    .delete()
    .eq("tenant_id", gate.tenantId)
    .eq("user_id", userId);
  if (error) return { ok: false, error: "service" };
  revalidatePath("/studio/bandeja");
  return { ok: true, error: null };
}
