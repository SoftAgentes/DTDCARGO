/**
 * Server actions globales del layout autenticado.
 *
 * signOut(): cierra la sesión Supabase y redirige al login. También borra la
 * marca del SSO de la Bandeja (SDD-0585, E2-D13): el próximo ingreso a Studio
 * pide un SSO nuevo. Si había marca (la Bandeja se abrió en este navegador),
 * pasa antes por `/studio/cerrar-chat` (paso 2.7), que cierra la sesión del
 * panel de Chatwoot en este navegador y sigue al login.
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
  const almacen = await cookies();
  const habiaChat = Boolean(almacen.get(SSO_COOKIE)?.value);
  almacen.delete({ name: SSO_COOKIE, path: SSO_COOKIE_OPTIONS.path });
  revalidatePath("/", "layout");
  redirect(habiaChat ? "/studio/cerrar-chat" : "/studio/login");
}
