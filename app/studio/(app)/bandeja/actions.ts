"use server";

/**
 * Server actions de la Bandeja de Chatwoot (SDD-0585, paso 2.2).
 *
 *  - `pedirEnlaceSso`: enlace de un solo uso para el iframe (E2-D12). Lo pide el
 *    servidor con el token de la Platform App; el cliente solo recibe el enlace
 *    ya validado (origen del chat, `/app/login`). Deja la marca `dtd_cw_sso`.
 *    Con `conversacion`, el enlace lleva `sso_account_id` y `sso_conversation_id`
 *    y Chatwoot redirige a esa conversación tras el login (E2-D24).
 *  - `reconciliarBandeja`: al abrir la Bandeja, lee con el token del PROPIO
 *    agente las conversaciones recientes y aplica su estado (E2-D22).
 *  - `vincularAgente` / `desvincularAgente`: solo admin (E2-D10). El vínculo
 *    exige que el agente de Chatwoot sea de la cuenta de la empresa y tenga el
 *    MISMO correo que el usuario de Studio: el SSO entra como ese agente.
 *  - `pedirFichaDtd`: la ficha del cliente para la Dashboard App «Ficha DTD»
 *    (paso 2.4, E2-D30 a E2-D32). Recibe solo los dos ids del contexto de
 *    Chatwoot; el cliente sale de la base, nunca del teléfono del contexto.
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
import { obtenerAgente, obtenerEnlaceSso, obtenerTokenAgente } from "@/lib/studio/chatwoot/platform-api";
import { listarConversacionesRecientes, obtenerConversacion } from "@/lib/studio/chatwoot/account-api";
import { aplicarConversacion } from "@/lib/studio/chatwoot/webhook-procesar";
import { getVinculoPropio } from "@/lib/studio/chatwoot/links-queries";
import { isUuid, mismoCorreo, parseChatwootUserId } from "@/lib/studio/chatwoot/chatwoot-types";
import { SSO_COOKIE, SSO_COOKIE_OPTIONS } from "@/lib/studio/chatwoot/sso-cookie";
import { canAccessModule } from "@/lib/studio/rbac";
import { puedeVerSaldoCliente, type EstadoCuentaCliente } from "@/lib/studio/client-account";
import { getClientAccountState } from "@/lib/studio/client-queries";
import { listMarkboxHistory } from "@/lib/studio/markbox-history-queries";

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

export type ReconciliarResult = { ok: true; aplicadas: number } | { ok: false; error: BandejaErrorCode };

export async function pedirEnlaceSso(conversacion?: number): Promise<EnlaceSsoResult> {
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
  const url = new URL(enlace.data);
  const destino = parseChatwootUserId(conversacion);
  if (destino !== null) {
    url.searchParams.set("sso_account_id", String(cfg.accountId));
    url.searchParams.set("sso_conversation_id", String(destino));
  }
  (await cookies()).set(SSO_COOKIE, userId, SSO_COOKIE_OPTIONS);
  return { ok: true, url: url.toString() };
}

export async function reconciliarBandeja(): Promise<ReconciliarResult> {
  const supabase = await createClient();
  const denial = await moduleViewDenial(supabase, "bandeja");
  if (denial) return { ok: false, error: "denied" };
  if (!isModuleEnabled("bandeja", await listFeatureFlags(supabase))) {
    return { ok: false, error: "denied" };
  }
  const { tenantId, userId } = await getStudioAccess(supabase);
  if (!tenantId || !userId) return { ok: false, error: "denied" };

  const cfg = chatwootConfig();
  if (!cfg) return { ok: false, error: "unconfigured" };
  const vinculo = await getVinculoPropio(supabase, tenantId, userId);
  if (!vinculo) return { ok: false, error: "unlinked" };

  // El token del agente se usa acá y se descarta: no se devuelve ni se registra.
  const token = await obtenerTokenAgente(vinculo.chatwoot_user_id, cfg);
  if (!token.ok) return { ok: false, error: "service" };
  const conversaciones = await listarConversacionesRecientes(cfg, token.data);
  if (!conversaciones.ok) {
    console.warn(`[bandeja] reconciliación no disponible: ${conversaciones.error}`);
    return { ok: false, error: "service" };
  }

  // Escribe con service_role por la RPC de 0504 (solo service_role), en el
  // tenant de la sesión. Lo que se aplica es lo que el agente ve en Chatwoot.
  const ctx = { admin: createAdminClient(), tenantId };
  let aplicadas = 0;
  try {
    for (const c of conversaciones.data) {
      if ((await aplicarConversacion(ctx, c, null)).aplicado) aplicadas += 1;
    }
  } catch {
    return { ok: false, error: "service" };
  }
  return { ok: true, aplicadas };
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

/** Errores de la Ficha DTD; el cliente los traduce con `bandeja.ficha.error.<código>`. */
export type FichaDtdError =
  | "denied"
  | "invalid"
  | "unconfigured"
  | "unlinked"
  | "otro_agente"
  | "sin_clientes"
  | "sin_acceso"
  | "service";

