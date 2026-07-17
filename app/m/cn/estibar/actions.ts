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
    clientName: result.client_name ?? null,
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

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Errcodes definidos en 0241 (+ los comunes de operario de 0066/0067). */
function humanizeStuffError(msg: string): string {
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
  return msg;
}
