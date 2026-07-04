/**
 * Types, enums, validadores y helpers de label/badge de Bitácora (SDD-0146).
 * Match con migración 0212_bitacora.sql.
 *
 * Convenciones del proyecto:
 *   - Sin Zod — validate*Input() propio.
 *   - Labels en castellano-VE (tuteo, cero voseo, cero anglicismos visibles).
 *   - Tonos = los 6 oficiales de Badge.
 */

import { isIsoDate } from "./dates";

// ─── Enums (text + CHECK en DB) ──────────────────────────────

export const BITACORA_TASK_ESTADOS = [
  "pendiente",
  "en_curso",
  "en_revision",
  "hecho",
] as const;
export type BitacoraTaskEstado = (typeof BITACORA_TASK_ESTADOS)[number];

export const BITACORA_PRIORIDADES = ["baja", "media", "alta"] as const;
export type BitacoraPrioridad = (typeof BITACORA_PRIORIDADES)[number];

export const BITACORA_TASK_TIPOS = ["empleado", "entregable_cliente"] as const;
export type BitacoraTaskTipo = (typeof BITACORA_TASK_TIPOS)[number];

/** Roles válidos para la cola por rol (mismo vocabulario del RBAC). */
export const BITACORA_ASSIGNABLE_ROLES = [
  "admin",
  "commercial",
  "operations",
  "accounting",
  "warehouse",
  "support",
  "marketing",
] as const;
export type BitacoraAssignableRole = (typeof BITACORA_ASSIGNABLE_ROLES)[number];

// ─── Type guards ─────────────────────────────────────────────

export function isBitacoraTaskEstado(v: unknown): v is BitacoraTaskEstado {
  return (
    typeof v === "string" &&
    (BITACORA_TASK_ESTADOS as readonly string[]).includes(v)
  );
}

export function isBitacoraPrioridad(v: unknown): v is BitacoraPrioridad {
  return (
    typeof v === "string" &&
    (BITACORA_PRIORIDADES as readonly string[]).includes(v)
  );
}

export function isBitacoraTaskTipo(v: unknown): v is BitacoraTaskTipo {
  return (
    typeof v === "string" &&
    (BITACORA_TASK_TIPOS as readonly string[]).includes(v)
  );
}

export function isBitacoraAssignableRole(
  v: unknown,
): v is BitacoraAssignableRole {
  return (
    typeof v === "string" &&
    (BITACORA_ASSIGNABLE_ROLES as readonly string[]).includes(v)
  );
}

// ─── META para UI (label + tone de Badge) ────────────────────

export type BitacoraBadgeTone =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "wine"
  | "neutral";

export const ESTADO_META: Record<
  BitacoraTaskEstado,
  { label: string; tone: BitacoraBadgeTone }
> = {
  pendiente: { label: "Pendiente", tone: "neutral" },
  en_curso: { label: "En curso", tone: "info" },
  en_revision: { label: "En revisión", tone: "warning" },
  hecho: { label: "Hecho", tone: "success" },
};

export const PRIORIDAD_META: Record<
  BitacoraPrioridad,
  { label: string; tone: BitacoraBadgeTone }
> = {
  alta: { label: "Alta", tone: "danger" },
  media: { label: "Media", tone: "warning" },
  baja: { label: "Baja", tone: "neutral" },
};

export const TIPO_META: Record<
  BitacoraTaskTipo,
  { label: string; tone: BitacoraBadgeTone }
> = {
  empleado: { label: "Interna", tone: "neutral" },
  entregable_cliente: { label: "Esperando al cliente", tone: "warning" },
};

export const ROLE_QUEUE_LABELS: Record<BitacoraAssignableRole, string> = {
  admin: "Dirección",
  commercial: "Comercial",
  operations: "Operaciones",
  accounting: "Contabilidad",
  warehouse: "Almacén",
  support: "Soporte",
  marketing: "Marketing",
};

/** Regla Kommo vs Bitácora — va también en el empty-state del módulo. */
export const BITACORA_EMPTY_RULE =
  "Kommo = pipeline y venta · Bitácora = compromisos internos accionables";

/** Orden de columnas del tablero (flujo de avance). */
export const ESTADO_FLOW: readonly BitacoraTaskEstado[] = BITACORA_TASK_ESTADOS;

/** Siguiente estado del flujo (o null si ya está en `hecho`). */
export function nextEstado(
  estado: BitacoraTaskEstado,
): BitacoraTaskEstado | null {
  const i = ESTADO_FLOW.indexOf(estado);
  if (i < 0 || i >= ESTADO_FLOW.length - 1) return null;
  return ESTADO_FLOW[i + 1];
}

