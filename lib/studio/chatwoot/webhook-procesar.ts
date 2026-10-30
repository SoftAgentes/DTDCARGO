import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { listFeatureFlags } from "@/lib/studio/feature-flags-queries";
import { drainOperarioPushOutbox, enqueueUserPush } from "@/lib/studio/notify/operario-push-outbox";
import type { ConversacionChatwoot, EventoChatwoot } from "./webhook-events";

/**
 * Procesamiento de un evento de Chatwoot ya verificado (SDD-0585, E2-D18 a D20, D25).
 *
 * 1. `chatwoot_registrar_evento` (0504) registra el evento y aplica el estado en
 *    una transacción. Un duplicado no sigue.
 * 2. Después corre la lista de manejadores. Hoy hay uno: el aviso push. E10
 *    (10.2 `clasificar`) agrega el suyo a `MANEJADORES` sin tocar la ruta.
 *
 * Un manejador que falla no tumba los demás ni el registro: se loguea el código,
 * nunca el payload.
 */

export interface Registro {
  nuevo: boolean;
  aplicado: boolean;
  clientId: string | null;
}

export interface ContextoChatwoot {
  admin: SupabaseClient;
  tenantId: string;
}

export type ManejadorEvento = (ctx: ContextoChatwoot, evento: EventoChatwoot, registro: Registro) => Promise<void>;

/** Llama la RPC. `clave` nula = reconciliación (no deja evento). Lanza si la base falla. */
export async function aplicarConversacion(
  ctx: ContextoChatwoot,
  conversacion: ConversacionChatwoot,
  evento: { clave: string; evento: EventoChatwoot["evento"] } | null,
): Promise<Registro> {
  const { data, error } = await ctx.admin.rpc("chatwoot_registrar_evento", {
    p_tenant_id: ctx.tenantId,
    p_event_key: evento?.clave ?? null,
    p_event: evento?.evento ?? null,
    p_conversation_id: conversacion.id,
    p_inbox_id: conversacion.inboxId,
    p_status: conversacion.estado,
    p_unread_count: conversacion.noLeidos,
    p_assignee_id: conversacion.asignadoId,
    p_phone_last10: conversacion.telefonoUltimos10,
    p_last_activity_at: conversacion.ultimaActividad,
    p_source_updated_at: conversacion.fuenteActualizada,
  });
  if (error) throw new Error(`chatwoot_registrar_evento: ${error.code ?? "sin código"}`);
  const fila = (Array.isArray(data) ? data[0] : data) as
    | { nuevo?: boolean; aplicado?: boolean; client_id?: string | null }
    | null;
  return { nuevo: fila?.nuevo === true, aplicado: fila?.aplicado === true, clientId: fila?.client_id ?? null };
}

/**
 * Aviso push de mensaje entrante (E2-D20). Al usuario vinculado al agente
 * asignado; sin asignado (o asignado sin vínculo), a todos los vinculados. Sin
 * datos personales en el cuerpo: solo el número de conversación.
 */
export const avisarPorPush: ManejadorEvento = async (ctx, evento, registro) => {
  if (!evento.avisar || !registro.nuevo) return;
  const flags = await listFeatureFlags(ctx.admin, ctx.tenantId);
  if (!flags.chatwoot_inbox) return;

  const { data } = await ctx.admin
    .from("chatwoot_agent_links")
    .select("user_id, chatwoot_user_id")
    .eq("tenant_id", ctx.tenantId);
  const vinculos = (data ?? []) as { user_id: string; chatwoot_user_id: number }[];
  const asignado = vinculos.filter((v) => v.chatwoot_user_id === evento.conversacion.asignadoId);
  const destinatarios = asignado.length > 0 ? asignado : vinculos;

  const n = evento.conversacion.id;
  let encolados = 0;
  for (const v of destinatarios) {
    const id = await enqueueUserPush(ctx.admin, ctx.tenantId, v.user_id, {
      title: "Bandeja · mensaje nuevo",
      body: `Tienes un mensaje nuevo en la conversación #${n}.`,
      url: `/studio/bandeja?c=${n}`,
      tag: `chatwoot-conversacion-${n}`,
    });
    if (id) encolados += 1;
  }
  if (encolados > 0) await drainOperarioPushOutbox(ctx.admin);
};

export const MANEJADORES: readonly ManejadorEvento[] = [avisarPorPush];

export async function procesarEventoChatwoot(
  ctx: ContextoChatwoot,
  evento: EventoChatwoot,
  manejadores: readonly ManejadorEvento[] = MANEJADORES,
): Promise<{ estado: "duplicado" | "procesado"; aplicado: boolean }> {
  const registro = await aplicarConversacion(ctx, evento.conversacion, evento);
  if (!registro.nuevo) return { estado: "duplicado", aplicado: false };
  for (const manejador of manejadores) {
    try {
      await manejador(ctx, evento, registro);
    } catch (e) {
      console.warn(`[chatwoot] manejador ${manejador.name || "anónimo"} falló: ${e instanceof Error ? e.name : "error"}`);
    }
  }
  return { estado: "procesado", aplicado: registro.aplicado };
}
