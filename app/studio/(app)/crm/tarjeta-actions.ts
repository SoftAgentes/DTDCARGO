"use server";

/**
 * Verbos sobre la tarjeta del CRM propio (SDD-0587 · paso 6.3).
 *
 * A diferencia de `actions.ts`, que encola órdenes a Kommo, aquí Studio es el
 * maestro: se escribe directo en las tablas de la 0506 con la sesión del
 * usuario, y la RLS vuelve a exigir admin o commercial del tenant.
 *
 * Dos candados, a propósito (SDD-0497): el del módulo (`kommo`, con sus
 * desvíos por rol) y el rol de la RLS (`rolUsaCrm`). Un permiso extra por
 * usuario no abre las tablas (§14.1 del contrato), así que la pantalla tiene
 * que decir que no antes de que lo diga la base con un error crudo.
 *
 * La etapa nunca se escribe con UPDATE: no tiene GRANT. Solo cambia por
 * `crm_mover_etapa`, que deja historial y fija `etapa_*_manual_at` (gana el
 * manual posterior frente a un movimiento automático, §5.3).
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import {
  getStudioAccess,
  moduleEditGate,
  moduleViewDenial,
} from "@/lib/studio/rbac-guard";
import { listTenantAdvisors } from "@/lib/studio/user-queries";
import { esTablero, rolUsaCrm, type CrmTablero } from "@/lib/studio/crm-tablero";
import type { CrmFichaTarjeta } from "@/lib/studio/crm-ficha";

/** Mismo contrato que `VerbResult` de `actions.ts` y que `ActionButton`. */
type Resultado = { ok?: true; error?: string };

const SIN_ROL = "Tu rol no usa el CRM propio. Lo usan administración y comercial.";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

type Sesion = Awaited<ReturnType<typeof createClient>>;

async function puertaEdicion(
  supabase: Sesion,
): Promise<{ tenantId: string; userId: string } | { error: string }> {
  const gate = await moduleEditGate(supabase, "kommo");
  if (!gate.ok) return { error: gate.denied };
  if (!rolUsaCrm(gate.role)) return { error: SIN_ROL };
  return { tenantId: gate.tenantId, userId: gate.userId };
}

async function puertaLectura(
  supabase: Sesion,
): Promise<{ tenantId: string } | { error: string }> {
  const denial = await moduleViewDenial(supabase, "kommo");
  if (denial) return { error: denial };
  const access = await getStudioAccess(supabase);
  if (!rolUsaCrm(access.role) || !access.tenantId) return { error: SIN_ROL };
  return { tenantId: access.tenantId };
}

/** Traduce los errores de las RPC de la 0506 a algo que el asesor entienda. */
function errorDeMovimiento(err: { code?: string; message?: string }): string {
  const msg = err.message ?? "";
  if (err.code === "42501") return SIN_ROL;
  if (msg.includes("pide motivo")) return "Para cerrar la tarjeta en esa etapa escribe el motivo.";
  if (msg.includes("etapa inexistente")) return "Esa etapa ya no existe o está apagada.";
  if (msg.includes("tarjeta inexistente")) return "Esa tarjeta ya no existe.";
  return "No se pudo mover la tarjeta. Intenta de nuevo.";
}

/**
 * Mueve una tarjeta de etapa dentro de un tablero. `movida: false` = ya estaba
 * ahí (la RPC no deja historial en ese caso).
 */
export async function moverTarjetaAction(
  tarjetaId: string,
  tablero: CrmTablero,
  etapa: string,
  motivo?: string | null,
): Promise<{ ok: true; movida: boolean } | { error: string }> {
  if (!UUID_RE.test(tarjetaId)) return { error: "Tarjeta inválida." };
  if (!esTablero(tablero)) return { error: "Tablero inválido." };
  if (!/^[a-z][a-z0-9_]{1,39}$/.test(etapa)) return { error: "Etapa inválida." };
  const m = (motivo ?? "").trim();
  if (m.length > 200) return { error: "El motivo admite hasta 200 caracteres." };

  const supabase = await createClient();
  const who = await puertaEdicion(supabase);
  if ("error" in who) return who;

  const { data, error } = await supabase.rpc("crm_mover_etapa", {
    p_tarjeta_id: tarjetaId,
    p_tablero: tablero,
    p_etapa: etapa,
    p_motivo: m || null,
  });
  if (error) return { error: errorDeMovimiento(error) };

  revalidatePath("/studio/crm");
  return { ok: true, movida: data === true };
}

