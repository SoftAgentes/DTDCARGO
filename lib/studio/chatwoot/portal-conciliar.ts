import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { listFeatureFlags } from "@/lib/studio/feature-flags-queries";
import { chatwootPortalConfig, type ChatwootPortalConfig } from "./config";
import {
  esRespuestaDelEquipo,
  escribirRespuestaPortal,
  estadoDelHilo,
  interpretarMensajePortal,
  type MensajePortal,
} from "./portal-manejadores";
import { obtenerConversacion, paginaMensajes } from "./router-api";
import { aplicarConversacion } from "./webhook-procesar";

/**
 * La conciliación del portal (SDD-0586, paso 10.5, 1c-2: E10-D40, punto 5).
 *
 * Si se pierde un webhook, una respuesta del equipo en la bandeja del portal no llega al cliente, o
 * el estado del hilo queda viejo. El cron `chatwoot-reintentos` corre esto cada 5 min, con un tope de
 * hilos por corrida (`chatwoot_portal_por_conciliar`, 0521: los vivos no resueltos sin ventana y los
 * resueltos con actividad en 7 días, primero los menos recientes en conciliarse). Por hilo:
 *
 *   1. Relee la conversación de Chatwoot y la aplica al espejo (`aplicarConversacion`, la misma RPC
 *      del webhook, que descarta lo viejo). Después, el estado del hilo (`estadoDelHilo`).
 *   2. Pagina los mensajes hacia atrás (`?before=`) hasta pasar la marca de agua
 *      `conciliado_hasta`, o hasta el principio si es nula, con un tope de páginas. No para en el
 *      primer saliente conocido: una pérdida salteada (se pierde el 10, llega el 11, se pierde el 12)
 *      dejaría fuera el 10. Lo juntado se escribe en orden ascendente por el mismo camino que el
 *      webhook (`escribirRespuestaPortal`), que es idempotente por `chatwoot:<id>`.
 *   3. Si pasó la marca (o llegó al principio), la sube al mensaje más nuevo revisado y marca la hora
 *      (`chatwoot_portal_marcar_conciliado`). Si lo cortó el tope, `faltan_paginas`: escribió lo que
 *      juntó, pero no mueve la marca ni marca el hilo, que vuelve primero en la próxima corrida.
 *
 * Un hilo que falla no frena los demás: se cuenta y se loguea solo el código. Con el flag apagado o
 * sin `chatwootPortalConfig()`, no hace nada.
 */

export const TOPE_HILOS = 20;
export const TOPE_PAGINAS = 5;

export interface ResultadoConciliar {
  hilos: number;
  /** Respuestas del equipo que se escribieron en el portal (insertadas). */
  traidas: number;
  completos: number;
  faltanPaginas: number;
  fallidos: number;
  omitido?: "sin_configurar" | "apagado" | "sin_migracion" | "error";
}

interface Pendiente {
  conversation_id: string;
  chatwoot_conversation_id: number;
  conciliado_hasta: number | null;
}

const VACIO: ResultadoConciliar = { hilos: 0, traidas: 0, completos: 0, faltanPaginas: 0, fallidos: 0 };

/** Un hilo: el estado, los mensajes que falten y la marca. */
export async function conciliarHilo(
  admin: SupabaseClient,
  cfg: ChatwootPortalConfig,
  hilo: Pendiente,
  topePaginas = TOPE_PAGINAS,
): Promise<{ traidas: number; completo: boolean }> {
  const conversacionId = hilo.chatwoot_conversation_id;

  // 1. El estado: el espejo primero (puede haberse perdido el evento), después el hilo.
  const c = await obtenerConversacion(cfg, conversacionId);
  if (!c.ok) throw new Error(`conversacion_${c.error}`);
  await aplicarConversacion({ admin, tenantId: cfg.tenantId }, c.data, null);
  await estadoDelHilo(admin, cfg.tenantId, conversacionId);

  // 2. Los mensajes, hacia atrás hasta pasar la marca.
  const marca = hilo.conciliado_hasta;
  const juntados = new Map<number, MensajePortal>();
  let masNuevo: number | null = null;
  let antes: number | null = null;
  let completo = false;
  for (let pagina = 0; pagina < topePaginas; pagina += 1) {
    const r = await paginaMensajes(cfg, conversacionId, antes);
    if (!r.ok) throw new Error(`mensajes_${r.error}`);
    const mensajes = r.data.map(interpretarMensajePortal).filter((m): m is MensajePortal => m !== null);
    // Página vacía: el principio de la conversación.
    if (mensajes.length === 0) {
      completo = true;
      break;
    }
    let minimo = mensajes[0].id;
    for (const m of mensajes) {
      if (masNuevo === null || m.id > masNuevo) masNuevo = m.id;
      if (m.id < minimo) minimo = m.id;
      if (marca === null || m.id > marca) juntados.set(m.id, m);
    }
    if (marca !== null && minimo <= marca) {
      completo = true;
      break;
    }
    // Chatwoot no avanzó con `before`: no hay cómo seguir.
    if (antes !== null && minimo >= antes) throw new Error("mensajes_sin_avance");
    antes = minimo;
  }

  // Lo juntado, en orden ascendente, por el mismo camino que el webhook.
  let traidas = 0;
  for (const m of [...juntados.values()].sort((a, b) => a.id - b.id)) {
    if (!esRespuestaDelEquipo(m, cfg.inboxPortalId)) continue;
    if ((await escribirRespuestaPortal(admin, cfg, conversacionId, m)) === "insertado") traidas += 1;
  }

  // 3. La marca, solo si se llegó.
  if (completo) {
    const { error } = await admin.rpc("chatwoot_portal_marcar_conciliado", {
      p_tenant_id: cfg.tenantId,
      p_conversation_id: hilo.conversation_id,
      p_hasta: masNuevo,
    });
    if (error) throw new Error(`chatwoot_portal_marcar_conciliado: ${error.code ?? "sin código"}`);
  }
  return { traidas, completo };
}

export async function conciliarPortal(admin: SupabaseClient, topeHilos = TOPE_HILOS): Promise<ResultadoConciliar> {
  const cfg = chatwootPortalConfig();
  if (!cfg) return { ...VACIO, omitido: "sin_configurar" };
  const flags = await listFeatureFlags(admin, cfg.tenantId);
  if (!flags.chatwoot_portal) return { ...VACIO, omitido: "apagado" };

  const { data, error } = await admin.rpc("chatwoot_portal_por_conciliar", {
    p_tenant_id: cfg.tenantId,
    p_limite: topeHilos,
  });
  if (error) {
    // Sin la 0521 (PGRST202) no hay a quién conciliar: se aplica antes de fusionar.
    if (error.code === "PGRST202") return { ...VACIO, omitido: "sin_migracion" };
    console.warn(`[chatwoot-portal] chatwoot_portal_por_conciliar: ${error.code ?? "sin código"}`);
    return { ...VACIO, omitido: "error" };
  }

  const r: ResultadoConciliar = { ...VACIO };
  for (const hilo of (data ?? []) as Pendiente[]) {
    r.hilos += 1;
    try {
      const h = await conciliarHilo(admin, cfg, hilo);
      r.traidas += h.traidas;
      if (h.completo) r.completos += 1;
      else r.faltanPaginas += 1;
    } catch (e) {
      r.fallidos += 1;
      console.warn(`[chatwoot-portal] conciliar un hilo falló: ${e instanceof Error ? e.message.slice(0, 60) : "error"}`);
    }
  }
  return r;
}
