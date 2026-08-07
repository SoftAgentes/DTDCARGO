/**
 * Superadmin · la capa de plataforma (SDD-0250 · migr 0355).
 *
 * Un nivel POR ENCIMA de `admin`, ortogonal a los 7 roles del tenant. Guarda
 * las "llaves del sistema": lo que ni siquiera un director debería poder tocar.
 *
 * ⭐ EL CONTROL REAL VIVE EN LA BASE, NO ACÁ. La migración 0355 mete
 * `is_platform_admin()` dentro de `studio_set_user_disabled`,
 * `studio_change_user_role` y la policy de `feature_flags`. Esos RPC están
 * concedidos a `authenticated`, o sea que son invocables como endpoint desde
 * PostgREST — gatear sólo la server action dejaría el mismo hueco un nivel más
 * abajo, que es el error que SDD-0085 ya cometió una vez.
 *
 * Este módulo es para que la UI pueda DECIRLO: sin él, un admin que aprieta el
 * interruptor de un feature flag vería la RLS descartar su UPDATE en silencio y
 * no entendería por qué no pasó nada.
 *
 * POR QUÉ `platform_admins` Y NO UN ROL NUEVO: los 7 roles están fijados en
 * cinco lugares de la base (migr 0189), así que agregar `superadmin` al enum es
 * una migración con blast radius grande. La tabla ya existía desde la 0058 con
 * su RLS, su helper y la fila del founder — dormida, sin un solo lector.
 */

import type { createClient } from "@/lib/db/server";

type StudioClient = Awaited<ReturnType<typeof createClient>>;

/**
 * ¿El usuario de la sesión opera la plataforma?
 *
 * Va por la RPC `is_platform_admin()` (security definer, migr 0058) y no por un
 * SELECT a la tabla: `platform_admins` sólo deja leerse a quien ya está en
 * ella, así que un no-miembro recibiría cero filas — indistinguible de un error.
 *
 * Fail-closed: cualquier fallo devuelve false. Una llave del sistema que se
 * abre porque la red falló no es una llave.
 */
export async function isPlatformAdmin(supabase: StudioClient): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("is_platform_admin");
    if (error) return false;
    return data === true;
  } catch {
    return false;
  }
}

/**
 * Guard para server actions, mismo contrato que `moduleEditDenial`: devuelve el
 * mensaje de denegación o null.
 *
 *   const denial = await platformAdminDenial(supabase);
 *   if (denial) return { error: denial };
 */
export async function platformAdminDenial(
  supabase: StudioClient,
): Promise<string | null> {
  const ok = await isPlatformAdmin(supabase);
  if (ok) return null;
  return "Esta acción la reserva el superadministrador. Pídesela a quien administra el sistema.";
}