/** Nombre legible de cada miembro activo del tenant (admin y commercial primero). */
async function nombresDelEquipo(tenantId: string): Promise<{
  porId: Map<string, string>;
  asesores: { userId: string; nombre: string }[];
}> {
  const miembros = await listTenantAdvisors(createAdminClient(), tenantId);
  const porId = new Map<string, string>();
  const asesores: { userId: string; nombre: string }[] = [];
  for (const m of miembros) {
    const nombre = m.name ?? "Sin nombre en el perfil";
    porId.set(m.userId, nombre);
    if (rolUsaCrm(m.role)) asesores.push({ userId: m.userId, nombre });
  }
  return { porId, asesores };
}

/**
 * Lee la ficha de una tarjeta: historial, tareas, notas, fuente y los dos
 * asesores (D9): el dueño de la tarjeta (Studio) y quien contesta el chat
 * (Chatwoot, solo lectura).
 */
export async function cargarFichaTarjetaAction(
  tarjetaId: string,
): Promise<{ ok: true; ficha: CrmFichaTarjeta } | { error: string }> {
  if (!UUID_RE.test(tarjetaId)) return { error: "Tarjeta inválida." };
  const supabase = await createClient();
  const who = await puertaLectura(supabase);
  if ("error" in who) return who;

  const { data: t, error } = await supabase
    .from("crm_tarjetas")
    .select(
      "id, client_id, nombre_visible, etapa_leads, etapa_clientes, motivo_perdida, asesor_id, fuente, fuente_detalle, utm_source, utm_medium, utm_campaign, utm_content, utm_term, created_at, ultima_actividad_at, anonimizada_at",
    )
    .eq("id", tarjetaId)
    .maybeSingle<{
      id: string;
      client_id: string | null;
      nombre_visible: string | null;
      etapa_leads: string;
      etapa_clientes: string;
      motivo_perdida: string | null;
      asesor_id: string | null;
      fuente: string;
      fuente_detalle: string | null;
      utm_source: string | null;
      utm_medium: string | null;
      utm_campaign: string | null;
      utm_content: string | null;
      utm_term: string | null;
      created_at: string;
      ultima_actividad_at: string;
      anonimizada_at: string | null;
    }>();
  if (error) return { error: "No se pudo leer la tarjeta." };
  if (!t || t.anonimizada_at) return { error: "Esa tarjeta ya no existe." };

  const [ficha, historial, tareas, notas, equipo] = await Promise.all([
    t.client_id
      ? supabase
          .from("clients")
          .select("name, markbox, deleted_at")
          .eq("id", t.client_id)
          .maybeSingle<{ name: string | null; markbox: string | null; deleted_at: string | null }>()
      : Promise.resolve({ data: null }),
    supabase
      .from("crm_historial_etapas")
      .select("id, tablero, de, a, origen, actor_id, motivo, ocurrio_at")
      .eq("tarjeta_id", tarjetaId)
      .order("ocurrio_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(200),
    supabase
      .from("crm_tareas")
      .select("id, texto, vence_at, asignado_a, completada_at, origen, created_at")
      .eq("tarjeta_id", tarjetaId)
      .order("completada_at", { ascending: true, nullsFirst: true })
      .order("vence_at", { ascending: true, nullsFirst: false })
      .limit(100),
    supabase
      .from("crm_notas")
      .select("id, texto, autor_id, created_at")
      .eq("tarjeta_id", tarjetaId)
      .order("created_at", { ascending: false })
      .limit(100),
    nombresDelEquipo(who.tenantId),
  ]);
  if (ficha.data?.deleted_at) return { error: "La ficha de esta tarjeta está borrada." };

  // Quién contesta el chat (D9): el asignado de la conversación más reciente de
  // la ficha en Chatwoot. Se lee, no se escribe: lo cambia Chatwoot. Si la
  // tabla de E2 no está (0504 sin aplicar) o no hay conversación, no se pinta.
  let chat: CrmFichaTarjeta["chat"] = null;
  if (t.client_id) {
    const conv = await supabase
      .from("chatwoot_conversations")
      .select("status, assignee_id, last_activity_at")
      .eq("client_id", t.client_id)
      .order("last_activity_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle<{ status: string; assignee_id: number | null; last_activity_at: string | null }>();
    if (!conv.error && conv.data) {
      let asignado: string | null = null;
      if (conv.data.assignee_id != null) {
        // La RLS de los vínculos solo deja ver el propio al no admin: el
        // nombre se resuelve con la llave de servicio, acotado al tenant.
        const link = await createAdminClient()
          .from("chatwoot_agent_links")
          .select("user_id")
          .eq("tenant_id", who.tenantId)
          .eq("chatwoot_user_id", conv.data.assignee_id)
          .maybeSingle<{ user_id: string }>();
        asignado = link.data ? (equipo.porId.get(link.data.user_id) ?? null) : null;
      }
      chat = {
        estado: conv.data.status,
        asignado,
        sinVincular: conv.data.assignee_id != null && asignado == null,
        ultimaActividadAt: conv.data.last_activity_at,
      };
    }
  }

  const nombre = (id: string | null) => (id ? (equipo.porId.get(id) ?? "Usuario sin nombre") : null);

  return {
    ok: true,
    ficha: {
      id: t.id,
      nombre: ficha.data?.name?.trim() || t.nombre_visible?.trim() || null,
      shippingMark: ficha.data?.markbox?.trim() || null,
      conFicha: t.client_id != null,
      etapaLeads: t.etapa_leads,
      etapaClientes: t.etapa_clientes,
      motivoPerdida: t.motivo_perdida,
      fuente: t.fuente,
      fuenteDetalle: t.fuente_detalle,
      utm: {
        source: t.utm_source,
        medium: t.utm_medium,
        campaign: t.utm_campaign,
        content: t.utm_content,
        term: t.utm_term,
      },
      creadaAt: t.created_at,
      ultimaActividadAt: t.ultima_actividad_at,
      dueno: { id: t.asesor_id, nombre: nombre(t.asesor_id) },
      asesores: equipo.asesores,
      chat,
      historial: ((historial.data ?? []) as {
        id: number;
        tablero: string;
        de: string | null;
        a: string;
        origen: string;
        actor_id: string | null;
        motivo: string | null;
        ocurrio_at: string;
      }[]).map((h) => ({
        id: h.id,
        tablero: esTablero(h.tablero) ? h.tablero : "leads",
        de: h.de,
        a: h.a,
        origen: h.origen,
        actor: nombre(h.actor_id),
        motivo: h.motivo,
        ocurrioAt: h.ocurrio_at,
      })),
      tareas: ((tareas.data ?? []) as {
        id: string;
        texto: string;
        vence_at: string | null;
        asignado_a: string | null;
        completada_at: string | null;
        origen: string;
      }[]).map((k) => ({
        id: k.id,
        texto: k.texto,
        venceAt: k.vence_at,
        asignado: nombre(k.asignado_a),
        completadaAt: k.completada_at,
        origen: k.origen,
      })),
      notas: ((notas.data ?? []) as {
        id: string;
        texto: string;
        autor_id: string | null;
        created_at: string;
      }[]).map((n) => ({
        id: n.id,
        texto: n.texto,
        autor: nombre(n.autor_id),
        creadaAt: n.created_at,
      })),
    },
  };
}

/** Agrega una nota a la tarjeta. Las notas solo se agregan (0506). */
export async function agregarNotaTarjetaAction(
  tarjetaId: string,
  texto: string,
): Promise<Resultado> {
  if (!UUID_RE.test(tarjetaId)) return { error: "Tarjeta inválida." };
  const limpio = (texto ?? "").trim();
  if (!limpio) return { error: "Escribe la nota." };
  if (limpio.length > 4000) return { error: "La nota admite hasta 4.000 caracteres." };

  const supabase = await createClient();
  const who = await puertaEdicion(supabase);
  if ("error" in who) return who;

  const { error } = await supabase.from("crm_notas").insert({
    tenant_id: who.tenantId,
    tarjeta_id: tarjetaId,
    texto: limpio,
    autor_id: who.userId,
  });
  if (error) return { error: "No se pudo guardar la nota." };
  revalidatePath("/studio/crm");
  return { ok: true };
}

/**
 * Crea una tarea. `vence` es YYYY-MM-DD y vence a las 9:00 de Caracas (UTC−4),
 * como las tareas del drawer de Kommo.
 */
export async function agregarTareaTarjetaAction(
  tarjetaId: string,
  texto: string,
  vence: string | null,
  asignadoA: string | null,
): Promise<Resultado> {
  if (!UUID_RE.test(tarjetaId)) return { error: "Tarjeta inválida." };
  const limpio = (texto ?? "").trim();
  if (!limpio) return { error: "Escribe la tarea." };
  if (limpio.length > 1000) return { error: "La tarea admite hasta 1.000 caracteres." };
  if (vence != null && !FECHA_RE.test(vence)) return { error: "Fecha de vencimiento inválida." };
  if (asignadoA != null && !UUID_RE.test(asignadoA)) return { error: "Responsable inválido." };

  const supabase = await createClient();
  const who = await puertaEdicion(supabase);
  if ("error" in who) return who;

  const { error } = await supabase.from("crm_tareas").insert({
    tenant_id: who.tenantId,
    tarjeta_id: tarjetaId,
    texto: limpio,
    vence_at: vence ? `${vence}T13:00:00.000Z` : null,
    asignado_a: asignadoA,
    created_by: who.userId,
  });
  if (error) return { error: "No se pudo crear la tarea." };
  revalidatePath("/studio/crm");
  return { ok: true };
}

/** Marca una tarea como hecha. */
export async function completarTareaTarjetaAction(tareaId: string): Promise<Resultado> {
  if (!UUID_RE.test(tareaId)) return { error: "Tarea inválida." };
  const supabase = await createClient();
  const who = await puertaEdicion(supabase);
  if ("error" in who) return who;

  const { data, error } = await supabase
    .from("crm_tareas")
    .update({ completada_at: new Date().toISOString() })
    .eq("id", tareaId)
    .is("completada_at", null)
    .select("id");
  if (error) return { error: "No se pudo marcar la tarea." };
  if (!data || data.length === 0) return { error: "Esa tarea ya estaba hecha o no existe." };
  revalidatePath("/studio/crm");
  return { ok: true };
}

/**
 * Cambia el dueño de la tarjeta (D9). No toca el asignado del chat: ese se
 * cambia en Chatwoot y Studio no lo pisa.
 */
export async function cambiarDuenoTarjetaAction(
  tarjetaId: string,
  asesorId: string | null,
): Promise<Resultado> {
  if (!UUID_RE.test(tarjetaId)) return { error: "Tarjeta inválida." };
  if (asesorId != null && !UUID_RE.test(asesorId)) return { error: "Asesor inválido." };

  const supabase = await createClient();
  const who = await puertaEdicion(supabase);
  if ("error" in who) return who;

  const { data, error } = await supabase
    .from("crm_tarjetas")
    .update({ asesor_id: asesorId })
    .eq("id", tarjetaId)
    .select("id");
  if (error) {
    return {
      error: error.message?.includes("no es del tenant")
        ? "Ese asesor no pertenece a tu equipo."
        : "No se pudo cambiar el dueño.",
    };
  }
  if (!data || data.length === 0) return { error: "Esa tarjeta ya no existe." };
  revalidatePath("/studio/crm");
  return { ok: true };
}
