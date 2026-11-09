"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { pedirEnvioPortal } from "@/lib/studio/chatwoot/portal";
import { notifyConversationInbound } from "@/lib/studio/conversation-inbound-notify";
import { readClientRequestId } from "@/lib/shared/client-request";

/**
 * Canal Portal de Conversaciones (SDD-0056 · Fase 1).
 *
 * El cliente del portal manda un mensaje. Delega TODO en la RPC SECURITY DEFINER
 * `portal_post_message`: resuelve su identidad (get_portal_client_id), crea/reusa
 * el hilo cliente×canal='portal' e inserta el mensaje inbound. La action es fina
 * (sin lógica de negocio); la defensa vive en la DB.
 *
 * SDD-0148: tras el post, avisa al equipo (best-effort) para que responda — el
 * chat no sirve si nadie se entera de que el cliente escribió.
 *
 * SDD-0586 (10.5, E10-D34): y pide el envío del hilo a Chatwoot, sin esperarlo
 * (`after()`). El mensaje ya quedó guardado: si Chatwoot no responde, lo manda el
 * cron. Con el flag `chatwoot_portal` apagado o sin configuración, no hace nada.
 */

export type PortalMessageState = {
  ok?: boolean;
  error?: string;
  /** El mensaje ya había llegado: un reintento del mismo envío (SDD-0599). */
  replayed?: boolean;
};

async function postMessage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  body: string,
  requestId: string | null,
): Promise<{ failed: boolean; conversationId: unknown; replayed: boolean }> {
  if (requestId) {
    const { data, error } = await supabase.rpc("portal_post_message", {
      p_body: body,
      p_request_id: requestId,
    });
    // Sin 0512 la firma nueva no existe: se envía como siempre, sin candado.
    if (error?.code !== "PGRST202") {
      const result = data as { conversation_id?: unknown; replayed?: unknown } | null;
      return { failed: !!error, conversationId: result?.conversation_id, replayed: result?.replayed === true };
    }
  }
  const { data, error } = await supabase.rpc("portal_post_message", { p_body: body });
  return { failed: !!error, conversationId: data, replayed: false };
}

export async function sendPortalMessageAction(
  _prev: PortalMessageState,
  formData: FormData,
): Promise<PortalMessageState> {
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Escribe tu mensaje antes de enviar." };
  if (body.length > 4000) {
    return { error: "El mensaje es muy largo (máximo 4000 caracteres)." };
  }

  const supabase = await createClient();
  const { failed, conversationId, replayed } = await postMessage(
    supabase,
    body,
    readClientRequestId(formData),
  );

  if (failed) {
    return { error: "No pudimos enviar tu mensaje. Prueba de nuevo." };
  }

  // Aviso al equipo (SDD-0148) — best-effort, con service_role. Nunca rompe el
  // envío: notifyConversationInbound ya atrapa sus errores. Un reintento no avisa
  // otra vez.
  if (!replayed && typeof conversationId === "string") {
    await notifyConversationInbound(createAdminClient(), {
      conversationId,
      body,
    });
  }

  // La cola no duplica: un reintento también lo pide, por si el primero no llegó.
  if (typeof conversationId === "string") {
    try {
      pedirEnvioPortal(conversationId);
    } catch {
      // El mensaje del cliente nunca falla por Chatwoot (E10-D24).
    }
  }

  revalidatePath("/portal/soporte");
  return replayed ? { ok: true, replayed } : { ok: true };
}
