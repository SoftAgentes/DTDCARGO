/**
 * Helpers de autenticación para el Studio.
 *
 * `getUser()` devuelve el user autenticado o null.
 * Usar en server components y route handlers para verificar sesión.
 *
 * Nota: usamos getUser() (no getSession()) porque getUser() valida el JWT
 * contra el servidor Supabase, mientras que getSession() solo lee la cookie
 * — esto último puede ser engañado por una cookie spoofeada del cliente.
 *
 * Referencia: https://supabase.com/docs/guides/auth/server-side/nextjs
 */

import { createClient } from "@/lib/db/server";
import type { User } from "@supabase/supabase-js";

export async function getUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

/**
 * Devuelve el tenant_id del usuario actual via la helper SQL get_user_tenant_id().
 * null si no está autenticado o si no tiene tenant asignado.
 */
export async function getUserTenantId(): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_user_tenant_id");
  if (error || !data) return null;
  return data as string;
}
