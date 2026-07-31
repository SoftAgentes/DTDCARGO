"use server";

/**
 * SDD-0152 · Server actions de Estiba (operario CN).
 *
 * Mutaciones via RPC `stuff_box_as_operario` / `unstuff_box_as_operario`
 * (migración 0241), SECURITY DEFINER + service_role only: el operario no tiene
 * `auth.uid()`, así que RLS no aplica y el tenant se resuelve desde
 * `operario_pins` dentro del RPC.
 *
 * Calca el patrón de app/m/ve/bodeguero/recepcion/actions.ts.
 */

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/db/admin";
import { getCurrentOperario } from "@/lib/auth/operario-session";
import { isBoxCode } from "@/lib/studio/etiquetas-qr";
import { isZoneInLayout, type ZoneCoord, type ZoneLayout } from "@/lib/studio/naviera/zones";
import { isContainerTypeCode } from "@/lib/studio/naviera/types";
import { notifyConsolidationRequestToOffice } from "@/lib/studio/naviera/consolidation-request-notify";

export type StuffBoxActionState = {
  ok?: boolean;
  error?: string;
  code?: string;
  markbox?: string | null;
  clientName?: string | null;
  zoneCode?: string;
  stuffedCount?: number;
  expectedCount?: number;
};

async function requireCnOperario() {
  const session = await getCurrentOperario();
  if (!session) return { error: "Sesión inválida · ingresa de nuevo." as const };
  if (session.region !== "cn") {
    return { error: "Solo operarios de China pueden estibar." as const };
  }
  return { session };
}

// ─────────────────────────────────────────────────────────────
// SDD-0157 · el operario pide abrir un contenedor (solicitud)
// ─────────────────────────────────────────────────────────────

export type RequestConsolidationState = {
  ok?: boolean;
  error?: string;
  /** id de la consolidación creada (status 'solicitada', sin ref). */
  id?: string;
};

/**
 * El operario CN pide abrir un contenedor de consolidación. Crea una fila
 * `status='solicitada'` SIN ref (el correlativo se asigna al autorizar, en el
 * Studio). Best-effort: avisa a la oficina por Telegram. La autorización real
 * vive en app/studio/(app)/naviera/actions.ts.
 */