/** Segmento de SDD-0582 §«Regla de segmentos». Hoy siempre null: lo llena E10 (E2-D33). */
export type SegmentoFicha = "cliente" | "lead_registrado";

export interface FichaDtd {
  markbox: string;
  segmento: SegmentoFicha | null;
  /** La misma cuenta que la cabecera de la ficha (SDD-0558): sin permiso, no trae dinero. */
  cuenta: EstadoCuentaCliente;
  enlace: string;
}

/** `ficha: null` es «sin ficha»: sin cruce, cruce ambiguo o cliente que la RLS no deja ver. */
export type FichaDtdResult = { ok: true; ficha: FichaDtd | null } | { ok: false; error: FichaDtdError };

const idDeContexto = (v: unknown): number | null => (typeof v === "number" ? parseChatwootUserId(v) : null);

export async function pedirFichaDtd(conversacionId: unknown, agenteId: unknown): Promise<FichaDtdResult> {
  const supabase = await createClient();
  const denial = await moduleViewDenial(supabase, "bandeja");
  if (denial) return { ok: false, error: "denied" };
  if (!isModuleEnabled("bandeja", await listFeatureFlags(supabase))) {
    return { ok: false, error: "denied" };
  }
  const conversacion = idDeContexto(conversacionId);
  const agente = idDeContexto(agenteId);
  if (conversacion === null || agente === null) return { ok: false, error: "invalid" };

  const { tenantId, userId, role, overrides } = await getStudioAccess(supabase);
  if (!tenantId || !userId) return { ok: false, error: "denied" };
  const cfg = chatwootConfig();
  if (!cfg) return { ok: false, error: "unconfigured" };

  // E2-D30 (3): el agente del contexto tiene que ser el de ESTA sesión de Studio.
  const vinculo = await getVinculoPropio(supabase, tenantId, userId);
  if (!vinculo) return { ok: false, error: "unlinked" };
  if (vinculo.chatwoot_user_id !== agente) return { ok: false, error: "otro_agente" };
  if (!canAccessModule(role, "clients", overrides)) return { ok: false, error: "sin_clientes" };

  // E2-D30 (4): Chatwoot decide si ese agente ve esa conversación. El token se
  // usa acá y se descarta.
  const token = await obtenerTokenAgente(vinculo.chatwoot_user_id, cfg);
  if (!token.ok) {
    console.warn(`[ficha-dtd] token del agente no disponible: ${token.error}`);
    return { ok: false, error: "service" };
  }
  const leida = await obtenerConversacion(cfg, token.data, conversacion);
  if (!leida.ok) {
    if (leida.error === "no_autorizado" || leida.error === "no_encontrado") return { ok: false, error: "sin_acceso" };
    console.warn(`[ficha-dtd] conversación no disponible: ${leida.error}`);
    return { ok: false, error: "service" };
  }

  // E2-D31: la misma RPC de la reconciliación; el cruce con el cliente lo decide la base.
  try {
    await aplicarConversacion({ admin: createAdminClient(), tenantId }, leida.data, null);
  } catch (e) {
    console.warn(`[ficha-dtd] ${e instanceof Error ? e.message : "no se pudo aplicar"}`);
    return { ok: false, error: "service" };
  }

  // E2-D30 (5) y E2-D32: todo lo que sigue se lee con el cliente de SESIÓN.
  const { data: fila } = await supabase
    .from("chatwoot_conversations")
    .select("client_id")
    .eq("tenant_id", tenantId)
    .eq("conversation_id", conversacion)
    .maybeSingle<{ client_id: string | null }>();
  if (!fila?.client_id) return { ok: true, ficha: null };
  const { data: cliente } = await supabase
    .from("clients")
    .select("id, markbox, deleted_at")
    .eq("id", fila.client_id)
    .maybeSingle<{ id: string; markbox: string; deleted_at: string | null }>();
  if (!cliente) return { ok: true, ficha: null };

  let codigosConocidos: string[] = [];
  try {
    codigosConocidos = (await listMarkboxHistory(supabase, cliente.id)).map((h) => h.markbox);
  } catch {
    codigosConocidos = [];
  }
  const cuenta = await getClientAccountState(supabase, cliente, {
    puedeVerSaldo: puedeVerSaldoCliente(role, overrides),
    codigosConocidos,
  });
  return {
    ok: true,
    ficha: {
      markbox: cliente.markbox,
      segmento: null,
      cuenta,
      enlace: `/studio/clientes/${encodeURIComponent(cliente.markbox)}`,
    },
  };
}
