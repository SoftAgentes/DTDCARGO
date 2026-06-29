/**
 * Tipos + validadores de la Compra Grupal del Club DTD (SDD-0116, Slice B).
 * DATA PURA (sin React, sin server-only). Enums = uniones de string-literal
 * (espejo de los CHECK de 0186), sin Zod.
 *
 * Decisiones founder (2026-06-28): D5 solo miembros del Club participan ·
 * D7 100% intención (CBM/valor ESTIMADO, cero montos cobrables — aislamiento
 * financiero). `committed_cbm` es DERIVADO (no se persiste).
 */

import { slugify } from "@/lib/studio/academia/types";

export { slugify };

// ── Enums (espejo de los CHECK de 0186) ──────────────────────
export type GroupBuyStatus =
  | "abierta"
  | "cerrada"
  | "en_consolidacion"
  | "completada"
  | "cancelada";
export type ParticipantStatus = "interesado" | "confirmado" | "retirado";

export const GROUP_BUY_STATUSES: readonly GroupBuyStatus[] = [
  "abierta",
  "cerrada",
  "en_consolidacion",
  "completada",
  "cancelada",
];
export const PARTICIPANT_STATUSES: readonly ParticipantStatus[] = [
  "interesado",
  "confirmado",
  "retirado",
];