/** Rank para ordenar por prioridad alta→media→baja (menor = primero). */
export function prioridadRank(p: string): number {
  if (p === "alta") return 0;
  if (p === "media") return 1;
  if (p === "baja") return 2;
  return 3;
}

// ─── Input de tarea manual + validador (sin Zod) ─────────────

export interface BitacoraTaskInput {
  titulo: string;
  descripcion: string | null;
  prioridad: BitacoraPrioridad;
  tipo: BitacoraTaskTipo;
  due_date: string | null; // YYYY-MM-DD
  /** Dueño único (DRI) del pool de asignables. null = sin dueño. */
  assignee_id: string | null;
  /** Cola por rol. Se anula si hay dueño (el dueño gana). */
  assigned_role: BitacoraAssignableRole | null;
  para_agente: boolean;
}

export interface BitacoraActionState {
  ok?: boolean;
  taskId?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validación manual de la tarea (patrón de la casa, sin Zod).
 *
 * Reglas (espejo del post-proceso determinista del spec):
 *   - titulo: requerido, no-blanco, ≤ 300.
 *   - prioridad fuera de enum → 'media' (normaliza, no error).
 *   - tipo fuera de enum → 'empleado' (normaliza).
 *   - due_date: '' → null; si viene, SOLO ISO estricto y fecha real → si no, error.
 *   - assignee_id: si viene, shape uuid → si no, error.
 *   - assigned_role fuera de enum → error (el select de la UI lo acota; una
 *     llamada directa forjada debe fallar ruidoso).
 *   - dueño Y cola a la vez → el dueño gana (assigned_role se anula).
 */
export function validateBitacoraTaskInput(
  partial: Partial<Record<keyof BitacoraTaskInput, unknown>>,
): { input?: BitacoraTaskInput; fieldErrors?: Record<string, string> } {
  const fieldErrors: Record<string, string> = {};

  const tituloRaw = typeof partial.titulo === "string" ? partial.titulo : "";
  const titulo = tituloRaw.trim();
  if (!titulo) {
    fieldErrors.titulo = "El título es obligatorio.";
  } else if (titulo.length > 300) {
    fieldErrors.titulo = "Máximo 300 caracteres.";
  }

  let descripcion: string | null = null;
  if (typeof partial.descripcion === "string") {
    const d = partial.descripcion.trim();
    if (d.length > 4000) {
      fieldErrors.descripcion = "Máximo 4000 caracteres.";
    }
    descripcion = d === "" ? null : d;
  }

  const prioridad: BitacoraPrioridad = isBitacoraPrioridad(partial.prioridad)
    ? partial.prioridad
    : "media";

  const tipo: BitacoraTaskTipo = isBitacoraTaskTipo(partial.tipo)
    ? partial.tipo
    : "empleado";

  let due_date: string | null = null;
  if (typeof partial.due_date === "string" && partial.due_date.trim() !== "") {
    const d = partial.due_date.trim();
    if (!isIsoDate(d)) {
      fieldErrors.due_date = "Fecha inválida (formato AAAA-MM-DD).";
    } else {
      due_date = d;
    }
  }

  let assignee_id: string | null = null;
  if (
    typeof partial.assignee_id === "string" &&
    partial.assignee_id.trim() !== ""
  ) {
    const a = partial.assignee_id.trim();
    if (!UUID_RE.test(a)) {
      fieldErrors.assignee_id = "Dueño inválido.";
    } else {
      assignee_id = a;
    }
  }

  let assigned_role: BitacoraAssignableRole | null = null;
  if (
    typeof partial.assigned_role === "string" &&
    partial.assigned_role.trim() !== ""
  ) {
    const r = partial.assigned_role.trim();
    if (!isBitacoraAssignableRole(r)) {
      fieldErrors.assigned_role = "Rol de cola inválido.";
    } else {
      assigned_role = r;
    }
  }

  // UN dueño por tarea (DRI): si hay dueño, la cola por rol se anula.
  if (assignee_id) assigned_role = null;

  const para_agente =
    partial.para_agente === true ||
    partial.para_agente === "true" ||
    partial.para_agente === "on" ||
    partial.para_agente === "1";

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  return {
    input: {
      titulo,
      descripcion,
      prioridad,
      tipo,
      due_date,
      assignee_id,
      assigned_role,
      para_agente,
    },
  };
}
