/**
 * Server actions de la zona interna.
 *
 * signOut(): cierra la sesión del equipo y vuelve al login del Studio. La sesión
 * de Supabase es compartida con el Studio (mismo cookie), así que cerrar acá
 * cierra también el ERP — comportamiento esperado.
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
