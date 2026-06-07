"use client";

/**
 * RecentActivityCard — feed lateral del Dashboard (SDD-0035).
 *
 * Lista los últimos N shipment_events del tenant con relative time.
 * Cada item es un <Link> a /studio/tracking/{shipment_id} con hover state.
 *
 * V1: fuente única shipment_events. V2 mergear con dispatch_orders,
 * mail_logs, etc. ordenados por timestamp desc.
 */

import Link from "next/link";
import type { RecentActivityItem } from "@/lib/studio/dashboard-queries";

const STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  quoted: "Estimado",
  confirmed: "Confirmado",
  in_transit: "En tránsito",
  customs: "En aduana",
  arrived_destination: "Arribó",
  out_for_delivery: "En reparto",
  last_mile: "Última milla",
  delivered: "Entregado",
  delayed: "Demorado",
  exception: "Con alerta",
  cancelled: "Cancelado",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "var(--ink-mute)",
  quoted: "var(--info)",
  confirmed: "var(--info)",
  in_transit: "var(--wine)",
  customs: "var(--warning)",
  arrived_destination: "var(--info)",
  out_for_delivery: "var(--wine)",
  last_mile: "var(--wine)",
  delivered: "var(--success)",
  delayed: "var(--warning)",
  exception: "var(--danger)",
  cancelled: "var(--ink-mute)",
};

export function RecentActivityCard({ items }: { items: RecentActivityItem[] }) {
  if (items.length === 0) {
    return (
      <section
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          padding: "20px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          minHeight: 160,
        }}
      >
        <div className="studio-eyebrow">Actividad reciente</div>
        <p
          style={{
            font: "500 13px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
            flex: 1,
          }}
        >
          Sin actividad reciente. Los eventos de embarques van a aparecer acá.
        </p>
        <Link
          href="/studio/tracking"
          style={{
            color: "var(--wine)",
            font: "600 12px/1 var(--f-sans)",
            textDecoration: "none",
            alignSelf: "flex-start",
          }}
        >
          Ver tracking →
        </Link>
      </section>
    );
  }

  return (
    <section
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: "20px 22px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <div className="studio-eyebrow">Actividad reciente</div>
        <Link
          href="/studio/tracking"
          style={{
            color: "var(--wine)",
            font: "600 11px/1 var(--f-sans)",
            textDecoration: "none",
          }}
        >
          Ver todo →
        </Link>
      </div>

      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {items.map((item) => (
          <li key={item.id}>
            <ActivityRow item={item} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ActivityRow({ item }: { item: RecentActivityItem }) {
  const statusLabel = STATUS_LABELS[item.status] ?? item.status;
  const statusColor = STATUS_COLORS[item.status] ?? "var(--ink-soft)";

  return (
    <Link
      href={`/studio/tracking/${item.shipment_id}`}
      style={{
        display: "block",
        padding: "10px 8px",
        borderRadius: "var(--r-sm)",
        textDecoration: "none",
        transition: "background var(--dur-fast) var(--ease)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--bg-elevated)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
          marginBottom: 3,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            minWidth: 0,
          }}
        >
          <span
            aria-hidden
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: statusColor,
              flexShrink: 0,
            }}
          />
          <code
            style={{
              font: "700 11.5px/1 var(--f-mono)",
              color: "var(--wine)",
            }}
          >
            {item.shipment_code}
          </code>
          <span
            style={{
              font: "600 11px/1 var(--f-sans)",
              color: statusColor,
              letterSpacing: "0.02em",
            }}
          >
            {statusLabel}
          </span>
        </div>
        <span
          style={{
            font: "500 10.5px/1 var(--f-mono)",
            color: "var(--ink-mute)",
            flexShrink: 0,
          }}
        >
          {fmtAgo(item.occurred_at)}
        </span>
      </div>
      <div
        style={{
          font: "500 12.5px/1.3 var(--f-sans)",
          color: "var(--ink)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {item.client_name ?? "—"}
        {item.note && (
          <span style={{ color: "var(--ink-soft)", marginLeft: 8 }}>
            · {item.note}
          </span>
        )}
      </div>
    </Link>
  );
}

function fmtAgo(iso: string): string {
  const now = Date.now();
  const t = new Date(iso).getTime();
  const m = Math.floor((now - t) / 60000);
  if (m < 1) return "recién";
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `hace ${d}d`;
  return new Date(iso).toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "short",
  });
}
