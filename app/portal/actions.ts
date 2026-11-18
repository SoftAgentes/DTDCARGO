"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { markMyPortalAvisosSeen } from "@/lib/portal/portal-avisos-queries";
import {
  esPortalVista,
  isPortalVistaSimpleEnabled,
  markMyPortalGuiaVista,
  setMyPortalVista,
  type PortalVista,
} from "@/lib/portal/vista-preferida";

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

/**
 * SDD-0654 · El selector de la barra cambió la vista («Vista simple» o «Vista
 * Pro»). Con el interruptor apagado no hace nada. Va con la sesión del cliente:
 * la RPC de la 0557 deriva la fila de `auth.uid()` y no acepta a quién escribir.
 * Sin la 0557 devuelve `ok: false` y el selector avisa que no pudo guardar.
 */
export async function setPortalVistaAction(
  vista: string,
): Promise<{ ok: boolean; vista?: PortalVista }> {
  if (!isPortalVistaSimpleEnabled() || !esPortalVista(vista)) return { ok: false };
  const supabase = await createClient();
  const guardada = await setMyPortalVista(supabase, vista);
  return guardada ? { ok: true, vista: guardada } : { ok: false };
}

/**
 * SDD-0654 · La guía de las primeras veces se mostró: queda marcada una sola
 * vez (la usa la fase 2). Con el interruptor apagado no hace nada.
 */
export async function markPortalGuiaVistaAction(): Promise<{ ok: boolean }> {
  if (!isPortalVistaSimpleEnabled()) return { ok: false };
  const supabase = await createClient();
  return { ok: await markMyPortalGuiaVista(supabase) };
}

// El cambio de contraseña del portal se eliminó (decisión founder 2026-07-03):
// el acceso es SOLO por magic link (signInWithOtp) — no hay contraseña que
// cambiar. La versión histórica vive en SDD-0042 Fase 6 (git).
