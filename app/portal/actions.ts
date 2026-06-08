"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";

/**
 * Cierra la sesión del cliente del portal y vuelve al login.
 * Usado por el botón "Cerrar sesión" del header y por el login cuando hay una
 * sesión colgada sin vincular.
 */
export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/portal/login");
}

export type ChangePasswordState = { ok?: boolean; error?: string };

/**
 * Cambio de contraseña OPCIONAL desde "Mi cuenta" (SDD-0042 Fase 6 · slice 10.2).
 * No es forzado: la contraseña inicial (cédula/RIF) funciona indefinidamente.
 * Usa `auth.updateUser({ password })` sobre la sesión del cliente logueado.
 */
export async function changePortalPasswordAction(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) {
    return { error: "La contraseña nueva debe tener al menos 8 caracteres." };
  }
  if (password !== confirm) {
    return { error: "Las contraseñas no coinciden." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Tu sesión expiró. Vuelve a entrar." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: "No pudimos cambiar la contraseña. Probá de nuevo." };
  }
  return { ok: true };
}
