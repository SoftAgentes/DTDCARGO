/**
 * Datos de «Agentes vinculados» (SDD-0585, E2-D10 y paso 2.5) para Usuarios ›
 * Bandeja (SDD-0655). Es la misma lectura que hacía `bandeja/page.tsx` para el
 * admin, mudada sin cambios de lógica: vínculos del tenant, miembros sin
 * vínculo (con si ven la Bandeja) y la salud de la cuenta de Chatwoot.
 *
 * SDD-0680: también los agentes de la cuenta de Chatwoot con nombre, correo y
 * rol, para elegir el agente por nombre en vez de escribir su número. La lista
 * de miembros de la cuenta (la misma que usa la salud) solo trae id y rol; el
 * nombre y el correo salen de leer cada agente por la Platform API, de solo
 * lectura. Si Chatwoot no responde, `agentes` es `null` y la pantalla ofrece
 * escribir el número a mano.
 *
 * Solo admin: devuelve `null` a cualquier otro rol, sin tenant o sin la
 * Bandeja configurada. La lista de miembros va con el cliente admin (la RLS de
 * `user_tenants` deja ver una sola fila con la sesión), filtrada por el tenant
 * del admin, como antes.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { StudioAccess } from "@/lib/studio/rbac-guard";
import { canAccessModule } from "@/lib/studio/rbac";
import { getTenantGrantsByUser } from "@/lib/studio/user-module-grants-queries";
import { chatwootConfig, chatwootServicioUserId } from "./config";
import { listarMiembrosCuenta, obtenerAgente, type RolCuenta } from "./platform-api";
import { evaluarSalud, type SaludBandeja } from "./agentes-salud";
import { revisarWebhookCuenta, sumarAlertasWebhook } from "./webhook-salud";
import { listVinculos } from "./links-queries";
import { miembrosDeBandeja } from "./bandeja-miembros";

/** SDD-0680: un agente de la cuenta de Chatwoot, para mostrarlo por nombre. */
export interface AgenteCuenta {
  id: number;
  nombre: string;
  correo: string;
  rol: RolCuenta;
}

export interface VinculoFila {
  userId: string;
  nombre: string;
  chatwootUserId: number;
  /** SDD-0680: el agente vinculado, si Chatwoot respondió; si no, solo el número. */
  agente?: AgenteCuenta | null;
}

export interface MiembroOpcion {
  userId: string;
  nombre: string;
  /** Paso 2.5: solo quien ve la Bandeja se puede dar de alta. Sin dato, se ofrece. */
  puedeBandeja?: boolean;
  /** SDD-0680: para poner primero el agente con el mismo correo. */
  correo?: string;
}

export interface AgentesBandejaDatos {
  vinculos: VinculoFila[];
  miembros: MiembroOpcion[];
  salud: SaludBandeja;
  /** SDD-0680: agentes de la cuenta (sin el de servicio); `null` si Chatwoot no respondió. */
  agentes: AgenteCuenta[] | null;
  /** SDD-0680: `false` si algún agente no se pudo leer; la pantalla ofrece también el número. */
  agentesCompletos: boolean;
}

/** Tope de agentes que se leen uno por uno; con más, la pantalla pide el número a mano. */
export const MAX_AGENTES_LEIDOS = 60;
/** Lecturas a la Platform API a la vez: no se abren 60 conexiones de golpe contra Chatwoot. */
export const LECTURAS_EN_PARALELO = 5;

/** La lista de agentes y si quedó completa. */
export interface ListaAgentes {
  agentes: AgenteCuenta[];
  completa: boolean;
}

