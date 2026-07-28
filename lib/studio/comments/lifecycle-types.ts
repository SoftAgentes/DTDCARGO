import type { CommentWithMeta } from "./types";

export const COMMENT_UNDO_WINDOW_MS = 10_000;
export const COMMENT_ORDINARY_RESTORE_WINDOW_MS = 30 * 24 * 60 * 60 * 1_000;
export const COMMENT_EXCEPTIONAL_RESTORE_WINDOW_MS = 90 * 24 * 60 * 60 * 1_000;

export type CommentLifecycleState =
  | "active"
  | "deleted_undoable"
  | "deleted_restorable"
  | "deleted_exceptional"
  | "retained_not_ordinary_restorable";

export type CommentRestoreMode = "undo" | "ordinary" | "exceptional";

export type CommentLifecycleCode =
  | "deleted"
  | "restored"
  | "idempotent_replay"
  | "not_allowed"
  | "unsupported_context"
  | "protected_context"
  | "state_conflict"
  | "operation_conflict"
  | "undo_expired"
  | "ordinary_window_expired"
  | "not_ordinary_restorable";

export interface CommentLifecycleResult {
  ok: boolean;
  code: CommentLifecycleCode;
  commentId?: string;
  state?: CommentLifecycleState;
  correlationId?: string | null;
  deletedAt?: string | null;
  undoExpiresAt?: string | null;
  error?: string;
}

export interface DeletedComment extends CommentWithMeta {
  deleted_by: string | null;
  deletion_mode: "self" | "moderation" | null;
  deletion_reason: string | null;
  lifecycle_correlation_id: string | null;
  last_lifecycle_operation_id: string | null;
  lifecycle_contract_version: number | null;
  lifecycleState: Exclude<CommentLifecycleState, "active">;
}

export interface DeletedCommentsCursor {
  deletedAt: string;
  id: string;
}

export interface DeletedCommentsPage {
  comments: DeletedComment[];
  nextCursor: DeletedCommentsCursor | null;
}

const SUCCESS_CODES = new Set<CommentLifecycleCode>([
  "deleted",
  "restored",
  "idempotent_replay",
]);

const ALL_CODES = new Set<CommentLifecycleCode>([
  ...SUCCESS_CODES,
  "not_allowed",
  "unsupported_context",
  "protected_context",
  "state_conflict",
  "operation_conflict",
  "undo_expired",
  "ordinary_window_expired",
  "not_ordinary_restorable",
]);

export function deriveCommentLifecycleState(
  deletedAt: string | null,
  nowMs = Date.now(),
): CommentLifecycleState {
  if (!deletedAt) return "active";
  const deletedMs = Date.parse(deletedAt);
  if (!Number.isFinite(deletedMs)) return "retained_not_ordinary_restorable";
  const ageMs = Math.max(0, nowMs - deletedMs);
  if (ageMs <= COMMENT_UNDO_WINDOW_MS) return "deleted_undoable";
  if (ageMs <= COMMENT_ORDINARY_RESTORE_WINDOW_MS) return "deleted_restorable";
  if (ageMs <= COMMENT_EXCEPTIONAL_RESTORE_WINDOW_MS) {
    return "deleted_exceptional";
  }
  return "retained_not_ordinary_restorable";
}

export function restoreModeForState(
  state: CommentLifecycleState,
): CommentRestoreMode | null {
  if (state === "deleted_undoable" || state === "deleted_restorable") {
    return "ordinary";
  }
  if (state === "deleted_exceptional") return "exceptional";
  return null;
}

export function lifecycleErrorMessage(code: CommentLifecycleCode): string {
  switch (code) {
    case "not_allowed":
      return "No tienes permiso para realizar esta acción.";
    case "unsupported_context":
    case "protected_context":
      return "Este comentario no admite esa acción.";
    case "undo_expired":
      return "Terminó la ventana inmediata para deshacer.";
    case "ordinary_window_expired":
    case "not_ordinary_restorable":
      return "Este comentario ya no admite restauración desde la aplicación.";
    case "state_conflict":
    case "operation_conflict":
      return "El comentario cambió en otra sesión. Actualiza e inténtalo nuevamente.";
    default:
      return "No se pudo completar la acción sobre el comentario.";
  }
}

export function parseCommentLifecycleResult(
  value: unknown,
): CommentLifecycleResult {
  if (!value || typeof value !== "object") {
    return {
      ok: false,
      code: "state_conflict",
      error: "La respuesta del servidor no fue válida.",
    };
  }
  const row = value as Record<string, unknown>;
  const code = typeof row.code === "string" && ALL_CODES.has(row.code as CommentLifecycleCode)
    ? (row.code as CommentLifecycleCode)
    : "state_conflict";
  const ok = row.ok === true && SUCCESS_CODES.has(code);
  const deletedAt = typeof row.deleted_at === "string" ? row.deleted_at : null;
  const rawState = typeof row.state === "string" ? row.state : undefined;
  const state =
    rawState === "active" ||
    rawState === "deleted_undoable" ||
    rawState === "deleted_restorable" ||
    rawState === "deleted_exceptional" ||
    rawState === "retained_not_ordinary_restorable"
      ? rawState
      : rawState === "deleted_retained"
        ? deriveCommentLifecycleState(deletedAt)
        : undefined;
  return {
    ok,
    code,
    commentId: typeof row.comment_id === "string" ? row.comment_id : undefined,
    state,
    correlationId:
      typeof row.correlation_id === "string" ? row.correlation_id : null,
    deletedAt,
    undoExpiresAt:
      typeof row.undo_expires_at === "string" ? row.undo_expires_at : null,
    error: ok ? undefined : lifecycleErrorMessage(code),
  };
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
