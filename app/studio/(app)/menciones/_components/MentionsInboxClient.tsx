"use client";

/**
 * MentionsInboxClient (SDD-0045) — lista interactiva de la bandeja de menciones.
 *
 * - read_at null → fila resaltada (dot wine) = no leída.
 * - click en una mención → marca leída (markMentionsRead) + navega a la entidad.
 * - "Marcar todas leídas" → markMentionsRead() sin scope.
 *
 * Marca: solo tokens var(--*).
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/app/studio/_components/ui/Avatar";
import {
  COMMENT_ENTITY_LABELS,
  entityHref,
  entityTypeLabel,
  formatRelativeTime,
  type MentionInboxItem,
} from "@/lib/studio/comments/types";
import { markMentionsRead } from "@/app/studio/(app)/_actions/comments";

export function MentionsInboxClient({ items }: { items: MentionInboxItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // tracking local del read state para feedback inmediato del badge
  const [readIds, setReadIds] = useState<Set<string>>(
    () => new Set(items.filter((i) => i.read_at).map((i) => i.mention_id)),
  );

  const anyUnread = items.some((i) => !readIds.has(i.mention_id));

  async function openMention(item: MentionInboxItem) {
    setReadIds((prev) => new Set(prev).add(item.mention_id));
    await markMentionsRead({ mentionId: item.mention_id });
    const href = entityHref(item.entity_type, item.entity_id, item.entity_code);
    startTransition(() => router.push(href));
  }

  async function markAll() {
    setReadIds(new Set(items.map((i) => i.mention_id)));
    await markMentionsRead();
    startTransition(() => router.refresh());
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: "var(--s-3)",
        }}
      >
        <button
          type="button"
          className="studio-btn studio-btn-ghost"
          onClick={() => void markAll()}
          disabled={!anyUnread || pending}
        >
          Marcar todas leídas
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
        {items.map((item) => {
          const unread = !readIds.has(item.mention_id);
          const label =
            COMMENT_ENTITY_LABELS[item.entity_type]?.label ??
            entityTypeLabel(item.entity_type);
          return (
            <button
              key={item.mention_id}
              type="button"
              onClick={() => void openMention(item)}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "var(--s-3)",
                textAlign: "left",
                width: "100%",
                padding: "12px 14px",
                background: unread ? "var(--wine-tint)" : "var(--bg-surface)",
                border: `1px solid ${unread ? "var(--wine)" : "var(--border)"}`,
                borderRadius: "var(--r-md)",
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "var(--r-pill)",
                  background: unread ? "var(--wine)" : "transparent",
                  marginTop: 6,
                  flexShrink: 0,
                }}
              />
              <Avatar
                initials={item.author?.avatar ?? "??"}
                size={32}
                color="neutral"
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: "var(--s-2)",
                    marginBottom: "var(--s-1)",
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{ font: "700 13px/1 var(--f-sans)", color: "var(--ink)" }}
                  >
                    {item.author?.name ?? "Alguien"}
                  </span>
                  <span
                    style={{
                      font: "600 10px/1 var(--f-sans)",
                      color: "var(--wine-text)",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                    }}
                  >
                    {label}
                    {item.entity_code ? ` · ${item.entity_code}` : ""}
                  </span>
                  <span
                    style={{
                      font: "500 11px/1 var(--f-sans)",
                      color: "var(--ink-soft)",
                      marginLeft: "auto",
                    }}
                  >
                    {formatRelativeTime(item.created_at)}
                  </span>
                </div>
                <div
                  style={{
                    font: "500 12.5px/1.5 var(--f-sans)",
                    color: "var(--ink-soft)",
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                  }}
                >
                  {item.body}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
