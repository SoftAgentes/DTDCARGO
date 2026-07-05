"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { notifyConversationInbound } from "@/lib/studio/conversation-inbound-notify";

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
 */

export type PortalMessageState = { ok?: boolean; error?: string };

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
  const { data: conversationId, error } = await supabase.rpc(
    "portal_post_message",
    { p_body: body },
  );

  if (error) {
    return { error: "No pudimos enviar tu mensaje. Prueba de nuevo." };
  }

  // Aviso al equipo (SDD-0148) — best-effort, con service_role. Nunca rompe el
  // envío: notifyConversationInbound ya atrapa sus errores.
  if (typeof conversationId === "string") {
    await notifyConversationInbound(createAdminClient(), {
      conversationId,
      body,
    });
  }

  revalidatePath("/portal/soporte");
  return { ok: true };
}
