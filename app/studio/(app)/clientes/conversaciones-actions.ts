"use server";

/**
 * SDD-0650 F2 (D4) · «Unir este chat a la ficha» y «Quitar la unión», en la columna
 * de conversaciones de la ficha del cliente.
 *
 *  1. `moduleEditGate(supabase, "bandeja")` al tope: Admin y Comercial (Soporte es
 *     de solo lectura).
 *  1a. Además hay que VER Clientes (SDD-0676, `puedeVincularContacto`): unir y quitar ya
 *     no solo escriben la unión, también absorben y sueltan la tarjeta del CRM de esa
 *     ficha. Un desvío de rol (SDD-0252) o un acceso por persona (SDD-0622) puede dar la
 *     edición de la Bandeja sin Clientes; ese caso recibe el mismo «sin permiso».
 *  1b. Solo el tenant dueño de la cuenta de Chatwoot (`CHATWOOT_TENANT_ID`): la cuenta
 *     de servicio ve TODA la cuenta, así que otro tenant recibe el mismo texto que da
 *     `moduleEditGate` a un rol sin la Bandeja, antes de tocar Chatwoot o la base. El
 *     tenant de Chatwoot vive en el entorno del servidor, no en una tabla.
 *  2. Unir: el número de conversación se traduce a su contacto con la cuenta de
 *     servicio (D2). Del contacto solo se usa el id: el nombre y el teléfono que trae
 *     la respuesta no se guardan ni se devuelven.
 *  3. Escriben SOLO por las RPC de la 0554, que son de service_role (acotar por tenant
 *     en la base: ninguna sesión las llama directo por la API). El cliente de servicio
 *     se crea DESPUÉS de 1 y 1b, y la RPC recibe explícitos el tenant y el actor de la
 *     sesión; la base vuelve a comprobar que el actor tiene membresía activa en ese
 *     tenant y edita la Bandeja, que la ficha es de ese tenant y está viva, el motivo,
 *     y audita con el actor real.
 *
 * Sin la 0554 o sin la cuenta de servicio, dicen qué falta y no escriben nada.
 *
 * SDD-0676 · «Vincular otra red»: unir pasa por `vincularContacto`, que guarda el canal
 * del contacto y absorbe su tarjeta de lead (sin esa migración, une como la 0554). Al
 * quitar la unión de un contacto que NO es de WhatsApp se limpian su segmento y su
 * Shipping Mark en Chatwoot (SDD-0649): fuera de WhatsApp nadie más los corregiría.
 */
import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/db/admin";
import { createClient } from "@/lib/db/server";
import { canalDeChatwoot, esCanalUnion } from "@/lib/studio/chatwoot/canal-union";
import {
  chatwootAtributosContactoActivos,
  chatwootFichaConfigPara,
  chatwootRouterConfig,
} from "@/lib/studio/chatwoot/config";
import { ATRIBUTO_SEGMENTO, ATRIBUTO_SHIPPING_MARK, SIN_FICHA } from "@/lib/studio/chatwoot/contacto-erp";
import { escribirAtributosContacto, obtenerConversacionYContacto } from "@/lib/studio/chatwoot/router-api";
import { puedeVincularContacto, vincularContacto } from "@/lib/studio/chatwoot/vincular";
import { getStudioAccess, moduleEditGate } from "@/lib/studio/rbac-guard";

export type ResultadoUnion = { ok: true; mensaje: string } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIN_0554: ReadonlySet<string> = new Set(["PGRST202", "42883", "PGRST205", "42P01"]);

function errorDeLaBase(code: string | undefined): string {
  if (code && SIN_0554.has(code)) return "Falta la migración 0554: todavía no se pueden unir chats.";
  if (code === "23505") return "Ese chat ya está unido a otra ficha.";
  if (code === "P0002") return "La ficha no existe o fue borrada.";
  if (code === "42501") return SIN_PERMISO;
  if (code === "22023") return "Revisa el motivo: va de 4 a 1.000 caracteres.";
  if (code === "55000") return "El chat del portal es de la ficha de su cliente: no se desvincula ni se mueve.";
  return "No se pudo guardar. Intenta de nuevo.";
}

/**
 * El mismo texto que devuelve `moduleEditGate` (editDenial, `lib/studio/rbac-guard.ts`) y que
 * levanta la base con el 42501: un tenant ajeno no se distingue de un rol sin permiso. Lo
 * prueba `conversaciones-actions.test.ts` contra el guard real.
 */
const SIN_PERMISO = "No tienes permiso para realizar esta acción.";

type Sesion = Awaited<ReturnType<typeof createClient>>;

/**
 * El segundo candado de unir y quitar (el primero, `moduleEditGate`, va al tope): editar
 * la Bandeja, VER Clientes y ser del tenant dueño de la cuenta de Chatwoot. Es la misma
 * regla que usa «Vincular a cliente» en la Ficha DTD.
 */
async function puedeTocarUniones(supabase: Sesion): Promise<boolean> {
  const { role, tenantId, overrides, grants } = await getStudioAccess(supabase);
  return puedeVincularContacto({ role, tenantId, overrides, grants });
}

function motivoValido(motivo: unknown): string | null {
  const m = typeof motivo === "string" ? motivo.trim() : "";
  return m.length >= 4 && m.length <= 1000 ? m : null;
}

