/**
 * Tipos + validadores del Club DTD (SDD-0116, Slice A · membresía).
 * DATA PURA (sin React, sin server-only). Convención del Studio: enums = uniones
 * de string-literal (espejo de los CHECK de la migración 0185), sin Zod.
 *
 * Decisiones del founder (2026-06-28): D1 miembro = miembro de Academia ·
 * D3 planes comunidad/importador/mayorista · D4 gratis (sin cuota/vigencia) ·
 * D6 RBAC commercial+support. La membresía se ancla a una PERSONA por cédula
 * (SDD-0106/0107) — reusamos los helpers de cédula de la Academia.
 */

import {
  isValidStudentCi,
  formatStudentCi,
  normalizeCedula,
} from "@/lib/studio/academia/types";

export { isValidStudentCi, formatStudentCi, normalizeCedula };

// ── Enums (espejo de los CHECK de 0185) ──────────────────────
export type ClubPlan = "comunidad" | "importador" | "mayorista";
export type ClubMemberStatus = "activa" | "pausada" | "cancelada";
/** De dónde entró el miembro. En DB es texto libre; la UI ofrece este set. */
export type ClubMemberSource = "academia" | "referido" | "evento" | "manual";

export const CLUB_PLANS: readonly ClubPlan[] = ["comunidad", "importador", "mayorista"];
export const CLUB_MEMBER_STATUSES: readonly ClubMemberStatus[] = ["activa", "pausada", "cancelada"];
export const CLUB_MEMBER_SOURCES: readonly ClubMemberSource[] = [
  "academia",
  "referido",
  "evento",
  "manual",
];

// ── Tipos ────────────────────────────────────────────────────
export interface ClubMember {
  id: string;
  tenant_id: string;
  person_id: string;
  client_markbox: string | null;
  plan: ClubPlan;
  status: ClubMemberStatus;
  joined_at: string;
  /** D4 (gratis): nullable y sin uso en Slice A. */
  current_period_end: string | null;
  source: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** Miembro + datos denormalizados de su persona, para el listado. */
export interface ClubMemberRow extends ClubMember {
  person_name: string;
  person_national_id: string | null;
  /** Shipping Mark del perfil de carga si la persona ya es cliente DTD; null si no. */
  cargo_markbox: string | null;
  /** D1: ¿la persona es miembro de la Academia (≥1 inscripción)? Gate de elegibilidad. */
  is_academy_member: boolean;
}

export interface ClubStats {
  /** Miembros vivos (no soft-deleted). */
  miembros: number;
  activos: number;
  importadores: number;
  mayoristas: number;
}

// ── Labels / tonos (UI) ──────────────────────────────────────
export function planLabel(p: ClubPlan): string {
  return { comunidad: "Comunidad", importador: "Importador", mayorista: "Mayorista" }[p];
}

/** Tono de Badge para el plan (tonos del sistema). */
export function planBadgeTone(p: ClubPlan): "neutral" | "info" | "wine" {
  return { comunidad: "neutral", importador: "info", mayorista: "wine" }[p] as
    "neutral" | "info" | "wine";
}

export function memberStatusLabel(s: ClubMemberStatus): string {
  return { activa: "Activa", pausada: "Pausada", cancelada: "Cancelada" }[s];
}

/** Tono de Badge para el estado de la membresía. */
export function memberStatusTone(s: ClubMemberStatus): "success" | "warning" | "neutral" {
  return { activa: "success", pausada: "warning", cancelada: "neutral" }[s] as
    "success" | "warning" | "neutral";
}

export function sourceLabel(s: string | null): string {
  if (!s) return "—";
  const map: Record<string, string> = {
    academia: "Academia",
    referido: "Referido",
    evento: "Evento",
    manual: "Manual",
  };
  return map[s] ?? s;
}

// ── Validación (sin Zod) ─────────────────────────────────────

/** Alta de miembro: ancla a una persona por cédula (requerida). */
export interface ClubMemberInput {
  /** Cédula/RIF del miembro (ancla a la persona; requerida). */
  ci: string;
  /** Nombre (para crear la persona si es nueva). */
  name: string;
  email: string | null;
  plan: ClubPlan;
  status: ClubMemberStatus;
  clientMarkbox: string | null;
  source: ClubMemberSource | null;
  notes: string | null;
}

/** Edición: la persona no cambia; solo plan/estado/markbox/origen/notas. */
export interface ClubMemberEditInput {
  plan: ClubPlan;
  status: ClubMemberStatus;
  clientMarkbox: string | null;
  source: ClubMemberSource | null;
  notes: string | null;
}

export interface ClubMemberActionState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof ClubMemberInput, string>>;
  createdId?: string;
  /** Contexto de la persona resuelta por cédula, para feedback de la UX. */
  person?: {
    created: boolean;
    name: string;
    /** Shipping Mark si la persona ya es cliente de carga; null si no. */
    cargoMarkbox: string | null;
    /** D1: ¿ya es miembro de la Academia? (aviso si no, no bloquea el alta). */
    isAcademyMember: boolean;
  };
}

