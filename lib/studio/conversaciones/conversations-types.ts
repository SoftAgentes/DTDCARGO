/**
 * Tipos + labels + tones + validators del módulo Conversaciones (SDD-0056 · Fase 1).
 * Matchea el schema de supabase/migrations/0106_conversaciones.sql.
 *
 * Sin Zod (convención del Studio): validadores manuales `validate*Input()` que
 * devuelven `{ input?, fieldErrors? }`.
 */

import type { BadgeTone } from "@/app/studio/_components/ui/Badge";

// ─────────────────────────────────────────────────────────────
// Enums (matchean Postgres)
// ─────────────────────────────────────────────────────────────

export type ConversationChannel = "whatsapp" | "email" | "portal";
export type ConversationStatus = "abierto" | "pendiente" | "resuelto";
export type ConversationDirection = "in" | "out";

export const CONVERSATION_CHANNELS: ConversationChannel[] = [
  "whatsapp",
  "email",
  "portal",
];
export const CONVERSATION_STATUSES: ConversationStatus[] = [
  "abierto",
  "pendiente",
  "resuelto",
];
export const CONVERSATION_DIRECTIONS: ConversationDirection[] = ["in", "out"];

export function isConversationChannel(v: unknown): v is ConversationChannel {
  return typeof v === "string" && CONVERSATION_CHANNELS.includes(v as ConversationChannel);
}
export function isConversationStatus(v: unknown): v is ConversationStatus {
  return typeof v === "string" && CONVERSATION_STATUSES.includes(v as ConversationStatus);
}
export function isConversationDirection(v: unknown): v is ConversationDirection {
  return typeof v === "string" && CONVERSATION_DIRECTIONS.includes(v as ConversationDirection);
}

// ─────────────────────────────────────────────────────────────
// Row types (DB)
// ─────────────────────────────────────────────────────────────

export type Conversation = {
  id: string;
  tenant_id: string;
  client_id: string;
  ref: string | null;
  channel: ConversationChannel;
  status: ConversationStatus;
  is_case: boolean;
  assigned_to: string | null;
  subject: string | null;
  last_message_at: string | null;
  unread_count: number;
  external_ref: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type ConversationMessage = {
  id: string;
  tenant_id: string;
  conversation_id: string;
  direction: ConversationDirection;
  author_name: string | null;
  author_user_id: string | null;
  body: string;
  external_msg_id: string | null;
  sent_at: string;
  created_at: string;
};

/** Datos del cliente hidratados en el hilo (join con clients). */
export type ConversationClientInfo = {
  client_id: string;
  markbox: string;
  client_name: string;
  email: string | null;
  phone: string | null;
};

/** Agente asignado (join con users del tenant). */
export type ConversationAgent = {
  id: string;
  name: string;
};

/** Fila de la lista: conversation + cliente + agente + preview del último mensaje. */
export type ConversationRow = Conversation &
  ConversationClientInfo & {
    agent: ConversationAgent | null;
    last_message_preview: string | null;
    last_message_direction: ConversationDirection | null;
  };

/** Contexto del cliente para el panel lateral del hilo (links, no duplicar data). */
export type ConversationClientContext = {
  client_id: string;
  markbox: string;
  client_name: string;
  email: string | null;
  phone: string | null;
  /** Envíos activos (no terminales) del cliente. */
  activeShipments: { id: string; code: string; status: string }[];
  /** Saldo CxC pendiente (Σ total − paid de facturas no-borrador), moneda dominante. */
  outstandingBalance: number;
  outstandingCurrency: string;
};

// ─────────────────────────────────────────────────────────────
// KPIs de la bandeja
// ─────────────────────────────────────────────────────────────

export type ConversationKpis = {
  /** Abiertas (status='abierto', no borradas). */
  open: number;
  /** Mensajes sin leer (Σ unread_count de las abiertas). */
  unread: number;
  /** Sin asignar (assigned_to null, no resueltas). */
  unassigned: number;
  /** Casos abiertos (is_case, no resueltas). */
  openCases: number;
  /** Resueltas hoy (status='resuelto', updated_at = hoy). */
  resolvedToday: number;
};

// ─────────────────────────────────────────────────────────────
// Labels + Tones
// ─────────────────────────────────────────────────────────────

export const CHANNEL_LABELS: Record<ConversationChannel, string> = {
  whatsapp: "WhatsApp",
  email: "Email",
  portal: "Portal",
};

export const CHANNEL_TONES: Record<ConversationChannel, BadgeTone> = {
  whatsapp: "success",
  email: "info",
  portal: "wine",
};

export const STATUS_LABELS: Record<ConversationStatus, string> = {
  abierto: "Abierto",
  pendiente: "Pendiente",
  resuelto: "Resuelto",
};

export const STATUS_TONES: Record<ConversationStatus, BadgeTone> = {
  abierto: "warning",
  pendiente: "info",
  resuelto: "success",
};

export function channelLabel(ch: ConversationChannel): string {
  return CHANNEL_LABELS[ch];
}
export function channelTone(ch: ConversationChannel): BadgeTone {
  return CHANNEL_TONES[ch];
}
export function statusLabel(s: ConversationStatus): string {
  return STATUS_LABELS[s];
}
export function statusTone(s: ConversationStatus): BadgeTone {
  return STATUS_TONES[s];
}

export const STATUS_OPTIONS: { value: ConversationStatus; label: string }[] =
  CONVERSATION_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }));

export const CHANNEL_OPTIONS: { value: ConversationChannel; label: string }[] =
  CONVERSATION_CHANNELS.map((c) => ({ value: c, label: CHANNEL_LABELS[c] }));

/**
 * "Antigüedad" legible del hilo (V1 muestra antigüedad, sin SLA timers —
 * decisión #4 diferida). Recibe ISO + ahora; devuelve "hace X".
 */