function rutaDeLaFicha(markbox: unknown): string | null {
  return typeof markbox === "string" && /^[A-Za-z0-9-]{1,40}$/.test(markbox) ? `/studio/clientes/${markbox}` : null;
}

export async function unirChatAction(
  clientId: string,
  markbox: string,
  conversacion: number,
  motivo: string,
): Promise<ResultadoUnion> {
  const supabase = await createClient();
  const gate = await moduleEditGate(supabase, "bandeja");
  if (!gate.ok) return { ok: false, error: gate.denied };
  if (!(await puedeTocarUniones(supabase))) return { ok: false, error: SIN_PERMISO };

  const m = motivoValido(motivo);
  if (!UUID.test(String(clientId))) return { ok: false, error: "Ficha inválida." };
  if (!Number.isSafeInteger(conversacion) || conversacion <= 0) return { ok: false, error: "Escribe el número de la conversación." };
  if (!m) return { ok: false, error: "Escribe el motivo (4 caracteres o más)." };

  const cfg = chatwootFichaConfigPara(gate.tenantId);
  if (!cfg) return { ok: false, error: "La lectura de Chatwoot no está configurada." };
  const r = await obtenerConversacionYContacto(cfg, conversacion);
  if (!r.ok) {
    return { ok: false, error: r.error === "no_encontrado" ? "No encontramos esa conversación en Chatwoot." : "Chatwoot no responde. Intenta de nuevo." };
  }
  const contactoId = r.data.contacto.contactoId;
  if (!contactoId) return { ok: false, error: "Esa conversación no tiene contacto." };

  const unido = await vincularContacto(createAdminClient(), {
    tenantId: gate.tenantId,
    actorId: gate.userId,
    clientId,
    contactoId,
    canal: canalDeChatwoot(r.data.contacto.canal),
    motivo: m,
    mover: false,
  });
  if (!unido.ok) return { ok: false, error: errorDeLaBase(unido.codigo) };

  const ruta = rutaDeLaFicha(markbox);
  if (ruta) revalidatePath(ruta);
  return { ok: true, mensaje: unido.resultado === "ya_estaba" ? "Ese chat ya estaba unido a esta ficha." : "Chat unido a la ficha." };
}

export async function quitarUnionAction(
  clientId: string,
  markbox: string,
  contactoId: number,
  motivo: string,
): Promise<ResultadoUnion> {
  const supabase = await createClient();
  const gate = await moduleEditGate(supabase, "bandeja");
  if (!gate.ok) return { ok: false, error: gate.denied };
  if (!(await puedeTocarUniones(supabase))) return { ok: false, error: SIN_PERMISO };

  const m = motivoValido(motivo);
  if (!UUID.test(String(clientId))) return { ok: false, error: "Ficha inválida." };
  if (!Number.isSafeInteger(contactoId) || contactoId <= 0) return { ok: false, error: "Contacto inválido." };
  if (!m) return { ok: false, error: "Escribe el motivo (4 caracteres o más)." };

  // SDD-0676: el canal se lee ANTES de quitar, con el cliente de sesión (RLS de la 0554).
  // Sin la columna (42703) o sin fila, no se sabe el canal y no se limpia nada.
  const { data: union } = await supabase
    .from("chatwoot_contact_links")
    .select("canal_chat")
    .eq("tenant_id", gate.tenantId)
    .eq("client_id", clientId)
    .eq("chatwoot_contact_id", contactoId)
    .maybeSingle<{ canal_chat: string | null }>();
  const canalGuardado = union?.canal_chat;
  const canal = esCanalUnion(canalGuardado) ? canalGuardado : null;

  const { data, error } = await createAdminClient().rpc("chatwoot_quitar_union", {
    p_tenant_id: gate.tenantId,
    p_actor_user_id: gate.userId,
    p_client_id: clientId,
    p_contact_id: contactoId,
    p_motivo: m,
  });
  if (error) return { ok: false, error: errorDeLaBase(error.code) };

  const ruta = rutaDeLaFicha(markbox);
  if (ruta) revalidatePath(ruta);
  if (data !== true) return { ok: false, error: "Esa unión ya no estaba." };
  await limpiarContactoDesvinculado(contactoId, canal);
  return { ok: true, mensaje: "Unión quitada." };
}

/**
 * SDD-0676 · Al quitar la unión de un contacto de Instagram, Messenger u otro canal que
 * no es WhatsApp, se le borran el segmento y el Shipping Mark que Studio le había puesto
 * en Chatwoot (SDD-0649). En WhatsApp no hace falta: `marcarContactoErp` lo corrige con
 * el siguiente mensaje. Mejor esfuerzo: si falla, la unión ya quedó quitada y solo se
 * anota el código (sin datos del contacto).
 */
async function limpiarContactoDesvinculado(contactoId: number, canal: string | null): Promise<void> {
  if (canal === null || canal === "whatsapp") return;
  if (!chatwootAtributosContactoActivos()) return;
  const cfg = chatwootRouterConfig();
  if (!cfg) return;
  const r = await escribirAtributosContacto(cfg, contactoId, {
    [ATRIBUTO_SEGMENTO]: SIN_FICHA.segmento,
    [ATRIBUTO_SHIPPING_MARK]: SIN_FICHA.shippingMark,
  });
  if (!r.ok) console.warn(`[ficha] limpiar atributos del contacto desvinculado: ${r.error}`);
}
