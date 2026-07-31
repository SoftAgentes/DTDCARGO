/**
 * SDD-0184 · Fase 3 — planta 2D del plan de carga.
 *
 * POR QUÉ 2D Y NO ISOMÉTRICO: el dispositivo principal es el TELÉFONO (el
 * operario que estiba en Yiwu y quien descarga en Valencia), y una planta se lee
 * mejor que un isométrico en una pantalla chica. El visor isométrico
 * (`ContainerIsoView`) sigue vivo para el escritorio y para la realidad
 * capturada; este dibuja la HIPÓTESIS.
 *
 * POR QUÉ NO HAY SVG: es una cuadrícula rectangular. CSS grid la resuelve mejor
 * que un `<svg>` — se reajusta sola al ancho del teléfono, el texto es texto de
 * verdad (seleccionable, buscable, legible por lector de pantalla) y no hay que
 * calcular una sola coordenada. Referencia de lo que NO hacer: el visor WebGL de
 * SeaRates congeló la pestaña con 190 bultos, y EasyCargo pide 2 GB de RAM.
 *
 * Componente PURO (sin hooks, sin estado): server-renderizable, 0 KB de JS.
 *
 * LAS ÁREAS SE COMPARTEN (SDD-0184 §4.2): una celda puede tener varios clientes,
 * uno al lado del otro. Se dibujan como bandas proporcionales al CBM que cada
 * uno puso ahí — que es justo el dato que `ZonaOcupada.cbm` trae.
 */

import { Fragment } from "react";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import {
  assignClientColors,
  lookupClientColor,
} from "@/lib/studio/naviera/client-palette";
import {
  etiquetasAncho,
  etiquetasLargo,
  type PlanCarga,
} from "@/lib/shared/estiba-plan";

type Props = {
  plan: PlanCarga;
  /** `compact` = el que va en la tarjeta del listado. */
  variant?: "full" | "compact";
};

/** Lo que cae en una celda: quién y cuánto. */
type Banda = {
  markbox: string | null;
  clientName: string | null;
  cbm: number;
  paso: number;
};

