"use client";

/**
 * CustomsFilingsList — lista de trámites con doc progress bar inline.
 * Click en fila → abre FilingDetailDrawer (manejado por SeniatClient).
 */

import { Badge } from "@/app/studio/_components/ui/Badge";
import { Icon } from "@/app/studio/_components/icons";
import type { CustomsFilingRow } from "@/lib/studio/customs-types";
import { vePortLabel } from "@/lib/studio/customs-types";
import { CustomsStatusBadge } from "./CustomsStatusBadge";

interface Props {
  rows: CustomsFilingRow[];
  onRowClick: (filingId: string) => void;
  emptyMessage?: string;
}

export function CustomsFilingsList({
  rows,
  onRowClick,
  emptyMessage,
}: Props) {
  if (rows.length === 0) {
    return (
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          padding: "var(--s-10) var(--s-8)",
          textAlign: "center",
          color: "var(--ink-soft)",
          font: "500 13px/1.5 var(--f-sans)",
        }}
      >
        {emptyMessage ?? "Sin trámites en esta cola."}
      </div>
    );
  }

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        overflow: "hidden",
      }}
    >
      {rows.map((r, i) => (
        <FilingRow
          key={r.id}
          row={r}
          hasBorderTop={i > 0}
          onClick={() => onRowClick(r.id)}
        />
      ))}
    </div>
  );
}

function FilingRow({
  row,
  hasBorderTop,
  onClick,
}: {
  row: CustomsFilingRow;
  hasBorderTop: boolean;
  onClick: () => void;
}) {
  const docsPct =
    row.docs_total === 0 ? 0 : (row.docs_uploaded / row.docs_total) * 100;
  const docsColor =
    docsPct === 100 ? "var(--success)" : "var(--warning)";

  const totalDisplay =
    row.total >= 1000
      ? `$${(row.total / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 })}K`
      : `$${row.total.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

  const hasAlert = !!row.alert;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        display: "grid",
        gridTemplateColumns:
          "140px minmax(180px, 1.5fr) 100px 110px 110px 140px",
        gap: 14,
        padding: "var(--s-4) var(--s-5)",
        alignItems: "center",
        borderTop: hasBorderTop ? "1px solid var(--border)" : 0,
        background: hasAlert ? "var(--danger-bg)" : "transparent",
        border: 0,
        cursor: "pointer",
        transition: "background var(--dur-fast) var(--ease)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = hasAlert
          ? "var(--danger-bg)"
          : "var(--bg-elevated)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = hasAlert
          ? "var(--danger-bg)"
          : "transparent";
      }}
    >
      {/* Shipment code + DUA */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-1)" }}>
        <code
          style={{
            font: "800 12px/1 var(--f-mono)",
            color: "var(--wine)",
            letterSpacing: "0.02em",
          }}
        >
          {row.shipment?.code ?? "—"}
        </code>
        <div
          style={{
            font: "600 10.5px/1.2 var(--f-mono)",
            color: "var(--ink-soft)",
          }}
        >
          {row.dua_code}
        </div>
      </div>

      {/* Cliente + observaciones/alerta */}
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            font: "700 13px/1.2 var(--f-sans)",
            color: "var(--ink)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {row.shipment?.client_name ?? "—"}
        </div>
        <div
          style={{
            font: "500 11px/1.4 var(--f-sans)",
            color: hasAlert ? "var(--danger)" : "var(--ink-soft)",
            marginTop: "var(--s-1)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            display: "flex",
            alignItems: "center",
            gap: "var(--s-1)",
          }}
          title={row.alert ?? row.observations ?? undefined}
        >
          {hasAlert && (
            <span
              aria-hidden="true"
              style={{ flexShrink: 0, color: "var(--danger)", display: "inline-flex" }}
            >
              {Icon.warn(11)}
            </span>
          )}
          {row.alert ?? row.observations ?? "—"}
        </div>
      </div>

      {/* Puerto */}
      <span>
        <Badge tone="info" size="sm">
          {row.port_code}
        </Badge>
        <div
          style={{
            font: "500 10.5px/1.3 var(--f-sans)",
            color: "var(--ink-soft)",
            marginTop: "var(--s-1)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {vePortLabel(row.port_code).split(" · ")[0]}
        </div>
      </span>

      {/* Docs progress */}
      <div>
        <div
          style={{
            font: "700 9.5px/1 var(--f-sans)",
            color: "var(--ink-soft)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          Docs
        </div>
        <div
          style={{
            font: "800 14px/1 var(--f-mono)",
            color: docsColor,
            marginTop: "var(--s-1)",
          }}
        >
          {row.docs_uploaded}/{row.docs_total}
        </div>
        <div
          style={{
            marginTop: 5,
            height: 4,
            background: "var(--bg-elevated)",
            borderRadius: "var(--r-pill)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${docsPct}%`,
              height: "100%",
              background: docsColor,
              borderRadius: "var(--r-pill)",
              transition: "width var(--dur) var(--ease)",
            }}
          />
        </div>
      </div>

      {/* Total */}
      <span
        className="mono"
        style={{
          font: "800 14px/1 var(--f-mono)",
          color: "var(--ink)",
          textAlign: "right",
        }}
      >
        {totalDisplay}
      </span>

      {/* Status */}
      <span>
        <CustomsStatusBadge status={row.status} size="md" />
      </span>
    </button>
  );
}
