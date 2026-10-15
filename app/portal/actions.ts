"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { markMyPortalAvisosSeen } from "@/lib/portal/portal-avisos-queries";

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

/**
 * SDD-0526 · La campana abrió la bandeja: marca como vistos los avisos hasta la
 * fecha del más nuevo que mostró. Va con la sesión del cliente; la RPC deriva el
 * vínculo de `auth.uid()` y no acepta a quién marcar.
 */
export async function markPortalAvisosSeenAction(
  hasta: string,
): Promise<{ ok: boolean }> {
  if (typeof hasta !== "string") return { ok: false };
  const supabase = await createClient();
  return { ok: await markMyPortalAvisosSeen(supabase, hasta) };
}

// El cambio de contraseña del portal se eliminó (decisión founder 2026-07-03):
// el acceso es SOLO por magic link (signInWithOtp) — no hay contraseña que
// cambiar. La versión histórica vive en SDD-0042 Fase 6 (git).
