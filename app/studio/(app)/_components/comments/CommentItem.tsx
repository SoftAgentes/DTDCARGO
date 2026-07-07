"use client";

/**
 * CommentItem (SDD-0045) — una entrada del hilo de comentarios.
 *
 * Portado 1:1 del mockup del Norte (erp/modules/comments.jsx):
 *  - avatar + nombre + rol + timestamp
 *  - burbuja con menciones resaltadas (.mention-chip wine-tint)
 *  - pills de reacciones + picker de 5 emojis al hover
 *  - editar / borrar para el autor (el botón "Responder" del mockup queda
 *    diferido: threading = §2 NO incluye)
 *
 * Marca: solo tokens var(--*), cero hex. Capa sistema → tokens.css.
 */

import { useState } from "react";
import { Avatar } from "@/app/studio/_components/ui/Avatar";
import { Icon } from "@/app/studio/_components/icons";
import {
  REACTION_EMOJIS,
  formatRelativeTime,
  type CommentTenantUser,
  type CommentWithMeta,
  type ReactionEmoji,
} from "@/lib/studio/comments/types";
import { renderMentionHtml } from "@/lib/studio/comments/mention-parse";

export function CommentItem({
  comment,
  users,
  currentUserId,
  onReact,
  onEdit,
  onDelete,
}: {
  comment: CommentWithMeta;
  users: CommentTenantUser[];
  currentUserId: string;
  onReact: (emoji: ReactionEmoji) => void;
  onEdit: (body: string) => void;
  onDelete: () => void;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);

  const isMine = comment.author_id === currentUserId;
  const html = renderMentionHtml(comment.body, users);

  const reactionEntries = Object.entries(comment.reactions) as [
    ReactionEmoji,
    string[],
  ][];

  return (
    <div style={{ display: "flex", gap: 10 }}>
      <Avatar
        initials={comment.author?.avatar ?? "??"}
        size={32}
        color={isMine ? "wine" : "neutral"}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 8,
            marginBottom: 4,
          }}
        >
          <span style={{ font: "700 13px/1 var(--f-sans)", color: "var(--ink)" }}>
            {comment.author?.name ?? "Usuario"}
          </span>
          {comment.author?.role && (
            <span
              style={{ font: "500 11px/1 var(--f-sans)", color: "var(--ink-soft)" }}
            >
              {comment.author.role}
            </span>
          )}
          <span
            style={{
              font: "500 11px/1 var(--f-sans)",
              color: "var(--ink-soft)",
              marginLeft: "auto",
            }}
          >
            {formatRelativeTime(comment.created_at)}
            {comment.edited_at ? " · editado" : ""}
          </span>
        </div>

        {editing ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              padding: 10,
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-md)",
            }}
          >
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              autoFocus
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
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                type="button"
                className="studio-btn studio-btn-ghost"
                onClick={() => {
                  setDraft(comment.body);
                  setEditing(false);
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="studio-btn studio-btn-primary"
                disabled={!draft.trim() || draft.trim() === comment.body}
                onClick={() => {
                  onEdit(draft.trim());
                  setEditing(false);
                }}
              >
                Guardar
              </button>
            </div>
          </div>
        ) : (
          <div
            onMouseEnter={() => setShowPicker(false)}
            style={{
              padding: "10px 12px",
              background: "var(--bg-elevated)",
              borderRadius: "12px 12px 12px 4px",
              font: "500 13px/1.6 var(--f-sans)",
              color: "var(--ink)",
              wordBreak: "break-word",
            }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}

        {/* Reacciones + acciones */}
        {!editing && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginTop: 6,
              flexWrap: "wrap",
            }}
          >
            {reactionEntries.map(([emoji, userIds]) => {
              const mine = userIds.includes(currentUserId);
              return (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onReact(emoji)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "3px 8px",
                    borderRadius: "var(--r-pill)",
                    background: mine ? "var(--wine-tint)" : "var(--bg-elevated)",
                    color: mine ? "var(--wine)" : "var(--ink-soft)",
                    border: `1px solid ${mine ? "var(--wine)" : "transparent"}`,
                    font: "600 11px/1.2 var(--f-sans)",
                  }}
                >
                  <span>{emoji}</span>
                  <span>{userIds.length}</span>
                </button>
              );
            })}

            <div style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => setShowPicker((v) => !v)}
                title="Reaccionar"
                aria-label="Reaccionar"
                style={{
                  padding: "3px 8px",
                  borderRadius: "var(--r-pill)",
                  color: "var(--ink-mute)",
                  font: "600 11px/1.2 var(--f-sans)",
                  border: "1px dashed var(--border-strong)",
                  background: "transparent",
                }}
              >
                +
              </button>
              {showPicker && (
                <div
                  style={{
                    position: "absolute",
                    bottom: "calc(100% + 4px)",
                    left: 0,
                    display: "flex",
                    gap: 2,
                    padding: 4,
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--r-pill)",
                    boxShadow: "var(--shadow-md)",
                    zIndex: 10,
                  }}
                >
                  {REACTION_EMOJIS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => {
                        onReact(e);
                        setShowPicker(false);
                      }}
                      style={{
                        width: 26,
                        height: 26,
                        fontSize: 14,
                        borderRadius: "var(--r-sm)",
                        background: "transparent",
                      }}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {isMine && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setDraft(comment.body);
                    setEditing(true);
                  }}
                  title="Editar"
                  aria-label="Editar comentario"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    color: "var(--ink-mute)",
                    padding: "4px 6px",
                    background: "transparent",
                  }}
                >
                  {Icon.edit(13)}
                </button>
                <button
                  type="button"
                  onClick={onDelete}
                  title="Eliminar"
                  aria-label="Eliminar comentario"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    color: "var(--ink-mute)",
                    padding: "4px 6px",
                    background: "transparent",
                  }}
                >
                  {Icon.trash(13)}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