// ── Tipos ────────────────────────────────────────────────────
export interface ClubGroupBuy {
  id: string;
  tenant_id: string;
  title: string;
  slug: string;
  summary: string | null;
  status: GroupBuyStatus;
  opens_at: string;
  closes_at: string | null;
  target_cbm: number | null;
  origin: string | null;
  destination: string | null;
  consolidation_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ClubGroupBuyParticipant {
  id: string;
  tenant_id: string;
  group_buy_id: string;
  member_id: string;
  estimated_cbm: number | null;
  estimated_value_usd: number | null;
  status: ParticipantStatus;
  note: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** Participante + datos del miembro/persona, para la grilla del detalle. */
export interface ParticipantRow extends ClubGroupBuyParticipant {
  member_name: string;
  member_national_id: string | null;
  member_plan: string;
}

/** Compra grupal + volumen comprometido DERIVADO + #participantes, para la lista. */
export interface GroupBuyRow extends ClubGroupBuy {
  /** Suma de estimated_cbm de participantes NO retirados. DERIVADO (no persistido). */
  committed_cbm: number;
  participants_count: number;
}

/** Detalle: la ronda + participantes (con datos del miembro) + comprometido. */
export interface GroupBuyDetail extends GroupBuyRow {
  participants: ParticipantRow[];
}

export interface GroupBuyStats {
  abiertas: number;
  enConsolidacion: number;
  /** CBM comprometido total en rondas abiertas (intención agregada). */
  cbmAbierto: number;
}

// ── Labels / tonos (UI) ──────────────────────────────────────
export function groupBuyStatusLabel(s: GroupBuyStatus): string {
  return {
    abierta: "Abierta",
    cerrada: "Cerrada",
    en_consolidacion: "En consolidación",
    completada: "Completada",
    cancelada: "Cancelada",
  }[s];
}

export function groupBuyStatusTone(
  s: GroupBuyStatus,
): "success" | "warning" | "wine" | "info" | "neutral" {
  return {
    abierta: "success",
    cerrada: "warning",
    en_consolidacion: "wine",
    completada: "info",
    cancelada: "neutral",
  }[s] as "success" | "warning" | "wine" | "info" | "neutral";
}

export function participantStatusLabel(s: ParticipantStatus): string {
  return { interesado: "Interesado", confirmado: "Confirmado", retirado: "Retirado" }[s];
}

export function participantStatusTone(
  s: ParticipantStatus,
): "neutral" | "success" | "danger" {
  return { interesado: "neutral", confirmado: "success", retirado: "danger" }[s] as
    "neutral" | "success" | "danger";
}

/** Estados que cuentan para el volumen comprometido (intención viva). */
export function countsTowardCommitted(s: ParticipantStatus): boolean {
  return s !== "retirado";
}

// ── Validación (sin Zod) ─────────────────────────────────────
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface GroupBuyInput {
  title: string;
  slug: string;
  summary: string | null;
  status: GroupBuyStatus;
  closesAt: string | null; // YYYY-MM-DD o null
  targetCbm: number | null;
  origin: string | null;
  destination: string | null;
}

export interface GroupBuyActionState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof GroupBuyInput, string>>;
  createdId?: string;
}

/** Normaliza una fecha (YYYY-MM-DD) o null. Rechaza formatos no-ISO. */
function normalizeDate(raw: string | null | undefined): { value: string | null; bad: boolean } {
  const s = (raw ?? "").trim();
  if (!s) return { value: null, bad: false };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return { value: null, bad: true };
  return { value: s, bad: false };
}

/** Número opcional ≥ 0; vacío/null → null; negativo/NaN → error. */
function optNonNegNumber(
  raw: number | null | undefined,
): { value: number | null; bad: boolean } {
  if (raw == null || (typeof raw === "number" && Number.isNaN(raw))) {
    return { value: null, bad: false };
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return { value: null, bad: true };
  return { value: n, bad: false };
}

export function validateGroupBuyInput(
  partial: Partial<GroupBuyInput>,
): { input: GroupBuyInput | null; fieldErrors: Partial<Record<keyof GroupBuyInput, string>> | null } {
  const fieldErrors: Partial<Record<keyof GroupBuyInput, string>> = {};

  const title = partial.title?.trim() ?? "";
  if (!title) fieldErrors.title = "El título es requerido";

  const rawSlug = partial.slug?.trim() ?? "";
  const slug = rawSlug || slugify(title);
  if (!slug) {
    fieldErrors.slug = "No se pudo generar el slug (escribe un título o un slug)";
  } else if (!SLUG_RE.test(slug)) {
    fieldErrors.slug = "El slug solo admite minúsculas, números y guiones";
  }

  const status = partial.status ?? "abierta";
  if (!GROUP_BUY_STATUSES.includes(status)) fieldErrors.status = "Estado inválido";

  const closes = normalizeDate(partial.closesAt);
  if (closes.bad) fieldErrors.closesAt = "Fecha inválida (usa el selector)";

  const target = optNonNegNumber(partial.targetCbm);
  if (target.bad) fieldErrors.targetCbm = "El CBM meta debe ser un número ≥ 0";

  if (Object.keys(fieldErrors).length > 0) return { input: null, fieldErrors };
  return {
    input: {
      title,
      slug,
      summary: partial.summary?.trim() || null,
      status,
      closesAt: closes.value,
      targetCbm: target.value,
      origin: partial.origin?.trim() || null,
      destination: partial.destination?.trim() || null,
    },
    fieldErrors: null,
  };
}

// ── Participante ─────────────────────────────────────────────
export interface ParticipantInput {
  memberId: string;
  estimatedCbm: number | null;
  estimatedValueUsd: number | null;
  status: ParticipantStatus;
  note: string | null;
}

export interface ParticipantActionState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof ParticipantInput, string>>;
  participantId?: string;
}

export function validateParticipantInput(
  partial: Partial<ParticipantInput>,
): { input: ParticipantInput | null; fieldErrors: Partial<Record<keyof ParticipantInput, string>> | null } {
  const fieldErrors: Partial<Record<keyof ParticipantInput, string>> = {};

  const memberId = partial.memberId?.trim() ?? "";
  if (!memberId) fieldErrors.memberId = "Falta el miembro";

  const status = partial.status ?? "interesado";
  if (!PARTICIPANT_STATUSES.includes(status)) fieldErrors.status = "Estado inválido";

  const cbm = optNonNegNumber(partial.estimatedCbm);
  if (cbm.bad) fieldErrors.estimatedCbm = "El CBM estimado debe ser un número ≥ 0";

  const value = optNonNegNumber(partial.estimatedValueUsd);
  if (value.bad) fieldErrors.estimatedValueUsd = "El valor estimado debe ser un número ≥ 0";

  if (Object.keys(fieldErrors).length > 0) return { input: null, fieldErrors };
  return {
    input: {
      memberId,
      estimatedCbm: cbm.value,
      estimatedValueUsd: value.value,
      status,
      note: partial.note?.trim() || null,
    },
    fieldErrors: null,
  };
}
