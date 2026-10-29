/**
 * Server actions globales del layout autenticado.
 *
 * signOut(): cierra la sesión Supabase y redirige al login. También borra la
 * marca del SSO de la Bandeja (SDD-0585, E2-D13): el próximo ingreso a Studio
 * pide un SSO nuevo, que reemplaza la sesión del panel de Chatwoot en este
 * navegador. La Platform API no revoca sesiones; el cierre del panel en sí
 * queda para el paso 2.7.
 */

"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { SSO_COOKIE, SSO_COOKIE_OPTIONS } from "@/lib/studio/chatwoot/sso-cookie";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  (await cookies()).delete({ name: SSO_COOKIE, path: SSO_COOKIE_OPTIONS.path });
  revalidatePath("/", "layout");
  redirect("/studio/login");
}
