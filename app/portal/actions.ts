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
  redirect("/entrar");
}

// El cambio de contraseña del portal se eliminó (decisión founder 2026-07-03):
// el acceso es SOLO por magic link (signInWithOtp) — no hay contraseña que
// cambiar. La versión histórica vive en SDD-0042 Fase 6 (git).
