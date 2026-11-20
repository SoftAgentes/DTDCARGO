"use server";

/**
 * SDD-0676 · «Vincular a cliente», desde la Ficha DTD (la pestaña de Studio dentro de
 * cada conversación de Chatwoot).
 *
 *  - `buscarClientesParaVincular`: busca fichas por Shipping Mark, nombre o teléfono.
 *    Devuelve lo mínimo para reconocer a la persona: código, nombre y los últimos
 *    4 dígitos del teléfono (decisión 4 de Sam). Tope de 8 y mínimo de 3 caracteres.
 *  - `vincularContactoDeConversacion`: une el contacto de ESTA conversación con la
 *    ficha elegida. El contacto no viene del navegador: sale de Chatwoot, leyendo la
 *    conversación con el token del propio agente (si Chatwoot no se la muestra, no
 *    se vincula nada).
 *
 * Candados, en este orden y antes de leer nada (los dos):
 *   1. `moduleEditGate(supabase, "bandeja")`: Admin y Comercial (decisión 1 de Sam).
 *   2. El módulo encendido, el módulo Clientes y el tenant dueño de la cuenta de
 *      Chatwoot (`CHATWOOT_TENANT_ID`).
 * Vincular suma: el agente del contexto es el de esta sesión, y Chatwoot le muestra
 * la conversación. Escribe SOLO por la RPC `chatwoot_vincular_contacto` (service_role),
 * que vuelve a comprobar al actor, el tenant y la ficha, y audita en `entity_audit_log`.
 *
 * Nunca se registra un nombre, un teléfono ni un Shipping Mark: solo códigos de error.
 */
import { createAdminClient } from "@/lib/db/admin";
import { createClient } from "@/lib/db/server";
import { obtenerConversacion } from "@/lib/studio/chatwoot/account-api";
import { canalDeChatwoot, telefonoFinal } from "@/lib/studio/chatwoot/canal-union";
import { isUuid, parseChatwootUserId } from "@/lib/studio/chatwoot/chatwoot-types";
import { chatwootConfig } from "@/lib/studio/chatwoot/config";
import { getVinculoPropio } from "@/lib/studio/chatwoot/links-queries";
import { obtenerTokenAgente } from "@/lib/studio/chatwoot/platform-api";
import { puedeVincularContacto, vincularContacto } from "@/lib/studio/chatwoot/vincular";
import { listClients } from "@/lib/studio/client-queries";
import { listFeatureFlags } from "@/lib/studio/feature-flags-queries";
import { isModuleEnabled } from "@/lib/studio/feature-flags-types";
import { getStudioAccess, moduleEditGate } from "@/lib/studio/rbac-guard";

/** El cliente los traduce con `bandeja.vincular.error.<código>`. */
export type VincularError =
  | "denied"
  | "invalid"
  | "unconfigured"
  | "unlinked"
  | "otro_agente"
  | "sin_acceso"
  | "sin_contacto"
  | "sin_migracion"
  | "ficha_inexistente"
  | "otra_ficha"
  | "del_portal"
  | "motivo"
  | "service";

export interface ClienteParaVincular {
  id: string;
  markbox: string;
  nombre: string;
  /** Últimos 4 dígitos del teléfono de la ficha, o null si no tiene. */
  telefonoFinal: string | null;
  /** SDD-0664 · Shipping Mark anterior por el que apareció, si fue por eso. */
  codigoAnterior: string | null;
}

export type BusquedaVincular = { ok: true; clientes: ClienteParaVincular[] } | { ok: false; error: VincularError };

export type VinculoResult =
  | { ok: true; resultado: "unido" | "ya_estaba" | "movido"; tarjetaAbsorbida: boolean }
  /** `otra`: la ficha a la que el chat ya está unido, para que el agente decida si lo mueve. */
  | { ok: false; error: VincularError; otra?: { markbox: string; nombre: string } | null };

const MIN_BUSQUEDA = 3;
const TOPE_BUSQUEDA = 8;

const idDeContexto = (v: unknown): number | null => (typeof v === "number" ? parseChatwootUserId(v) : null);

type Sesion = Awaited<ReturnType<typeof createClient>>;

/**
 * El segundo candado, común a buscar y vincular (el primero, `moduleEditGate`, va al
 * tope de cada acción): módulo encendido, módulo Clientes y tenant de Chatwoot.
 */
async function puedeSeguir(supabase: Sesion): Promise<boolean> {
  if (!isModuleEnabled("bandeja", await listFeatureFlags(supabase))) return false;
  const { role, tenantId, overrides, grants } = await getStudioAccess(supabase);
  return puedeVincularContacto({ role, tenantId, overrides, grants });
}

export async function buscarClientesParaVincular(q: unknown): Promise<BusquedaVincular> {
  const supabase = await createClient();
  const gate = await moduleEditGate(supabase, "bandeja");
  if (!gate.ok) return { ok: false, error: "denied" };
  if (!(await puedeSeguir(supabase))) return { ok: false, error: "denied" };

  const termino = typeof q === "string" ? q.trim().slice(0, 80) : "";
  if (termino.length < MIN_BUSQUEDA) return { ok: true, clientes: [] };

  try {
    // Con el cliente de SESIÓN: la RLS de `clients` acota al tenant, y `listClients`
    // saca las fichas borradas.
    const filas = await listClients(supabase, { q: termino, limite: TOPE_BUSQUEDA });
    return {
      ok: true,
      clientes: filas.slice(0, TOPE_BUSQUEDA).map((c) => ({
        id: c.id,
        markbox: c.markbox,
        nombre: c.name,
        telefonoFinal: telefonoFinal(c.phone),
        codigoAnterior: (c as { codigo_anterior?: string | null }).codigo_anterior ?? null,
      })),
    };
  } catch (e) {
    console.warn(`[vincular] búsqueda: ${(e as { code?: string }).code ?? "sin código"}`);
    return { ok: false, error: "service" };
  }
}

