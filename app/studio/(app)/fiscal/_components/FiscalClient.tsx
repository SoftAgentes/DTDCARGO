"use client";

/**
 * FiscalClient — orquestador del módulo Fiscal/SENIAT (SDD-0073).
 *
 * 3 tabs (Configuración · Libro de Ventas · Libro de Compras) navegados por URL
 * (?tab=) + selector de mes (?period=YYYY-MM). Las tablas siguen el formato
 * SENIAT con totales por alícuota. Export:
 *  - CSV via downloadTextFile + rowsToCsv (reusa lib/studio/reports/export-csv).
 *  - PDF via window.print() sobre un layout solo-impresión (patrón Reportes 0052,
 *    sin lib de PDF).
 *
 * Cero valores fabricados: columnas sin fuente (nº de control; IVA/base de
 * compras en V1) muestran "—". EmptyState honesto cuando el mes no tiene filas.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { rowsToCsv, type CsvValue } from "@/lib/studio/reports/export-csv";
import { downloadTextFile } from "@/app/studio/_components/ui/download";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { Icon } from "@/app/studio/_components/icons";
import {
  invoiceIvaModeLabel,
  isFiscalModuleEnabled,
  type FiscalSettings,
} from "@/lib/studio/fiscal/config-types";
import {
  periodLabel,
  purchaseTotals,
  salesTotals,
  shiftPeriod,
  type BookTotals,
  type FiscalPeriod,
  type IvaClass,
  type PurchaseBookRow,
  type SalesBookRow,
} from "@/lib/studio/fiscal/types";
import type {
  PostedBook,
  PostedBookType,
} from "@/lib/studio/fiscal/books-types";
import type { TaxWithholding } from "@/lib/studio/fiscal/withholding-types";
import { postFiscalBookAction, voidFiscalBookAction } from "../actions";
import { FiscalConfig } from "./FiscalConfig";
import { WithholdingsView } from "./WithholdingsView";

export type FiscalTab = "config" | "ventas" | "compras" | "retenciones";

type Props = {
  tab: FiscalTab;
  period: FiscalPeriod;
  settings: FiscalSettings;
  canEditConfig: boolean;
  /** ¿El usuario puede asentar/anular libros y crear/anular retenciones? */
  canPost?: boolean;
  sales?: SalesBookRow[];
  purchases?: PurchaseBookRow[];
  /** Monedas distintas presentes en el período (V1 no normaliza con fx_rate). */
  currencies?: string[];
  /** Asiento VIGENTE del período (snapshot inmutable) o null si no asentado. */
  postedBook?: PostedBook | null;
  /** Comprobantes de retención del período (pestaña Retenciones). */
  withholdings?: TaxWithholding[];
};

const TABS: { id: FiscalTab; label: string }[] = [
  { id: "config", label: "Configuración" },
  { id: "ventas", label: "Libro de Ventas" },
  { id: "compras", label: "Libro de Compras" },
  { id: "retenciones", label: "Retenciones" },
];

