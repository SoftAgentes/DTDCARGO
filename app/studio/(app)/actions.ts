/**
 * Server actions globales del layout autenticado.
 *
 * signOut(): cierra la sesión Supabase y redirige al login.
 */

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/studio/login");
}
