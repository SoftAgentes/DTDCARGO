"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";

/**
 * Cierra sesión y redirige a /back/login.
 * Server action invocada desde el botón "Cerrar sesión" del sidebar.
 */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/back/login");
}
