"use client";

/**
 * CommentsThread (SDD-0045) — hilo de comentarios embebible en el detalle de
 * cualquier entidad (embarque, cliente, factura…).
 *
 * Portado 1:1 del mockup del Norte (erp/modules/comments.jsx):
 *  - composer con dropdown de @menciones (autocomplete contra users del tenant)
 *  - hilo con chips de mención + reacciones (picker de 5) + avatar/rol/timestamp
 *  - ⌘/Ctrl+Enter para enviar
 *  - empty state
 *
 * Server actions: postComment / toggleReaction / editComment / deleteComment.
 * Tras cada mutación llama router.refresh() para reconciliar con el server
 * (V1 sin Realtime; el detalle es un server component que revalida).
 *
 * Marca: solo tokens var(--*), cero hex.
 */

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/app/studio/_components/ui/Avatar";
import { Icon } from "@/app/studio/_components/icons";
import { ConfirmDialog } from "@/app/studio/_components/ui/ConfirmDialog";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { MentionDropdown } from "./MentionDropdown";
import { useIsMac } from "@/app/studio/_components/ui/usePlatformMod";
import { CommentItem } from "./CommentItem";
import { DeletedCommentsPanel } from "./DeletedCommentsPanel";
import {
  type CommentEntityType,
  type CommentTenantUser,
  type CommentWithMeta,
  type ReactionEmoji,
} from "@/lib/studio/comments/types";
import {
  postComment,
  toggleReaction,
  editComment,
  deleteComment,
  restoreComment,
} from "@/app/studio/(app)/_actions/comments";