// ── Formato ────────────────────────────────────────────────────
function fmtMoney(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtMoneyOrDash(n: number | null): string {
  return n == null ? "—" : fmtMoney(n);
}
function fmtRate(r: number | null): string {
  return r == null ? "Exenta" : `${r.toFixed(2)}%`;
}
function ivaClassLabel(k: IvaClass): string {
  return k === "exenta" ? "Exenta" : k === "tasa_cero" ? "Tasa 0%" : "Gravada";
}

export function FiscalClient({
  tab,
  period,
  settings,
  canEditConfig,
  canPost = false,
  sales,
  purchases,
  currencies = [],
  postedBook = null,
  withholdings = [],
}: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const moduleOn = isFiscalModuleEnabled(settings);

  const go = (next: Partial<{ tab: FiscalTab; period: FiscalPeriod }>) => {
    const sp = new URLSearchParams(params.toString());
    if (next.tab) sp.set("tab", next.tab);
    if (next.period) sp.set("period", next.period);
    router.push(`/studio/fiscal?${sp.toString()}`);
  };

  return (
    <div style={{ maxWidth: 1180 }}>
      <header style={{ marginBottom: 22 }}>
        <div className="studio-eyebrow" style={{ color: "var(--wine)", marginBottom: 6 }}>
          Fiscal · SENIAT
        </div>
        <h1 className="studio-display" style={{ font: "900 26px/1.1 var(--f-display)", color: "var(--ink)", margin: 0 }}>
          Libros de IVA y configuración fiscal
        </h1>
        <p style={{ font: "500 13.5px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: "8px 0 0", maxWidth: "70ch" }}>
          Libros de Ventas y Compras en formato SENIAT, generados según la{" "}
          <strong style={{ color: "var(--ink)" }}>configuración fiscal</strong> de tu
          empresa.{" "}
          <strong style={{ color: moduleOn ? "var(--success)" : "var(--ink-mute)" }}>
            Módulo {moduleOn ? "activo" : "desactivado"}
          </strong>
          {moduleOn && (
            <>
              {" "}· IVA por defecto en facturas nuevas:{" "}
              <strong style={{ color: "var(--ink)" }}>
                {invoiceIvaModeLabel(settings.default_invoice_iva_mode)}
              </strong>
            </>
          )}
          .
        </p>
      </header>

      {/* Tabs (navegación por URL) */}
      <div
        role="tablist"
        aria-label="Secciones del módulo fiscal"
        style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", marginBottom: 24 }}
      >
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => go({ tab: t.id })}
              style={{
                appearance: "none",
                background: "transparent",
                border: "none",
                borderBottom: `2px solid ${active ? "var(--wine)" : "transparent"}`,
                padding: "10px 14px",
                font: `${active ? 700 : 600} 13.5px/1 var(--f-sans)`,
                color: active ? "var(--wine)" : "var(--ink-soft)",
                cursor: "pointer",
                marginBottom: -1,
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "config" && <FiscalConfig settings={settings} canEdit={canEditConfig} />}

      {/* Principio #1: con el módulo OFF los libros no aplican (módulo inerte).
          Mostramos un estado claro con CTA a Configuración para activarlo. */}
      {tab === "ventas" &&
        (moduleOn ? (
          <SalesBookView
            period={period}
            rows={sales ?? []}
            settings={settings}
            currencies={currencies}
            postedBook={postedBook}
            canPost={canPost}
            onPeriod={(p) => go({ period: p })}
          />
        ) : (
          <FiscalDisabled canEditConfig={canEditConfig} onGoConfig={() => go({ tab: "config" })} />
        ))}

      {tab === "compras" &&
        (moduleOn ? (
          <PurchaseBookView
            period={period}
            rows={purchases ?? []}
            settings={settings}
            currencies={currencies}
            postedBook={postedBook}
            canPost={canPost}
            onPeriod={(p) => go({ period: p })}
          />
        ) : (
          <FiscalDisabled canEditConfig={canEditConfig} onGoConfig={() => go({ tab: "config" })} />
        ))}

      {tab === "retenciones" &&
        (moduleOn ? (
          <WithholdingsView
            period={period}
            rows={withholdings}
            canPost={canPost}
            onPeriod={(p) => go({ period: p })}
          />
        ) : (
          <FiscalDisabled canEditConfig={canEditConfig} onGoConfig={() => go({ tab: "config" })} />
        ))}
    </div>
  );
}

// ── Banda de asiento (asentar / snapshot vigente / anular) ─────
/**
 * Cinta de control del asentado de un libro-período (SDD-0104). Tres estados:
 *  - No asentado → botón "Asentar período" (accounting/admin) con confirmación.
 *  - Asentado, vivo == snapshot → badge "Asentado · {fecha}" + "Anular asiento".
 *  - Asentado, vivo difiere → además aviso discreto "hay cambios desde el asiento".
 *
 * Compara row_count + total base/iva del vivo contra el snapshot para detectar
 * drift (factura editada/agregada/anulada tras asentar).
 */
function PostingBar({
  period,
  bookType,
  posted,
  canPost,
  liveRowCount,
  liveBase,
  liveIva,
}: {
  period: FiscalPeriod;
  bookType: PostedBookType;
  posted: PostedBook | null;
  canPost: boolean;
  liveRowCount: number;
  liveBase: number;
  liveIva: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const close2 = (a: number, b: number) => Math.abs(a - b) < 0.01;
  const drift =
    posted != null &&
    (posted.rowCount !== liveRowCount ||
      !close2(posted.totalBase, liveBase) ||
      !close2(posted.totalIva, liveIva));

  const onPost = () => {
    if (
      !window.confirm(
        `¿Asentar el ${bookType === "ventas" ? "Libro de Ventas" : "Libro de Compras"} de ${periodLabel(period)}? Quedará congelado: editar facturas luego no cambia el asiento.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await postFiscalBookAction(period, bookType);
      if (res?.error) {
        window.alert(res.error);
        return;
      }
      router.refresh();
    });
  };

  const onVoid = () => {
    if (!posted) return;
    const reason = window.prompt(
      "Anular el asiento vigente (queda en historial; podrás re-asentar). Motivo (opcional):",
      "",
    );
    // null = canceló el prompt; "" = aceptó sin motivo.
    if (reason === null) return;
    startTransition(async () => {
      const res = await voidFiscalBookAction(posted.id, reason);
      if (res?.error) {
        window.alert(res.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        padding: "12px 14px",
        marginBottom: 18,
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        {posted ? (
          <>
            <Badge tone="success" size="md" dot>
              Asentado · {posted.postedAt.slice(0, 10)}
            </Badge>
            <span
              style={{ font: "500 12px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}
            >
              Snapshot inmutable de {posted.rowCount}{" "}
              {posted.rowCount === 1 ? "operación" : "operaciones"}.
            </span>
            {drift && (
              <span
                role="note"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  font: "600 11.5px/1.3 var(--f-sans)",
                  color: "var(--warning)",
                }}
              >
                <span aria-hidden style={{ fontWeight: 800 }}>!</span>
                Hay cambios desde el asiento — anula y re-asienta para actualizar.
              </span>
            )}
          </>
        ) : (
          <span
            style={{ font: "500 12.5px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}
          >
            Este período no está asentado. El libro se recalcula en vivo; asiéntalo
            para congelar un registro oficial inmutable.
          </span>
        )}
      </div>

      {canPost && (
        <div style={{ display: "flex", gap: 8 }}>
          {posted ? (
            <button
              type="button"
              className="studio-btn studio-btn-ghost studio-btn-sm"
              onClick={onVoid}
              disabled={pending}
            >
              {pending ? "Procesando…" : "Anular asiento"}
            </button>
          ) : (
            <button
              type="button"
              className="studio-btn studio-btn-primary studio-btn-sm"
              onClick={onPost}
              disabled={pending}
            >
              {pending ? "Asentando…" : "Asentar período"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Módulo desactivado (principio #1 · master toggle OFF) ──────
/**
 * Estado cuando `fiscal_module_enabled = false`: el módulo es inerte (no genera
 * libros, no toca IVA, la facturación sigue normal). DTD hoy = OFF. El admin lo
 * activa desde Configuración con su contador.
 */
function FiscalDisabled({
  canEditConfig,
  onGoConfig,
}: {
  canEditConfig: boolean;
  onGoConfig: () => void;
}) {
  return (
    <EmptyState
      eyebrow="Módulo fiscal desactivado"
      title="Los libros de IVA están apagados"
      description={
        canEditConfig
          ? "El módulo Fiscal/SENIAT está desactivado: la facturación funciona normal (sin IVA) y no se generan libros. Para activarlo, configúralo con tu contador en la pestaña Configuración."
          : "El módulo Fiscal/SENIAT está desactivado. Un administrador puede activarlo desde Configuración, junto con el contador."
      }
      action={
        canEditConfig ? (
          <button
            type="button"
            className="studio-btn studio-btn-primary studio-btn-sm"
            onClick={onGoConfig}
          >
            Ir a Configuración
          </button>
        ) : undefined
      }
    />
  );
}

// ── Selector de mes ────────────────────────────────────────────
function MonthSelector({
  period,
  onPeriod,
}: {
  period: FiscalPeriod;
  onPeriod: (p: FiscalPeriod) => void;
}) {
  return (
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
  );
}

// ── Barra de período + export ──────────────────────────────────
function BookToolbar({
  period,
  onPeriod,
  onCsv,
  hasRows,
}: {
  period: FiscalPeriod;
  onPeriod: (p: FiscalPeriod) => void;
  onCsv: () => void;
  hasRows: boolean;
}) {
  return (
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
      <MonthSelector period={period} onPeriod={onPeriod} />
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          className="studio-btn studio-btn-ghost studio-btn-sm"
          onClick={onCsv}
          disabled={!hasRows}
        >
          {Icon.doc(14)} Exportar CSV
        </button>
        <button
          type="button"
          className="studio-btn studio-btn-primary studio-btn-sm"
          onClick={() => window.print()}
          disabled={!hasRows}
        >
          Exportar PDF
        </button>
      </div>
    </div>
  );
}

// ── Moneda del libro + aviso de mezcla ─────────────────────────
/**
 * Encabezado de moneda del libro. V1 NO normaliza con fx_rate, así que:
 *  - 1 moneda → la muestra en el encabezado (el usuario sabe en qué moneda lee).
 *  - >1 moneda → además un banner visible: los totales mezclan monedas (no se
 *    suman con tipo de cambio en V1). Es información que el usuario DEBE ver, no
 *    solo un comentario en código.
 */
function CurrencyNote({ currencies }: { currencies: string[] }) {
  if (currencies.length === 0) return null;
  const mixed = currencies.length > 1;

  return (
    <div style={{ marginBottom: 14 }}>
      <div className="studio-eyebrow" style={{ color: "var(--ink-mute)", marginBottom: mixed ? 8 : 0 }}>
        Moneda: <span style={{ fontFamily: "var(--f-mono)", color: "var(--ink-soft)" }}>{currencies.join(" · ")}</span>
      </div>
      {mixed && (
        <div
          role="note"
          style={{
            display: "flex",
            gap: 8,
            alignItems: "flex-start",
            background: "var(--warning-bg)",
            border: "1px solid var(--warning)",
            borderRadius: "var(--r-md)",
            padding: "10px 12px",
            font: "500 12px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
          }}
        >
          <span aria-hidden style={{ color: "var(--warning)", fontWeight: 700, lineHeight: 1.5 }}>!</span>
          <span>
            Este período tiene operaciones en{" "}
            <strong style={{ color: "var(--ink)" }}>más de una moneda</strong> (
            {currencies.join(", ")}). Los totales suman los montos{" "}
            <strong style={{ color: "var(--ink)" }}>sin convertir</strong> con el tipo
            de cambio — revisa cada fila por su moneda. La normalización por tasa BCV
            queda para una versión futura.
          </span>
        </div>
      )}
    </div>
  );
}

// ── Totales (cards) ────────────────────────────────────────────
function TotalsStrip({ totals, label }: { totals: BookTotals; label: string }) {
  const cards: { k: string; v: string }[] = [
    { k: "Base imponible", v: fmtMoney(totals.base) },
    { k: label, v: fmtMoney(totals.iva) },
    { k: "Total", v: fmtMoney(totals.total) },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 18 }}>
      {cards.map((c) => (
        <div
          key={c.k}
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            padding: "14px 16px",
          }}
        >
          <div className="studio-eyebrow" style={{ color: "var(--ink-mute)", marginBottom: 6 }}>{c.k}</div>
          <div style={{ font: "800 22px/1 var(--f-mono)", color: "var(--ink)" }}>{c.v}</div>
        </div>
      ))}
    </div>
  );
}

// ── Tabla genérica ─────────────────────────────────────────────
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
const numTd: React.CSSProperties = { ...tdStyle, textAlign: "right", fontFamily: "var(--f-mono)" };
const numTh: React.CSSProperties = { ...thStyle, textAlign: "right" };

// ── Snapshot → filas (para renderizar el asiento con la misma tabla) ──
/** Líneas del snapshot vigente → SalesBookRow[] (lo que pinta la tabla viva). */
function postedToSalesRows(posted: PostedBook): SalesBookRow[] {
  return posted.entries.map((e) => ({
    date: e.opDate ?? "—",
    invoiceCode: e.documentNumber ?? "—",
    controlNumber: e.controlNumber,
    rif: e.rif,
    clientName: e.partyName ?? "—",
    ivaClass: (e.ivaClass ?? "exenta") as IvaClass,
    base: e.base ?? 0,
    rate: e.rate,
    iva: e.iva ?? 0,
    total: e.total ?? 0,
    retention: e.retention,
    currency: e.currency,
  }));
}

/** Líneas del snapshot vigente → PurchaseBookRow[]. */
function postedToPurchaseRows(posted: PostedBook): PurchaseBookRow[] {
  return posted.entries.map((e) => ({
    date: e.opDate ?? "—",
    documentNumber: e.documentNumber ?? "—",
    controlNumber: e.controlNumber,
    rif: e.rif,
    supplierName: e.partyName ?? "—",
    base: e.base,
    rate: e.rate,
    iva: e.iva,
    total: e.total ?? 0,
    retention: e.retention,
    currency: e.currency,
  }));
}

// ── Libro de Ventas ────────────────────────────────────────────
function SalesBookView({
  period,
  rows,
  settings,
  currencies,
  postedBook,
  canPost,
  onPeriod,
}: {
  period: FiscalPeriod;
  rows: SalesBookRow[];
  settings: FiscalSettings;
  currencies: string[];
  postedBook: PostedBook | null;
  canPost: boolean;
  onPeriod: (p: FiscalPeriod) => void;
}) {
  // Totales del VIVO (para detectar drift contra el snapshot).
  const liveTotals = useMemo(() => salesTotals(rows), [rows]);
  // Si está asentado, la tabla muestra el SNAPSHOT (no el vivo).
  const displayRows = useMemo(
    () => (postedBook ? postedToSalesRows(postedBook) : rows),
    [postedBook, rows],
  );
  const snapCurrencies = postedBook ? postedBook.currencies : currencies;
  const totals = useMemo(() => salesTotals(displayRows), [displayRows]);

  const exportCsv = () => {
    const headers = [
      "Fecha", "Factura", "Nº control", "RIF", "Cliente", "Condición",
      "Base imponible", "Alícuota %", "IVA débito", "Total", "Retención IVA",
    ];
    const data: CsvValue[][] = displayRows.map((r) => [
      r.date, r.invoiceCode, r.controlNumber ?? "—", r.rif ?? "—", r.clientName,
      ivaClassLabel(r.ivaClass), r.base, r.rate ?? "Exenta", r.iva, r.total, r.retention ?? "—",
    ]);
    downloadTextFile(`libro-ventas-${period}.csv`, rowsToCsv(headers, data));
  };

  return (
    <div>
      <BookToolbar period={period} onPeriod={onPeriod} onCsv={exportCsv} hasRows={displayRows.length > 0} />

      {(displayRows.length > 0 || canPost) && (
        <PostingBar
          period={period}
          bookType="ventas"
          posted={postedBook}
          canPost={canPost}
          liveRowCount={liveTotals.rows}
          liveBase={liveTotals.base}
          liveIva={liveTotals.iva}
        />
      )}

      {displayRows.length === 0 ? (
        <EmptyState
          eyebrow={`Libro de Ventas · ${periodLabel(period)}`}
          title="Sin facturas en este mes"
          description="No hay facturas emitidas en el período seleccionado. Cambia de mes o emite facturas en Facturación."
        />
      ) : (
        <>
          <CurrencyNote currencies={snapCurrencies} />
          <TotalsStrip totals={totals} label="IVA débito fiscal" />
          {totals.byRate.length > 0 && <RateBreakdown totals={totals} />}
          <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: "var(--r-md)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 920 }}>
              <thead>
                <tr>
                  <th style={thStyle}>Fecha</th>
                  <th style={thStyle}>Factura</th>
                  <th style={thStyle}>Nº control</th>
                  <th style={thStyle}>RIF</th>
                  <th style={thStyle}>Cliente</th>
                  <th style={thStyle}>Condición</th>
                  <th style={numTh}>Base</th>
                  <th style={numTh}>Alícuota</th>
                  <th style={numTh}>IVA</th>
                  <th style={numTh}>Total</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((r, i) => (
                  <tr key={`${r.invoiceCode}-${i}`}>
                    <td style={tdStyle}>{r.date}</td>
                    <td style={{ ...tdStyle, fontFamily: "var(--f-mono)" }}>{r.invoiceCode}</td>
                    <td style={tdStyle}>{r.controlNumber ?? "—"}</td>
                    <td style={{ ...tdStyle, fontFamily: "var(--f-mono)" }}>{r.rif ?? "—"}</td>
                    <td style={tdStyle}>{r.clientName}</td>
                    <td style={tdStyle}>{ivaClassLabel(r.ivaClass)}</td>
                    <td style={numTd}>{fmtMoney(r.base)}</td>
                    <td style={numTd}>{fmtRate(r.rate)}</td>
                    <td style={numTd}>{fmtMoney(r.iva)}</td>
                    <td style={numTd}>{fmtMoney(r.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td style={{ ...tdStyle, fontWeight: 800, borderTop: "1.5px solid var(--ink)" }} colSpan={6}>
                    Totales
                  </td>
                  <td style={{ ...numTd, fontWeight: 800, borderTop: "1.5px solid var(--ink)" }}>{fmtMoney(totals.base)}</td>
                  <td style={{ ...numTd, borderTop: "1.5px solid var(--ink)" }}>—</td>
                  <td style={{ ...numTd, fontWeight: 800, borderTop: "1.5px solid var(--ink)" }}>{fmtMoney(totals.iva)}</td>
                  <td style={{ ...numTd, fontWeight: 800, borderTop: "1.5px solid var(--ink)" }}>{fmtMoney(totals.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <FootNote>
            Operaciones clasificadas según el modo de IVA de cada factura
            (default del tenant: {invoiceIvaModeLabel(settings.default_invoice_iva_mode)}). El
            nº de control fiscal lo asigna el proveedor homologado (facturación digital,
            V2) → por ahora “—”. La columna de retención queda preparada para los
            comprobantes (V2).
          </FootNote>
          <PrintLayout
            title={`Libro de Ventas · ${periodLabel(period)}`}
            columns={["Fecha", "Factura", "RIF", "Cliente", "Condición", "Base", "Alícuota", "IVA", "Total"]}
            rows={displayRows.map((r) => [
              r.date, r.invoiceCode, r.rif ?? "—", r.clientName, ivaClassLabel(r.ivaClass),
              fmtMoney(r.base), fmtRate(r.rate), fmtMoney(r.iva), fmtMoney(r.total),
            ])}
            totalRow={["Totales", "", "", "", "", fmtMoney(totals.base), "", fmtMoney(totals.iva), fmtMoney(totals.total)]}
          />
        </>
      )}
    </div>
  );
}

// ── Libro de Compras ───────────────────────────────────────────
function PurchaseBookView({
  period,
  rows,
  settings,
  currencies,
  postedBook,
  canPost,
  onPeriod,
}: {
  period: FiscalPeriod;
  rows: PurchaseBookRow[];
  settings: FiscalSettings;
  currencies: string[];
  postedBook: PostedBook | null;
  canPost: boolean;
  onPeriod: (p: FiscalPeriod) => void;
}) {
  const liveTotals = useMemo(() => purchaseTotals(rows), [rows]);
  const displayRows = useMemo(
    () => (postedBook ? postedToPurchaseRows(postedBook) : rows),
    [postedBook, rows],
  );
  const snapCurrencies = postedBook ? postedBook.currencies : currencies;
  const totals = useMemo(() => purchaseTotals(displayRows), [displayRows]);
  const missingIva = totals.rows - totals.rowsWithData;

  const exportCsv = () => {
    const headers = [
      "Fecha", "Documento", "Nº control", "RIF", "Proveedor",
      "Base imponible", "Alícuota %", "IVA crédito", "Total", "Retención IVA",
    ];
    const data: CsvValue[][] = displayRows.map((r) => [
      r.date, r.documentNumber, r.controlNumber ?? "—", r.rif ?? "—", r.supplierName,
      r.base ?? "—", r.rate ?? "—", r.iva ?? "—", r.total, r.retention ?? "—",
    ]);
    downloadTextFile(`libro-compras-${period}.csv`, rowsToCsv(headers, data));
  };

  return (
    <div>
      <BookToolbar period={period} onPeriod={onPeriod} onCsv={exportCsv} hasRows={displayRows.length > 0} />

      {(displayRows.length > 0 || canPost) && (
        <PostingBar
          period={period}
          bookType="compras"
          posted={postedBook}
          canPost={canPost}
          liveRowCount={liveTotals.rows}
          liveBase={liveTotals.base}
          liveIva={liveTotals.iva}
        />
      )}

      {displayRows.length === 0 ? (
        <EmptyState
          eyebrow={`Libro de Compras · ${periodLabel(period)}`}
          title="Sin compras en este mes"
          description="No hay facturas de proveedor (CxP) en el período seleccionado. Cambia de mes o registra compras en Tesorería."
        />
      ) : (
        <>
          <CurrencyNote currencies={snapCurrencies} />
          <TotalsStrip totals={totals} label="IVA crédito fiscal" />
          <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: "var(--r-md)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 920 }}>
              <thead>
                <tr>
                  <th style={thStyle}>Fecha</th>
                  <th style={thStyle}>Documento</th>
                  <th style={thStyle}>Nº control</th>
                  <th style={thStyle}>RIF</th>
                  <th style={thStyle}>Proveedor</th>
                  <th style={numTh}>Base</th>
                  <th style={numTh}>Alícuota</th>
                  <th style={numTh}>IVA</th>
                  <th style={numTh}>Total</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((r, i) => (
                  <tr key={`${r.documentNumber}-${i}`}>
                    <td style={tdStyle}>{r.date}</td>
                    <td style={{ ...tdStyle, fontFamily: "var(--f-mono)" }}>{r.documentNumber}</td>
                    <td style={tdStyle}>{r.controlNumber ?? "—"}</td>
                    <td style={{ ...tdStyle, fontFamily: "var(--f-mono)" }}>{r.rif ?? "—"}</td>
                    <td style={tdStyle}>{r.supplierName}</td>
                    <td style={numTd}>{fmtMoneyOrDash(r.base)}</td>
                    <td style={numTd}>{r.rate == null ? "—" : `${r.rate.toFixed(2)}%`}</td>
                    <td style={numTd}>{fmtMoneyOrDash(r.iva)}</td>
                    <td style={numTd}>{fmtMoney(r.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td style={{ ...tdStyle, fontWeight: 800, borderTop: "1.5px solid var(--ink)" }} colSpan={5}>
                    Totales
                  </td>
                  <td style={{ ...numTd, fontWeight: 800, borderTop: "1.5px solid var(--ink)" }}>{fmtMoney(totals.base)}</td>
                  <td style={{ ...numTd, borderTop: "1.5px solid var(--ink)" }}>—</td>
                  <td style={{ ...numTd, fontWeight: 800, borderTop: "1.5px solid var(--ink)" }}>{fmtMoney(totals.iva)}</td>
                  <td style={{ ...numTd, fontWeight: 800, borderTop: "1.5px solid var(--ink)" }}>{fmtMoney(totals.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <FootNote>
            {settings.purchase_iva_mode === "derivado" ? (
              <>
                Las compras (CxP) hoy no discriminan el IVA — va al costo. Por eso la
                base y el IVA crédito se muestran “—” ({missingIva} de {totals.rows}{" "}
                {totals.rows === 1 ? "compra" : "compras"}); solo el total es real.
                Capturar el IVA por compra es un paso futuro (V2). Nada se inventa.
              </>
            ) : (
              <>
                Modo “capturado”: requiere un campo de IVA explícito por compra que
                aún no existe (V2) — por ahora la base y el IVA se muestran “—”.
              </>
            )}
          </FootNote>
          <PrintLayout
            title={`Libro de Compras · ${periodLabel(period)}`}
            columns={["Fecha", "Documento", "RIF", "Proveedor", "Base", "Alícuota", "IVA", "Total"]}
            rows={displayRows.map((r) => [
              r.date, r.documentNumber, r.rif ?? "—", r.supplierName,
              fmtMoneyOrDash(r.base), r.rate == null ? "—" : `${r.rate.toFixed(2)}%`,
              fmtMoneyOrDash(r.iva), fmtMoney(r.total),
            ])}
            totalRow={["Totales", "", "", "", fmtMoney(totals.base), "", fmtMoney(totals.iva), fmtMoney(totals.total)]}
            numFrom={4}
          />
        </>
      )}
    </div>
  );
}

// ── Desglose por alícuota ──────────────────────────────────────
function RateBreakdown({ totals }: { totals: BookTotals }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div className="studio-eyebrow" style={{ color: "var(--ink-soft)", marginBottom: 8 }}>
        Desglose por alícuota
      </div>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
        {totals.baseExenta > 0 && (
          <span style={{ font: "500 12.5px/1 var(--f-sans)", color: "var(--ink-soft)" }}>
            Exentas: <strong style={{ color: "var(--ink)", fontFamily: "var(--f-mono)" }}>{fmtMoney(totals.baseExenta)}</strong>
          </span>
        )}
        {totals.baseTasaCero > 0 && (
          <span style={{ font: "500 12.5px/1 var(--f-sans)", color: "var(--ink-soft)" }}>
            Tasa 0%: <strong style={{ color: "var(--ink)", fontFamily: "var(--f-mono)" }}>{fmtMoney(totals.baseTasaCero)}</strong>
          </span>
        )}
        {totals.byRate.map((b) => (
          <span key={b.rate} style={{ font: "500 12.5px/1 var(--f-sans)", color: "var(--ink-soft)" }}>
            {b.rate.toFixed(2)}%: base{" "}
            <strong style={{ color: "var(--ink)", fontFamily: "var(--f-mono)" }}>{fmtMoney(b.base)}</strong> · IVA{" "}
            <strong style={{ color: "var(--ink)", fontFamily: "var(--f-mono)" }}>{fmtMoney(b.iva)}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

function FootNote({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ font: "400 11.5px/1.5 var(--f-sans)", color: "var(--ink-mute)", margin: "14px 0 0", maxWidth: "82ch" }}>
      {children}
    </p>
  );
}

// ── Layout solo-impresión (window.print = "Guardar como PDF") ──
function PrintLayout({
  title,
  columns,
  rows,
  totalRow,
  numFrom = 5,
}: {
  title: string;
  columns: string[];
  rows: string[][];
  totalRow: string[];
  /** Índice de la primera columna numérica (alineada a la derecha en el PDF). */
  numFrom?: number;
}) {
  return (
    <div id="dtd-fiscal-print">
      <div className="fp-eyebrow">DTD Cargo · Libros de IVA</div>
      <div className="fp-title">{title}</div>
      <table className="fp-table">
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={c} className={i >= numFrom ? "fp-num" : ""}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>
              {r.map((cell, ci) => (
                <td key={ci} className={ci >= numFrom ? "fp-num" : ""}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            {totalRow.map((cell, ci) => (
              <td key={ci} className={ci >= numFrom ? "fp-num" : ""}>{cell}</td>
            ))}
          </tr>
        </tfoot>
      </table>
      <div className="fp-foot">Generado desde DTD Studio · datos reales del período. Columnas sin fuente: “—”.</div>
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
          #dtd-fiscal-print .fp-table tfoot td {
            font-weight: 800;
            border-top: 1.5px solid var(--ink);
          }
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
