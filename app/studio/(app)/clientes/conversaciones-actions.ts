"use server";

/**
 * SDD-0650 F2 (D4) · «Unir este chat a la ficha» y «Quitar la unión», en la columna
 * de conversaciones de la ficha del cliente.
 *
 *  1. `moduleEditDenial(supabase, "bandeja")` al tope: Admin y Comercial (Soporte es
 *     de solo lectura). La RPC lo repite con `user_has_module('bandeja', true)`.
 *  2. Unir: el número de conversación se traduce a su contacto con la cuenta de
 *     servicio (D2). Del contacto solo se usa el id: el nombre y el teléfono que trae
 *     la respuesta no se guardan ni se devuelven.
 *  3. Escriben SOLO por las RPC de la 0554, con el cliente de SESIÓN: tenant, ficha
 *     viva, motivo y auditoría los pone la base.
 *
 * Sin la 0554 o sin la cuenta de servicio, dicen qué falta y no escriben nada.
 */
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/db/server";
import { chatwootFichaConfig } from "@/lib/studio/chatwoot/config";
import { obtenerConversacionYContacto } from "@/lib/studio/chatwoot/router-api";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";

export type ResultadoUnion = { ok: true; mensaje: string } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIN_0554: ReadonlySet<string> = new Set(["PGRST202", "42883", "PGRST205", "42P01"]);

function errorDeLaBase(code: string | undefined): string {
  if (code && SIN_0554.has(code)) return "Falta la migración 0554: todavía no se pueden unir chats.";
  if (code === "23505") return "Ese chat ya está unido a otra ficha.";
  if (code === "P0002") return "La ficha no existe o fue borrada.";
  if (code === "42501") return "No tienes permiso para unir chats.";
  if (code === "22023") return "Revisa el motivo: va de 4 a 1.000 caracteres.";
  return "No se pudo guardar. Intenta de nuevo.";
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
  const denegado = await moduleEditDenial(supabase, "bandeja");
  if (denegado) return { ok: false, error: denegado };

  const m = motivoValido(motivo);
  if (!UUID.test(String(clientId))) return { ok: false, error: "Ficha inválida." };
  if (!Number.isSafeInteger(conversacion) || conversacion <= 0) return { ok: false, error: "Escribe el número de la conversación." };
  if (!m) return { ok: false, error: "Escribe el motivo (4 caracteres o más)." };

  const cfg = chatwootFichaConfig();
  if (!cfg) return { ok: false, error: "La lectura de Chatwoot no está configurada." };
  const r = await obtenerConversacionYContacto(cfg, conversacion);
  if (!r.ok) {
    return { ok: false, error: r.error === "no_encontrado" ? "No encontramos esa conversación en Chatwoot." : "Chatwoot no responde. Intenta de nuevo." };
  }
  const contactoId = r.data.contacto.contactoId;
  if (!contactoId) return { ok: false, error: "Esa conversación no tiene contacto." };

  const { data, error } = await supabase.rpc("chatwoot_unir_contacto_manual", {
    p_client_id: clientId,
    p_contact_id: contactoId,
    p_motivo: m,
  });
  if (error) return { ok: false, error: errorDeLaBase(error.code) };

  const ruta = rutaDeLaFicha(markbox);
  if (ruta) revalidatePath(ruta);
  return { ok: true, mensaje: data === "ya_estaba" ? "Ese chat ya estaba unido a esta ficha." : "Chat unido a la ficha." };
}

export async function quitarUnionAction(
  clientId: string,
  markbox: string,
  contactoId: number,
  motivo: string,
): Promise<ResultadoUnion> {
  const supabase = await createClient();
  const denegado = await moduleEditDenial(supabase, "bandeja");
  if (denegado) return { ok: false, error: denegado };

  const m = motivoValido(motivo);
  if (!UUID.test(String(clientId))) return { ok: false, error: "Ficha inválida." };
  if (!Number.isSafeInteger(contactoId) || contactoId <= 0) return { ok: false, error: "Contacto inválido." };
  if (!m) return { ok: false, error: "Escribe el motivo (4 caracteres o más)." };

  const { data, error } = await supabase.rpc("chatwoot_quitar_union", {
    p_client_id: clientId,
    p_contact_id: contactoId,
    p_motivo: m,
  });
  if (error) return { ok: false, error: errorDeLaBase(error.code) };

  const ruta = rutaDeLaFicha(markbox);
  if (ruta) revalidatePath(ruta);
  return data === true ? { ok: true, mensaje: "Unión quitada." } : { ok: false, error: "Esa unión ya no estaba." };
}
