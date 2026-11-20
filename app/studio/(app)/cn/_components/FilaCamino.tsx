"use client";

/**
 * Almacén China · una fila de «En camino» (SDD-0682 §2.2).
 *
 * Número DTD, naviera, ETA, días y porcentaje. El botón de la carga abre las
 * recepciones que van en el contenedor, con su MARKBOX (Shipping Mark). Nunca el
 * nombre del importador: no llega al navegador.
 */

import { useId, useState } from "react";
import { useT } from "@/lib/i18n";
import {
  rotuloDelContenedor,
  type ContenedorEnCamino,
} from "@/lib/studio/almacen-cn-contenedores";
import { COLUMNAS_CAMINO, textoDeDias } from "@/lib/studio/almacen-cn-vistas";
import { formatFecha } from "@/lib/studio/embarques-contenedores";
import { formatCbm } from "@/lib/shared/cbm";


function Dias({ dias }: { dias: number | null }) {
  const t = useT();
  const x = textoDeDias(dias);
  if (x.tipo === "sin_eta") {
    return <span style={{ color: "var(--ink-soft)" }}>{t("warehouse_cn.camino.no_eta")}</span>;
  }
  if (x.tipo === "hoy") return <strong>{t("warehouse_cn.camino.arrives_today")}</strong>;
  if (x.tipo === "vencida") {
    return (
      <strong style={{ color: "var(--danger-text)" }}>
        {t("warehouse_cn.camino.days_late", { days: x.dias })}
      </strong>
    );
  }
  return <strong>{t("warehouse_cn.camino.days_left", { days: x.dias })}</strong>;
}

function Avance({ valor, etiqueta }: { valor: number; etiqueta: string }) {
  const v = Math.max(0, Math.min(100, Math.round(valor)));
  return (
    <span style={{ display: "flex", alignItems: "center", gap: "var(--s-2)" }}>
      <span
        role="progressbar"
        aria-label={etiqueta}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={v}
        style={{
          flex: 1,
          height: 8,
          borderRadius: 999,
          background: "var(--border)",
          overflow: "hidden",
        }}
      >
        <span style={{ display: "block", width: `${v}%`, height: "100%", background: "var(--ink)" }} />
      </span>
      <span style={{ font: "700 12px/1 var(--f-mono)", minWidth: 40, textAlign: "right" }}>{v}%</span>
    </span>
  );
}

function Recepciones({ c, id }: { c: ContenedorEnCamino; id: string }) {
  const t = useT();
  // Va dentro de `role="table"`: es una fila con una sola celda que la cruza entera
  // (ARIA válido), y la tabla nativa de recepciones vive en esa celda.
  return (
    <div
      role="row"
      id={id}
      style={{
        padding: "var(--s-3) var(--s-4) var(--s-4)",
        background: "var(--bg-elevated)",
        borderTop: "1px solid var(--border)",
      }}
    >
      <div role="cell" aria-colspan={6}>
      {c.recepciones.length === 0 ? (
        <p style={{ margin: 0, color: "var(--ink-soft)", font: "400 13px/1.4 var(--f-sans)" }}>
          {t("warehouse_cn.camino.receipts_empty")}
        </p>
      ) : (
        <table
          style={{ width: "100%", borderCollapse: "collapse", font: "500 12.5px/1.3 var(--f-sans)" }}
          aria-label={t("warehouse_cn.camino.receipts_label", { container: rotuloDelContenedor(c) })}
        >
          <thead>
            <tr style={{ color: "var(--ink-soft)", textAlign: "left" }}>
              <th scope="col" style={{ padding: "var(--s-1) var(--s-2)" }}>{t("warehouse_cn.table.col_receipt")}</th>
              <th scope="col" style={{ padding: "var(--s-1) var(--s-2)" }}>{t("warehouse_cn.camino.col_mark")}</th>
              <th scope="col" style={{ padding: "var(--s-1) var(--s-2)", textAlign: "right" }}>
                {t("warehouse_cn.table.col_boxes")}
              </th>
              <th scope="col" style={{ padding: "var(--s-1) var(--s-2)", textAlign: "right" }}>
                {t("warehouse_cn.table.col_cbm")}
              </th>
            </tr>
          </thead>
          <tbody>
            {c.recepciones.map((r) => (
              <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ padding: "var(--s-1) var(--s-2)", font: "600 12px/1.3 var(--f-mono)" }}>{r.codigo}</td>
                <td style={{ padding: "var(--s-1) var(--s-2)", font: "600 12px/1.3 var(--f-mono)" }}>
                  {r.markbox ?? "—"}
                </td>
                <td style={{ padding: "var(--s-1) var(--s-2)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {r.cajas}
                </td>
                <td style={{ padding: "var(--s-1) var(--s-2)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {formatCbm(r.cbm)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      </div>
    </div>
  );
}

export function FilaCamino({ c }: { c: ContenedorEnCamino }) {
  const t = useT();
  const [abierta, setAbierta] = useState(false);
  const panelId = useId();
  const rotulo = rotuloDelContenedor(c);
  const carga =
    c.clientes === 1
      ? t("warehouse_cn.camino.load_text_one", { pieces: c.piezas })
      : t("warehouse_cn.camino.load_text", { clients: c.clientes, pieces: c.piezas });

  return (
    <>
      <div
        role="row"
        style={{
          display: "grid",
          gridTemplateColumns: COLUMNAS_CAMINO,
          borderTop: "1px solid var(--border)",
          gap: "var(--s-3)",
          alignItems: "center",
          padding: "var(--s-3) var(--s-4)",
          font: "500 13px/1.3 var(--f-sans)",
        }}
      >
        <span role="cell" style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <span style={{ font: "800 14px/1.2 var(--f-sans)" }}>{rotulo}</span>
          <span style={{ font: "500 11.5px/1.2 var(--f-mono)", color: "var(--ink-soft)" }}>
            {[c.numeroDtd !== null ? c.nombre : null, c.containerNo].filter(Boolean).join(" · ") || "—"}
          </span>
        </span>
        <span role="cell" style={{ color: "var(--ink-soft)", overflowWrap: "anywhere" }}>
          {c.naviera ?? "—"}
        </span>
        <span role="cell" style={{ whiteSpace: "nowrap" }}>
          {c.eta ? formatFecha(c.eta) : "—"}
        </span>
        <span role="cell" style={{ whiteSpace: "nowrap" }}>
          <Dias dias={c.diasRestantes} />
        </span>
        <span role="cell">
          <Avance valor={c.progreso} etiqueta={`${t("warehouse_cn.camino.col_progress")} · ${rotulo}`} />
        </span>
        <span role="cell" style={{ display: "flex", flexDirection: "column", gap: "var(--s-1)", alignItems: "flex-start" }}>
          <span style={{ color: "var(--ink-soft)" }}>{carga}</span>
          <button
            type="button"
            className="studio-btn studio-btn-ghost studio-btn-xs"
            aria-expanded={abierta}
            aria-controls={panelId}
            onClick={() => setAbierta((x) => !x)}
          >
            {abierta
              ? t("warehouse_cn.camino.hide_receipts")
              : t("warehouse_cn.camino.show_receipts", { count: c.recepciones.length })}
          </button>
        </span>
      </div>
      {abierta && <Recepciones c={c} id={panelId} />}
    </>
  );
}
