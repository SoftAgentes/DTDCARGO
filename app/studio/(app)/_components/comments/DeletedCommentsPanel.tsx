"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ConfirmDialog } from "@/app/studio/_components/ui/ConfirmDialog";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import {
  listDeletedCommentsAction,
  restoreComment,
} from "@/app/studio/(app)/_actions/comments";
import {
  restoreModeForState,
  type DeletedComment,
  type DeletedCommentsCursor,
} from "@/lib/studio/comments/lifecycle-types";
import type { CommentEntityType } from "@/lib/studio/comments/types";
import { Aviso } from "@/app/studio/_components/ui/Aviso";

export function DeletedCommentsPanel({
  entityType,
  entityId,
  onAfterChange,
}: {
  entityType: CommentEntityType;
  entityId: string;
  onAfterChange?: () => void;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<DeletedComment[]>([]);
  const [cursor, setCursor] = useState<DeletedCommentsCursor | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<DeletedComment | null>(null);
  const [restorePending, setRestorePending] = useState(false);
  const [restoreError, setRestoreError] = useState<string | undefined>();
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const restoreFocusAfterSuccessRef = useRef(false);

  useEffect(() => {
    if (restoreTarget !== null || !restoreFocusAfterSuccessRef.current) return;
    restoreFocusAfterSuccessRef.current = false;
    toggleRef.current?.focus();
  }, [restoreTarget]);

  async function load(nextCursor?: DeletedCommentsCursor | null) {
    if (loading) return;
    setLoading(true);
    setError(null);
    const result = await listDeletedCommentsAction(
      entityType,
      entityId,
      nextCursor ?? null,
    );
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setComments((previous) =>
      nextCursor ? [...previous, ...result.page.comments] : result.page.comments,
    );
    setCursor(result.page.nextCursor);
  }

  async function confirmRestore(reason: string) {
    if (!restoreTarget || restorePending) return;
    const mode = restoreModeForState(restoreTarget.lifecycleState);
    if (!mode) return;
    setRestorePending(true);
    setRestoreError(undefined);
    const targetId = restoreTarget.id;
    const result = await restoreComment(
      targetId,
      crypto.randomUUID(),
      restoreTarget.lifecycle_correlation_id,
      mode,
      reason || undefined,
    );
    setRestorePending(false);
    if (!result.ok) {
      setRestoreError(result.error ?? "No se pudo restaurar el comentario.");
      return;
    }
    setComments((previous) =>
      previous.filter((comment) => comment.id !== targetId),
    );
    restoreFocusAfterSuccessRef.current = true;
    setRestoreTarget(null);
    toast.show({
      eventKey: "comment:restored",
      tone: "success",
      message: "Comentario restaurado.",
      priority: "normal",
      scope: "module",
      dedupeKey: `comment:restored:${result.commentId ?? targetId}`,
      correlationId: result.correlationId ?? undefined,
    });
    onAfterChange?.();
  }

  return (
    <div
      style={{
        borderTop: "1px solid var(--border)",
        marginTop: "var(--s-4)",
        paddingTop: "var(--s-3)",
      }}
    >
      <button
        ref={toggleRef}
        type="button"
        className="studio-btn studio-btn-ghost studio-btn-sm"
        aria-expanded={open}
        onClick={() => {
          const nextOpen = !open;
          setOpen(nextOpen);
          if (nextOpen) void load(null);
        }}
      >
        Comentarios eliminados
      </button>

      {open && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--s-2)",
            marginTop: "var(--s-3)",
          }}
        >
          {loading && comments.length === 0 ? (
            <p style={messageStyle}>Cargando comentarios eliminados…</p>
          ) : error ? (
            <Aviso tono="error" compacto>
              {error}
            </Aviso>
          ) : comments.length === 0 ? (
            <p style={messageStyle}>No hay comentarios eliminados en este registro.</p>
          ) : (
            comments.map((comment) => {
              const mode = restoreModeForState(comment.lifecycleState);
              const exceptional = mode === "exceptional";
              return (
                <article
                  key={comment.id}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: "var(--r-md)",
                    padding: "var(--s-3)",
                    background: "var(--bg-elevated)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: "var(--s-2)",
                      marginBottom: "var(--s-2)",
                    }}
                  >
                    <strong
                      style={{
                        font: "700 12.5px/1.3 var(--f-sans)",
                        color: "var(--ink)",
                      }}
                    >
                      {comment.author?.name ?? "Autor no disponible"}
                    </strong>
                    <span style={metaStyle}>
                      Eliminado {formatDeletedAt(comment.deleted_at)}
                    </span>
                    <span style={{ ...metaStyle, marginLeft: "auto" }}>
                      {lifecycleLabel(comment.lifecycleState)}
                    </span>
                  </div>
                  <p
                    style={{
                      margin: 0,
                      font: "500 12.5px/1.5 var(--f-sans)",
                      color: "var(--ink)",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {comment.body}
                  </p>
                  {comment.deletion_reason && (
                    <p style={{ ...messageStyle, marginTop: "var(--s-2)" }}>
                      Motivo de moderación: {comment.deletion_reason}
                    </p>
                  )}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      marginTop: "var(--s-3)",
                    }}
                  >
                    {mode ? (
                      <button
                        type="button"
                        className={`studio-btn studio-btn-sm ${
                          exceptional ? "studio-btn-danger" : "studio-btn-ghost"
                        }`}
                        onClick={() => {
                          setRestoreError(undefined);
                          setRestoreTarget(comment);
                        }}
                      >
                        {exceptional ? "Restaurar con excepción" : "Restaurar"}
                      </button>
                    ) : (
                      <span style={messageStyle}>
                        Requiere un procedimiento documentado.
                      </span>
                    )}
                  </div>
                </article>
              );
            })
          )}

          {cursor && (
            <button
              type="button"
              className="studio-btn studio-btn-ghost studio-btn-sm"
              disabled={loading}
              onClick={() => void load(cursor)}
              style={{ alignSelf: "flex-start" }}
            >
              {loading ? "Cargando…" : "Cargar más"}
            </button>
          )}
        </div>
      )}

      <ConfirmDialog
        open={restoreTarget !== null}
        title={
          restoreTarget?.lifecycleState === "deleted_exceptional"
            ? "Restauración excepcional"
            : "Restaurar comentario"
        }
        message={
          restoreTarget?.lifecycleState === "deleted_exceptional"
            ? "El comentario superó la ventana ordinaria. Volverá a ser visible con sus menciones y estado de lectura previos, sin reenviar notificaciones."
            : "El comentario volverá a ser visible con sus menciones y estado de lectura previos, sin reenviar notificaciones."
        }
        confirmLabel="Restaurar"
        danger={restoreTarget?.lifecycleState === "deleted_exceptional"}
        pending={restorePending}
        reason={restoreTarget?.lifecycleState === "deleted_exceptional"}
        reasonRequired={restoreTarget?.lifecycleState === "deleted_exceptional"}
        reasonLabel="Motivo de la restauración excepcional"
        reasonPlaceholder="Explica por qué debe recuperarse"
        error={restoreError}
        onCancel={() => {
          if (!restorePending) {
            setRestoreTarget(null);
            setRestoreError(undefined);
          }
        }}
        onConfirm={(reason) => void confirmRestore(reason)}
      />
    </div>
  );
}

const messageStyle: CSSProperties = {
  margin: 0,
  font: "500 12px/1.45 var(--f-sans)",
  color: "var(--ink-soft)",
};

const metaStyle: CSSProperties = {
  font: "500 11px/1.3 var(--f-sans)",
  color: "var(--ink-soft)",
};

function formatDeletedAt(value: string | null): string {
  if (!value) return "en una fecha no disponible";
  return new Intl.DateTimeFormat("es-VE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function lifecycleLabel(state: DeletedComment["lifecycleState"]): string {
  if (state === "deleted_undoable") return "Restauración disponible";
  if (state === "deleted_restorable") return "Ventana ordinaria";
  if (state === "deleted_exceptional") return "Ventana excepcional";
  return "Retenido";
}
