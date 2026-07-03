/**
 * Tipos + helpers PUROS del módulo Nómina · Perfiles de puesto (SDD-0140 · Fase 1).
 * Matchea el schema de supabase/migrations/0204_nomina_positions.sql.
 *
 * Es la Capa 2 del doc `estructura-perfiles-dtdcargo.md`: el PERFIL del puesto,
 * desacoplado de la persona. Sin React, sin server-only → importable client+server.
 * Validador manual (no Zod, patrón del repo).
 *
 * `rbac_role` es una SUGERENCIA/plantilla para el alta unificada; el control real
 * de permisos vive en lib/studio/rbac.ts (matriz en código, SDD-0139).
 */

import { strOrNull, type NominaBadgeTone } from "./employee-types";
import {
  STUDIO_USER_ROLES,
  ROLE_LABELS,
  type StudioUserRole,
} from "../user-types";

// ╔═══════════════════════════════════════════════════════════╗
// ║ Fila persistida                                            ║
// ╚═══════════════════════════════════════════════════════════╝
export type Position = {
  id: string;
  tenant_id: string;
  slug: string;
  title: string;
  area: string;
  rbac_role: StudioUserRole | null;
  triggers: string | null;
  responsibilities: string | null;
  skills: string | null;
  kpi: string | null;
  owner_note: string | null;
  governance_note: string | null;
  sort_order: number;
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

/** Rol RBAC opcional del puesto: el label legible (o "Sin asiento" si es null). */
export function positionRoleLabel(role: StudioUserRole | null): string {
  return role ? ROLE_LABELS[role] : "Sin asiento";
}

/** Tono de badge por rol RBAC (dinero = wine para que salte a la vista). */
export function positionRoleBadgeTone(role: StudioUserRole | null): NominaBadgeTone {
  switch (role) {
    case "admin":
      return "danger";
    case "accounting":
      return "wine";
    case "commercial":
      return "info";
    case "operations":
      return "success";
    case "warehouse":
      return "warning";
    case "marketing":
      return "info";
    case "support":
      return "neutral";
    default:
      return "neutral";
  }
}

/** Opciones para el <select> de rol (incluye "sin asiento" = ""). */
export const POSITION_ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Sin asiento (sin cuenta ERP)" },
  ...STUDIO_USER_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] })),
];

// ── Agrupación por área (para el listado) ─────────────────────
export type PositionGroup = { area: string; positions: Position[] };

/**
 * Agrupa por área respetando el orden (sort_order, luego título). Las áreas
 * aparecen en el orden en que asoma su primer puesto (que ya viene ordenado).
 */
export function groupPositionsByArea(positions: Position[]): PositionGroup[] {
  const order: string[] = [];
  const byArea = new Map<string, Position[]>();
  for (const p of positions) {
    if (!byArea.has(p.area)) {
      byArea.set(p.area, []);
      order.push(p.area);
    }
    byArea.get(p.area)!.push(p);
  }
  return order.map((area) => ({ area, positions: byArea.get(area)! }));
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Validación de input (sin Zod) + estado                     ║
// ╚═══════════════════════════════════════════════════════════╝
export type PositionInput = {
  slug: string;
  title: string;
  area: string;
  rbac_role: StudioUserRole | null;
  triggers: string | null;
  responsibilities: string | null;
  skills: string | null;
  kpi: string | null;
  owner_note: string | null;
  governance_note: string | null;
  active: boolean;
};

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Deriva un slug kebab-case desde el título si el input no trae uno. */
export function slugFromTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita acentos (combining marks)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function isStudioUserRole(v: unknown): v is StudioUserRole {
  return typeof v === "string" && (STUDIO_USER_ROLES as string[]).includes(v);
}

export function validatePositionInput(raw: Record<string, unknown>): {
  input?: PositionInput;
  fieldErrors?: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  const title = String(raw.title ?? "").trim();
  if (!title) errors.title = "Indica el título del puesto.";
  else if (title.length > 120) errors.title = "Título demasiado largo (máx 120).";

  const area = String(raw.area ?? "").trim();
  if (!area) errors.area = "Indica el área.";
  else if (area.length > 80) errors.area = "Área demasiado larga (máx 80).";

  // slug: usa el provisto o lo deriva del título.
  const rawSlug = strOrNull(raw.slug);
  const slug = rawSlug ?? slugFromTitle(title);
  if (!slug || !SLUG_RE.test(slug)) {
    errors.slug = "Slug inválido (usa minúsculas, números y guiones).";
  }

  // rol: "" o null = sin asiento; si viene, debe ser un rol válido.
  const roleRaw = strOrNull(raw.rbac_role);
  let rbac_role: StudioUserRole | null = null;
  if (roleRaw !== null) {
    if (!isStudioUserRole(roleRaw)) errors.rbac_role = "Rol RBAC inválido.";
    else rbac_role = roleRaw;
  }

  if (Object.keys(errors).length > 0) return { fieldErrors: errors };

  return {
    input: {
      slug,
      title,
      area,
      rbac_role,
      triggers: strOrNull(raw.triggers),
      responsibilities: strOrNull(raw.responsibilities),
      skills: strOrNull(raw.skills),
      kpi: strOrNull(raw.kpi),
      owner_note: strOrNull(raw.owner_note),
      governance_note: strOrNull(raw.governance_note),
      active: raw.active === undefined ? true : Boolean(raw.active),
    },
  };
}