/** Validación laxa de email (solo si viene); el campo es opcional. */
function looksLikeEmail(s: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);
}

export function validateClubMemberInput(
  partial: Partial<ClubMemberInput>,
): { input: ClubMemberInput | null; fieldErrors: Partial<Record<keyof ClubMemberInput, string>> | null } {
  const fieldErrors: Partial<Record<keyof ClubMemberInput, string>> = {};

  // Cédula: requerida y anclable a una persona.
  const ciRaw = partial.ci?.trim() ?? "";
  if (!ciRaw) fieldErrors.ci = "La cédula del miembro es requerida";
  else if (!isValidStudentCi(ciRaw)) {
    fieldErrors.ci = "Cédula inválida. Ej: V-18.452.110 o J-12345678-9.";
  }

  const name = partial.name?.trim() ?? "";
  if (!name) fieldErrors.name = "El nombre del miembro es requerido";

  const email = partial.email?.trim() ?? "";
  if (email && !looksLikeEmail(email)) fieldErrors.email = "Correo inválido";

  const plan = partial.plan ?? "comunidad";
  if (!CLUB_PLANS.includes(plan)) fieldErrors.plan = "Plan inválido";

  const status = partial.status ?? "activa";
  if (!CLUB_MEMBER_STATUSES.includes(status)) fieldErrors.status = "Estado inválido";

  let source: ClubMemberSource | null = null;
  if (partial.source != null && String(partial.source).trim() !== "") {
    if (!CLUB_MEMBER_SOURCES.includes(partial.source)) fieldErrors.source = "Origen inválido";
    else source = partial.source;
  }

  if (Object.keys(fieldErrors).length > 0) return { input: null, fieldErrors };
  return {
    input: {
      // Se guarda la cédula en formato canónico visible; el ancla usa normalizeCedula.
      ci: formatStudentCi(ciRaw),
      name,
      email: email || null,
      plan,
      status,
      clientMarkbox: partial.clientMarkbox?.trim() || null,
      source,
      notes: partial.notes?.trim() || null,
    },
    fieldErrors: null,
  };
}

export function validateClubMemberEditInput(
  partial: Partial<ClubMemberEditInput>,
): { input: ClubMemberEditInput | null; fieldErrors: Partial<Record<keyof ClubMemberEditInput, string>> | null } {
  const fieldErrors: Partial<Record<keyof ClubMemberEditInput, string>> = {};

  const plan = partial.plan ?? "comunidad";
  if (!CLUB_PLANS.includes(plan)) fieldErrors.plan = "Plan inválido";

  const status = partial.status ?? "activa";
  if (!CLUB_MEMBER_STATUSES.includes(status)) fieldErrors.status = "Estado inválido";

  let source: ClubMemberSource | null = null;
  if (partial.source != null && String(partial.source).trim() !== "") {
    if (!CLUB_MEMBER_SOURCES.includes(partial.source)) fieldErrors.source = "Origen inválido";
    else source = partial.source;
  }

  if (Object.keys(fieldErrors).length > 0) return { input: null, fieldErrors };
  return {
    input: {
      plan,
      status,
      clientMarkbox: partial.clientMarkbox?.trim() || null,
      source,
      notes: partial.notes?.trim() || null,
    },
    fieldErrors: null,
  };
}