function errorDeLaBase(codigo: string | undefined): VincularError {
  if (codigo === "42501") return "denied";
  if (codigo === "23505") return "otra_ficha";
  if (codigo === "P0002") return "ficha_inexistente";
  if (codigo === "22023") return "motivo";
  if (codigo === "55000") return "del_portal";
  return "service";
}

export async function vincularContactoDeConversacion(
  conversacionId: unknown,
  agenteId: unknown,
  clientId: unknown,
  opciones?: { mover?: boolean; motivo?: string },
): Promise<VinculoResult> {
  const supabase = await createClient();
  const gate = await moduleEditGate(supabase, "bandeja");
  if (!gate.ok) return { ok: false, error: "denied" };
  if (!(await puedeSeguir(supabase))) return { ok: false, error: "denied" };

  const conversacion = idDeContexto(conversacionId);
  const agente = idDeContexto(agenteId);
  if (conversacion === null || agente === null || typeof clientId !== "string" || !isUuid(clientId)) {
    return { ok: false, error: "invalid" };
  }
  const mover = opciones?.mover === true;
  // Decisión 5 de Sam: el motivo es automático. Solo «Mover aquí» pide uno escrito (decisión 2).
  const escrito = typeof opciones?.motivo === "string" ? opciones.motivo.trim() : "";
  if (mover && (escrito.length < 4 || escrito.length > 1000)) return { ok: false, error: "motivo" };
  const motivo = mover ? escrito : `Vinculado desde la conversación ${conversacion}`;

  const cfg = chatwootConfig();
  if (!cfg) return { ok: false, error: "unconfigured" };
  // El agente del contexto tiene que ser el de ESTA sesión (igual que la Ficha DTD, E2-D30).
  const vinculo = await getVinculoPropio(supabase, gate.tenantId, gate.userId);
  if (!vinculo) return { ok: false, error: "unlinked" };
  if (vinculo.chatwoot_user_id !== agente) return { ok: false, error: "otro_agente" };

  // Chatwoot decide si ese agente ve esa conversación; de ahí sale el contacto.
  const token = await obtenerTokenAgente(vinculo.chatwoot_user_id, cfg);
  if (!token.ok) {
    console.warn(`[vincular] token del agente no disponible: ${token.error}`);
    return { ok: false, error: "service" };
  }
  const leida = await obtenerConversacion(cfg, token.data, conversacion);
  if (!leida.ok) {
    if (leida.error === "no_autorizado" || leida.error === "no_encontrado") return { ok: false, error: "sin_acceso" };
    console.warn(`[vincular] conversación no disponible: ${leida.error}`);
    return { ok: false, error: "service" };
  }
  const contactoId = leida.data.contactoId;
  if (!contactoId) return { ok: false, error: "sin_contacto" };

  const r = await vincularContacto(createAdminClient(), {
    tenantId: gate.tenantId,
    actorId: gate.userId,
    clientId,
    contactoId,
    canal: canalDeChatwoot(leida.data.canal),
    motivo,
    mover,
  });
  if (r.ok) return r;
  if (r.sinMigracion) return { ok: false, error: "sin_migracion" };

  const error = errorDeLaBase(r.codigo);
  if (error !== "otra_ficha") {
    if (error === "service") console.warn(`[vincular] chatwoot_vincular_contacto: ${r.codigo ?? "sin código"}`);
    return { ok: false, error };
  }
  return { ok: false, error, otra: await fichaActualDelContacto(supabase, gate.tenantId, contactoId) };
}

/**
 * A qué ficha está unido hoy ese contacto, con el cliente de SESIÓN: la RLS de la 0554
 * (Bandeja y tenant) y la de `clients` deciden si esta persona la puede ver. Si no la ve
 * (o es de otro tenant), `null`: se avisa que está unido, sin decir a quién.
 */
async function fichaActualDelContacto(
  supabase: Sesion,
  tenantId: string,
  contactoId: number,
): Promise<{ markbox: string; nombre: string } | null> {
  const { data: union } = await supabase
    .from("chatwoot_contact_links")
    .select("client_id")
    .eq("tenant_id", tenantId)
    .eq("chatwoot_contact_id", contactoId)
    .maybeSingle<{ client_id: string }>();
  if (!union?.client_id) return null;
  const { data: ficha } = await supabase
    .from("clients")
    .select("markbox, name, deleted_at")
    .eq("tenant_id", tenantId)
    .eq("id", union.client_id)
    .maybeSingle<{ markbox: string; name: string | null; deleted_at: string | null }>();
  if (!ficha || ficha.deleted_at) return null;
  return { markbox: ficha.markbox, nombre: ficha.name?.trim() ?? "" };
}