export function relativeAge(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diffMs = now.getTime() - then;
  if (diffMs < 0) return "ahora";
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "ayer";
  if (days < 30) return `hace ${days} d`;
  const months = Math.floor(days / 30);
  return `hace ${months} mes${months > 1 ? "es" : ""}`;
}

// ─────────────────────────────────────────────────────────────
// Filtros de la lista (UI client-side)
// ─────────────────────────────────────────────────────────────

export type ConversationStatusFilter = ConversationStatus | "todos";
export type ConversationChannelFilter = ConversationChannel | "all";

/**
 * Filtra una lista de filas por estado/canal/búsqueda (cliente/MARKBOX/ref).
 * Función pura para testear el filtrado de la bandeja sin montar React.
 */
export function filterConversations(
  rows: ConversationRow[],
  opts: {
    status?: ConversationStatusFilter;
    channel?: ConversationChannelFilter;
    search?: string;
  },
): ConversationRow[] {
  const status = opts.status ?? "todos";
  const channel = opts.channel ?? "all";
  const q = (opts.search ?? "").trim().toLowerCase();
  return rows.filter((c) => {
    if (status !== "todos" && c.status !== status) return false;
    if (channel !== "all" && c.channel !== channel) return false;
    if (q) {
      const hay =
        c.client_name.toLowerCase().includes(q) ||
        c.markbox.toLowerCase().includes(q) ||
        (c.ref ?? "").toLowerCase().includes(q);
      if (!hay) return false;
    }
    return true;
  });
}

// ─────────────────────────────────────────────────────────────
// Action state (compartido) + validators
// ─────────────────────────────────────────────────────────────

export type ConversationActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Email enviado por Resend (cliente con email). Para feedback en UI. */
  emailSent?: boolean;
};

export type SendReplyInput = {
  conversation_id: string;
  body: string;
};

export function validateSendReplyInput(
  input: Partial<SendReplyInput>,
): { input?: SendReplyInput; fieldErrors?: Record<string, string> } {
  const errors: Record<string, string> = {};
  const conversation_id = input.conversation_id?.trim();
  if (!conversation_id) errors.conversation_id = "Falta el ID de la conversación.";
  const body = input.body?.trim();
  if (!body) errors.body = "Escribe una respuesta.";
  if (body && body.length > 4000) errors.body = "El mensaje es muy largo (máx 4000).";
  if (Object.keys(errors).length > 0) return { fieldErrors: errors };
  return { input: { conversation_id: conversation_id!, body: body! } };
}

export type SetStatusInput = {
  conversation_id: string;
  status: ConversationStatus;
};

export function validateSetStatusInput(
  input: Partial<SetStatusInput>,
): { input?: SetStatusInput; fieldErrors?: Record<string, string> } {
  const errors: Record<string, string> = {};
  const conversation_id = input.conversation_id?.trim();
  if (!conversation_id) errors.conversation_id = "Falta el ID de la conversación.";
  if (!isConversationStatus(input.status)) errors.status = "Estado inválido.";
  if (Object.keys(errors).length > 0) return { fieldErrors: errors };
  return {
    input: { conversation_id: conversation_id!, status: input.status as ConversationStatus },
  };
}

export type AssignInput = {
  conversation_id: string;
  /** null = desasignar. */
  assigned_to: string | null;
};

export function validateAssignInput(
  input: Partial<AssignInput>,
): { input?: AssignInput; fieldErrors?: Record<string, string> } {
  const errors: Record<string, string> = {};
  const conversation_id = input.conversation_id?.trim();
  if (!conversation_id) errors.conversation_id = "Falta el ID de la conversación.";
  if (Object.keys(errors).length > 0) return { fieldErrors: errors };
  return {
    input: {
      conversation_id: conversation_id!,
      assigned_to: input.assigned_to?.trim() || null,
    },
  };
}

export type MarkCaseInput = {
  conversation_id: string;
  is_case: boolean;
};

export function validateMarkCaseInput(
  input: Partial<MarkCaseInput>,
): { input?: MarkCaseInput; fieldErrors?: Record<string, string> } {
  const errors: Record<string, string> = {};
  const conversation_id = input.conversation_id?.trim();
  if (!conversation_id) errors.conversation_id = "Falta el ID de la conversación.";
  if (typeof input.is_case !== "boolean") errors.is_case = "Valor de caso inválido.";
  if (Object.keys(errors).length > 0) return { fieldErrors: errors };
  return {
    input: { conversation_id: conversation_id!, is_case: input.is_case as boolean },
  };
}

// ─────────────────────────────────────────────────────────────
// Quick replies (plantillas estáticas V1 · mismas del Norte)
// ─────────────────────────────────────────────────────────────

export const QUICK_REPLIES: { id: string; label: string; text: string }[] = [
  {
    id: "qr-1",
    label: "Saludo",
    text: "Buenos días, gracias por escribir a DTD Cargo. ¿En qué puedo ayudarte?",
  },
  {
    id: "qr-2",
    label: "ETA en proceso",
    text: "Estamos verificando el estatus de tu embarque con la naviera. Te confirmo el ETA en breve.",
  },
  {
    id: "qr-3",
    label: "Tracking portal",
    text: "Puedes seguir tu embarque en tiempo real desde el portal del cliente con tu Shipping Mark.",
  },
  {
    id: "qr-4",
    label: "Caso abierto",
    text: "Abrí tu caso y lo estoy revisando con el equipo de almacén. Te mantengo al tanto.",
  },
  {
    id: "qr-5",
    label: "Cierre",
    text: "¿Hay algo más en lo que pueda ayudarte? Quedamos atentos. Con confianza, de China a tu puerta.",
  },
];
