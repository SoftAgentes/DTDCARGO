import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { listFeatureFlags } from "@/lib/studio/feature-flags-queries";
import { drainOperarioPushOutbox, enqueueUserPush } from "@/lib/studio/notify/operario-push-outbox";
import { clasificarContacto } from "./enrutar";
import type { ConversacionChatwoot, EventoChatwoot } from "./webhook-events";

/**
 * Procesamiento de un evento de Chatwoot ya verificado (SDD-0585, E2-D18 a D20, D25).
 *
 * 1. `chatwoot_registrar_evento` (0504) registra el evento (en «procesando») y
 *    aplica el estado en una transacción. Un duplicado real no sigue.
 * 2. Después corre la lista de manejadores: el aviso push y, desde E10
 *    (SDD-0586, 10.2 y 10.3), `clasificarContacto`, que etiqueta, asigna equipo
 *    y redirige al cliente. Ninguno toca la ruta.
 * 3. `chatwoot_cerrar_evento` lo cierra: «procesado» si todos salieron bien,
 *    «fallido» si alguno falló. Un fallido se vuelve a procesar en la próxima
 *    entrega (hallazgo de la revisión de Codex: cerrarlo antes perdía el
 *    reintento; en E10 dejaría a un cliente sin su redirección).
 *
 * Un manejador que falla no tumba los demás: se loguea el código, nunca el
 * payload, y la ruta responde 500.
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
  evento: Pick<EventoChatwoot, "clave" | "evento" | "mensajeId" | "avisar"> | null,
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
    p_message_id: evento?.mensajeId ?? null,
    p_avisar: evento?.avisar ?? false,
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
  // Sin `registro.nuevo` no se llega acá; la guarda queda por si se llama suelto.
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
  if (destinatarios.length > 0 && encolados === 0) {
    // Nadie recibió el aviso: que el evento quede fallido y se reintente.
    throw new Error("push no encolado");
  }
  if (encolados > 0) await drainOperarioPushOutbox(ctx.admin);
};

export const MANEJADORES: readonly ManejadorEvento[] = [avisarPorPush, clasificarContacto];

export async function procesarEventoChatwoot(
  ctx: ContextoChatwoot,
  evento: EventoChatwoot,
  manejadores: readonly ManejadorEvento[] = MANEJADORES,
): Promise<{ estado: "duplicado" | "procesado" | "fallido"; aplicado: boolean }> {
  const registro = await aplicarConversacion(ctx, evento.conversacion, evento);
  if (!registro.nuevo) return { estado: "duplicado", aplicado: false };
  const ok = await correrYCerrar(ctx, evento, registro, manejadores);
  return { estado: ok ? "procesado" : "fallido", aplicado: registro.aplicado };
}

/** Corre los manejadores y cierra el evento: procesado si todos salieron bien. */
async function correrYCerrar(
  ctx: ContextoChatwoot,
  evento: EventoChatwoot,
  registro: Registro,
  manejadores: readonly ManejadorEvento[],
): Promise<boolean> {
  let ok = true;
  for (const manejador of manejadores) {
    try {
      await manejador(ctx, evento, registro);
    } catch (e) {
      ok = false;
      console.warn(`[chatwoot] manejador ${manejador.name || "anónimo"} falló: ${e instanceof Error ? e.name : "error"}`);
    }
  }
  // Si el cierre mismo falla, el evento queda en «procesando» y la RPC lo
  // reclama pasados 5 minutos: nunca queda «procesado» sin haberlo sido.
  const { error } = await ctx.admin.rpc("chatwoot_cerrar_evento", {
    p_tenant_id: ctx.tenantId,
    p_event_key: evento.clave,
    p_ok: ok,
  });
  if (error) console.warn(`[chatwoot] chatwoot_cerrar_evento: ${error.code ?? "sin código"}`);
  return ok;
}

/** Fila de `chatwoot_tomar_pendientes` (0504): lo mínimo, sin payload. */
interface Pendiente {
  tenant_id: string;
  event_key: string;
  event: EventoChatwoot["evento"];
  conversation_id: number;
  message_id: number | null;
  avisar: boolean;
  assignee_id: number | null;
}

/**
 * Reintento propio de Studio (SDD-0585, E2-D26): Chatwoot 4.19.1 no reintenta
 * webhooks de cuenta, así que el cron `/api/cron/chatwoot-reintentos` toma los
 * eventos fallidos vencidos y los colgados, y vuelve a correr los manejadores
 * con lo que el evento guardó (ids, asignado y si avisa). La base cuenta los
 * intentos, espera 1, 2, 4 y 8 min y descarta al quinto. El estado de la
 * conversación no se toca acá: ya se aplicó al registrar, y lo corrige la
 * reconciliación. E10 reutiliza este camino para la redirección.
 */
export async function reprocesarEventosChatwoot(
  admin: SupabaseClient,
  manejadores: readonly ManejadorEvento[] = MANEJADORES,
  limite = 20,
): Promise<{ tomados: number; procesados: number; fallidos: number; omitido?: true }> {
  const { data, error } = await admin.rpc("chatwoot_tomar_pendientes", { p_limite: limite });
  if (error) {
    // Sin 0504 (o con la base caída) el cron no rompe: lo intenta en la próxima corrida.
    console.warn(`[chatwoot] chatwoot_tomar_pendientes: ${error.code ?? "sin código"}`);
    return { tomados: 0, procesados: 0, fallidos: 0, omitido: true };
  }
  const filas = (data ?? []) as Pendiente[];
  let procesados = 0;
  for (const f of filas) {
    const evento: EventoChatwoot = {
      evento: f.event,
      clave: f.event_key,
      accountId: 0,
      mensajeId: f.message_id,
      avisar: f.avisar,
      // Solo lo que los manejadores usan; el resto no se guardó a propósito.
      conversacion: {
        id: f.conversation_id,
        inboxId: null,
        estado: "open",
        noLeidos: 0,
        asignadoId: f.assignee_id,
        ultimaActividad: null,
        fuenteActualizada: 0,
        telefonoUltimos10: null,
      },
    };
    const ok = await correrYCerrar({ admin, tenantId: f.tenant_id }, evento, { nuevo: true, aplicado: false, clientId: null }, manejadores);
    if (ok) procesados += 1;
  }
  return { tomados: filas.length, procesados, fallidos: filas.length - procesados };
}
