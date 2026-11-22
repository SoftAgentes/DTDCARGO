"use client";

/**
 * Vista Lista de un embudo del CRM (SDD-0648 §3, D6).
 *
 * Las mismas tarjetas que el tablero (ya filtradas por embudo y búsqueda), en
 * una tabla densa para revisar muchas de un vistazo. No hace lecturas nuevas.
 * Orden: etapa (el del admin) y, dentro de la etapa, la más antigua primero.
 * El nombre abre la ficha; mover se hace en el tablero o desde la ficha.
 */

import type { CSSProperties } from "react";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { canalDeTarjeta, CANAL_LABEL } from "@/lib/studio/crm-canal";
import {
  CRM_DIAS_ATENCION,
  SEGMENTO_LABEL,
  type CrmColumna,
  type CrmTablero,
  type CrmTarjetaTablero,
} from "@/lib/studio/crm-tablero";
import { CanalLogo } from "./CanalLogo";
import { nombreTarjeta } from "./CrmTableroKanban";

export function CrmEmbudosLista({
  tablero,
  columnas,
  onOpen,
}: {
  tablero: CrmTablero;
  columnas: CrmColumna[];
  onOpen: (tarjeta: CrmTarjetaTablero) => void;
}) {
  const filas = columnas.flatMap(({ etapa, tarjetas }) =>
    [...tarjetas]
      .sort((a, b) => (b.diasEnEtapa ?? -1) - (a.diasEnEtapa ?? -1))
      .map((t) => ({ t, etapa: etapa.nombre })),
  );

  if (filas.length === 0) {
    return (
      <p style={{ font: "400 12.5px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
        Sin tarjetas en este embudo.
      </p>
    );
  }

  return (
    <div
      style={{
        overflowX: "auto",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        background: "var(--bg-surface)",
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
        <caption style={SR_ONLY}>
          Tarjetas de {tablero === "leads" ? "Leads" : "Clientes"}, por etapa
        </caption>
        <thead>
          <tr>
            {["Canal", "Nombre", "Etapa", tablero === "leads" ? "Estado" : "Shipping Mark", "Dueño", "Días", "Tareas"].map(
              (h) => (
                <th key={h} scope="col" style={TH}>
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {filas.map(({ t, etapa }) => {
            const canal = canalDeTarjeta(t.fuente, t.utmSource);
            const nombre = nombreTarjeta(t);
            const atencion = t.diasEnEtapa != null && t.diasEnEtapa >= CRM_DIAS_ATENCION;
            return (
              <tr key={t.id} data-tarjeta-id={t.id} className="studio-row-hover">
                <td style={{ ...TD, width: 120, whiteSpace: "nowrap" }}>
                  {canal ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--s-1)" }}>
                      <CanalLogo canal={canal} />
                      {/* SDD-0676: los otros canales vinculados a la ficha del cliente. */}
                      {(t.canalesExtra ?? []).map((c) => (
                        <CanalLogo key={c} canal={c} />
                      ))}
                      <span>{CANAL_LABEL[canal]}</span>
                    </span>
                  ) : (
                    <span style={{ color: "var(--ink-soft)" }}>—</span>
                  )}
                </td>
                <td style={TD}>
                  <button
                    type="button"
                    onClick={() => onOpen(t)}
                    aria-label={`Abrir ficha de ${nombre}`}
                    className="studio-link-quiet"
                    style={{
                      background: "none",
                      border: 0,
                      padding: "var(--s-1) 0",
                      minHeight: 32,
                      cursor: "pointer",
                      textAlign: "left",
                      font: "600 13px/1.3 var(--f-sans)",
                      color: t.nombre ? "var(--ink)" : "var(--ink-soft)",
                    }}
                  >
                    {nombre}
                  </button>
                </td>
                <td style={TD}>{etapa}</td>
                <td style={TD}>{tablero === "leads" ? SEGMENTO_LABEL[t.segmento] : (t.shippingMark ?? "—")}</td>
                <td style={TD}>{t.asesorNombre ?? "Sin dueño"}</td>
                <td style={{ ...TD, font: "700 12px/1 var(--f-mono)", whiteSpace: "nowrap" }}>
                  {atencion && (
                    <span
                      aria-hidden
                      style={{
                        display: "inline-block",
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "var(--warning)",
                        marginRight: "var(--s-1)",
                        verticalAlign: "middle",
                      }}
                    />
                  )}
                  {t.diasEnEtapa == null ? "—" : `${t.diasEnEtapa}d`}
                  {atencion && <span style={SR_ONLY}> (más de {CRM_DIAS_ATENCION} días)</span>}
                </td>
                <td style={TD}>
                  {t.tareasVencidas > 0 ? (
                    <Badge tone="danger" size="sm">
                      {t.tareasVencidas === 1 ? "1 vencida" : `${t.tareasVencidas} vencidas`}
                    </Badge>
                  ) : t.tareasAbiertas > 0 ? (
                    `${t.tareasAbiertas}`
                  ) : (
                    <span style={{ color: "var(--ink-soft)" }}>—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const TH: CSSProperties = {
  textAlign: "left",
  font: "700 11px/1.2 var(--f-sans)",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--ink-soft)",
  background: "var(--bg-elevated)",
  padding: "var(--s-2) var(--s-3)",
  borderBottom: "1px solid var(--border)",
};

const TD: CSSProperties = {
  font: "500 12.5px/1.3 var(--f-sans)",
  color: "var(--ink)",
  padding: "0 var(--s-3)",
  borderBottom: "1px solid var(--border)",
  verticalAlign: "middle",
};

const SR_ONLY = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
} as const;
