"use client";

/**
 * WithholdingsView — pestaña Retenciones (SDD-0104 · Slice B).
 *
 * Selector de mes + 2 KPIs (Retención IVA / ISLR del período) + tabla
 * (fecha, comprobante, tipo, proveedor, RIF, base, %, retenido, estado) +
 * drawer "Nuevo comprobante" + anular por fila + export CSV/PDF. EmptyState
 * honesto si el mes no tiene comprobantes. Solo tokens de marca.
 *
 * Los totales cuentan SOLO los emitidos; los anulados se muestran tachados.
 */

import { useMemo, useState, useTransition } from "react";
import { rowsToCsv, type CsvValue } from "@/lib/studio/reports/export-csv";
import { downloadTextFile } from "@/app/studio/_components/ui/download";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { Icon } from "@/app/studio/_components/icons";
import {
  periodLabel,
  shiftPeriod,
  type FiscalPeriod,
} from "@/lib/studio/fiscal/types";
import {
  withholdingStatusLabel,
  withholdingTypeShort,
  type TaxWithholding,
} from "@/lib/studio/fiscal/withholding-types";
import { withholdingTotals } from "@/lib/studio/fiscal/withholding-queries";
import { voidWithholdingAction } from "../actions";
import { useRouter } from "next/navigation";
import { WithholdingDrawer } from "./WithholdingDrawer";
import { ConfirmDialog } from "@/app/studio/_components/ui/ConfirmDialog";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";

function fmtMoney(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  font: "700 10px/1 var(--f-sans)",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--ink-soft)",
  borderBottom: "1.5px solid var(--border)",
  padding: "10px 12px",
  whiteSpace: "nowrap",
};
const tdStyle: React.CSSProperties = {
  font: "500 12.5px/1.4 var(--f-sans)",
  color: "var(--ink)",
  borderBottom: "1px solid var(--border)",
  padding: "9px 12px",
};
const numTd: React.CSSProperties = {
  ...tdStyle,
  textAlign: "right",
  fontFamily: "var(--f-mono)",
};
const numTh: React.CSSProperties = { ...thStyle, textAlign: "right" };