export function ContainerPlanView({ plan, variant = "full" }: Props) {
  const compact = variant === "compact";
  const { nx, nz } = plan.espacio.layout;

  if (plan.pasos.length === 0) {
    return (
      <EmptyState
        eyebrow="Sin plan"
        title="Todavía no hay nada que repartir"
        description="Asigna carga al contenedor y calcula el plan para ver dónde va cada cliente."
      />
    );
  }

  const colores = assignClientColors(plan.pasos.map((p) => p.markbox));
  const tramos = etiquetasLargo(nx);
  const lados = etiquetasAncho(nz);

  // Celda (zx, zz) → las bandas que la ocupan, en orden de carga. La altura se
  // colapsa a propósito: el modelo no la usa (SDD-0155) y en un teléfono estorba.
  const celdas = new Map<string, Banda[]>();
  for (const paso of plan.pasos) {
    for (const z of paso.zonas) {
      const k = `${z.zx}-${z.zz}`;
      const lista = celdas.get(k) ?? [];
      lista.push({
        markbox: paso.markbox,
        clientName: paso.clientName,
        cbm: z.cbm,
        paso: paso.paso,
      });
      celdas.set(k, lista);
    }
  }

  const altoCelda = compact ? 44 : 68;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-3)" }}>
      {/* ── La planta ─────────────────────────────────────── */}
      <div
        role="img"
        aria-label={textoAlternativo(plan)}
        style={{
          display: "grid",
          gridTemplateColumns: `minmax(52px, auto) repeat(${nz}, minmax(0, 1fr))`,
          gap: 3,
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-strong)",
          borderRadius: "var(--r-md)",
          padding: compact ? 6 : 10,
        }}
      >
        {/* Cabecera: los lados */}
        <span aria-hidden="true" />
        {lados.map((l) => (
          <span
            key={l}
            style={{
              font: "700 9.5px/1 var(--f-sans)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--ink-soft)",
              textAlign: "center",
              paddingBottom: 4,
            }}
          >
            {l}
          </span>
        ))}

        {/* Una fila por tramo, del FONDO a la PUERTA (orden real de carga) */}
        {tramos.map((tramo, zx) => (
          <Fragment key={tramo}>
            <span
              style={{
                font: "700 9.5px/1.2 var(--f-sans)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--ink-soft)",
                alignSelf: "center",
                paddingRight: 6,
                textAlign: "right",
              }}
            >
              {tramo}
            </span>
            {lados.map((lado, zz) => (
              <Celda
                key={`${zx}-${zz}`}
                bandas={celdas.get(`${zx}-${zz}`) ?? []}
                colores={colores}
                alto={altoCelda}
                titulo={`${tramo} ${zz === 1 && nz === 3 ? "al centro" : zz === 0 ? "a la izquierda" : "a la derecha"}`}
              />
            ))}
          </Fragment>
        ))}
      </div>

      {/* ── La puerta, para que se entienda la orientación ── */}
      <div
        aria-hidden="true"
        style={{
          font: "600 10px/1 var(--f-sans)",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--ink-soft)",
          textAlign: "center",
          marginTop: -6,
        }}
      >
        ↑ se carga desde el fondo · se descarga por la puerta ↓
      </div>

      {/* ── Leyenda · el color solo no basta (BRAND.md §6) ── */}
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
          {plan.pasos.map((p) => (
            <li key={p.loteId} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                aria-hidden="true"
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  background: lookupClientColor(colores, p.markbox),
                  flexShrink: 0,
                }}
              />
              <span style={{ font: "600 11.5px/1.3 var(--f-sans)", color: "var(--ink)" }}>
                {p.markbox ?? "Sin dueño"}
              </span>
              {p.clientName && (
                <span style={{ font: "500 11px/1.3 var(--f-sans)", color: "var(--ink-soft)" }}>
                  {p.clientName}
                </span>
              )}
              <span
                style={{
                  font: "700 11px/1.3 var(--f-mono)",
                  color: "var(--ink-soft)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {p.cbmUbicado} CBM
              </span>
              {p.parcial && (
                <Badge tone="warning" size="xs">
                  parcial
                </Badge>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Una celda de la planta. Varios clientes conviven como bandas proporcionales. */
function Celda({
  bandas,
  colores,
  alto,
  titulo,
}: {
  bandas: Banda[];
  colores: ReturnType<typeof assignClientColors>;
  alto: number;
  titulo: string;
}) {
  if (bandas.length === 0) {
    return (
      <span
        title={`${titulo} · vacío`}
        style={{
          height: alto,
          background: "var(--bg-base)",
          border: "1px dashed var(--border)",
          borderRadius: "var(--r-sm)",
        }}
      />
    );
  }

  const total = bandas.reduce((a, b) => a + b.cbm, 0);

  return (
    <span
      title={`${titulo} · ${bandas.map((b) => `${b.markbox ?? "sin dueño"} ${b.cbm} CBM`).join(" · ")}`}
      style={{
        height: alto,
        display: "flex",
        flexDirection: "column",
        borderRadius: "var(--r-sm)",
        overflow: "hidden",
        border: "1px solid var(--border-strong)",
      }}
    >
      {bandas.map((b, i) => {
        // Con CBM en 0 (lote sin volumen declarado) se reparte parejo, para que
        // igual se vea que hay algo ahí.
        const alto1 = total > 0 ? (b.cbm / total) * 100 : 100 / bandas.length;
        return (
          <span
            key={`${b.markbox}-${b.paso}-${i}`}
            style={{
              flex: `0 0 ${alto1}%`,
              background: lookupClientColor(colores, b.markbox),
              minHeight: 0,
            }}
          />
        );
      })}
    </span>
  );
}

/** El equivalente textual del dibujo — lo que oye un lector de pantalla. */
function textoAlternativo(plan: PlanCarga): string {
  const { stats, espacio } = plan;
  const cabeza = `Plan de carga de un ${espacio.label}: ${stats.cbmUbicado} de ${espacio.cbmCapacity} CBM (${Math.round(stats.pctVolumen)}%), ${stats.zonasUsadas} de ${stats.zonasTotales} áreas.`;
  const partes = plan.pasos.map(
    (p) => `${p.markbox ?? "sin dueño"} en ${p.destino}, ${p.cajasUbicadas} cajas`,
  );
  return `${cabeza} ${partes.join(". ")}.`;
}