export function CommentsThread({
  entityType,
  entityId,
  entityCode,
  entityLabel = "registro",
  users,
  currentUser,
  initialComments,
  canEditComments = true,
  canModerateComments = false,
  canRestoreComments = false,
  onAfterChange,
}: {
  entityType: CommentEntityType;
  entityId: string;
  entityCode: string | null;
  entityLabel?: string;
  users: CommentTenantUser[];
  currentUser: CommentTenantUser;
  initialComments: CommentWithMeta[];
  canEditComments?: boolean;
  canModerateComments?: boolean;
  canRestoreComments?: boolean;
  /**
   * Opcional (SDD-0146): callback tras cada mutación. Cuando el hilo se embebe en
   * un contenedor que carga los comentarios en el cliente (ej. el drawer/detalle
   * de tarea de Bitácora, donde `router.refresh()` recarga la page pero NO la
   * lista fetch-ada en el cliente), este callback re-fetcha. Los consumidores
   * server-rendered (tracking, etc.) NO lo pasan → comportamiento intacto.
   */
  onAfterChange?: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const isMac = useIsMac();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [lifecyclePendingId, setLifecyclePendingId] = useState<string | null>(null);
  const [moderationTarget, setModerationTarget] =
    useState<CommentWithMeta | null>(null);
  const [moderationError, setModerationError] = useState<string | undefined>();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const comments = initialComments;

  function refresh() {
    startTransition(() => router.refresh());
    onAfterChange?.();
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setText(val);
    const cursor = e.target.selectionStart;
    const upToCursor = val.slice(0, cursor);
    const m = upToCursor.match(/@([\p{L}.\s]*)$/u);
    if (m) {
      // recortamos al token actual (sin saltos a otra línea/palabra muy larga)
      const tail = m[1].split("\n").pop() ?? "";
      setMentionQuery(tail.trim());
      setMentionOpen(true);
    } else {
      setMentionOpen(false);
    }
  }

  function insertMention(user: CommentTenantUser) {
    const el = textareaRef.current;
    const cursor = el ? el.selectionStart : text.length;
    const upToCursor = text.slice(0, cursor);
    const after = text.slice(cursor);
    const parts = user.name.trim().split(/\s+/);
    const token = `@${parts[0]}${parts[1] ? " " + parts[1][0] + "." : ""} `;
    const replaced = upToCursor.replace(/@[\p{L}.\s]*$/u, token);
    setText(replaced + after);
    setMentionOpen(false);
    requestAnimationFrame(() => el?.focus());
  }

  async function send() {
    const body = text.trim();
    if (!body || pending) return;
    setError(null);
    const fd = new FormData();
    fd.set("body", body);
    const res = await postComment(entityType, entityId, entityCode, {}, fd);
    if (res.ok) {
      setText("");
      refresh();
    } else {
      setError(res.error ?? res.fieldErrors?.body ?? "No se pudo publicar.");
    }
  }

  async function onReact(commentId: string, emoji: ReactionEmoji) {
    await toggleReaction(commentId, emoji);
    refresh();
  }

  async function onEdit(commentId: string, body: string) {
    const fd = new FormData();
    fd.set("body", body);
    const res = await editComment(commentId, {}, fd);
    if (res.ok) refresh();
    else setError(res.error ?? "No se pudo editar.");
  }

  async function onDelete(commentId: string) {
    if (lifecyclePendingId) return;
    setLifecyclePendingId(commentId);
    setError(null);
    const res = await deleteComment(commentId, crypto.randomUUID());
    setLifecyclePendingId(null);
    if (!res.ok) {
      setError(res.error ?? "No se pudo eliminar.");
      return;
    }
    refresh();
    const undoRemainingMs =
      typeof res.undoRemainingMs === "number"
        ? res.undoRemainingMs
        : 0;
    const undoAvailable =
      Boolean(res.correlationId) &&
      Number.isFinite(undoRemainingMs) &&
      undoRemainingMs > 0;
    toast.show({
      eventKey: "comment:soft-deleted",
      tone: "warning",
      message: "Comentario eliminado.",
      priority: "high",
      scope: "module",
      dedupeKey: `comment:soft-deleted:${commentId}`,
      duration: undoAvailable ? "undo" : "default",
      correlationId: res.correlationId ?? undefined,
      actionDurationMs: undoAvailable ? undoRemainingMs : undefined,
      actionExpiredMessage: "Terminó la ventana inmediata para deshacer.",
      action: undoAvailable
        ? {
            label: "Deshacer",
            failureMessage:
              "No se pudo deshacer. Actualiza el hilo o revisa Comentarios eliminados.",
            onSelect: async () => {
              const restored = await restoreComment(
                commentId,
                crypto.randomUUID(),
                res.correlationId ?? null,
                "undo",
              );
              if (!restored.ok) throw new Error(restored.error);
              refresh();
            },
          }
        : undefined,
    });
  }

  async function onModerate(reason: string) {
    if (!moderationTarget || lifecyclePendingId) return;
    setLifecyclePendingId(moderationTarget.id);
    setModerationError(undefined);
    const result = await deleteComment(
      moderationTarget.id,
      crypto.randomUUID(),
      reason,
    );
    setLifecyclePendingId(null);
    if (!result.ok) {
      setModerationError(result.error ?? "No se pudo moderar el comentario.");
      return;
    }
    const moderatedId = moderationTarget.id;
    setModerationTarget(null);
    refresh();
    toast.show({
      eventKey: "comment:moderated",
      tone: "success",
      message: "Comentario moderado y conservado en recuperación.",
      priority: "normal",
      scope: "module",
      dedupeKey: `comment:moderated:${moderatedId}`,
      correlationId: result.correlationId ?? undefined,
    });
  }

  const authorIds = [...new Set(comments.map((c) => c.author_id).filter(Boolean))];

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <div className="eyebrow eyebrow-wine">COMENTARIOS ({comments.length})</div>
        {authorIds.length > 0 && (
          <div style={{ display: "flex", gap: 4 }}>
            {authorIds.slice(0, 4).map((uid) => {
              const u = users.find((x) => x.id === uid);
              return u ? (
                <Avatar key={uid} initials={u.avatar} size={22} color="neutral" />
              ) : null;
            })}
          </div>
        )}
      </div>

      {/* Thread */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          marginBottom: 16,
        }}
      >
        {comments.length === 0 ? (
          <div
            style={{
              padding: "var(--s-6) var(--s-4)",
              textAlign: "center",
              background: "var(--bg-elevated)",
              borderRadius: "var(--r-md)",
              font: "500 12.5px/1.5 var(--f-sans)",
              color: "var(--ink-soft)",
            }}
          >
            Sin comentarios aún. Comenta abajo y @menciona a alguien del equipo.
          </div>
        ) : (
          comments.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              users={users}
              currentUserId={currentUser.id}
              onReact={(emoji) => onReact(c.id, emoji)}
              onEdit={(body) => onEdit(c.id, body)}
              onDelete={() => onDelete(c.id)}
              onModerate={() => {
                setModerationError(undefined);
                setModerationTarget(c);
              }}
              canDeleteOwn={canEditComments}
              canModerate={canModerateComments}
              lifecyclePending={lifecyclePendingId === c.id}
            />
          ))
        )}
      </div>

      {error && (
        <div
          role="alert"
          style={{
            marginBottom: 10,
            padding: "var(--s-2) var(--s-3)",
            background: "var(--danger-bg)",
            border: "1px solid var(--danger)",
            borderRadius: "var(--r-sm)",
            font: "500 12px/1.4 var(--f-sans)",
            color: "var(--danger)",
          }}
        >
          {error}
        </div>
      )}

      {canRestoreComments && (
        <DeletedCommentsPanel
          entityType={entityType}
          entityId={entityId}
          onAfterChange={refresh}
        />
      )}

      <ConfirmDialog
        open={moderationTarget !== null}
        title="Moderar comentario"
        message={`El comentario de ${
          moderationTarget?.author?.name ?? "este usuario"
        } se ocultará para el equipo, pero permanecerá disponible para recuperación.`}
        confirmLabel="Moderar"
        danger
        pending={lifecyclePendingId === moderationTarget?.id}
        reason
        reasonRequired
        reasonLabel="Motivo de moderación"
        reasonPlaceholder="Explica por qué debe ocultarse"
        error={moderationError}
        onCancel={() => {
          if (!lifecyclePendingId) {
            setModerationTarget(null);
            setModerationError(undefined);
          }
        }}
        onConfirm={(reasonValue) => void onModerate(reasonValue)}
      />

      {/* Composer */}
      <div
        style={{
          position: "relative",
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-md)",
          padding: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <Avatar initials={currentUser.avatar} size={28} color="wine" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleChange}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void send();
                }
                if (e.key === "Escape") setMentionOpen(false);
              }}
              placeholder={`Comenta en este ${entityLabel}… usa @ para mencionar`}
              rows={2}
              style={{
                width: "100%",
                border: 0,
                outline: "none",
                resize: "vertical",
                background: "transparent",
                color: "var(--ink)",
                font: "500 13px/1.5 var(--f-sans)",
                minHeight: 44,
              }}
            />
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            paddingTop: 8,
            borderTop: "1px solid var(--border)",
            marginTop: 4,
          }}
        >
          <button
            type="button"
            title="Mencionar (@)"
            aria-label="Mencionar"
            onClick={() => {
              setText((t) => t + "@");
              setMentionQuery("");
              setMentionOpen(true);
              textareaRef.current?.focus();
            }}
            style={{
              width: 24,
              height: 24,
              color: "var(--ink-soft)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
            }}
          >
            @
          </button>
          <span
            style={{
              marginLeft: "auto",
              font: "500 10.5px/1 var(--f-sans)",
              color: "var(--ink-soft)",
            }}
          >
            {isMac ? "⌘" : "Ctrl"} + Enter para enviar
          </span>
          <button
            type="button"
            className="studio-btn studio-btn-primary"
            onClick={() => void send()}
            disabled={!text.trim() || pending}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            Comentar {Icon.arrowR(11)}
          </button>
        </div>

        {mentionOpen && (
          <MentionDropdown
            users={users}
            query={mentionQuery}
            onPick={insertMention}
          />
        )}
      </div>
    </div>
  );
}
