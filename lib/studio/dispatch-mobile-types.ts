/**
 * Tipos + validators de las apps móviles del Despacho (SDD-0030).
 * Inputs de las 4 RPCs operario: bodeguero_advance_od · bodeguero_split_p2
 * camionero_advance_od · camionero_pod.
 */

import type {
  DispatchOrderStatus,
  DispatchSplitReason,
} from "./dispatch-types";

// ─────────────────────────────────────────────────────────────
// Action state compartido
// ─────────────────────────────────────────────────────────────

export type MobileActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  createdPodId?: string;
  createdOdId?: string;     // P2 generada por split
};

// ─────────────────────────────────────────────────────────────
// Bodeguero · advance OD
// ─────────────────────────────────────────────────────────────

export type BodegueroAdvanceInput = {
  od_id: string;
  status: Extract<DispatchOrderStatus, "cargando" | "lista">;
};

const BODEGUERO_ALLOWED: DispatchOrderStatus[] = ["cargando", "lista"];

export function validateBodegueroAdvanceInput(
  input: Partial<BodegueroAdvanceInput>,
): { input?: BodegueroAdvanceInput; fieldErrors?: Record<string, string> } {
  const errors: Record<string, string> = {};
  const od_id = input.od_id?.trim();
  if (!od_id) errors.od_id = "Falta el ID de la OD.";
  if (!input.status || !BODEGUERO_ALLOWED.includes(input.status)) {
    errors.status = "Status inválido para bodeguero.";
  }
  if (Object.keys(errors).length > 0) return { fieldErrors: errors };
  return { input: { od_id: od_id!, status: input.status as BodegueroAdvanceInput["status"] } };
}

// ─────────────────────────────────────────────────────────────
// Bodeguero · split P2
// ─────────────────────────────────────────────────────────────

export type BodegueroSplitInput = {
  od_id: string;
  package_id: string;
  boxes_shipped: number;
  split_reason: DispatchSplitReason;
  split_reason_text: string | null;
};

const SPLIT_REASONS: DispatchSplitReason[] = [
  "falta_volumen",
  "cliente_pidio_esperar",
  "dano_caja",
  "documentacion_pendiente",
  "otro",
];

export function validateBodegueroSplitInput(
  input: Partial<BodegueroSplitInput>,
): { input?: BodegueroSplitInput; fieldErrors?: Record<string, string> } {
  const errors: Record<string, string> = {};
  const od_id = input.od_id?.trim();
  if (!od_id) errors.od_id = "Falta el ID de la OD.";
  const package_id = input.package_id?.trim();
  if (!package_id) errors.package_id = "Falta el ID del paquete.";
  const boxes_shipped = Number(input.boxes_shipped ?? 0);
  if (!Number.isFinite(boxes_shipped) || boxes_shipped <= 0) {
    errors.boxes_shipped = "Cajas a despachar debe ser > 0.";
  }
  if (!input.split_reason || !SPLIT_REASONS.includes(input.split_reason)) {
    errors.split_reason = "Motivo obligatorio.";
  }
  if (input.split_reason === "otro" && !input.split_reason_text?.trim()) {
    errors.split_reason_text = "Indicá un motivo libre para 'Otro'.";
  }
  if (Object.keys(errors).length > 0) return { fieldErrors: errors };
  return {
    input: {
      od_id: od_id!,
      package_id: package_id!,
      boxes_shipped: Math.floor(boxes_shipped),
      split_reason: input.split_reason as DispatchSplitReason,
      split_reason_text: input.split_reason_text?.trim() || null,
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Camionero · advance OD
// ─────────────────────────────────────────────────────────────

export type CamioneroAdvanceInput = {
  od_id: string;
  status: Extract<DispatchOrderStatus, "en_ruta" | "entregada">;
  progress: number | null;
  current_city: string | null;
};

const CAMIONERO_ALLOWED: DispatchOrderStatus[] = ["en_ruta", "entregada"];

export function validateCamioneroAdvanceInput(
  input: Partial<CamioneroAdvanceInput>,
): { input?: CamioneroAdvanceInput; fieldErrors?: Record<string, string> } {
  const errors: Record<string, string> = {};
  const od_id = input.od_id?.trim();
  if (!od_id) errors.od_id = "Falta el ID de la OD.";
  if (!input.status || !CAMIONERO_ALLOWED.includes(input.status)) {
    errors.status = "Status inválido para camionero.";
  }
  let progress = input.progress;
  if (progress != null) {
    const n = Number(progress);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      errors.progress = "progress debe estar entre 0 y 100.";
    } else {
      progress = Math.round(n);
    }
  }
  if (Object.keys(errors).length > 0) return { fieldErrors: errors };
  return {
    input: {
      od_id: od_id!,
      status: input.status as CamioneroAdvanceInput["status"],
      progress: progress ?? null,
      current_city: input.current_city?.trim() || null,
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Camionero · POD
// ─────────────────────────────────────────────────────────────

export type CamioneroPodInput = {
  od_id: string;
  package_id: string | null;          // null si POD es del OD completo
  photo_path: string;                  // path en bucket receipt-photos
  signature_path: string;
  received_by: string;
  received_doc: string | null;
  notes: string | null;
};

export function validateCamioneroPodInput(
  input: Partial<CamioneroPodInput>,
): { input?: CamioneroPodInput; fieldErrors?: Record<string, string> } {
  const errors: Record<string, string> = {};
  const od_id = input.od_id?.trim();
  if (!od_id) errors.od_id = "Falta el ID de la OD.";
  if (!input.photo_path?.trim()) errors.photo_path = "Foto del POD obligatoria.";
  if (!input.signature_path?.trim()) errors.signature_path = "Firma del receptor obligatoria.";
  const received_by = input.received_by?.trim();
  if (!received_by) errors.received_by = "Indicá el nombre del receptor.";
  if (received_by && received_by.length < 3) errors.received_by = "Nombre muy corto.";

  if (Object.keys(errors).length > 0) return { fieldErrors: errors };
  return {
    input: {
      od_id: od_id!,
      package_id: input.package_id?.trim() || null,
      photo_path: input.photo_path!.trim(),
      signature_path: input.signature_path!.trim(),
      received_by: received_by!,
      received_doc: input.received_doc?.trim() || null,
      notes: input.notes?.trim() || null,
    },
  };
}
