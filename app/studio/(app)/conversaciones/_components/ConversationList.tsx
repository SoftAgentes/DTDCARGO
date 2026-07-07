"use client";

/**
 * ConversationList — lista filtrable de la bandeja (SDD-0056 · Fase 1).
 * Filtros (búsqueda cliente/MARKBOX · estado · canal) + items con cliente,
 * MARKBOX, canal, preview, sin-leer y agente. Portado del Norte
 * (conversaciones.jsx v1.9.1) a primitivas + tokens del Studio.
 */

import { Avatar } from "@/app/studio/_components/ui/Avatar";
import { Badge, type BadgeTone } from "@/app/studio/_components/ui/Badge";
import { Icon } from "@/app/studio/_components/icons";
import {
  CHANNEL_LABELS,
  channelTone,
  relativeAge,
  type ConversationChannel,
  type ConversationChannelFilter,
  type ConversationRow,
  type ConversationStatusFilter,
} from "@/lib/studio/conversaciones/conversations-types";

/** Tokens bg/fg por tono (misma convención que el primitive Badge). */
const TONE_TOKENS: Record<BadgeTone, { bg: string; fg: string }> = {
  success: { bg: "var(--success-bg)", fg: "var(--success)" },
  warning: { bg: "var(--warning-bg)", fg: "var(--warning)" },
  danger: { bg: "var(--danger-bg)", fg: "var(--danger)" },
  info: { bg: "var(--info-bg)", fg: "var(--info)" },
  wine: { bg: "var(--wine-tint)", fg: "var(--wine)" },
  neutral: { bg: "var(--neutral-bg)", fg: "var(--ink-soft)" },
};

interface Props {
  list: ConversationRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  statusFilter: ConversationStatusFilter;
  setStatusFilter: (s: ConversationStatusFilter) => void;
  channelFilter: ConversationChannelFilter;
  setChannelFilter: (c: ConversationChannelFilter) => void;
  search: string;
  setSearch: (s: string) => void;
}

const STATUS_TABS: { value: ConversationStatusFilter; label: string }[] = [
  { value: "todos", label: "Todas" },
  { value: "abierto", label: "Abiertas" },
  { value: "pendiente", label: "Pend." },
  { value: "resuelto", label: "Resueltas" },
];

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function ConversationList({
  list,
  selectedId,
  onSelect,
  statusFilter,
  setStatusFilter,
  channelFilter,
  setChannelFilter,
  search,
  setSearch,
}: Props) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        overflow: "hidden",
      }}
    >
      {/* Filtros */}
      <div
        style={{
          padding: "12px 14px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            height: 34,
            padding: "0 10px",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
          }}
        >
          <span style={{ color: "var(--ink-mute)", display: "inline-flex" }}>
            {Icon.search(14)}
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente o Shipping Mark…"
            style={{
              flex: 1,
              height: "100%",
              border: 0,
              outline: "none",
              background: "transparent",
              font: "500 12.5px/1 var(--f-sans)",
              color: "var(--ink)",
            }}
          />
        </div>

        {/* Tabs de estado */}
        <div style={{ display: "flex", gap: 4 }}>
          {STATUS_TABS.map((t) => {
            const active = statusFilter === t.value;
            return (
              <button
                key={t.value}
                onClick={() => setStatusFilter(t.value)}
                style={{
                  flex: 1,
                  padding: "6px 4px",
                  borderRadius: "var(--r-sm)",
                  border: "none",
                  cursor: "pointer",
                  font: `${active ? "700" : "500"} 11px/1 var(--f-sans)`,
                  background: active ? "var(--wine-tint)" : "transparent",
                  color: active ? "var(--wine)" : "var(--ink-soft)",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Chips de canal */}
        <div style={{ display: "flex", gap: 6 }}>
          <ChannelChip
            active={channelFilter === "all"}
            tone="neutral"
            onClick={() => setChannelFilter("all")}
          >
            Todos
          </ChannelChip>
          {(Object.keys(CHANNEL_LABELS) as ConversationChannel[]).map((ch) => (
            <ChannelChip
              key={ch}
              active={channelFilter === ch}
              tone={channelTone(ch)}
              onClick={() => setChannelFilter(ch)}
            >
              {CHANNEL_LABELS[ch as ConversationChannel]}
            </ChannelChip>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {list.length === 0 && (
          <div
            style={{
              padding: "32px 16px",
              textAlign: "center",
              font: "500 12.5px/1.5 var(--f-sans)",
              color: "var(--ink-soft)",
            }}
          >
            Sin conversaciones con esos filtros.
          </div>
        )}
        {list.map((c) => {
          const isSel = selectedId === c.id;
          const preview =
            (c.last_message_direction === "out" ? "Tú: " : "") +
            (c.last_message_preview ?? "");
          return (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              style={{
                width: "100%",
                textAlign: "left",
                display: "block",
                padding: "12px 14px",
                border: "none",
                borderBottom: "1px solid var(--border)",
                borderLeft: `3px solid ${isSel ? "var(--wine)" : "transparent"}`,
                background: isSel ? "var(--wine-tint)" : "transparent",
                cursor: "pointer",
                transition: "background var(--dur-fast) var(--ease)",
              }}
              onMouseEnter={(e) => {
                if (!isSel) e.currentTarget.style.background = "var(--bg-elevated)";
              }}
              onMouseLeave={(e) => {
                if (!isSel) e.currentTarget.style.background = "transparent";
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: `var(--${channelTone(c.channel)})`,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    font: "700 12.5px/1.2 var(--f-sans)",
                    color: "var(--ink)",
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {c.client_name}
                </span>
                {c.unread_count > 0 && (
                  <span
                    style={{
                      minWidth: 18,
                      height: 18,
                      padding: "0 5px",
                      borderRadius: "var(--r-pill)",
                      background: "var(--wine)",
                      color: "var(--wine-tint)",
                      font: "700 10px/18px var(--f-sans)",
                      textAlign: "center",
                    }}
                  >
                    {c.unread_count}
                  </span>
                )}
                <span style={{ font: "500 10px/1 var(--f-sans)", color: "var(--ink-soft)" }}>
                  {relativeAge(c.last_message_at)}
                </span>
              </div>
              <div
                style={{
                  font: "500 11.5px/1.4 var(--f-sans)",
                  color: "var(--ink-soft)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  marginBottom: 7,
                  minHeight: 16,
                }}
              >
                {preview}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {c.is_case && (
                  <Badge tone="danger" size="sm">
                    Caso
                  </Badge>
                )}
                <code style={{ font: "600 10px/1 var(--f-mono)", color: "var(--ink-soft)" }}>
                  {c.markbox}
                </code>
                <span style={{ flex: 1 }} />
                {c.agent ? (
                  <Avatar
                    initials={initialsOf(c.agent.name)}
                    size={18}
                    color={c.is_case ? "wine" : "neutral"}
                  />
                ) : (
                  <Badge tone="danger" size="sm">
                    sin asignar
                  </Badge>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChannelChip({
  active,
  tone,
  onClick,
  children,
}: {
  active: boolean;
  tone: BadgeTone;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const t = TONE_TOKENS[tone];
  return (
    <button
      onClick={onClick}
      style={{
        padding: "4px 9px",
        borderRadius: "var(--r-pill)",
        cursor: "pointer",
        font: `${active ? "700" : "500"} 10.5px/1 var(--f-sans)`,
        background: active ? t.bg : "var(--bg-elevated)",
        color: active ? t.fg : "var(--ink-soft)",
        border: `1px solid ${active ? t.fg : "transparent"}`,
      }}
    >
      {children}
    </button>
  );
}
