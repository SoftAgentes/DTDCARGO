/**
 * Lógica de emisión/anulación de la Rendición (SDD-0069 · decisiones #5/#6/#10).
 *
 * Helpers puros-de-IO que reciben el SupabaseClient autenticado del caller (RLS).
 * NO son un módulo `"use server"`: las server actions (rendiciones/actions.ts)
 * los envuelven con revalidatePath.
 *
 * `emitRenditionFor` (decisión #5 — snapshot INMUTABLE):
 *   1. resuelve tenant + verifica rol admin (decisión #9).
 *   2. RE-CHECK de elegibilidad server-side: recomputa el preview (no confía en
 *      el del cliente). Si no hay recibos → no emite (rendición vacía no existe).
 *   3. genera rendition_code (rpc next_rendition_code) con REINTENTO ante choque
 *      de unique(tenant,rendition_code) (patrón 0054, correlativo sin huecos).
 *   4. inserta `renditions` con los totales CONGELADOS.
 *   5. inserta `rendition_receipts` (puente con los receipt_id incluidos).
 *   6. UPDATE de los recibos incluidos `aplicado → rendido`.
 *   NO genera journal_entries (decisión #4 — la liquidación contable la decide el
 *   contador; este es el gancho documentado).
 *
 * `voidRenditionFor` (decisión #6 — anulación reversible):
 *   status → anulada + void_reason; el trigger DB marca el puente
 *   (rendition_voided) y los recibos se revierten `rendido → aplicado` (vuelven a
 *   estar disponibles). Único cambio permitido post-emisión.
 *
 * Notas de robustez (sin transacción cross-statement en supabase-js):
 *  - Si falla el puente tras insertar la cabecera, se hace rollback manual de la
 *    rendición (delete con admin client — el trigger de inmutabilidad bloquea el
 *    delete del rol normal).
 *  - El UPDATE de recibos→rendido NO es bloqueante del éxito (best-effort con
 *    log): el unique parcial del puente ya impide la doble inclusión; el filtro
 *    `application_status='aplicado'` del preview es la red. Si quedara un recibo
 *    sin pasar a `rendido`, anular+re-emitir lo corrige.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/db/admin";
import { previewRendition } from "./queries";
import {
  validateRenditionEmitInput,
  type RenditionEmitInput,
} from "./types";

const MAX_CODE_RETRIES = 5;

/**
 * Resuelve el tenant del usuario logueado + verifica que sea admin. Devuelve
 * `{ tenantId, userId }` o `{ error }`. La emisión/anulación son admin-only
 * (decisión #9); la RLS de la migración 0123 lo respalda en la DB.
 */
async function resolveAdminTenant(
  supabase: SupabaseClient,
): Promise<{ tenantId?: string; userId?: string | null; error?: string }> {
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) return { error: "Sesión no válida." };

  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id, role")
    .maybeSingle<{ tenant_id: string; role: string }>();
  if (!link?.tenant_id) return { error: "No se pudo resolver el tenant." };
  if (link.role !== "admin") {
    return { error: "Solo un administrador puede emitir o anular rendiciones." };
  }
  return { tenantId: link.tenant_id, userId: userResp.user.id };
}

export type EmitRenditionResult = {
  ok?: boolean;
  error?: string;
  renditionCode?: string;
  receiptCount?: number;
};

/**
 * Emite una rendición del período (snapshot inmutable). El SupabaseClient debe
 * estar autenticado (RLS resuelve el tenant). Devuelve `{ ok, renditionCode,
 * receiptCount }` o `{ error }`.
 */
