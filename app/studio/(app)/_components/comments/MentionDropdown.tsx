"use client";

/**
 * MentionDropdown (SDD-0045) — autocomplete de @menciones del composer.
 *
 * Portado del mockup del Norte (erp/modules/comments.jsx): se posiciona sobre el
 * composer, filtra usuarios del tenant por la query (texto tras el @) y al elegir
 * inserta `@Nombre A. ` en el textarea.
 *
 * Marca: solo tokens var(--*).
 */

import { Avatar } from "@/app/studio/_components/ui/Avatar";
import type { CommentTenantUser } from "@/lib/studio/comments/types";

export function MentionDropdown({
  users,
  query,
  onPick,
}: {
  users: CommentTenantUser[];
  query: string;
  onPick: (user: CommentTenantUser) => void;
}) {
  const q = query.toLowerCase();
  const filtered = users
    .filter((u) => u.name.toLowerCase().includes(q))
    .slice(0, 5);

  if (filtered.length === 0) return null;

  return (
    <div
      role="listbox"
      aria-label="Mencionar a"
      style={{
        position: "absolute",
        bottom: "calc(100% + 4px)",
        left: 8,
        width: 280,
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        boxShadow: "var(--shadow-lg)",
        padding: 6,
        zIndex: 20,
      }}
    >
      <div
        style={{
          padding: "6px 10px",
          font: "700 9.5px/1 var(--f-sans)",
          color: "var(--ink-soft)",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        }}
      >
        Mencionar a
      </div>
      {filtered.map((u) => (
        <button
          key={u.id}
          type="button"
          role="option"
          aria-selected={false}
          onMouseDown={(e) => {
            // mousedown (no click) para no perder el foco del textarea antes de insertar
            e.preventDefault();
            onPick(u);
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            width: "100%",
            padding: "6px 10px",
            borderRadius: "var(--r-sm)",
            textAlign: "left",
            background: "transparent",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--bg-elevated)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          <Avatar initials={u.avatar} size={24} color="wine" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                font: "600 12.5px/1.2 var(--f-sans)",
                color: "var(--ink)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {u.name}
            </div>
            <div
              style={{
                font: "500 10.5px/1.2 var(--f-sans)",
                color: "var(--ink-soft)",
                marginTop: 2,
              }}
            >
              {u.role}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
