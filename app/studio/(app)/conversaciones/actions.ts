/**
 * Server actions del módulo Conversaciones (SDD-0056 · Fase 1).
 *
 * - sendReplyAction : el agente responde (direction='out'). Si el cliente del
 *   hilo tiene email → sale por Resend (reusa lib/studio/mail/send-email).
 * - setStatusAction : cambia el estado del hilo (abierto/pendiente/resuelto).
 * - assignAction    : asigna/desasigna un agente.
 * - markCaseAction  : marca/desmarca como caso (reclamo / prioridad alta).
 *
 * Convención del Studio: "use server" + useActionState + parsing manual de
 * FormData + validate*Input() (sin Zod) + revalidatePath().
 *
 * SDD-0586 (10.5, 1c-1, E10-D41): con `chatwoot_portal` encendido y la bandeja del portal
 * configurada, un hilo del portal se responde desde la Bandeja de Chatwoot. `sendReplyAction` y
 * `setStatusAction` lo rechazan en el servidor (`rechazoPortal`), después del gate de edición y
 * sin escribir nada. `assignAction` y `markCaseAction` no se traban: son metadatos internos
 * (decisión del DG del 2026-11-08, ~10:22Z).
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import { createAdminClient } from "@/lib/db/admin";
import { insertOutboundMessage } from "@/lib/studio/conversaciones/messages-queries";
import { notifyClientReplyPush } from "@/lib/studio/conversation-reply-push";
import { rechazoPortal } from "@/lib/studio/chatwoot/portal-solo-lectura";
import { runConversationDigestsForTenant } from "@/lib/studio/conversaciones/monthly-digest";
import {
  validateAssignInput,
  validateMarkCaseInput,
  validateSendReplyInput,
  validateSetStatusInput,
  type AssignInput,
  type ConversationActionState,
  type ConversationStatus,
  type DigestGenState,
  type MarkCaseInput,
  type SendReplyInput,
  type SetStatusInput,
} from "@/lib/studio/conversaciones/conversations-types";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function str(v: FormDataEntryValue | null): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

async function resolveTenantId(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string | null> {
  const { data } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  return data?.tenant_id ?? null;
}

type AgentIdentity = { userId: string; name: string };

async function resolveAgent(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<AgentIdentity | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("first_name, last_name")
    .eq("user_id", user.id)
    .maybeSingle<{ first_name: string | null; last_name: string | null }>();
  const name =
    `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() || "Agente DTD";
  return { userId: user.id, name };
}

// ─────────────────────────────────────────────────────────────
// sendReplyAction
//
// Gate de EDICIÓN (SDD-0497): era la única de las cinco acciones de este archivo
// sin `moduleEditDenial`, y la que más lejos llega — inserta un mensaje SALIENTE
// al cliente, firmado con el nombre del agente (o «Agente DTD»), y le dispara un
// push al portal. El `requireModuleView("conversaciones")` de la page protege la
// PÁGINA, no esta action; y la policy viva `"conversation_messages by tenant"`
// (0106:141-145) es FOR ALL con `with check (tenant_id = get_user_tenant_id())`,
// sin predicado de rol, así que el INSERT no lo frenaba nadie.
//
// Lo que cambia en concreto: `support` está en la matriz de `conversaciones`
// pero es read-only V1 (`canEditModule` lo rechaza siempre), así que hasta acá
// escribía al cliente contra el diseño explícito de su rol. `accounting`,
// `warehouse` y `marketing`, que ni ven el módulo, tampoco pasan ya.
// ─────────────────────────────────────────────────────────────

export async function sendReplyAction(
  _prev: ConversationActionState,
  formData: FormData,
): Promise<ConversationActionState> {
  const partial: Partial<SendReplyInput> = {
    conversation_id: str(formData.get("conversation_id")) ?? undefined,
    body: str(formData.get("body")) ?? undefined,
  };
  const { input, fieldErrors } = validateSendReplyInput(partial);
  if (fieldErrors) return { fieldErrors };

  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "conversaciones");
  if (denial) return { error: denial };

  const tenantId = await resolveTenantId(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant." };

  const agent = await resolveAgent(supabase);
  if (!agent) return { error: "Tu sesión expiró. Vuelve a entrar." };

  // El hilo debe ser del tenant (RLS lo garantiza en la lectura).
  const { data: conv } = await supabase
    .from("conversations")
    .select("id, client_id, channel, external_ref")
    .eq("id", input!.conversation_id)
    .is("deleted_at", null)
    .maybeSingle<{
      id: string;
      client_id: string;
      channel: string;
      external_ref: string | null;
    }>();
  if (!conv) return { error: "Conversación no encontrada." };

  // SDD-0586 1c-1: un hilo del portal con la integración encendida se responde desde la Bandeja.
  const rechazo = await rechazoPortal(supabase, tenantId, conv.channel);
  if (rechazo) return { error: rechazo };

  const inserted = await insertOutboundMessage(supabase, {
    tenantId,
    conversationId: input!.conversation_id,
    body: input!.body,
    authorName: agent.name,
    authorUserId: agent.userId,
  });
  if (!inserted.ok) return { error: `No se pudo enviar: ${inserted.error}` };

  // NO se manda email (decisión founder 2026-07-05): lo dialogado con el cliente
  // queda REGISTRADO en el ERP (el hilo `conversation_messages`, insertado arriba) y
  // el cliente ve la respuesta en el portal (realtime + badge + push). Cero correo.
  await notifyClientReplyPush(createAdminClient(), {
    clientId: conv.client_id,
    body: input!.body,
  });

  revalidatePath("/studio/conversaciones");
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// generateDigestsAction (SDD-0149 F3 · admin)
//
// Genera/backfillea los resúmenes mensuales de un mes puntual desde el ERP,
// sin depender del cron ni del CRON_SECRET (oculto). Idempotente (upsert): re-
// correr no duplica. Escribe con service_role (el runner) tras validar permiso.
// ─────────────────────────────────────────────────────────────

/** "YYYY-MM" → rango [monthStart, monthEndExcl) (date) + label "julio de 2026". */
function monthRange(month: string): {
  monthStart: string;
  monthEndExcl: string;
  periodLabel: string;
} | null {
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  const [y, m] = month.split("-").map(Number);
  if (m < 1 || m > 12) return null;
  const start = new Date(Date.UTC(y, m - 1, 1));
  const endExcl = new Date(Date.UTC(y, m, 1));
  const periodLabel = start.toLocaleString("es-VE", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return {
    monthStart: start.toISOString().slice(0, 10),
    monthEndExcl: endExcl.toISOString().slice(0, 10),
    periodLabel,
  };
}

export async function generateDigestsAction(
  _prev: DigestGenState,
  formData: FormData,
): Promise<DigestGenState> {
  const month = str(formData.get("month"));
  const range = month ? monthRange(month) : null;
  if (!range) return { error: "Elige un mes válido." };

  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "conversaciones");
  if (denial) return { error: denial };

  const tenantId = await resolveTenantId(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant." };

  // El runner escribe con service_role (RLS: solo el cron/service_role escribe).
  const res = await runConversationDigestsForTenant(
    createAdminClient(),
    tenantId,
    range.monthStart,
    range.monthEndExcl,
    range.periodLabel,
  );

  revalidatePath("/studio/conversaciones");
  return {
    ok: true,
    processed: res.processed,
    generated: res.generated,
    skipped: res.skipped,
    periodLabel: range.periodLabel,
  };
}

// ─────────────────────────────────────────────────────────────
// setStatusAction
// ─────────────────────────────────────────────────────────────

export async function setStatusAction(
  _prev: ConversationActionState,
  formData: FormData,
): Promise<ConversationActionState> {
  const partial: Partial<SetStatusInput> = {
    conversation_id: str(formData.get("conversation_id")) ?? undefined,
    status: (str(formData.get("status")) as ConversationStatus | null) ?? undefined,
  };
  const { input, fieldErrors } = validateSetStatusInput(partial);
  if (fieldErrors) return { fieldErrors };

  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "conversaciones");
  if (denial) return { error: denial };

  // SDD-0586 1c-1: el estado de un hilo del portal con la integración encendida lo decide
  // Chatwoot (E10-D39). Se lee el canal con la sesión (la RLS lo deja ver solo en el tenant).
  // Si la lectura falla no se sabe si es del portal: no se escribe (fail-closed).
  const { data: hilo, error: errorHilo } = await supabase
    .from("conversations")
    .select("id, channel")
    .eq("id", input!.conversation_id)
    .is("deleted_at", null)
    .maybeSingle<{ id: string; channel: string }>();
  if (errorHilo) return { error: "No se pudo leer la conversación. Vuelve a intentar." };
  if (hilo?.channel === "portal") {
    const rechazo = await rechazoPortal(supabase, await resolveTenantId(supabase), hilo.channel);
    if (rechazo) return { error: rechazo };
  }

  const { error } = await supabase
    .from("conversations")
    .update({ status: input!.status })
    .eq("id", input!.conversation_id);
  if (error) return { error: `No se pudo cambiar el estado: ${error.message}` };

  revalidatePath("/studio/conversaciones");
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// assignAction
// ─────────────────────────────────────────────────────────────

export async function assignAction(
  _prev: ConversationActionState,
  formData: FormData,
): Promise<ConversationActionState> {
  const partial: Partial<AssignInput> = {
    conversation_id: str(formData.get("conversation_id")) ?? undefined,
    assigned_to: str(formData.get("assigned_to")),
  };
  const { input, fieldErrors } = validateAssignInput(partial);
  if (fieldErrors) return { fieldErrors };

  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "conversaciones");
  if (denial) return { error: denial };

  const { error } = await supabase
    .from("conversations")
    .update({ assigned_to: input!.assigned_to })
    .eq("id", input!.conversation_id);
  if (error) return { error: `No se pudo asignar: ${error.message}` };

  revalidatePath("/studio/conversaciones");
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// markCaseAction
// ─────────────────────────────────────────────────────────────

export async function markCaseAction(
  _prev: ConversationActionState,
  formData: FormData,
): Promise<ConversationActionState> {
  const partial: Partial<MarkCaseInput> = {
    conversation_id: str(formData.get("conversation_id")) ?? undefined,
    is_case: str(formData.get("is_case")) === "true",
  };
  const { input, fieldErrors } = validateMarkCaseInput(partial);
  if (fieldErrors) return { fieldErrors };

  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "conversaciones");
  if (denial) return { error: denial };

  const { error } = await supabase
    .from("conversations")
    .update({ is_case: input!.is_case })
    .eq("id", input!.conversation_id);
  if (error) return { error: `No se pudo marcar el caso: ${error.message}` };

  revalidatePath("/studio/conversaciones");
  return { ok: true };
}
