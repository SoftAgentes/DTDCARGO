"use server";

/**
 * Server actions de /studio/debug.
 *
 * Por ahora solo `recheckAllAction()` que invalida el cache de la página
 * (que abarca healthchecks de integraciones + publicaciones del servidor) ·
 * útil para forzar un refresh inmediato sin esperar al revalidate
 * automático de 60s.
 */

import { revalidatePath } from "next/cache";

export async function recheckAllAction(): Promise<{ ok: true; at: number }> {
  revalidatePath("/studio/debug");
  return { ok: true, at: Date.now() };
}
