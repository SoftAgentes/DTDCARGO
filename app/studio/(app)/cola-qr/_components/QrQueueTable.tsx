"use client";

/**
 * Tabla de órdenes QR con selección múltiple + acciones inline
 * (Marcar impreso · Marcar entregado · Cancelar).
 */

import { useState, useTransition } from "react";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { markPrintedAction, markDeliveredAction, cancelQrOrderAction } from "../actions";
import {
  QR_PRIORITY_LABELS,
  QR_PRIORITY_TONES,
  QR_STATUS_LABELS,
  QR_STATUS_TONES,
  type QrOrder,
  type QrQueueTab,
} from "@/lib/studio/qr-queue-types";

interface Props {
  orders: QrOrder[];
  tab: QrQueueTab;
  selectedIds: Set<string>;
  selectableIds: string[];
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onAfterAction: () => void;
}

export function QrQueueTable({
  orders,
  tab,
  selectedIds,
  selectableIds,
  onToggleSelect,
  onToggleSelectAll,
  onAfterAction,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  if (orders.length === 0) {
    return (
      <div
        style={{
          padding: 60,
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-md)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            font: "800 16px/1.2 var(--f-display)",
            color: "var(--ink)",
            marginBottom: "var(--s-2)",
          }}
        >
          {tab === "cola" ? "Cola vacía" : "Sin historial"}
        </div>
        <p
          style={{
            font: "500 12.5px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
          }}
        >
          {tab === "cola"
            ? "Cuando el operario CN mande órdenes de impresión, las vas a ver acá."
            : "Las órdenes impresas, entregadas y canceladas aparecen acá."}
        </p>
      </div>
    );
  }

  const handleMarkPrinted = (ids: string[]) => {
    const fd = new FormData();
    for (const id of ids) fd.append("ids", id);
    startTransition(async () => {
      await markPrintedAction({}, fd);
      onAfterAction();
    });
  };

  const handleMarkDelivered = (ids: string[]) => {
    const fd = new FormData();
    for (const id of ids) fd.append("ids", id);
    startTransition(async () => {
      await markDeliveredAction({}, fd);
      onAfterAction();
    });
  };

  const handleCancel = (id: string) => {
    if (!cancelReason.trim() || cancelReason.length < 4) return;
    const fd = new FormData();
    fd.set("id", id);
    fd.set("reason", cancelReason.trim());
    startTransition(async () => {
      await cancelQrOrderAction({}, fd);
      setCancelingId(null);
      setCancelReason("");
      onAfterAction();
    });
  };

  const allSelected =
    selectableIds.length > 0 && selectedIds.size === selectableIds.length;

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        overflow: "hidden",
      }}
    >
      <div style={{ overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
          <thead>
            <tr style={{ background: "var(--bg-elevated)" }}>
              {tab === "cola" && (
                <th style={{ ...thStyle, width: 36 }}>
                  {selectableIds.length > 0 && (
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={onToggleSelectAll}
                      style={{ accentColor: "var(--wine)" }}
                    />
                  )}
                </th>
              )}
              <th style={thStyle}>Orden</th>
              <th style={thStyle}>Cliente</th>
              <th style={thStyle}>Supplier</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Bultos</th>
              <th style={thStyle}>Operario</th>
              <th style={thStyle}>Status</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const checked = selectedIds.has(o.id);
              const canSelect = o.status === "pendiente";
              return (
                <tr
                  key={o.id}
                  style={{
                    borderTop: "1px solid var(--border)",
                    background: checked ? "var(--wine-tint)" : "transparent",
                  }}
                >
                  {tab === "cola" && (
                    <td style={tdStyle}>
                      {canSelect ? (
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => onToggleSelect(o.id)}
                          style={{ accentColor: "var(--wine)" }}
                        />
                      ) : (
                        <span style={{ color: "var(--ink-mute)" }}>—</span>
                      )}
                    </td>
                  )}
                  <td style={tdStyle}>
                    <code
                      style={{
                        font: "800 12.5px/1 var(--f-mono)",
                        color: "var(--wine)",
                      }}
                    >
                      {o.order_code}
                    </code>
                    <div
                      style={{
                        marginTop: "var(--s-1)",
                        display: "flex",
                        gap: 6,
                        alignItems: "center",
                      }}
                    >
                      {o.priority === "urgent" && (
                        <Badge tone={QR_PRIORITY_TONES.urgent} size="sm">
                          {QR_PRIORITY_LABELS.urgent}
                        </Badge>
                      )}
                      <code
                        style={{
                          font: "600 10.5px/1 var(--f-mono)",
                          color: "var(--ink-soft)",
                        }}
                      >
                        {timeAgo(o.sent_at)}
                      </code>
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ font: "700 13px/1.2 var(--f-sans)", color: "var(--ink)" }}>
                      {o.client_name}
                    </div>
                    <code
                      style={{
                        font: "600 11px/1.2 var(--f-mono)",
                        color: "var(--ink-soft)",
                        marginTop: 3,
                        display: "inline-block",
                      }}
                    >
                      {o.markbox}
                    </code>
                  </td>
                  <td style={tdStyle}>
                    {o.supplier_name ?? (
                      <span style={{ color: "var(--ink-mute)" }}>—</span>
                    )}
                  </td>
                  <td
                    style={{
                      ...tdStyle,
                      textAlign: "right",
                      font: "800 14px/1 var(--f-mono)",
                      color: "var(--ink)",
                    }}
                  >
                    {o.bultos}
                  </td>
                  <td style={tdStyle}>
                    <div style={{ font: "600 12px/1.3 var(--f-sans)", color: "var(--ink)" }}>
                      {o.sent_by_name}
                    </div>
                    {o.sent_by_phone && (
                      <code
                        style={{
                          font: "500 10.5px/1.2 var(--f-mono)",
                          color: "var(--ink-soft)",
                          marginTop: 2,
                          display: "inline-block",
                        }}
                      >
                        {o.sent_by_phone}
                      </code>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <Badge tone={QR_STATUS_TONES[o.status]} size="sm">
                      {QR_STATUS_LABELS[o.status]}
                    </Badge>
                    {o.assigned_printer && (
                      <div
                        style={{
                          marginTop: "var(--s-1)",
                          font: "500 10.5px/1.2 var(--f-sans)",
                          color: "var(--ink-soft)",
                        }}
                      >
                        {o.assigned_printer}
                      </div>
                    )}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    {o.status === "imprimiendo" && (
                      <button
                        type="button"
                        className="studio-btn studio-btn-ghost studio-btn-xs"
                        disabled={isPending}
                        onClick={() => handleMarkPrinted([o.id])}
                      >
                        Marcar impreso
                      </button>
                    )}
                    {o.status === "impreso" && (
                      <button
                        type="button"
                        className="studio-btn studio-btn-primary studio-btn-xs"
                        disabled={isPending}
                        onClick={() => handleMarkDelivered([o.id])}
                      >
                        Marcar entregado
                      </button>
                    )}
                    {(o.status === "pendiente" || o.status === "imprimiendo") && (
                      <button
                        type="button"
                        className="studio-btn studio-btn-ghost studio-btn-xs"
                        style={{ marginLeft: 6, color: "var(--danger)" }}
                        disabled={isPending}
                        onClick={() => {
                          setCancelingId(o.id);
                          setCancelReason("");
                        }}
                      >
                        Cancelar
                      </button>
                    )}
                    {o.status === "entregado" && o.delivered_at && (
                      <span
                        style={{
                          font: "500 11px/1 var(--f-mono)",
                          color: "var(--ink-soft)",
                        }}
                      >
                        {timeAgo(o.delivered_at)}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Cancel inline modal */}
      {cancelingId && (
        <div
          onClick={() => setCancelingId(null)}
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "var(--scrim)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "var(--s-5)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 480,
              background: "var(--bg-surface)",
              borderRadius: "var(--r-md)",
              padding: 22,
            }}
          >
            <h3
              className="studio-display"
              style={{ fontSize: 16, margin: "0 0 8px", color: "var(--ink)" }}
            >
              Cancelar orden de impresión
            </h3>
            <p
              style={{
                font: "500 12.5px/1.4 var(--f-sans)",
                color: "var(--ink-soft)",
                margin: "0 0 12px",
              }}
            >
              El operario verá un aviso de cancelación en su próximo refresh.
            </p>
            <label className="studio-label" htmlFor="cancel-reason">
              Motivo
            </label>
            <textarea
              id="cancel-reason"
              className="studio-input"
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Ej: cliente pidió postergar"
              style={{ marginTop: 6, resize: "vertical" }}
            />
            <div
              style={{
                display: "flex",
                gap: 10,
                justifyContent: "flex-end",
                marginTop: 14,
              }}
            >
              <button
                type="button"
                onClick={() => setCancelingId(null)}
                className="studio-btn studio-btn-ghost"
                disabled={isPending}
              >
                Volver
              </button>
              <button
                type="button"
                onClick={() => handleCancel(cancelingId)}
                className="studio-btn studio-btn-danger"
                disabled={isPending || cancelReason.length < 4}
              >
                {isPending ? "Cancelando…" : "Cancelar orden"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "10px 12px",
  textAlign: "left",
  font: "700 10.5px/1 var(--f-sans)",
  color: "var(--ink-soft)",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 12px",
  font: "500 12.5px/1.3 var(--f-sans)",
  color: "var(--ink)",
  verticalAlign: "top",
};

function timeAgo(iso: string): string {
  const now = Date.now();
  const t = new Date(iso).getTime();
  const m = Math.floor((now - t) / 60000);
  if (m < 1) return "recién";
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}
