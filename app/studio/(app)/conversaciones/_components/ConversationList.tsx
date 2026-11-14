"use client";

/**
 * ConversationList — lista filtrable de la bandeja (SDD-0056 · Fase 1).
 * Filtros (búsqueda cliente/MARKBOX · estado · canal) + items con cliente,
 * MARKBOX, canal, preview, sin-leer y agente. Portado del Norte
 * (conversaciones.jsx v1.9.1) a primitivas + tokens del Studio.
 */

import { Avatar } from "@/app/studio/_components/ui/Avatar";
import { Badge } from "@/app/studio/_components/ui/Badge";
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
            gap: "var(--s-2)",
            height: 34,
            padding: "0 10px",
            background: "var(--bg-elevated)",
            // SDD-0603 tramo 5d: contorno de campo ≥ 3:1, como `.studio-input`.
            border: "1px solid var(--ink-soft)",
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

        {/* Filtro de estado · SDD-0603 tramo 5d: chip con contorno, 32 px y
            relleno de tinta en el elegido (BD-037). Sigue siendo un grupo de
            botones `aria-pressed`, no un tablist. */}
        <div style={{ display: "flex", gap: "var(--s-1)", flexWrap: "wrap" }}>
          {STATUS_TABS.map((t) => {
            const active = statusFilter === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setStatusFilter(t.value)}
                aria-pressed={active}
                data-activo={active ? "true" : undefined}
                className="studio-chip"
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Chips de canal */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <ChannelChip
            active={channelFilter === "all"}
            onClick={() => setChannelFilter("all")}
          >
            Todos
          </ChannelChip>
          {(Object.keys(CHANNEL_LABELS) as ConversationChannel[]).map((ch) => (
            <ChannelChip
              key={ch}
              active={channelFilter === ch}
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
              padding: "var(--s-8) var(--s-4)",
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
            // SDD-0603 tramo 5d: la fila sigue abriendo con el ratón, pero sale
            // del orden de Tab; la parada de teclado y de lector es «Abrir».
            // La elegida se marca con tinta (contorno y relleno del botón).
            <div
              key={c.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--s-2)",
                padding: "0 14px 0 0",
                borderBottom: "1px solid var(--border)",
                borderLeft: `3px solid ${isSel ? "var(--ctl-border)" : "transparent"}`,
                background: isSel ? "var(--bg-elevated)" : "transparent",
                transition: "background var(--dur-fast) var(--ease)",
              }}
              onMouseEnter={(e) => {
                if (!isSel) e.currentTarget.style.background = "var(--bg-elevated)";
              }}
              onMouseLeave={(e) => {
                if (!isSel) e.currentTarget.style.background = "transparent";
              }}
            >
            <button
              type="button"
              tabIndex={-1}
              onClick={() => onSelect(c.id)}
              style={{
                flex: 1,
                minWidth: 0,
                textAlign: "left",
                display: "block",
                padding: "12px 0 12px 14px",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                color: "inherit",
                font: "inherit",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "var(--s-2)", marginBottom: 5 }}>
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
                      color: "var(--ink-side-strong)",
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
              <button
                type="button"
                className={`studio-btn ${isSel ? "studio-btn-dark" : "studio-btn-ghost"} studio-btn-sm`}
                aria-label={`Abrir conversación de ${c.client_name} por ${CHANNEL_LABELS[c.channel]}`}
                aria-current={isSel ? "true" : undefined}
                onClick={() => onSelect(c.id)}
                style={{ flex: "0 0 auto" }}
              >
                Abrir
                {Icon.chevR(14)}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChannelChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      data-activo={active ? "true" : undefined}
      className="studio-chip"
    >
      {children}
    </button>
  );
}