export function WithholdingsView({
  period,
  rows,
  canPost,
  onPeriod,
}: {
  period: FiscalPeriod;
  rows: TaxWithholding[];
  canPost: boolean;
  onPeriod: (p: FiscalPeriod) => void;
}) {
  const router = useRouter();
  const totals = useMemo(() => withholdingTotals(rows), [rows]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [confirmVoidId, setConfirmVoidId] = useState<string | null>(null);
  const toast = useToast();

  const doVoid = (id: string) => {
    setVoidingId(id);
    startTransition(async () => {
      const res = await voidWithholdingAction(id);
      setVoidingId(null);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      setConfirmVoidId(null);
      router.refresh();
    });
  };

  const exportCsv = () => {
    const headers = [
      "Fecha",
      "Comprobante",
      "Tipo",
      "Proveedor",
      "RIF",
      "Base",
      "% retención",
      "Retenido",
      "Moneda",
      "Estado",
    ];
    const data: CsvValue[][] = rows.map((r) => [
      r.opDate,
      r.voucherNumber,
      withholdingTypeShort(r.withholdingType),
      r.supplierName,
      r.rif ?? "—",
      r.base,
      r.pct,
      r.amount,
      r.currency,
      withholdingStatusLabel(r.status),
    ]);
    downloadTextFile(`retenciones-${period}.csv`, rowsToCsv(headers, data));
  };

  return (
    <div>
      {/* Toolbar: mes + acciones */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginBottom: 18,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            className="studio-btn studio-btn-ghost studio-btn-sm"
            onClick={() => onPeriod(shiftPeriod(period, -1))}
            aria-label="Mes anterior"
          >
            ←
          </button>
          <input
            type="month"
            value={period}
            onChange={(e) => {
              const v = e.target.value;
              if (/^\d{4}-\d{2}$/.test(v)) onPeriod(v);
            }}
            className="studio-input studio-input-mono"
            style={{ width: 160 }}
            aria-label="Período fiscal"
          />
          <button
            type="button"
            className="studio-btn studio-btn-ghost studio-btn-sm"
            onClick={() => onPeriod(shiftPeriod(period, 1))}
            aria-label="Mes siguiente"
          >
            →
          </button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="studio-btn studio-btn-ghost studio-btn-sm"
            onClick={exportCsv}
            disabled={rows.length === 0}
          >
            {Icon.doc(14)} Exportar CSV
          </button>
          <button
            type="button"
            className="studio-btn studio-btn-ghost studio-btn-sm"
            onClick={() => window.print()}
            disabled={rows.length === 0}
          >
            Exportar PDF
          </button>
          {canPost && (
            <button
              type="button"
              className="studio-btn studio-btn-primary studio-btn-sm"
              onClick={() => setDrawerOpen(true)}
            >
              {Icon.plus(14)} Nuevo comprobante
            </button>
          )}
        </div>
      </div>

      {/* KPIs siempre visibles (aunque el mes esté vacío, muestran 0). */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
          marginBottom: 18,
        }}
      >
        {[
          { k: "Retención de IVA", v: totals.iva },
          { k: "Retención de ISLR", v: totals.islr },
        ].map((c) => (
          <div
            key={c.k}
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-md)",
              padding: "14px 16px",
            }}
          >
            <div
              className="studio-eyebrow"
              style={{ color: "var(--ink-soft)", marginBottom: 6 }}
            >
              {c.k}
            </div>
            <div style={{ font: "800 22px/1 var(--f-mono)", color: "var(--ink)" }}>
              {fmtMoney(c.v)}
            </div>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          eyebrow={`Retenciones · ${periodLabel(period)}`}
          title="Sin comprobantes en este mes"
          description={
            canPost
              ? "No registraste comprobantes de retención en el período seleccionado. Cambia de mes o registra uno nuevo con el nº que asignó el portal SENIAT."
              : "No hay comprobantes de retención en el período seleccionado. Cambia de mes para ver otro."
          }
          action={
            canPost ? (
              <button
                type="button"
                className="studio-btn studio-btn-primary studio-btn-sm"
                onClick={() => setDrawerOpen(true)}
              >
                Nuevo comprobante
              </button>
            ) : undefined
          }
        />
      ) : (
        <div
          style={{
            overflowX: "auto",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
          }}
        >
          <table
            style={{ width: "100%", borderCollapse: "collapse", minWidth: 920 }}
          >
            <thead>
              <tr>
                <th style={thStyle}>Fecha</th>
                <th style={thStyle}>Comprobante</th>
                <th style={thStyle}>Tipo</th>
                <th style={thStyle}>Proveedor</th>
                <th style={thStyle}>RIF</th>
                <th style={numTh}>Base</th>
                <th style={numTh}>%</th>
                <th style={numTh}>Retenido</th>
                <th style={thStyle}>Estado</th>
                {canPost && <th style={thStyle} aria-label="Acciones" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const anulado = r.status === "anulado";
                const strike: React.CSSProperties = anulado
                  ? { textDecoration: "line-through", color: "var(--ink-mute)" }
                  : {};
                return (
                  <tr key={r.id}>
                    <td style={{ ...tdStyle, ...strike }}>{r.opDate}</td>
                    <td
                      style={{
                        ...tdStyle,
                        fontFamily: "var(--f-mono)",
                        ...strike,
                      }}
                    >
                      {r.voucherNumber}
                    </td>
                    <td style={tdStyle}>
                      <Badge tone={r.withholdingType === "iva" ? "wine" : "info"} size="sm">
                        {withholdingTypeShort(r.withholdingType)}
                      </Badge>
                    </td>
                    <td style={{ ...tdStyle, ...strike }}>{r.supplierName}</td>
                    <td
                      style={{
                        ...tdStyle,
                        fontFamily: "var(--f-mono)",
                        ...strike,
                      }}
                    >
                      {r.rif ?? "—"}
                    </td>
                    <td style={{ ...numTd, ...strike }}>{fmtMoney(r.base)}</td>
                    <td style={{ ...numTd, ...strike }}>{r.pct.toFixed(2)}%</td>
                    <td
                      style={{ ...numTd, fontWeight: 700, ...strike }}
                    >
                      {fmtMoney(r.amount)}
                    </td>
                    <td style={tdStyle}>
                      <Badge tone={anulado ? "neutral" : "success"} size="sm">
                        {withholdingStatusLabel(r.status)}
                      </Badge>
                    </td>
                    {canPost && (
                      <td style={{ ...tdStyle, textAlign: "right" }}>
                        {!anulado && (
                          <button
                            type="button"
                            className="studio-btn studio-btn-ghost studio-btn-xs"
                            onClick={() => setConfirmVoidId(r.id)}
                            disabled={pending && voidingId === r.id}
                          >
                            {pending && voidingId === r.id ? "Anulando…" : "Anular"}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p
        style={{
          font: "400 11.5px/1.5 var(--f-sans)",
          color: "var(--ink-soft)",
          margin: "14px 0 0",
          maxWidth: "82ch",
        }}
      >
        Los totales del período suman solo los comprobantes{" "}
        <strong style={{ color: "var(--ink)" }}>emitidos</strong>; los anulados
        quedan en el historial (tachados) y no cuentan. El nº de comprobante lo
        asigna el portal SENIAT — aquí se captura el real, no se genera.
      </p>

      {/* PDF: layout solo-impresión, mismo patrón que los libros. */}
      {rows.length > 0 && (
        <PrintLayout
          title={`Retenciones · ${periodLabel(period)}`}
          rows={rows.map((r) => [
            r.opDate,
            r.voucherNumber,
            withholdingTypeShort(r.withholdingType),
            r.supplierName,
            r.rif ?? "—",
            fmtMoney(r.base),
            `${r.pct.toFixed(2)}%`,
            fmtMoney(r.amount),
            withholdingStatusLabel(r.status),
          ])}
          totals={totals}
        />
      )}

      {drawerOpen && (
        <WithholdingDrawer
          period={period}
          onClose={() => setDrawerOpen(false)}
          onSaved={() => {
            setDrawerOpen(false);
            router.refresh();
          }}
        />
      )}

      <ConfirmDialog
        open={confirmVoidId !== null}
        danger
        title="Anular comprobante"
        message="¿Anular este comprobante de retención? Queda en historial."
        confirmLabel="Anular"
        pending={pending}
        onCancel={() => setConfirmVoidId(null)}
        onConfirm={() => {
          if (confirmVoidId) doVoid(confirmVoidId);
        }}
      />
    </div>
  );
}

// ── Layout solo-impresión (window.print = "Guardar como PDF") ──
function PrintLayout({
  title,
  rows,
  totals,
}: {
  title: string;
  rows: string[][];
  totals: { iva: number; islr: number };
}) {
  const columns = [
    "Fecha",
    "Comprobante",
    "Tipo",
    "Proveedor",
    "RIF",
    "Base",
    "%",
    "Retenido",
    "Estado",
  ];
  const numFrom = 5;
  return (
    <div id="dtd-fiscal-print">
      <div className="fp-eyebrow">DTD Cargo · Retenciones</div>
      <div className="fp-title">{title}</div>
      <table className="fp-table">
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={c} className={i >= numFrom && i <= 7 ? "fp-num" : ""}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>
              {r.map((cell, ci) => (
                <td key={ci} className={ci >= numFrom && ci <= 7 ? "fp-num" : ""}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="fp-foot">
        Retención de IVA: {fmtMoney(totals.iva)} · Retención de ISLR:{" "}
        {fmtMoney(totals.islr)} (solo emitidos). Generado desde DTD Studio.
      </div>
      <style>{`
        #dtd-fiscal-print { display: none; }
        @media print {
          body * { visibility: hidden !important; }
          #dtd-fiscal-print, #dtd-fiscal-print * { visibility: visible !important; }
          #dtd-fiscal-print {
            --ink: #0F1E3D;
            --ink-soft: #6B6B6B;
            --wine: #7F0F1A;
            --border: #E8E6E2;
            --bg-surface: #FFFFFF;
            display: block !important;
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            color: var(--ink);
            background: var(--bg-surface);
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          @page { size: A4 landscape; margin: 14mm; }
          #dtd-fiscal-print .fp-eyebrow {
            font: 700 9px/1 var(--f-sans);
            letter-spacing: 0.18em;
            text-transform: uppercase;
            color: var(--wine);
          }
          #dtd-fiscal-print .fp-title {
            font: 900 20px/1.15 var(--f-display);
            color: var(--ink);
            margin: 6px 0 16px;
          }
          #dtd-fiscal-print .fp-table { width: 100%; border-collapse: collapse; }
          #dtd-fiscal-print .fp-table thead { display: table-header-group; }
          #dtd-fiscal-print .fp-table tr { break-inside: avoid; }
          #dtd-fiscal-print .fp-table th {
            text-align: left;
            font: 700 8.5px/1 var(--f-sans);
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: var(--ink-soft);
            border-bottom: 1.5px solid var(--ink);
            padding: 6px;
          }
          #dtd-fiscal-print .fp-table td {
            font: 500 10px/1.3 var(--f-sans);
            color: var(--ink);
            border-bottom: 1px solid var(--border);
            padding: 5px 6px;
          }
          #dtd-fiscal-print .fp-num { text-align: right; font-family: var(--f-mono); }
          #dtd-fiscal-print .fp-foot {
            font: 400 9px/1.4 var(--f-sans);
            color: var(--ink-soft);
            margin-top: 14px;
          }
        }
      `}</style>
    </div>
  );
}