export async function emitRenditionFor(
  supabase: SupabaseClient,
  raw: Partial<RenditionEmitInput>,
): Promise<EmitRenditionResult> {
  // 0. Validar el rango (forma).
  const { input, error: validationError } = validateRenditionEmitInput(raw);
  if (validationError || !input) {
    return { error: validationError ?? "Rango inválido." };
  }

  // 1. Tenant + admin.
  const { tenantId, userId, error: authError } = await resolveAdminTenant(
    supabase,
  );
  if (authError || !tenantId) return { error: authError };

  // 2. RE-CHECK server-side: recomputar el preview (no confiar en el cliente).
  const preview = await previewRendition(supabase, {
    from: input.from,
    to: input.to,
  });
  if (preview.receiptCount === 0) {
    return {
      error:
        "No hay recibos de terceros aplicados en este período (nada que rendir).",
    };
  }

  // 3. Generar rendition_code con reintento ante choque de unique (patrón 0054).
  let lastError = "No se pudo emitir la rendición.";
  for (let attempt = 0; attempt < MAX_CODE_RETRIES; attempt++) {
    const { data: codeData, error: codeErr } = await supabase.rpc(
      "next_rendition_code",
      { p_tenant: tenantId },
    );
    if (codeErr || !codeData) {
      lastError = "No se pudo generar el código de la rendición.";
      continue;
    }
    const renditionCode = String(codeData);

    // 4. Insertar la cabecera con los totales CONGELADOS.
    const { data: insertedRendition, error: insErr } = await supabase
      .from("renditions")
      .insert({
        tenant_id: tenantId,
        rendition_code: renditionCode,
        period_from: input.from,
        period_to: input.to,
        third_party_usd: preview.thirdPartyUsd,
        local_revenue_usd: preview.localRevenueInvoicedUsd,
        net_to_operadora_usd: preview.netToOperadoraUsd,
        receipt_count: preview.receiptCount,
        status: "emitida",
        created_by: userId ?? null,
      })
      .select("id")
      .single();

    if (insErr || !insertedRendition) {
      // ¿Choque del unique(tenant,rendition_code)? → reintentar con nuevo code.
      const code = (insErr as { code?: string } | null)?.code;
      if (code === "23505") {
        lastError = "El código de la rendición ya existía; reintentando.";
        continue;
      }
      return { error: `No se pudo emitir la rendición: ${insErr?.message}` };
    }

    const renditionId = insertedRendition.id;

    // 5. Insertar el puente (un row por recibo elegible). Si falla, rollback
    //    manual de la cabecera (el delete del rol normal lo bloquea el trigger
    //    de inmutabilidad → se usa el admin client).
    const bridgeRows = preview.lines.map((l) => ({
      tenant_id: tenantId,
      rendition_id: renditionId,
      receipt_id: l.receiptId,
      amount_usd: l.amountUsd,
      rendition_voided: false,
    }));
    const { error: bridgeErr } = await supabase
      .from("rendition_receipts")
      .insert(bridgeRows);

    if (bridgeErr) {
      try {
        await createAdminClient()
          .from("renditions")
          .delete()
          .eq("id", renditionId);
      } catch (e) {
        console.error(
          `[rendiciones] rollback de ${renditionCode} falló:`,
          e,
        );
      }
      // 23505 en el puente = un recibo ya está en otra rendición activa (carrera).
      const bcode = (bridgeErr as { code?: string }).code;
      if (bcode === "23505") {
        return {
          error:
            "Uno o más recibos ya fueron incluidos en otra rendición. Recarga el período e intenta de nuevo.",
        };
      }
      return {
        error: `No se pudieron asociar los recibos: ${bridgeErr.message}`,
      };
    }

    // 6. Marcar los recibos incluidos como `rendido` (aplicado → rendido).
    //    Best-effort: el unique parcial ya impide la doble inclusión.
    const receiptIds = preview.lines.map((l) => l.receiptId);
    const { error: updErr } = await supabase
      .from("payment_receipts")
      .update({ application_status: "rendido" })
      .in("id", receiptIds)
      .eq("application_status", "aplicado");
    if (updErr) {
      console.error(
        `[rendiciones] no se pudieron marcar recibos como rendido en ${renditionCode}:`,
        updErr.message,
      );
    }

    return {
      ok: true,
      renditionCode,
      receiptCount: preview.receiptCount,
    };
  }

  return { error: lastError };
}

export type VoidRenditionResult = {
  ok?: boolean;
  error?: string;
  renditionCode?: string;
};

/**
 * Anula una rendición (admin + motivo): status → anulada + void_reason, y
 * revierte sus recibos `rendido → aplicado` (vuelven a estar disponibles). El
 * trigger DB marca el puente (rendition_voided) liberándolos del índice parcial.
 * Único cambio permitido post-emisión (decisión #6).
 */
export async function voidRenditionFor(
  supabase: SupabaseClient,
  renditionId: string,
  reasonRaw: string,
): Promise<VoidRenditionResult> {
  const reason = String(reasonRaw ?? "").trim();
  if (!reason) {
    return { error: "Indica el motivo de la anulación." };
  }

  const { tenantId, error: authError } = await resolveAdminTenant(supabase);
  if (authError || !tenantId) return { error: authError };

  // Leer la rendición (RLS la acota al tenant).
  const { data: rend, error: readErr } = await supabase
    .from("renditions")
    .select("id, rendition_code, status")
    .eq("id", renditionId)
    .maybeSingle<{ id: string; rendition_code: string; status: string }>();
  if (readErr || !rend) return { error: "Rendición no encontrada." };
  if (rend.status === "anulada") {
    return { error: "Esta rendición ya está anulada." };
  }

  // Recibos incluidos (para revertirlos a `aplicado`).
  const { data: bridge } = await supabase
    .from("rendition_receipts")
    .select("receipt_id")
    .eq("rendition_id", rend.id)
    .limit(20000);
  const receiptIds = (
    (bridge as { receipt_id: string }[] | null) ?? []
  ).map((b) => b.receipt_id);

  // 1. status → anulada + void_reason. El trigger de inmutabilidad solo permite
  //    esta transición; el trigger de sync marca el puente (rendition_voided).
  const { error: voidErr } = await supabase
    .from("renditions")
    .update({ status: "anulada", void_reason: reason })
    .eq("id", rend.id);
  if (voidErr) {
    return { error: `No se pudo anular la rendición: ${voidErr.message}` };
  }

  // 2. Revertir los recibos `rendido → aplicado` (vuelven a estar disponibles).
  if (receiptIds.length > 0) {
    const { error: revertErr } = await supabase
      .from("payment_receipts")
      .update({ application_status: "aplicado" })
      .in("id", receiptIds)
      .eq("application_status", "rendido");
    if (revertErr) {
      console.error(
        `[rendiciones] no se pudieron revertir recibos de ${rend.rendition_code}:`,
        revertErr.message,
      );
    }
  }

  return { ok: true, renditionCode: rend.rendition_code };
}
