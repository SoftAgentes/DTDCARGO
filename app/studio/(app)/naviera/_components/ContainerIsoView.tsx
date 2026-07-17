/**
 * SDD-0152 → SDD-0155 · Visor isométrico del contenedor por LOTES.
 *
 * SVG inline a mano, cero dependencias. Los motores del mercado (three.js ~155 KB,
 * Konva ~150 KB, PixiJS) están dimensionados para 8.000 cajas a 60 fps — muy por
 * encima de esta carga. Acá el peso es solo el de este archivo + zones.ts (~3 KB).
 *
 * SDD-0155: el layout NO es fijo — se DERIVA de lo montado. La profundidad la da
 * el orden de carga (la primera al fondo), el ancho es izq/centro/der, no hay
 * altura. Antes (0152) el layout venía de container_types con nx=3 fijo, y el
 * visor asumía `zx < 3` — con load_order creciente eso reventaba (lo marcó el
 * review adversarial). Ahora nx = cuántas cargas hay.
 *
 * Componente PURO (sin hooks, sin estado): lo consume NavieraClient, que es
 * "use client", así que viaja en el bundle del cliente.
 *
 * Interactividad: ninguna en JS. Cada cubo lleva un <title> nativo → el hover
 * muestra cliente + posición sin una línea de JavaScript. La leyenda textual es
 * la que desambigua (el color solo no basta: BRAND.md §6). Sigue los invariantes
 * de los charts (charts.tsx): viewBox + width:100%/height:auto, role="img" +
 * aria-label, colores solo var(--*).
 */

import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import {
  assignClientColors,
  lookupClientColor,
} from "@/lib/studio/naviera/client-palette";
import {
  cubeFaces,
  isoProject,
  isoViewBox,
  layoutFromStuffing,
  lotDepthLabels,
  painterSort,
  svgPoints,
  widthLabels,
  zoneLabel,
  zoneOccupancy,
  type StuffedBox,
  type ZoneLayout,
} from "@/lib/studio/naviera/zones";

type Props = {
  boxes: StuffedBox[];
  /** Sufijo único para los ids del <defs> (evita colisión con otros visores en la página). */
  idSuffix: string;
  /** `compact` = el que va en la tarjeta del listado. */
  variant?: "full" | "compact";
};

