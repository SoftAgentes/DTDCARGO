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
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import { createAdminClient } from "@/lib/db/admin";
import { insertOutboundMessage } from "@/lib/studio/conversaciones/messages-queries";
import { sendEmail } from "@/lib/studio/mail/send-email";
import {
  validateAssignInput,
  validateMarkCaseInput,
  validateSendReplyInput,
  validateSetStatusInput,
  type AssignInput,
  type ConversationActionState,
  type ConversationStatus,
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

  const inserted = await insertOutboundMessage(supabase, {
    tenantId,
    conversationId: input!.conversation_id,
    body: input!.body,
    authorName: agent.name,
    authorUserId: agent.userId,
  });
  if (!inserted.ok) return { error: `No se pudo enviar: ${inserted.error}` };

  // Si el cliente tiene email → sale por Resend (best-effort, no rompe el reply).
  let emailSent = false;
  const { data: client } = await supabase
    .from("clients")
    .select("name, email")
    .eq("id", conv.client_id)
    .maybeSingle<{ name: string; email: string | null }>();

  if (client?.email) {
    try {
      // Threading (SDD-0056 Fase 2): si el hilo nació de un email entrante, su
      // external_ref guarda el Message-ID RFC del primer email del cliente
      // (`<...>`). Lo referenciamos con In-Reply-To/References para que la
      // respuesta del agente caiga en el mismo hilo de la casilla del cliente.
      // Solo lo usamos si es un Message-ID con forma RFC válida; si es null o no
      // empieza con `<` (dato viejo/sucio) → no seteamos headers (un valor
      // incorrecto rompe el agrupamiento en Gmail/Outlook).
      const rfcRef = conv.external_ref?.trim();
      const threadHeaders =
        conv.channel === "email" && rfcRef && rfcRef.startsWith("<") && rfcRef.endsWith(">")
          ? { "In-Reply-To": rfcRef, References: rfcRef }
          : undefined;

      const result = await sendEmail(createAdminClient(), tenantId, {
        to: client.email,
        to_name: client.name,
        subject: `DTD Cargo · respuesta de tu asesor`,
        html: replyEmailHtml(client.name, input!.body, agent.name),
        metadata: { source: "conversaciones", conversation_id: conv.id },
        headers: threadHeaders,
      });
      emailSent = result.ok;
    } catch {
      emailSent = false;
    }
  }

  revalidatePath("/studio/conversaciones");
  return { ok: true, emailSent };
}

/** HTML mínimo del email de respuesta (sin template — html crudo). */
function replyEmailHtml(clientName: string, body: string, agentName: string): string {
  const safe = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return [
    `<p>Hola ${safe(clientName)},</p>`,
    `<p>${safe(body).replace(/\n/g, "<br>")}</p>`,
    `<p style="color:#6B6B6B;font-size:13px;margin-top:24px">— ${safe(agentName)}, DTD Cargo</p>`,
  ].join("");
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
