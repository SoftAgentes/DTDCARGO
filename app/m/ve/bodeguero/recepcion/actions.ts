"use server";

/**
 * Server actions de Recepción VE (Sprint E · plan v3).
 *
 * Mutaciones via RPC `operario_action` (branches scan_box + seal_reception),
 * que vive bajo SECURITY DEFINER + service_role only (el operario no tiene
 * auth.uid()).
 */

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/db/admin";
import { getCurrentOperario } from "@/lib/auth/operario-session";
import {
  isValidBoxCode,
  type ScanBoxActionState,
  type SealReceiptActionState,
  type WarehouseReceiptVeStatus,
} from "@/lib/studio/warehouse-receipt-ve-types";

async function requireVeBodeguero() {
  const session = await getCurrentOperario();
  if (!session) return { error: "Sesión inválida · ingresá de nuevo." as const };
  if (session.region !== "ve") return { error: "Solo operarios VE." as const };
  // Multi-rol: si tiene > 1 modo y no eligió bodeguero, denegar
  const activeMode = session.current_mode ?? session.role;
  if (activeMode !== "bodeguero" && activeMode !== "supervisor") {
    return { error: "Tu modo activo no permite operar la recepción VE." as const };
  }
  return { session };
}

// ─────────────────────────────────────────────────────────────
// scan_box · marcar caja como escaneada
// ─────────────────────────────────────────────────────────────

export async function scanBoxAction(
  receiptId: string,
  code: string,
  manual: boolean,
): Promise<ScanBoxActionState> {
  const auth = await requireVeBodeguero();
  if ("error" in auth) return { error: auth.error };

  const trimmed = code.trim();
  if (!isValidBoxCode(trimmed)) {
    return { error: "Código inválido · 4+ chars alfanuméricos." };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("operario_action", {
    p_operario_id: auth.session.operario_id,
    p_action_type: "scan_box",
    p_payload: { receipt_id: receiptId, code: trimmed, manual },
  });

  if (error) return { error: humanizeOperarioActionError(error.message) };

  const result = (data ?? {}) as {
    ok?: boolean;
    scanned_count?: number;
    expected_count?: number;
  };
  revalidatePath(`/m/ve/bodeguero/recepcion/${receiptId}`);

  return {
    ok: true,
    scannedCode: trimmed,
    scannedCount: result.scanned_count,
    expectedCount: result.expected_count,
  };
}

// ─────────────────────────────────────────────────────────────
// seal_reception · cerrar receipt
// ─────────────────────────────────────────────────────────────

export async function sealReceiptAction(
  receiptId: string,
  options: { force: boolean; incidentNote?: string | null },
): Promise<SealReceiptActionState> {
  const auth = await requireVeBodeguero();
  if ("error" in auth) return { error: auth.error };

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("operario_action", {
    p_operario_id: auth.session.operario_id,
    p_action_type: "seal_reception",
    p_payload: {
      receipt_id: receiptId,
      force: options.force,
      incident_note: options.incidentNote ?? null,
    },
  });

  if (error) return { error: humanizeOperarioActionError(error.message) };

  const result = (data ?? {}) as {
    ok?: boolean;
    scanned_count?: number;
    expected_count?: number;
    status?: WarehouseReceiptVeStatus;
  };

  revalidatePath(`/m/ve/bodeguero/recepcion/${receiptId}`);
  revalidatePath("/m/ve/bodeguero/recepcion");

  return {
    ok: true,
    scannedCount: result.scanned_count,
    expectedCount: result.expected_count,
    resultingStatus: result.status,
  };
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function humanizeOperarioActionError(msg: string): string {
  // Errcodes definidos en operario_action (0066 + 0067)
  if (msg.includes("P0001")) return "Operario no encontrado.";
  if (msg.includes("P0002")) return "Operario inactivo.";
  if (msg.includes("P0003")) return "Solo operarios VE pueden operar acá.";
  if (msg.includes("P0004")) return "Tu rol no permite esta acción.";
  if (msg.includes("P0110")) return "Faltan datos del payload (receipt_id / code).";
  if (msg.includes("P0111")) return "Receipt no encontrado.";
  if (msg.includes("P0112")) return "Receipt ya está sellado.";
  if (msg.includes("P0113")) return "Esa caja no figura en este receipt.";
  if (msg.includes("P0114")) return "Esa caja ya estaba escaneada.";
  if (msg.includes("P0115")) {
    const match = msg.match(/Faltan (\d+) cajas/);
    if (match) return `Faltan ${match[1]} cajas · sellá con incidencia si querés cerrar igual.`;
    return "Faltan cajas por escanear.";
  }
  return msg;
}
