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
