/**
 * Types, enums, validators y helpers del módulo Comentarios + @menciones
 * (SDD-0045). Match con la migración 0090_comments.sql.
 *
 * Convenciones del proyecto:
 *   - Sin Zod — validateCommentInput() propio.
 *   - LABELS en castellano-VE.
 *   - Comentarios INTERNOS del equipo (el portal del cliente no los lee).
 */

// ─── Entity types (match CHECK de 0090) ──────────────────────

export type CommentEntityType =
  | "shipment"
  | "client"
  | "invoice"
  | "quote"
  | "dispatch_order"
  | "supplier_bill"
  | "warehouse_receipt_cn"
  | "warehouse_receipt_ve";

export const COMMENT_ENTITY_TYPES: CommentEntityType[] = [
  "shipment",
  "client",
  "invoice",
  "quote",
  "dispatch_order",
  "supplier_bill",
  "warehouse_receipt_cn",
  "warehouse_receipt_ve",
];

/**
 * Label legible + builder de ruta para navegar desde la bandeja de menciones.
 * La ruta usa el `entity_code` cuando la pantalla destino indexa por código
 * (clientes/[markbox]) y el `entity_id` cuando indexa por uuid (tracking/[id]).
 */
export interface CommentEntityMeta {
  label: string;
  /** Construye la href de la entidad para el click en la bandeja. */
  href: (entityId: string, entityCode: string | null) => string;
}

// Entidades con ruta de detalle propia (aterrizan en el record):
//   shipment → tracking/[id] · client → clientes/[markbox] ·
//   invoice → facturacion/[code] · quote → cotizador/[code]
// Las demás (dispatch/tesorería/cn/ve) son lista+drawer (sin ruta de record) →
// aterrizan en la lista. Nota: este href también lo consume `revalidatePath`
// en las actions, por eso NO lleva query string (`?highlight=`) — rompería el
// revalidate (la query no es parte de la cache key de Next).
export const COMMENT_ENTITY_LABELS: Record<CommentEntityType, CommentEntityMeta> = {
  shipment: {
    label: "Embarque",
    href: (id) => `/studio/tracking/${id}`,
  },
  client: {
    label: "Cliente",
    href: (id, code) => (code ? `/studio/clientes/${code}` : `/studio/clientes`),
  },
  invoice: {
    label: "Factura",
    href: (id, code) => (code ? `/studio/facturacion/${code}` : `/studio/facturacion`),
  },
  quote: {
    label: "Estimado",
    href: (id, code) => (code ? `/studio/cotizador/${code}` : `/studio/cotizador`),
  },
  dispatch_order: {
    label: "Orden de despacho",
    href: () => `/studio/despacho`,
  },
  supplier_bill: {
    label: "Cuenta por pagar",
    href: () => `/studio/tesoreria`,
  },
  warehouse_receipt_cn: {
    label: "Recepción CN",
    href: () => `/studio/cn`,
  },
  warehouse_receipt_ve: {
    label: "Recepción VE",
    href: () => `/studio/ve`,
  },
};

export function entityTypeLabel(t: CommentEntityType): string {
  return COMMENT_ENTITY_LABELS[t]?.label ?? t;
}

export function entityHref(
  t: CommentEntityType,
  entityId: string,
  entityCode: string | null,
): string {
  const meta = COMMENT_ENTITY_LABELS[t];
  return meta ? meta.href(entityId, entityCode) : "/studio";
}

// ─── Reacciones (5 fijos, match CHECK de 0090) ───────────────

export const REACTION_EMOJIS = ["👍", "✓", "👀", "🔥", "❓"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export function isReactionEmoji(s: string): s is ReactionEmoji {
  return (REACTION_EMOJIS as readonly string[]).includes(s);
}

// ─── Entity rows (match schema 0090) ─────────────────────────

export interface Comment {
  id: string;
  tenant_id: string;
  entity_type: CommentEntityType;
  entity_id: string;
  entity_code: string | null;
  author_id: string | null;
  body: string;
  parent_id: string | null;
  edited_at: string | null;
  created_at: string;
  deleted_at: string | null;
}

export interface CommentMention {
  id: string;
  comment_id: string;
  tenant_id: string;
  mentioned_user_id: string;
  read_at: string | null;
  created_at: string;
}

export interface CommentReaction {
  id: string;
  comment_id: string;
  tenant_id: string;
  user_id: string;
  emoji: ReactionEmoji;
  created_at: string;
}

/** Usuario mínimo del tenant — lo que necesita el parser + el componente. */
export interface CommentTenantUser {
  id: string;
  name: string;
  /** Iniciales para el Avatar (max 2). */
  avatar: string;
  /** Rol legible en es-VE (ej "Comercial"). */
  role: string;
}

/**
 * Comentario enriquecido para render: autor resuelto, reacciones agrupadas por
 * emoji (con los userIds que reaccionaron), mi reacción actual, y los userIds
 * mencionados.
 */
export interface CommentWithMeta extends Comment {
  author: { name: string; avatar: string; role: string } | null;
  /** { emoji: [userId, …] } */
  reactions: Partial<Record<ReactionEmoji, string[]>>;
  /** Emojis con los que YO (el caller) reaccioné. */
  myReactions: ReactionEmoji[];
  /** userIds mencionados en este comentario. */
  mentionedUserIds: string[];
}

/** Item de la bandeja "Menciones". */
export interface MentionInboxItem {
  mention_id: string;
  comment_id: string;
  read_at: string | null;
  created_at: string;
  entity_type: CommentEntityType;
  entity_id: string;
  entity_code: string | null;
  body: string;
  author: { name: string; avatar: string; role: string } | null;
}

// ─── Validación (sin Zod) ────────────────────────────────────

export const COMMENT_MAX_LENGTH = 4000;

export type CommentFieldErrors = Partial<Record<string, string>>;

export interface CommentActionState {
  ok?: boolean;
  error?: string;
  fieldErrors?: CommentFieldErrors;
  commentId?: string;
}

export interface CommentInput {
  body: string;
}

/**
 * Valida el cuerpo de un comentario: no vacío, no solo-espacios, ≤ 4000 chars.
 * Devuelve el body trimmeado en `input` si pasa, o `fieldErrors` si no.
 */
export function validateCommentInput(
  partial: Partial<CommentInput>,
): { input?: CommentInput; fieldErrors?: CommentFieldErrors } {
  const fieldErrors: CommentFieldErrors = {};
  const raw = partial.body ?? "";
  const trimmed = raw.trim();

  if (trimmed.length === 0) {
    fieldErrors.body = "El comentario no puede estar vacío";
  } else if (raw.length > COMMENT_MAX_LENGTH) {
    fieldErrors.body = `El comentario supera el máximo de ${COMMENT_MAX_LENGTH} caracteres`;
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };
  return { input: { body: trimmed } };
}

// ─── Helpers de display ──────────────────────────────────────

/** Timestamp relativo en es-VE: "ahora" / "hace 5 min" / "hace 3 h" / "12 may". */
export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `hace ${hr} h`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `hace ${days} ${days === 1 ? "día" : "días"}`;
  return new Date(iso).toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "short",
  });
}