export async function requestConsolidationAction(
  containerType: string,
): Promise<RequestConsolidationState> {
  const auth = await requireCnOperario();
  if ("error" in auth) return { error: auth.error };

  const tipo = (containerType ?? "").trim();
  if (!isContainerTypeCode(tipo)) {
    return { error: "Elige un tipo de contenedor válido (20' GP / 40' GP / 40' HC)." };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("request_consolidation_as_operario", {
    p_operario_id: auth.session.operario_id,
    p_container_type: tipo,
  });
  if (error) {
    return { error: "No se pudo enviar la solicitud · reintenta en un momento." };
  }

  const id = typeof data === "string" ? data : String(data ?? "");

  // Aviso a la oficina (best-effort, no bloquea la solicitud).
  await notifyConsolidationRequestToOffice(admin, auth.session.tenant_id, {
    containerType: tipo,
    operarioName: auth.session.display_name,
  });

  revalidatePath("/m/cn/estibar");
  return { ok: true, id };
}

// ─────────────────────────────────────────────────────────────
// stuff_box · registrar en qué zona quedó la caja
// ─────────────────────────────────────────────────────────────

export async function stuffBoxAction(
  consolidationId: string,
  code: string,
  zone: ZoneCoord,
  layout: ZoneLayout,
  manual: boolean,
): Promise<StuffBoxActionState> {
  const auth = await requireCnOperario();
  if ("error" in auth) return { error: auth.error };

  const trimmed = code.trim();
  if (!isBoxCode(trimmed)) {
    return { error: "Ese no es un código de caja del hub (DTD-B-…)." };
  }
  // Atajo local del mismo guard que hace el RPC contra zone_layout: así el
  // operario no gasta un viaje al servidor por un tap fuera de la grilla.
  if (!isZoneInLayout(layout, zone)) {
    return { error: "Esa zona no existe en este contenedor." };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("stuff_box_as_operario", {
    p_operario_id: auth.session.operario_id,
    p_consolidation_id: consolidationId,
    p_code: trimmed,
    p_zx: zone.zx,
    p_zy: zone.zy,
    p_zz: zone.zz,
    p_manual: manual,
  });

  if (error) return { error: humanizeStuffError(error.message) };

  const result = (data ?? {}) as {
    code?: string;
    markbox?: string | null;
    client_name?: string | null;
    zone_code?: string;
    stuffed_count?: number;
    expected_count?: number;
  };

  revalidatePath(`/m/cn/estibar/${consolidationId}`);

  return {
    ok: true,
    code: result.code,
    markbox: result.markbox ?? null,
    clientName: null, // privacidad · hallazgo H-7

    zoneCode: result.zone_code,
    stuffedCount: result.stuffed_count,
    expectedCount: result.expected_count,
  };
}

// ─────────────────────────────────────────────────────────────
// unstuff_box · sacar una caja (corregir sin perder la historia)
// ─────────────────────────────────────────────────────────────

export async function unstuffBoxAction(
  consolidationId: string,
  code: string,
): Promise<StuffBoxActionState> {
  const auth = await requireCnOperario();
  if ("error" in auth) return { error: auth.error };

  const trimmed = code.trim();
  if (!isBoxCode(trimmed)) {
    return { error: "Ese no es un código de caja del hub (DTD-B-…)." };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("unstuff_box_as_operario", {
    p_operario_id: auth.session.operario_id,
    p_code: trimmed,
  });

  if (error) return { error: humanizeStuffError(error.message) };

  const result = (data ?? {}) as { code?: string; stuffed_count?: number };
  revalidatePath(`/m/cn/estibar/${consolidationId}`);

  return { ok: true, code: result.code, stuffedCount: result.stuffed_count };
}

// ═════════════════════════════════════════════════════════════
// SDD-0155 · Estiba por LOTES
// ═════════════════════════════════════════════════════════════

// Paso 1 · lookup (read-only): ¿qué lote es esta caja?
export type LotLookup = {
  found: true;
  boxCode: string;
  prealertaCode: string;
  clientMarkbox: string | null;
  clientName: string | null;
  lotSize: number; // cajas recibidas de esa compra, sin montar
};
export type LotLookupState = LotLookup | { found: false; error: string };

export async function lookupLotAction(code: string): Promise<LotLookupState> {
  const auth = await requireCnOperario();
  if ("error" in auth) return { found: false, error: auth.error ?? "Sesión inválida." };

  const trimmed = code.trim().toUpperCase();
  if (!isBoxCode(trimmed)) {
    return { found: false, error: "Ese no es un código de caja del hub (DTD-B-…)." };
  }

  const admin = createAdminClient();
  const { data: box } = await admin
    .from("warehouse_boxes")
    .select("code, status, prealerta_id")
    .eq("tenant_id", auth.session.tenant_id)
    .eq("code", trimmed)
    .is("deleted_at", null)
    .maybeSingle<{ code: string; status: string; prealerta_id: string | null }>();

  if (!box) return { found: false, error: `La caja ${trimmed} no existe.` };
  if (box.status !== "recibida") {
    return {
      found: false,
      error: `La caja ${trimmed} todavía no se recibió · recíbela primero.`,
    };
  }
  if (!box.prealerta_id) {
    return { found: false, error: `La caja ${trimmed} no viene de una compra.` };
  }

  const { data: pre } = await admin
    .from("prealertas")
    .select("code, client_markbox")
    .eq("id", box.prealerta_id)
    .maybeSingle<{ code: string; client_markbox: string }>();

  // El lote = cajas recibidas de esa compra que todavía no están montadas.
  const { data: lotRows } = await admin
    .from("warehouse_boxes")
    .select("id")
    .eq("tenant_id", auth.session.tenant_id)
    .eq("prealerta_id", box.prealerta_id)
    .eq("status", "recibida")
    .is("deleted_at", null);

  // Descontar las que ya tienen posición viva.
  let lotSize = lotRows?.length ?? 0;
  if (lotRows && lotRows.length > 0) {
    const ids = lotRows.map((r) => (r as { id: string }).id);
    const { data: live } = await admin
      .from("consolidation_box_positions")
      .select("box_id")
      .in("box_id", ids)
      .is("unstuffed_at", null);
    lotSize -= live?.length ?? 0;
  }

  return {
    found: true,
    boxCode: box.code,
    prealertaCode: pre?.code ?? "—",
    clientMarkbox: pre?.client_markbox ?? null,
    // PRIVACIDAD (hallazgo H-7): el equipo CN identifica al importador solo por
    // Shipping Mark. Redacción server-side: nunca se envía el nombre real.
    clientName: null,
    lotSize: Math.max(lotSize, 0),
  };
}

// Paso 2 · montar el lote (o parte, para el lote partido)
export type StuffLotState = {
  ok?: boolean;
  error?: string;
  stuffed?: number;
  remaining?: number;
  lotSize?: number;
  loadOrder?: number;
  width?: number;
  prealertaCode?: string;
  clientName?: string | null;
  clientMarkbox?: string | null;
};

export async function stuffLotAction(
  consolidationId: string,
  code: string,
  width: number,
  count: number | null,
  /**
   * SDD-0184 · Fase 4 — el lazo plan ↔ realidad. Contra qué plan se estibó y si
   * el operario confirmó la posición que proponía. Opcionales: si no hay plan
   * calculado, la estiba funciona exactamente igual que antes.
   */
  planId?: string | null,
  siguioPlan?: boolean | null,
): Promise<StuffLotState> {
  const auth = await requireCnOperario();
  if ("error" in auth) return { error: auth.error };

  const trimmed = code.trim().toUpperCase();
  if (!isBoxCode(trimmed)) return { error: "Código de caja inválido." };
  if (![0, 1, 2].includes(width)) {
    return { error: "Elige izquierda, centro o derecha." };
  }
  let cnt: number | null = null;
  if (count != null) {
    if (!Number.isInteger(count) || count < 1) {
      return { error: "La cantidad tiene que ser 1 o más." };
    }
    cnt = count;
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("stuff_lot_as_operario", {
    p_operario_id: auth.session.operario_id,
    p_consolidation_id: consolidationId,
    p_scanned_code: trimmed,
    p_width: width,
    p_count: cnt,
  });

  if (error) return { error: humanizeStuffError(error.message) };

  const r = (data ?? {}) as {
    stuffed?: number;
    remaining?: number;
    lot_size?: number;
    load_order?: number;
    width?: number;
    prealerta_code?: string;
    client_name?: string | null;
    client_markbox?: string | null;
  };
  // SDD-0184 · Fase 4: marcar el lote recién montado contra el plan.
  //
  // Se hace con un UPDATE posterior y NO agregándole parámetros al RPC: con
  // `CREATE OR REPLACE` quedarían DOS aridades vivas en pg_proc, cada una con sus
  // propios grants, y la nueva nacería sin los `revoke` de public/anon — la deuda
  // que el repo ya cerró una vez.
  //
  // Best-effort a propósito: si esto falla, la estiba ya quedó registrada y solo
  // se pierde la traza del plan. Fallar del otro lado (abortar la estiba porque
  // no se pudo anotar el plan) sería peor para el operario que está en el galpón.
  if (planId && r.load_order != null) {
    const { error: markError } = await admin
      .from("consolidation_box_positions")
      .update({ plan_id: planId, siguio_plan: siguioPlan ?? null })
      .eq("consolidation_id", consolidationId)
      .eq("load_order", r.load_order)
      .is("unstuffed_at", null);
    if (markError) {
      console.error("[estibar] no se pudo marcar el plan del lote", markError);
    }
  }

  revalidatePath(`/m/cn/estibar/${consolidationId}`);

  return {
    ok: true,
    stuffed: r.stuffed,
    remaining: r.remaining,
    lotSize: r.lot_size,
    loadOrder: r.load_order,
    width: r.width,
    prealertaCode: r.prealerta_code,
    clientName: null, // privacidad · hallazgo H-7
    clientMarkbox: r.client_markbox ?? null,
  };
}

export async function unstuffLotAction(
  consolidationId: string,
): Promise<StuffLotState> {
  const auth = await requireCnOperario();
  if ("error" in auth) return { error: auth.error };

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("unstuff_lot_as_operario", {
    p_operario_id: auth.session.operario_id,
    p_consolidation_id: consolidationId,
  });
  if (error) return { error: humanizeStuffError(error.message) };

  const r = (data ?? {}) as { unstuffed?: number; load_order?: number };
  revalidatePath(`/m/cn/estibar/${consolidationId}`);
  return { ok: true, stuffed: r.unstuffed, loadOrder: r.load_order };
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Errcodes definidos en 0241/0246 (+ los comunes de operario de 0066/0067). */
function humanizeStuffError(msg: string): string {
  if (msg.includes("P0129")) return "No hay ningún lote montado para deshacer.";
  if (msg.includes("P0001")) return "Operario no encontrado.";
  if (msg.includes("P0002")) return "Operario inactivo.";
  if (msg.includes("P0003")) return "Solo operarios de China pueden estibar.";
  if (msg.includes("P0120")) return "Ese contenedor no existe.";
  if (msg.includes("P0121")) return "Ese contenedor ya está cerrado · no admite más carga.";
  if (msg.includes("P0122")) return "El contenedor no tiene grilla de zonas configurada.";
  if (msg.includes("P0123")) return "Esa zona no existe en este contenedor.";
  if (msg.includes("P0124")) return "Esa caja no existe · revisa la etiqueta.";
  if (msg.includes("P0125")) return "Esa caja ya está estibada en este contenedor.";
  if (msg.includes("P0126")) return "Esa caja ya está estibada en OTRO contenedor.";
  if (msg.includes("P0127")) return "Esa caja no está estibada.";
  // SDD-0153: la etiqueta existe (el proveedor la imprimió y la pegó) pero la caja
  // todavía no se recibió en el almacén. No es un error de la etiqueta.
  if (msg.includes("P0128"))
    return "Esa caja todavía no se recibió en el almacén · recíbela primero y vuelve a escanear.";
  return msg;
}
