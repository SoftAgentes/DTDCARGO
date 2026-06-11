/**
 * Server actions del módulo Rendiciones (SDD-0069).
 *
 * - emitRenditionAction: emite una rendición del período (snapshot inmutable;
 *   delega en `emitRenditionFor`: re-check + insert + puente + recibos→rendido).
 * - voidRenditionAction: anula una rendición (admin + motivo; revierte recibos).
 *
 * Admin-only: la página gatea por rol, y `emitRenditionFor`/`voidRenditionFor`
 * vuelven a verificar `user_tenants.role==='admin'` server-side (RLS 0123 lo
 * respalda en la DB). Sin Zod: validación con `validate*Input()` propio.
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import {
  emitRenditionFor,
  voidRenditionFor,
} from "@/lib/studio/renditions/actions-helpers";

/**
 * Emite la rendición de un período [from, to] (YYYY-MM-DD). Devuelve
 * renditionCode + receiptCount para la traza, o `{ error }`.
 */
export async function emitRenditionAction(args: {
  from: string;
  to: string;
}): Promise<{
  ok?: boolean;
  error?: string;
  renditionCode?: string;
  receiptCount?: number;
}> {
  const supabase = await createClient();
  const result = await emitRenditionFor(supabase, {
    from: args.from,
    to: args.to,
  });
  if (!result.ok) {
    return { error: result.error ?? "No se pudo emitir la rendición." };
  }

  revalidatePath("/studio/rendiciones");
  revalidatePath("/studio/cobranzas");
  return {
    ok: true,
    renditionCode: result.renditionCode,
    receiptCount: result.receiptCount,
  };
}

/**
 * Anula una rendición (admin + motivo): revierte sus recibos a `aplicado` y
 * la deja en el historial. Único cambio permitido post-emisión.
 */
export async function voidRenditionAction(
  renditionId: string,
  reason: string,
): Promise<{ ok?: boolean; error?: string; renditionCode?: string }> {
  const supabase = await createClient();
  const result = await voidRenditionFor(supabase, renditionId, reason);
  if (!result.ok) {
    return { error: result.error ?? "No se pudo anular la rendición." };
  }

  revalidatePath("/studio/rendiciones");
  revalidatePath("/studio/cobranzas");
  return { ok: true, renditionCode: result.renditionCode };
}