/** Corre `fn` sobre cada elemento con a lo sumo `n` en vuelo; conserva el orden. */
export async function enLotes<T, R>(items: readonly T[], n: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const salida: R[] = new Array(items.length);
  let siguiente = 0;
  const trabajador = async () => {
    while (siguiente < items.length) {
      const i = siguiente++;
      salida[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, trabajador));
  return salida;
}

/**
 * Lee nombre y correo de cada miembro de la cuenta (sin el de servicio), de a
 * `LECTURAS_EN_PARALELO`. Un agente que no se pudo leer queda fuera y la lista
 * se marca incompleta; si no se pudo leer ninguno, hay más del tope o la cuenta
 * no respondió, devuelve `null`.
 */
export async function agentesDeCuenta(
  cuenta: Awaited<ReturnType<typeof listarMiembrosCuenta>>,
  servicioId: number | null,
  cfg: NonNullable<ReturnType<typeof chatwootConfig>>,
): Promise<ListaAgentes | null> {
  if (!cuenta.ok) return null;
  const miembros = cuenta.data.filter((m) => m.userId !== servicioId);
  if (miembros.length === 0) return { agentes: [], completa: true };
  if (miembros.length > MAX_AGENTES_LEIDOS) return null;
  const leidos = await enLotes(miembros, LECTURAS_EN_PARALELO, async (m): Promise<AgenteCuenta | null> => {
    const r = await obtenerAgente(m.userId, cfg);
    return r.ok ? { id: m.userId, nombre: r.data.name, correo: r.data.email, rol: m.rol } : null;
  });
  const agentes = leidos.filter((a): a is AgenteCuenta => a !== null);
  if (agentes.length === 0) return null;
  return { agentes, completa: agentes.length === miembros.length };
}

function nombreDe(profile: { first_name: string | null; last_name: string | null } | null): string {
  return `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim();
}

export async function cargarAgentesBandeja(
  supabase: SupabaseClient,
  access: Pick<StudioAccess, "role" | "tenantId" | "overrides">,
  crearClienteAdmin: () => SupabaseClient,
): Promise<AgentesBandejaDatos | null> {
  const cfg = chatwootConfig();
  if (access.role !== "admin" || !access.tenantId || !cfg) return null;
  const tenantId = access.tenantId;

  const [vinculos, miembros, cuenta, webhook, accesos] = await Promise.all([
    listVinculos(supabase, tenantId),
    miembrosDeBandeja(access, crearClienteAdmin),
    listarMiembrosCuenta(cfg),
    revisarWebhookCuenta(cfg, chatwootServicioUserId()),
    // SDD-0675: el acceso adicional de Bandeja también deja darla de alta.
    getTenantGrantsByUser(crearClienteAdmin(), tenantId),
  ]);
  // Paso 2.5: la misma salud que mide el cron diario, leída al abrir la página.
  const salud = evaluarSalud({
    miembrosCuenta: cuenta,
    servicioId: chatwootServicioUserId(),
    vinculos: vinculos.map((v) => ({ userId: v.user_id, chatwootUserId: v.chatwoot_user_id })),
  });
  // SDD-0586 (10.5, PR 1b): el webhook de cuenta, por donde llegan las respuestas al portal.
  sumarAlertasWebhook(salud, webhook);
  const lista = await agentesDeCuenta(cuenta, chatwootServicioUserId(), cfg);
  const porId = new Map((lista?.agentes ?? []).map((a) => [a.id, a]));

  const nombres = new Map(miembros.map((m) => [m.user_id, nombreDe(m.profile)]));
  return {
    vinculos: vinculos.map((v) => ({
      userId: v.user_id,
      nombre: nombres.get(v.user_id) || v.user_id.slice(0, 8),
      chatwootUserId: v.chatwoot_user_id,
      agente: porId.get(v.chatwoot_user_id) ?? null,
    })),
    miembros: miembros
      .filter((m) => !vinculos.some((v) => v.user_id === m.user_id))
      .map((m) => ({
        userId: m.user_id,
        nombre: nombreDe(m.profile) || m.user_id.slice(0, 8),
        puedeBandeja: canAccessModule(m.role, "bandeja", access.overrides, accesos.get(m.user_id)),
        correo: m.email,
      })),
    salud,
    agentes: lista?.agentes ?? null,
    agentesCompletos: lista?.completa ?? false,
  };
}
