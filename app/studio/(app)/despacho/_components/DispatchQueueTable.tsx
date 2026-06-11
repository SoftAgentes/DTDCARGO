"use client";

/**
 * DispatchQueueTable — cola priorizada con scoring (SDD-0029 Vista 1).
 *
 * Muestra paquetes con check de selección, badge de score level + valor,
 * pago, días en bodega, ciudad, peso/cbm. En modo seleccionado permite
 * editar cajas a despachar (P1) → P2 se genera al confirmar.
 */

import { Badge } from "@/app/studio/_components/ui/Badge";
import {
  SCORE_LEVEL_COLORS,
  SCORE_LEVEL_LABELS,
  scoreLevel,
} from "@/lib/studio/dispatch-scoring";
import {
  DISPATCH_PAYMENT_LABELS,
  DISPATCH_PAYMENT_TONES,
  type EligiblePackage,
} from "@/lib/studio/dispatch-types";
import type { DispatchRules } from "@/lib/studio/dispatch-rules-types";

interface Props {
  queue: EligiblePackage[];
  rules: DispatchRules;
  selectedIds: Set<string>;
  shippedMap: Map<string, number>;
  onToggle: (pkg: EligiblePackage) => void;
  onChangeShipped: (id: string, value: number) => void;
}

export function DispatchQueueTable({
  queue,
  rules,
  selectedIds,
  shippedMap,
  onToggle,
  onChangeShipped,
}: Props) {
  if (queue.length === 0) {
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
            marginBottom: 8,
          }}
        >
          La cola está vacía
        </div>
        <p
          style={{
            font: "500 12.5px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
          }}
        >
          {rules.payment_policy === "estricto"
            ? "No hay paquetes pagados listos para despacho. Si tu política es estricta, revísalo en Reglas."
            : "No hay paquetes recibidos en bodega VE. Las recepciones del operario CN aparecen acá cuando llegan."}
        </p>
      </div>
    );
  }

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
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 880 }}>
          <thead>
            <tr style={{ background: "var(--bg-elevated)" }}>
              <th style={thStyle}></th>
              <th style={thStyle}>Score</th>
              <th style={thStyle}>Cliente</th>
              <th style={thStyle}>Ciudad</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Cajas</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Peso · CBM</th>
              <th style={thStyle}>Pago</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Días</th>
            </tr>
          </thead>
          <tbody>
            {queue.map((p) => {
              const selected = selectedIds.has(p.id);
              const shipped = shippedMap.get(p.id) ?? p.boxes_total;
              const isPartial = selected && shipped < p.boxes_total;
              const level = scoreLevel(p.score);
              return (
                <tr
                  key={p.id}
                  style={{
                    borderTop: "1px solid var(--border)",
                    background: selected ? "var(--wine-tint)" : "transparent",
                    cursor: "pointer",
                  }}
                  onClick={() => onToggle(p)}
                >
                  <td style={{ padding: "10px 12px", width: 36 }}>
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={(e) => {
                        e.stopPropagation();
                        onToggle(p);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      style={{ accentColor: "var(--wine)", width: 16, height: 16 }}
                    />
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <code
                        style={{
                          font: "800 14px/1 var(--f-mono)",
                          color: SCORE_LEVEL_COLORS[level],
                        }}
                      >
                        {p.score}
                      </code>
                      <span
                        style={{
                          font: "700 9.5px/1 var(--f-sans)",
                          color: SCORE_LEVEL_COLORS[level],
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                        }}
                      >
                        {SCORE_LEVEL_LABELS[level]}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ font: "700 13px/1.2 var(--f-sans)", color: "var(--ink)" }}>
                      {p.client_name}
                    </div>
                    <code
                      style={{
                        font: "600 11px/1.2 var(--f-mono)",
                        color: "var(--ink-mute)",
                        marginTop: 3,
                        display: "inline-block",
                      }}
                    >
                      {p.markbox}
                    </code>
                  </td>
                  <td style={{ padding: "10px 12px", font: "500 12.5px/1.3 var(--f-sans)", color: "var(--ink)" }}>
                    {p.city}
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right" }}>
                    {selected ? (
                      <div
                        style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="number"
                          value={shipped}
                          min={1}
                          max={p.boxes_total}
                          onChange={(e) => onChangeShipped(p.id, Number(e.target.value))}
                          style={{
                            width: 60,
                            height: 32,
                            padding: "0 8px",
                            background: "var(--bg-surface)",
                            border: `1px solid ${isPartial ? "var(--warning)" : "var(--border)"}`,
                            borderRadius: "var(--r-sm)",
                            font: "800 14px/1 var(--f-mono)",
                            color: "var(--ink)",
                            textAlign: "right",
                            outline: "none",
                          }}
                        />
                        <span style={{ font: "600 11px/1 var(--f-mono)", color: "var(--ink-mute)" }}>
                          / {p.boxes_total}
                        </span>
                      </div>
                    ) : (
                      <code style={{ font: "800 14px/1 var(--f-mono)", color: "var(--ink)" }}>
                        {p.boxes_total}
                      </code>
                    )}
                  </td>
                  <td
                    style={{
                      padding: "10px 12px",
                      textAlign: "right",
                      font: "600 12px/1.3 var(--f-mono)",
                      color: "var(--ink)",
                    }}
                  >
                    <div>{p.weight_kg.toFixed(0)} kg</div>
                    <div style={{ color: "var(--ink-mute)" }}>{p.cbm.toFixed(1)} cbm</div>
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <Badge tone={DISPATCH_PAYMENT_TONES[p.pay]} size="sm">
                      {DISPATCH_PAYMENT_LABELS[p.pay]}
                    </Badge>
                  </td>
                  <td
                    style={{
                      padding: "10px 12px",
                      textAlign: "right",
                      font: "700 12px/1 var(--f-mono)",
                      color: p.days_in_warehouse > 14 ? "var(--warning)" : "var(--ink-soft)",
                    }}
                  >
                    {p.days_in_warehouse}d
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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
