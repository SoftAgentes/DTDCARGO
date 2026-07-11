"use client";

/**
 * ActiveOdsPanel — feed lateral con las ODs activas (SDD-0029 Vista 1 panel derecho).
 * Click en una OD abre el drawer de cancel (Fase 1) — en Fase 2 abre detalle.
 */

import { Badge } from "@/app/studio/_components/ui/Badge";
import {
  DISPATCH_ORDER_STATUS_LABELS,
  DISPATCH_ORDER_STATUS_TONES,
  type DispatchOrderRow,
} from "@/lib/studio/dispatch-types";

export function ActiveOdsPanel({
  ods,
  onCancel,
}: {
  ods: DispatchOrderRow[];
  onCancel: (id: string) => void;
}) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        padding: 16,
        position: "sticky",
        top: 16,
        maxHeight: "calc(100vh - 32px)",
        overflowY: "auto",
      }}
    >
      <div
        className="studio-eyebrow"
        style={{ color: "var(--wine-text)", marginBottom: 14 }}
      >
        Órdenes activas · {ods.length}
      </div>

      {ods.length === 0 ? (
        <p
          style={{
            font: "500 12.5px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
            padding: "var(--s-6) 0",
            textAlign: "center",
          }}
        >
          Sin ODs activas todavía. Al crear una desde la cola la vas a ver acá.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {ods.map((od) => {
            const tone = DISPATCH_ORDER_STATUS_TONES[od.status];
            const canCancel = od.status !== "entregada" && od.status !== "cerrada" && od.status !== "cancelada";
            return (
              <div
                key={od.id}
                style={{
                  padding: 12,
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border)",
                  borderLeft: "3px solid var(--wine)",
                  borderRadius: "var(--r-sm)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 6,
                  }}
                >
                  <code style={{ font: "800 12.5px/1 var(--f-mono)", color: "var(--wine-text)" }}>
                    {od.order_code}
                  </code>
                  <Badge tone={tone} size="sm">
                    {DISPATCH_ORDER_STATUS_LABELS[od.status]}
                  </Badge>
                </div>
                <div
                  style={{
                    font: "500 11.5px/1.3 var(--f-sans)",
                    color: "var(--ink-soft)",
                    marginBottom: 4,
                  }}
                >
                  {od.route?.name ?? "Sin ruta"}
                </div>
                <div
                  style={{
                    font: "600 11px/1.2 var(--f-mono)",
                    color: "var(--ink-soft)",
                    marginBottom: 8,
                  }}
                >
                  {od.truck?.plate ?? "—"} · {od.driver?.name ?? "—"}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    font: "600 10.5px/1 var(--f-mono)",
                    color: "var(--ink-soft)",
                  }}
                >
                  <span>{od.package_count} pkg</span>
                  <span>{od.total_kg.toFixed(0)} kg</span>
                  <span>{od.total_cbm.toFixed(1)} cbm</span>
                </div>
                {canCancel && (
                  <button
                    type="button"
                    onClick={() => onCancel(od.id)}
                    className="studio-btn studio-btn-ghost studio-btn-xs"
                    style={{ marginTop: 10, width: "100%" }}
                  >
                    Cancelar OD
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
