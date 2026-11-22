import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { canAccessModule, canEditModule, type RoleModuleOverrides, type UserModuleGrants } from "@/lib/studio/rbac";
import type { StudioUserRole } from "@/lib/studio/user-types";

import type { CanalUnion } from "./canal-union";
import { chatwootTenantId } from "./config";

/**
 * SDD-0676 · «Vincular a cliente»: lo que comparten la Ficha DTD (dentro de Chatwoot)
 * y la ficha del cliente en Studio.
 *
 * Quién vincula (decisión 1 de Sam, 2026-11-18): quien EDITA la Bandeja (Admin y
 * Comercial; Soporte solo ve), ve Clientes y es del tenant dueño de la cuenta de
 * Chatwoot. La base repite la comprobación del actor en `chatwoot_vincular_contacto`.
 */

export interface AccesoVincular {
  role: StudioUserRole | null;
  tenantId: string | null;
  overrides?: RoleModuleOverrides;
  grants?: UserModuleGrants;
}

/** ¿La sesión es del tenant dueño de la cuenta de Chatwoot? Sin `CHATWOOT_TENANT_ID`, no. */
export function esElTenantDeChatwoot(tenantSesion: string | null | undefined): boolean {
  const dueño = chatwootTenantId();
  return !!tenantSesion && dueño !== null && dueño.toLowerCase() === tenantSesion.toLowerCase();
}

export function puedeVincularContacto(a: AccesoVincular): boolean {
  return (
    canEditModule(a.role, "bandeja", a.overrides, a.grants) &&
    canAccessModule(a.role, "clients", a.overrides, a.grants) &&
    esElTenantDeChatwoot(a.tenantId)
  );
}

/** Función que todavía no existe: la migración de la SDD-0676 (o la 0554) sin aplicar. */
const SIN_FUNCION: ReadonlySet<string> = new Set(["PGRST202", "42883"]);

export type ResultadoVincular =
  | { ok: true; resultado: "unido" | "ya_estaba" | "movido"; tarjetaAbsorbida: boolean }
  | { ok: false; codigo: string | undefined; sinMigracion: boolean };

/**
 * Une el contacto con la ficha por la RPC de la SDD-0676 (canal y absorción de la tarjeta
 * del lead). `admin` es el cliente de SERVICIO y se crea DESPUÉS del candado del llamador:
 * la RPC recibe explícitos el tenant y el actor, y los vuelve a comprobar.
 *
 * Sin esa migración (PGRST202 o 42883) y sin `mover`, cae en la unión de la 0554
 * (`chatwoot_unir_contacto_manual`): une igual, sin canal ni absorción. «Mover» no
 * tiene equivalente en la 0554 y responde `sinMigracion`.
 */
export async function vincularContacto(
  admin: SupabaseClient,
  args: {
    tenantId: string;
    actorId: string;
    clientId: string;
    contactoId: number;
    canal: CanalUnion | null;
    motivo: string;
    mover: boolean;
  },
): Promise<ResultadoVincular> {
  const { data, error } = await admin.rpc("chatwoot_vincular_contacto", {
    p_tenant_id: args.tenantId,
    p_actor_user_id: args.actorId,
    p_client_id: args.clientId,
    p_contact_id: args.contactoId,
    p_canal: args.canal,
    p_motivo: args.motivo,
    p_mover: args.mover,
  });
  if (!error) {
    const r = (data ?? {}) as { resultado?: unknown; tarjeta_absorbida?: unknown };
    const resultado = r.resultado === "ya_estaba" || r.resultado === "movido" ? r.resultado : "unido";
    return { ok: true, resultado, tarjetaAbsorbida: r.tarjeta_absorbida === true };
  }
  if (!SIN_FUNCION.has(error.code ?? "")) return { ok: false, codigo: error.code, sinMigracion: false };
  if (args.mover) return { ok: false, codigo: error.code, sinMigracion: true };

  const anterior = await admin.rpc("chatwoot_unir_contacto_manual", {
    p_tenant_id: args.tenantId,
    p_actor_user_id: args.actorId,
    p_client_id: args.clientId,
    p_contact_id: args.contactoId,
    p_motivo: args.motivo,
  });
  if (anterior.error) {
    return { ok: false, codigo: anterior.error.code, sinMigracion: SIN_FUNCION.has(anterior.error.code ?? "") };
  }
  return { ok: true, resultado: anterior.data === "ya_estaba" ? "ya_estaba" : "unido", tarjetaAbsorbida: false };
}