export function ContainerIsoView({ boxes, idSuffix, variant = "full" }: Props) {
  const compact = variant === "compact";
  const cw = compact ? 34 : 62;
  const ch = compact ? 23 : 42;
  const pad = compact ? 10 : 30;

  // SDD-0155: la profundidad la dan los datos (orden de carga), no un layout fijo.
  const layout = layoutFromStuffing(boxes);
  const occ = zoneOccupancy(layout, boxes);
  const colors = assignClientColors(boxes.map((b) => b.markbox));
  const vb = isoViewBox(layout, cw, ch, pad);
  const P = (x: number, y: number, z: number) => isoProject(x, y, z, cw, ch);

  const corrId = `corr-${idSuffix}`;

  // Casco: piso + las dos paredes del fondo. El lado de la puerta queda abierto
  // (es por donde se carga y por donde se mira).
  const floor = [P(0, 0, 0), P(layout.nx, 0, 0), P(layout.nx, 0, layout.nz), P(0, 0, layout.nz)];
  const wallBack = [P(0, 0, 0), P(layout.nx, 0, 0), P(layout.nx, layout.ny, 0), P(0, layout.ny, 0)];
  const wallLeft = [P(0, 0, 0), P(0, 0, layout.nz), P(0, layout.ny, layout.nz), P(0, layout.ny, 0)];

  const lengthL = lotDepthLabels(layout.nx);
  const widthL = widthLabels(layout.nz);

  if (boxes.length === 0) {
    return (
      <EmptyState
        eyebrow="Sin estibar"
        title="Todavía no hay nada cargado"
        description="Cuando el operario en el hub escanee las cajas al subirlas, vas a ver acá dónde quedó cada una."
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-3)" }}>
      <svg
        viewBox={`${vb.minX.toFixed(1)} ${vb.minY.toFixed(1)} ${vb.width.toFixed(1)} ${vb.height.toFixed(1)}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        role="img"
        aria-label={buildAriaLabel(layout, occ)}
      >
        <defs>
          {/* Corrugado vertical del contenedor · guiño a public/brand/container.svg */}
          <pattern
            id={corrId}
            width={compact ? 5 : 7}
            height={compact ? 5 : 7}
            patternUnits="userSpaceOnUse"
          >
            <rect width={compact ? 1.8 : 2.5} height={compact ? 5 : 7} fill="var(--shell-corr)" />
          </pattern>
        </defs>

        {/* ── Casco ─────────────────────────────────────────── */}
        <polygon
          points={svgPoints(floor)}
          fill="var(--shell-floor)"
          stroke="var(--border-strong)"
          strokeWidth={0.6}
        />
        {[wallBack, wallLeft].map((w, i) => (
          <g key={`wall-${i}`}>
            <polygon points={svgPoints(w)} fill="var(--shell-wall)" />
            <polygon points={svgPoints(w)} fill={`url(#${corrId})`} />
            <polygon
              points={svgPoints(w)}
              fill="none"
              stroke="var(--border-strong)"
              strokeWidth={0.6}
            />
          </g>
        ))}

        {/* ── Zonas · algoritmo del pintor (atrás-abajo → adelante-arriba) ── */}
        {painterSort(boxes).map((b) => {
          const f = cubeFaces(b, cw, ch);
          const fill = lookupClientColor(colors, b.markbox);
          return (
            <g key={b.boxId}>
              <title>
                {`${b.markbox ?? "Sin dueño"}${b.clientName ? ` · ${b.clientName}` : ""} · ${zoneLabel(layout, b)} · caja ${b.code}`}
              </title>
              {/* izquierda (sombreada) → derecha (base) → tapa (iluminada) */}
              <polygon points={svgPoints(f.left)} fill={fill} />
              <polygon points={svgPoints(f.left)} fill="var(--face-left-tint)" />
              <polygon points={svgPoints(f.right)} fill={fill} />
              <polygon points={svgPoints(f.top)} fill={fill} />
              <polygon points={svgPoints(f.top)} fill="var(--face-top-tint)" />
              <polygon
                points={svgPoints(f.top)}
                fill="none"
                stroke="var(--bg-surface)"
                strokeWidth={0.5}
                strokeOpacity={0.5}
              />
            </g>
          );
        })}

        {/* ── Ejes ──────────────────────────────────────────── */}
        {!compact &&
          lengthL.map((t, i) => {
            const [x, y] = P(i + 0.5, 0, layout.nz);
            return (
              <text
                key={`lx-${i}`}
                x={x + 13}
                y={y + 12}
                textAnchor="start"
                fontFamily="var(--f-sans)"
                fontSize={8.5}
                fontWeight={700}
                letterSpacing="0.6"
                fill="var(--ink-soft)"
              >
                {t.toUpperCase()}
              </text>
            );
          })}
        {!compact &&
          widthL.map((t, i) => {
            const [x, y] = P(layout.nx, 0, i + 0.5);
            return (
              <text
                key={`lz-${i}`}
                x={x - 13}
                y={y + 12}
                textAnchor="end"
                fontFamily="var(--f-sans)"
                fontSize={8.5}
                fontWeight={700}
                letterSpacing="0.6"
                fill="var(--ink-soft)"
              >
                {t.toUpperCase()}
              </text>
            );
          })}
      </svg>

      {/* ── Leyenda · el color solo no basta (BRAND.md §6) ──── */}
      {!compact && (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexWrap: "wrap",
            gap: "var(--s-2) var(--s-4)",
          }}
        >
          {occ.byMarkbox.map((c) => (
            <li
              key={c.markbox}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  background: lookupClientColor(colors, c.markbox),
                  flexShrink: 0,
                }}
              />
              <span style={{ font: "600 11.5px/1.3 var(--f-sans)", color: "var(--ink)" }}>
                {c.markbox}
              </span>
              {c.clientName && (
                <span style={{ font: "500 11px/1.3 var(--f-sans)", color: "var(--ink-soft)" }}>
                  {c.clientName}
                </span>
              )}
              <span
                style={{
                  font: "700 11px/1.3 var(--f-mono)",
                  color: "var(--ink-soft)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {c.zones}
              </span>
            </li>
          ))}
          <li style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              aria-hidden="true"
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-strong)",
                flexShrink: 0,
              }}
            />
            <span style={{ font: "500 11.5px/1.3 var(--f-sans)", color: "var(--ink-soft)" }}>
              Vacías
            </span>
            <span
              style={{
                font: "700 11px/1.3 var(--f-mono)",
                color: "var(--ink-soft)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {occ.total - occ.filled}
            </span>
          </li>
        </ul>
      )}
    </div>
  );
}

/** El equivalente textual del dibujo — lo que oye un lector de pantalla. */
function buildAriaLabel(
  layout: ZoneLayout,
  occ: ReturnType<typeof zoneOccupancy>,
): string {
  const head = `Contenedor por zonas: ${occ.filled} de ${occ.total} ocupadas (${Math.round(occ.pct)}%).`;
  if (occ.byMarkbox.length === 0) return `${head} Vacío.`;
  const parts = occ.byMarkbox.map(
    (c) => `${c.markbox}${c.clientName ? ` (${c.clientName})` : ""}: ${c.zones} zona${c.zones === 1 ? "" : "s"}`,
  );
  return `${head} ${parts.join(". ")}.`;
}
