"use client";

/**
 * RendicionesClient (SDD-0069) — orquestador de la pantalla de rendiciones.
 *
 * Compone: navegación de mes + las 2 quincenas con su preview EN VIVO (totales
 * con su base + recibos elegibles) + el historial de rendiciones (con anular).
 * "Revisar y emitir" abre el EmitDrawer (revisión del preview antes de congelar
 * el snapshot, decisión #5). Trazabilidad visual: toast + highlight de la nueva
 * rendición en el historial (regla 1 del Studio).
 *
 * Solo tokens var(--*); sentence case; tuteo cero voseo. Nombra "la Operadora",
 * nunca "Canopy".
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { Icon } from "@/app/studio/_components/icons";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { useRowHighlight } from "@/app/studio/_components/ui/useRowHighlight";
import {
  renditionStatusLabel,
  renditionStatusTone,
  type Rendition,
} from "@/lib/studio/renditions/types";
import { fmtAmount } from "@/lib/studio/renditions/printable";
import type { QuincenaCard } from "../page";
import { EmitDrawer } from "./EmitDrawer";
import { VoidDrawer } from "./VoidDrawer";

export function RendicionesClient({
  monthLabel,
  prevMonthParam,
  nextMonthParam,
  cards,
  renditions,
}: {
  monthLabel: string;
  prevMonthParam: string;
  nextMonthParam: string;
  cards: QuincenaCard[];
  renditions: Rendition[];
}) {
  const router = useRouter();
  const toast = useToast();
  const flashClassFor = useRowHighlight();
  const [emitCard, setEmitCard] = useState<QuincenaCard | null>(null);
  const [voidTarget, setVoidTarget] = useState<Rendition | null>(null);

  const onEmitted = (code: string, count: number) => {
    setEmitCard(null);
    toast.success(`Rendición ${code} emitida · ${count} recibos`, {
      link: {
        href: `/studio/rendiciones/${code}`,
        label: "Ver rendición",
      },
    });
    router.replace(`/studio/rendiciones?highlight=${code}&hl-tone=warm`);
  };

  const onVoided = (code: string) => {
    setVoidTarget(null);
    toast.success(`Rendición ${code} anulada · recibos liberados`);
    router.refresh();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {/* Header */}
      <header style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span className="studio-eyebrow" style={{ color: "var(--ink-soft)" }}>
          Capa legal · mandato de cobranza
        </span>
        <h1
          className="studio-display"
          style={{ fontSize: 24, margin: 0, color: "var(--ink)" }}
        >
          Rendición a la Operadora
        </h1>
        <p
          style={{
            font: "500 13px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
            maxWidth: 720,
          }}
        >
          Cada quincena se rinde a la Operadora lo recaudado de terceros (flete
          internacional cobrado por su cuenta), neto de los servicios locales
          facturados por DTD Services. Emitir congela un comprobante inmutable y
          marca los recibos como rendidos.
        </p>
      </header>

      {/* Navegación de mes */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Link
            className="studio-btn studio-btn-ghost studio-btn-sm"
            href={`/studio/rendiciones?month=${prevMonthParam}`}
            aria-label="Mes anterior"
          >
            {Icon.chevR ? (
              <span style={{ transform: "rotate(180deg)", display: "inline-flex" }}>
                {Icon.chevR(13)}
              </span>
            ) : (
              "←"
            )}
          </Link>
          <span
            style={{
              font: "700 14px/1 var(--f-sans)",
              color: "var(--ink)",
              minWidth: 130,
              textAlign: "center",
            }}
          >
            {monthLabel}
          </span>
          <Link
            className="studio-btn studio-btn-ghost studio-btn-sm"
            href={`/studio/rendiciones?month=${nextMonthParam}`}
            aria-label="Mes siguiente"
          >
            {Icon.chevR ? Icon.chevR(13) : "→"}
          </Link>
        </div>
      </div>

      {/* Quincenas del mes */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: 16,
        }}
      >
        {cards.map((card) => (
          <QuincenaPanel
            key={`${card.from}-${card.to}`}
            card={card}
            onReview={() => setEmitCard(card)}
          />
        ))}
      </div>

      {/* Historial */}
      <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h2
          className="studio-display"
          style={{ fontSize: 17, margin: 0, color: "var(--ink)" }}
        >
          Historial de rendiciones
        </h2>
        {renditions.length === 0 ? (
          <EmptyState
            eyebrow="Rendiciones"
            title="Todavía no emitiste ninguna rendición"
            description="Revisa una quincena de arriba y emítela para empezar el historial."
          />
        ) : (
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: "var(--r-lg)",
              overflow: "hidden",
              background: "var(--bg-surface)",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                font: "500 12.5px/1.4 var(--f-sans)",
              }}
            >
              <thead>
                <tr style={{ background: "var(--bg-base)" }}>
                  {[
                    "Rendición",
                    "Período",
                    "Recaudado terceros",
                    "Servicios locales",
                    "Neto a la Operadora",
                    "Recibos",
                    "Estado",
                    "",
                  ].map((h, i) => (
                    <th
                      key={h || `c${i}`}
                      style={{
                        textAlign: i >= 2 && i <= 5 ? "right" : "left",
                        padding: "10px 14px",
                        font: "700 10px/1 var(--f-sans)",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "var(--ink-soft)",
                        borderBottom: "1px solid var(--border)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {renditions.map((r) => (
                  <tr
                    key={r.id}
                    data-row-id={r.rendition_code}
                    className={flashClassFor(r.rendition_code)}
                    style={{ borderBottom: "1px solid var(--border)" }}
                  >
                    <td style={{ padding: "10px 14px" }}>
                      <Link
                        href={`/studio/rendiciones/${r.rendition_code}`}
                        className="studio-input-mono"
                        style={{
                          font: "600 12.5px/1 var(--f-mono)",
                          color: "var(--wine-text)",
                          textDecoration: "none",
                        }}
                      >
                        {r.rendition_code}
                      </Link>
                    </td>
                    <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                      {r.period_from} → {r.period_to}
                    </td>
                    <td style={cellNum}>{fmtAmount(r.third_party_usd)}</td>
                    <td style={cellNum}>{fmtAmount(r.local_revenue_usd)}</td>
                    <td style={{ ...cellNum, fontWeight: 700 }}>
                      {fmtAmount(r.net_to_operadora_usd)}
                    </td>
                    <td style={cellNum}>{r.receipt_count}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <Badge tone={renditionStatusTone(r.status)} dot>
                        {renditionStatusLabel(r.status)}
                      </Badge>
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right" }}>
                      {r.status === "emitida" && (
                        <button
                          type="button"
                          className="studio-btn studio-btn-ghost studio-btn-xs"
                          onClick={() => setVoidTarget(r)}
                          style={{ color: "var(--danger)" }}
                        >
                          Anular
                        </button>
                      )}
                      {r.status === "anulada" && r.void_reason && (
                        <span
                          title={r.void_reason}
                          style={{
                            font: "500 11px/1.3 var(--f-sans)",
                            color: "var(--ink-soft)",
                          }}
                        >
                          {r.void_reason.length > 28
                            ? `${r.void_reason.slice(0, 28)}…`
                            : r.void_reason}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {emitCard && (
        <EmitDrawer
          card={emitCard}
          onClose={() => setEmitCard(null)}
          onEmitted={onEmitted}
        />
      )}
      {voidTarget && (
        <VoidDrawer
          rendition={voidTarget}
          onClose={() => setVoidTarget(null)}
          onVoided={onVoided}
        />
      )}
    </div>
  );
}

const cellNum: React.CSSProperties = {
  padding: "10px 14px",
  textAlign: "right",
  font: "500 12.5px/1 var(--f-mono)",
  color: "var(--ink)",
  whiteSpace: "nowrap",
};

/** Una quincena con su preview en vivo (3 totales + #recibos + botón revisar). */
function QuincenaPanel({
  card,
  onReview,
}: {
  card: QuincenaCard;
  onReview: () => void;
}) {
  const { preview } = card;
  const empty = preview.receiptCount === 0;
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        background: "var(--bg-surface)",
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span
          style={{
            font: "700 10px/1 var(--f-sans)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--ink-soft)",
          }}
        >
          Quincena
        </span>
        <span
          style={{ font: "700 15px/1.2 var(--f-sans)", color: "var(--ink)" }}
        >
          {card.label}
        </span>
        <span
          className="studio-input-mono"
          style={{ font: "500 11px/1.3 var(--f-mono)", color: "var(--ink-soft)" }}
        >
          {card.from} → {card.to}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <TotalRow
          label="Recaudado de terceros"
          base="caja"
          value={preview.thirdPartyUsd}
        />
        <TotalRow
          label="Servicios locales facturados"
          base="devengado"
          value={preview.localRevenueInvoicedUsd}
        />
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 8 }}>
          <TotalRow
            label="Neto a favor de la Operadora"
            value={preview.netToOperadoraUsd}
            strong
          />
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <span
          style={{ font: "500 12px/1 var(--f-sans)", color: "var(--ink-soft)" }}
        >
          {empty
            ? "Sin recibos por rendir"
            : `${preview.receiptCount} recibo${preview.receiptCount === 1 ? "" : "s"} por rendir`}
        </span>
        <button
          type="button"
          className="studio-btn studio-btn-primary studio-btn-sm"
          onClick={onReview}
          disabled={empty}
        >
          Revisar y emitir
        </button>
      </div>
    </div>
  );
}

function TotalRow({
  label,
  base,
  value,
  strong = false,
}: {
  label: string;
  base?: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 10,
      }}
    >
      <span
        style={{
          font: `${strong ? 700 : 500} 12.5px/1.3 var(--f-sans)`,
          color: strong ? "var(--ink)" : "var(--ink-soft)",
        }}
      >
        {label}
        {base && (
          <span
            style={{
              font: "600 9px/1 var(--f-sans)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--ink-soft)",
              marginLeft: 6,
            }}
          >
            {base}
          </span>
        )}
      </span>
      <span
        style={{
          font: `${strong ? 800 : 600} 14px/1 var(--f-mono)`,
          color: "var(--ink)",
          whiteSpace: "nowrap",
        }}
      >
        USD {fmtAmount(value)}
      </span>
    </div>
  );
}
