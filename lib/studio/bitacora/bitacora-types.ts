/**
 * Types, enums, validadores y helpers de label/badge de Bitácora (SDD-0146).
 * Match con migración 0214_bitacora.sql.
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

/** Tipo de reunión/acta (CHECK en bitacora_meetings). */
export const BITACORA_MEETING_TIPOS = ["interna", "cliente"] as const;
export type MeetingTipo = (typeof BITACORA_MEETING_TIPOS)[number];

/** Estado del acta: la IA propone en borrador, el humano confirma. */
export const BITACORA_MEETING_ESTADOS = ["borrador", "confirmada"] as const;
export type MeetingEstado = (typeof BITACORA_MEETING_ESTADOS)[number];

/** Visibilidad del acta (toggle "Reunión confidencial"). */
export const BITACORA_MEETING_VISIBILIDADES = ["equipo", "gestores"] as const;
export type MeetingVisibilidad = (typeof BITACORA_MEETING_VISIBILIDADES)[number];

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

export function isMeetingTipo(v: unknown): v is MeetingTipo {
  return (
    typeof v === "string" &&
    (BITACORA_MEETING_TIPOS as readonly string[]).includes(v)
  );
}

export function isMeetingVisibilidad(v: unknown): v is MeetingVisibilidad {
  return (
    typeof v === "string" &&
    (BITACORA_MEETING_VISIBILIDADES as readonly string[]).includes(v)
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

// ─── Actas / reuniones (Fase 2) ──────────────────────────────

export const MEETING_TIPO_META: Record<
  MeetingTipo,
  { label: string; tone: BitacoraBadgeTone }
> = {
  interna: { label: "Reunión interna", tone: "neutral" },
  cliente: { label: "Con cliente", tone: "info" },
};

/** Próxima reunión dentro del acta. */
export interface ActaProxima {
  fecha: string | null; // YYYY-MM-DD | null
  foco: string | null;
}

/** Forma canónica del jsonb `acta` en bitacora_meetings (columna `acta`). */
export interface ActaData {
  puntos: string[];
  hablaron: string[];
  decisiones: string[];
  pendientes: string[];
  proxima_reunion: ActaProxima;
}

/** Input del formulario de ingesta (pegar transcripción). */
export interface MeetingDraftInput {
  tipo: MeetingTipo;
  transcript: string;
  /** Cliente real vinculado (SDD-0108) — mutuamente excluyente con contacto_libre. */
  client_id: string | null;
  /** Lead sin registrar (texto libre) cuando no hay cliente en el sistema. */
  contacto_libre: string | null;
  /**
   * Path del audio en el bucket `bitacora` cuando la transcripción vino de una
   * grabación/archivo (Fase 3). null en el flujo de solo-texto. La ACTION valida
   * que pertenezca al tenant del caller (`isValidMeetingAudioPath`) antes de
   * persistirlo en `bitacora_meetings.audio_path`.
   */
  audio_path: string | null;
}

/** Mínimo de caracteres de transcripción para habilitar el análisis con IA. */
export const TRANSCRIPT_MIN_CHARS = 20;

/**
 * Valida el borrador de ingesta (sin Zod). Reglas:
 *   - tipo fuera de enum → error (el segmented lo acota; forjado debe fallar).
 *   - transcript: requerido, ≥ TRANSCRIPT_MIN_CHARS tras trim.
 *   - client_id: si viene, shape uuid → si no, error.
 *   - tipo cliente: se pide vincular cliente O escribir el contacto libre.
 */
export function validateMeetingDraftInput(
  partial: Partial<Record<keyof MeetingDraftInput, unknown>>,
): { input?: MeetingDraftInput; fieldErrors?: Record<string, string> } {
  const fieldErrors: Record<string, string> = {};

  const tipo: MeetingTipo = isMeetingTipo(partial.tipo)
    ? partial.tipo
    : "interna";
  if (!isMeetingTipo(partial.tipo)) {
    fieldErrors.tipo = "Tipo de reunión inválido.";
  }

  const transcript =
    typeof partial.transcript === "string" ? partial.transcript.trim() : "";
  if (transcript.length < TRANSCRIPT_MIN_CHARS) {
    fieldErrors.transcript = `Pega al menos ${TRANSCRIPT_MIN_CHARS} caracteres de la conversación.`;
  }

  let client_id: string | null = null;
  if (typeof partial.client_id === "string" && partial.client_id.trim() !== "") {
    const c = partial.client_id.trim();
    if (!UUID_RE.test(c)) {
      fieldErrors.client_id = "Cliente inválido.";
    } else {
      client_id = c;
    }
  }

  let contacto_libre: string | null = null;
  if (typeof partial.contacto_libre === "string") {
    const t = partial.contacto_libre.trim();
    if (t.length > 300) {
      fieldErrors.contacto_libre = "Máximo 300 caracteres.";
    }
    contacto_libre = t === "" ? null : t;
  }

  if (tipo === "cliente" && !client_id && !contacto_libre) {
    fieldErrors.contacto_libre =
      "Vincula un cliente o escribe con quién fue la conversación.";
  }

  // audio_path: solo se transporta un string acotado; el shape/tenant lo re-valida
  // la action con isValidMeetingAudioPath (tiene el tenant del caller). Aquí solo
  // se recorta y se normaliza a null (nunca bloquea la ingesta por el puntero).
  let audio_path: string | null = null;
  if (typeof partial.audio_path === "string") {
    const a = partial.audio_path.trim();
    audio_path = a === "" || a.length > 300 ? null : a;
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  return { input: { tipo, transcript, client_id, contacto_libre, audio_path } };
}

// ─── Confirmación del acta (patch del acta + tareas revisadas) ─

/** Una tarea revisada por el humano, lista para la RPC de confirmación. */
export interface ConfirmTaskInput {
  titulo: string;
  descripcion: string | null;
  prioridad: BitacoraPrioridad;
  tipo: BitacoraTaskTipo;
  due_date: string | null;
  para_agente: boolean;
  /** Dueño resuelto/reasignado (uuid) o null (sin asignar). */
  assignee_user_id: string | null;
  /** Nombre crudo que sugirió la IA (se conserva aunque no matchee). */
  responsable_nombre: string | null;
  checklist: string[];
}

/** Payload de la confirmación (patch del acta + tareas). */
export interface ConfirmActaInput {
  meetingId: string;
  titulo: string;
  resumen: string;
  visibilidad: MeetingVisibilidad;
  acta: ActaData;
  tasks: ConfirmTaskInput[];
}

/** Tope de tareas por confirmación (espejo del guard de la RPC). */
export const CONFIRM_TASKS_MAX = 50;

/**
 * Valida el payload de confirmación en el servidor (la RPC re-valida y es
 * transaccional; esto da mensajes limpios antes de gastar el round-trip).
 */
export function validateConfirmActaInput(
  raw: unknown,
): { input?: ConfirmActaInput; error?: string } {
  if (!raw || typeof raw !== "object") return { error: "Datos inválidos." };
  const r = raw as Record<string, unknown>;

  const meetingId = typeof r.meetingId === "string" ? r.meetingId.trim() : "";
  if (!UUID_RE.test(meetingId)) return { error: "Falta la reunión a confirmar." };

  const titulo =
    typeof r.titulo === "string" ? r.titulo.trim().slice(0, 300) : "";
  if (!titulo) return { error: "El acta necesita un título." };

  const resumen = typeof r.resumen === "string" ? r.resumen.trim() : "";

  const visibilidad: MeetingVisibilidad = isMeetingVisibilidad(r.visibilidad)
    ? r.visibilidad
    : "equipo";

  const actaRaw = (r.acta ?? {}) as Record<string, unknown>;
  const acta: ActaData = {
    puntos: cleanStringArray(actaRaw.puntos),
    hablaron: cleanStringArray(actaRaw.hablaron),
    decisiones: cleanStringArray(actaRaw.decisiones),
    pendientes: cleanStringArray(actaRaw.pendientes),
    proxima_reunion: normalizeProxima(actaRaw.proxima_reunion),
  };

  const rawTasks = Array.isArray(r.tasks) ? r.tasks : [];
  if (rawTasks.length > CONFIRM_TASKS_MAX) {
    return { error: `Máximo ${CONFIRM_TASKS_MAX} tareas por acta.` };
  }

  const tasks: ConfirmTaskInput[] = [];
  for (const t of rawTasks) {
    if (!t || typeof t !== "object") continue;
    const tt = t as Record<string, unknown>;
    const tTitulo =
      typeof tt.titulo === "string" ? tt.titulo.trim().slice(0, 300) : "";
    if (!tTitulo) return { error: "Hay una tarea sin título. Complétala o quítala." };

    const assignee =
      typeof tt.assignee_user_id === "string" && UUID_RE.test(tt.assignee_user_id.trim())
        ? tt.assignee_user_id.trim()
        : null;

    tasks.push({
      titulo: tTitulo,
      descripcion:
        typeof tt.descripcion === "string" && tt.descripcion.trim() !== ""
          ? tt.descripcion.trim().slice(0, 4000)
          : null,
      prioridad: isBitacoraPrioridad(tt.prioridad) ? tt.prioridad : "media",
      tipo: isBitacoraTaskTipo(tt.tipo) ? tt.tipo : "empleado",
      due_date:
        typeof tt.due_date === "string" && isIsoDate(tt.due_date.trim())
          ? tt.due_date.trim()
          : null,
      para_agente: tt.para_agente === true,
      assignee_user_id: assignee,
      responsable_nombre:
        typeof tt.responsable_nombre === "string" && tt.responsable_nombre.trim() !== ""
          ? tt.responsable_nombre.trim().slice(0, 200)
          : null,
      checklist: cleanStringArray(tt.checklist).map((s) => s.slice(0, 500)),
    });
  }

  return {
    input: { meetingId, titulo, resumen, visibilidad, acta, tasks },
  };
}

function cleanStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter((x) => x.length > 0);
}

function normalizeProxima(v: unknown): ActaProxima {
  if (!v || typeof v !== "object") return { fecha: null, foco: null };
  const p = v as Record<string, unknown>;
  const fecha =
    typeof p.fecha === "string" && isIsoDate(p.fecha.trim()) ? p.fecha.trim() : null;
  const foco =
    typeof p.foco === "string" && p.foco.trim() !== "" ? p.foco.trim() : null;
  return { fecha, foco };
}
