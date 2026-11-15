/**
 * Superadmin · la capa de plataforma (SDD-0250 · migr 0355).
 *
 * Un nivel POR ENCIMA de `admin`, ortogonal a los 7 roles del tenant. Guarda
 * las "llaves del sistema": lo que ni siquiera un director debería poder tocar.
 *
 * EL CONTROL VIVE EN LA BASE para usuarios: la 0355 mete `is_platform_admin()`
 * dentro de `studio_set_user_disabled` y `studio_change_user_role` (DEFINER,
 * invocables por PostgREST). ⚠️ Para los feature flags NO: la escritura va por
 * `audit_d1_execute` (0289:632-650), que solo exige admin del tenant y escribe
 * como dueño, así que la policy de `feature_flags` (0355) no la alcanza y el
 * bloqueo efectivo es `platformAdminDenial` en la server action (SDD-0633,
 * FUERA DE ALCANCE: va en otra PR).
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
  return (await platformAdminCheck(supabase)) === "si";
}

/**
 * Lo mismo, sin aplanar el fallo: «no» es la respuesta de la base; «error» es
 * que no se pudo preguntar (red, o la RPC negada, como el 403 que dejó la 0211
 * hasta la 0542 · SDD-0633). Los dos niegan, pero solo se le puede decir «no
 * eres superadministrador» a quien la base contestó que no.
 */
export async function platformAdminCheck(
  supabase: StudioClient,
): Promise<"si" | "no" | "error"> {
  try {
    const { data, error } = await supabase.rpc("is_platform_admin");
    if (error) return "error";
    return data === true ? "si" : "no";
  } catch {
    return "error";
  }
}

/** La denegación de una llave del sistema, para quien la base dijo que no. */
export const SUPERADMIN_DENIAL =
  "No eres superadministrador. Esta acción la reserva el superadministrador: pídesela a quien administra el sistema.";

/** No se pudo comprobar el permiso: fail-closed, pero sin acusar a nadie. */
export const SUPERADMIN_CHECK_FAILED =
  "No pudimos comprobar si eres superadministrador, así que no se hizo el cambio. Intenta de nuevo; si sigue pasando, avísale a quien administra el sistema.";

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
  const check = await platformAdminCheck(supabase);
  if (check === "si") return null;
  return check === "no" ? SUPERADMIN_DENIAL : SUPERADMIN_CHECK_FAILED;
}
