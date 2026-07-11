/**
 * TrackingMap — mapa SVG estilizado para la vista operativa (SDD-0013).
 *
 * No es un mapa real. Es una representación visual del avance del
 * embarque entre origen (CN o VE) y destino (VE). Continentes
 * simplificados, ruta curva, barco animado por % progress.
 *
 * Cuando exista AIS real (SDD futuro), reemplazar internals
 * manteniendo la misma interface.
 */

import type { Shipment } from "@/lib/studio/shipment-types";
import {
  computeProgress,
  daysRemaining,
  nextMilestone,
} from "@/lib/studio/tracking-progress";

type Props = {
  shipment: Shipment;
};

function formatEtaDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "short",
  });
}

export function TrackingMap({ shipment }: Props) {
  const progress = computeProgress(shipment.status);
  const isAlert =
    shipment.status === "exception" || shipment.status === "delayed_warehouse";
  const days = daysRemaining(shipment.status, shipment.shipment_service);
  const milestone = nextMilestone(shipment.status, shipment.shipment_service);

  // Geometría del SVG (viewBox 900×320)
  const ox = 180; // x del origen
  const dx = 720; // x del destino
  const py = 200; // y de la línea base
  // Posición horizontal del barco en función del progress
  const cx = ox + (dx - ox) * (progress / 100);
  // Altura del arco: máximo en 50%, parabólico
  const arcY = py - (progress < 50 ? progress * 1.6 : (100 - progress) * 1.6);

  const isGround = shipment.shipment_service === "transporte_terrestre";

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "var(--s-4) var(--s-5) var(--s-3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid var(--border)",
          gap: 16,
        }}
      >
        <div>
          <div
            className="studio-eyebrow"
            style={{ color: "var(--wine-text)" }}
          >
            Posición actual
          </div>
          <div
            className="studio-display"
            style={{
              fontSize: 18,
              color: "var(--ink)",
              marginTop: 6,
              lineHeight: 1.1,
            }}
          >
            {shipment.code} ·{" "}
            <span style={{ color: "var(--ink-soft)" }}>
              {shipment.vehicle_model ?? "sin asignar"}
            </span>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            className="studio-eyebrow"
            style={{ color: "var(--ink-soft)" }}
          >
            ETA {shipment.destination ?? "destino"}
          </div>
          <div
            style={{
              font: "800 16px/1 var(--f-mono)",
              color: isAlert ? "var(--warning)" : "var(--ink)",
              marginTop: 4,
            }}
          >
            {shipment.status === "delivered"
              ? formatEtaDate(shipment.arrived_destination_at)
              : `≈ ${days}d`}
          </div>
        </div>
      </div>

      {/* SVG canvas */}
      <div
        style={{
          position: "relative",
          height: 320,
          background: "var(--bg-elevated)",
        }}
      >
        <svg
          viewBox="0 0 900 320"
          className="studio-tracking-map-svg"
          style={{ width: "100%", height: "100%", display: "block" }}
          role="img"
          aria-label={`Mapa de avance ${shipment.code} en ${progress}%`}
        >
          {/* Continentes estilizados (Asia · Europa · África). */}
          <path
            d="M30 80 L240 70 L260 120 L210 180 L130 200 L40 170 Z"
            fill="var(--bg-surface)"
            stroke="var(--border)"
            strokeWidth="1"
          />
          <path
            d="M620 70 L850 80 L870 160 L810 200 L700 190 L640 150 Z"
            fill="var(--bg-surface)"
            stroke="var(--border)"
            strokeWidth="1"
          />
          <path
            d="M270 200 L480 230 L500 280 L380 300 L290 270 Z"
            fill="var(--bg-surface)"
            stroke="var(--border)"
            strokeWidth="1"
          />

          {/* Ruta completa (dasharray wine-soft) */}
          {isGround ? (
            <line
              x1={ox}
              y1={py}
              x2={dx}
              y2={py}
              stroke="var(--wine-soft)"
              strokeWidth="2"
              strokeDasharray="5 5"
            />
          ) : (
            <path
              d={`M ${ox} ${py} Q 450 ${py - 80} ${dx} ${py}`}
              fill="none"
              stroke="var(--wine-soft)"
              strokeWidth="2"
              strokeDasharray="5 5"
            />
          )}

          {/* Ruta recorrida (sólida wine, hasta el barco) */}
          {isGround ? (
            <line
              x1={ox}
              y1={py}
              x2={cx}
              y2={py}
              stroke="var(--wine)"
              strokeWidth="3"
            />
          ) : (
            <path
              d={`M ${ox} ${py} Q ${(ox + cx) / 2} ${py - 40} ${cx} ${arcY}`}
              fill="none"
              stroke="var(--wine)"
              strokeWidth="3"
            />
          )}

          {/* Origen */}
          <circle cx={ox} cy={py} r="9" fill="var(--ink)" />
          <circle cx={ox} cy={py} r="3" fill="var(--bg-surface)" />
          <text
            x={ox}
            y={py + 28}
            fill="var(--ink)"
            textAnchor="middle"
            style={{ font: "900 11px/1 var(--f-display)" }}
          >
            {shipment.origin ?? "Origen"}
          </text>
          <text
            x={ox}
            y={py + 42}
            fill="var(--ink-soft)"
            textAnchor="middle"
            style={{ font: "600 9px/1 var(--f-sans)" }}
          >
            {isGround ? "Venezuela" : "China"}
          </text>

          {/* Destino */}
          <circle cx={dx} cy={py} r="9" fill="var(--wine)" />
          <circle cx={dx} cy={py} r="3" fill="var(--bg-surface)" />
          <text
            x={dx}
            y={py + 28}
            fill="var(--ink)"
            textAnchor="middle"
            style={{ font: "900 11px/1 var(--f-display)" }}
          >
            {shipment.destination ?? "Destino"}
          </text>
          <text
            x={dx}
            y={py + 42}
            fill="var(--ink-soft)"
            textAnchor="middle"
            style={{ font: "600 9px/1 var(--f-sans)" }}
          >
            Venezuela
          </text>

          {/* Barco / móvil (solo si está en curso) */}
          {progress > 0 && progress < 100 && (
            <g transform={`translate(${cx}, ${isGround ? py : arcY})`}>
              {/* Halo animado */}
              <circle
                r="14"
                fill={isAlert ? "var(--warning)" : "var(--wine)"}
                opacity="0.25"
                data-pulse="halo"
              >
                <animate
                  attributeName="r"
                  values="14;22;14"
                  dur="2s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.4;0;0.4"
                  dur="2s"
                  repeatCount="indefinite"
                />
              </circle>
              <circle
                r="8"
                fill={isAlert ? "var(--warning)" : "var(--wine)"}
                stroke="var(--bg-surface)"
                strokeWidth="2"
              />
              <text
                y="-22"
                fill={isAlert ? "var(--warning)" : "var(--wine)"}
                textAnchor="middle"
                style={{ font: "900 10px/1 var(--f-mono)" }}
              >
                {progress}%
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Banda inferior · 4 KPIs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          borderTop: "1px solid var(--border)",
        }}
      >
        {[
          {
            l: "Progreso",
            v: `${progress}%`,
            tone: isAlert ? "warning" : "wine",
          },
          { l: "Días restantes", v: `≈ ${days}`, tone: "neutral" },
          {
            l: isGround ? "Velocidad" : "Velocidad",
            v: isGround ? "60 km/h" : "17.4 kn",
            tone: "neutral",
          },
          { l: "Próximo hito", v: milestone, tone: "neutral" },
        ].map((k, i) => (
          <div
            key={k.l}
            style={{
              padding: "14px 18px",
              borderRight: i < 3 ? "1px solid var(--border)" : 0,
            }}
          >
            <div
              className="studio-eyebrow"
              style={{ color: "var(--ink-soft)" }}
            >
              {k.l}
            </div>
            <div
              className="studio-display"
              style={{
                fontSize: 18,
                marginTop: 6,
                color:
                  k.tone === "wine"
                    ? "var(--wine)"
                    : k.tone === "warning"
                      ? "var(--warning)"
                      : "var(--ink)",
                lineHeight: 1,
              }}
            >
              {k.v}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
