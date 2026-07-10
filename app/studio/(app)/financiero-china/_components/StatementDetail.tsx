"use client";

/**
 * Detalle de un estado de cuenta en reconciliación (SDD-0059 · Slice B2).
 *
 * Espejo de erp/modules/conciliacion.jsx: balance strip + tabs por estado de
 * match (a revisar / conciliados / sin sugerencia / discrepancias / todo) +
 * filas de línea con el match sugerido (confianza alta/media/baja) + panel
 * detalle con búsqueda de match manual + acciones confirmar/rechazar/manual +
 * cerrar período.
 *
 * Resuelve cada línea vía decideMatchLine; cierra vía closePeriod (marca los
 * cargos reconciled). Sólo tokens var(--*) + primitivas del sistema.
 */

import { useMemo, useState, useTransition } from "react";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { Icon } from "@/app/studio/_components/icons";
import {
  matchConfidenceLabel,
  matchConfidenceTone,
  matchStatusLabel,
  matchStatusTone,
  type PartnerLedgerEntry,
  type PartnerStatementLine,
  type PartnerStatementWithLines,
  type SupplierChargeWithNet,
} from "@/lib/studio/partner-finance/types";
import {
  countLines,
  tabForMatchStatus,
  type ReconcileTab,
} from "@/lib/studio/partner-finance/reconciliation-view";
import { closePeriod, decideMatchLine, reconcileNow } from "../actions";

function fmtLine(amount: number, currency: string): string {
  const sym = currency === "RMB" ? "¥" : "$";
  return `${sym}${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

type MatchTab = ReconcileTab | "todo";

const TABS: { value: MatchTab; label: string }[] = [
  { value: "revisar", label: "A revisar" },
  { value: "conciliados", label: "Conciliados" },
  { value: "sin_sugerencia", label: "Sin sugerencia" },
  { value: "discrepancias", label: "Discrepancias" },
  { value: "todo", label: "Todo el estado" },
];

export function StatementDetail({
  statement,
  charges,
  ledgerEntries,
  supplierName,
  supplierId,
  onBack,
  onRefetch,
}: {
  statement: PartnerStatementWithLines;
  charges: SupplierChargeWithNet[];
  ledgerEntries: PartnerLedgerEntry[];
  supplierName: string;
  supplierId: string;
  onBack: () => void;
  onRefetch: () => void;
}) {
  const [tab, setTab] = useState<MatchTab>("revisar");
  const [detailLineId, setDetailLineId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const liveLines = useMemo(
    () => statement.lines.filter((l) => l.deleted_at == null),
    [statement.lines],
  );

  const counts = useMemo(() => {
    const c = countLines(liveLines);
    return { ...c, todo: liveLines.length };
  }, [liveLines]);

  const visible = useMemo(
    () =>
      tab === "todo"
        ? liveLines
        : liveLines.filter((l) => tabForMatchStatus(l.match_status) === tab),
    [liveLines, tab],
  );

  const closed = statement.status === "cerrado";
  const detailLine = detailLineId
    ? liveLines.find((l) => l.id === detailLineId) ?? null
    : null;

  const run = (
    fn: () => Promise<{ error?: string }>,
    successMsg: string,
  ) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.error) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success(successMsg);
      onRefetch();
    });
  };

  const onConfirm = (line: PartnerStatementLine) => {
    run(
      () =>
        decideMatchLine({
          lineId: line.id,
          match_status: "match_manual",
          matched_charge_id: line.matched_charge_id,
          matched_ledger_entry_id: line.matched_ledger_entry_id,
          match_confidence: line.match_confidence,
        }),
      "Línea confirmada",
    );
  };

  const onReject = (line: PartnerStatementLine) => {
    run(
      () =>
        decideMatchLine({
          lineId: line.id,
          match_status: "solo_en_estado",
          matched_charge_id: null,
          matched_ledger_entry_id: null,
          match_confidence: null,
        }),
      "Match rechazado",
    );
  };

  const onManualCharge = (line: PartnerStatementLine, chargeId: string) => {
    run(
      () =>
        decideMatchLine({
          lineId: line.id,
          match_status: "match_manual",
          matched_charge_id: chargeId,
          matched_ledger_entry_id: null,
          match_confidence: null,
        }),
      "Match manual aplicado",
    );
    setDetailLineId(null);
  };

  const onManualEntry = (line: PartnerStatementLine, entryId: string) => {
    run(
      () =>
        decideMatchLine({
          lineId: line.id,
          match_status: "match_manual",
          matched_charge_id: null,
          matched_ledger_entry_id: entryId,
          match_confidence: null,
        }),
      "Match manual aplicado",
    );
    setDetailLineId(null);
  };

  const onClose = () => {
    run(() => closePeriod(statement.id), "Período cerrado");
  };

  const onRerun = () => {
    run(() => reconcileNow(statement.id, supplierId), "Match recalculado");
  };

  const totalUsd = liveLines
    .filter((l) => l.currency !== "RMB")
    .reduce((s, l) => s + l.amount, 0);
  const totalRmb = liveLines
    .filter((l) => l.currency === "RMB")
    .reduce((s, l) => s + l.amount, 0);
  const pct = counts.pct;

  return (
    <div>
      {/* Header / back */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <button
            type="button"
            className="studio-btn studio-btn-ghost studio-btn-sm"
            onClick={onBack}
            style={{ marginBottom: 10 }}
          >
            {Icon.arrowL(13)} Volver a la cola
          </button>
          <h2
            className="studio-display"
            style={{ fontSize: 22, margin: "0 0 var(--s-1)", color: "var(--ink)" }}
          >
            {statement.period_label}
          </h2>
          <p
            style={{
              font: "500 12px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: 0,
            }}
          >
            {supplierName} · {liveLines.length} líneas · importado{" "}
            {statement.imported_at.slice(0, 10)} ·{" "}
            <Badge tone={closed ? "success" : "warning"} size="sm">
              {closed ? "Cerrado" : "Reconciliando"}
            </Badge>
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {!closed && (
            <button
              type="button"
              className="studio-btn studio-btn-ghost studio-btn-sm"
              onClick={onRerun}
              disabled={pending}
            >
              {Icon.refresh(13)} Re-correr match
            </button>
          )}
          {!closed && (
            <button
              type="button"
              className="studio-btn studio-btn-dark studio-btn-sm"
              onClick={onClose}
              disabled={pending || !counts.canClose}
              title={
                !counts.canClose
                  ? "Resuelve las líneas a revisar antes de cerrar"
                  : "Cerrar el período y marcar los cargos como reconciliados"
              }
            >
              Cerrar período
            </button>
          )}
        </div>
      </div>

      {/* Balance strip (sobre navy) */}
      <div
        style={{
          background: "var(--bg-sidebar)",
          borderRadius: "var(--r-lg)",
          padding: "16px 22px",
          marginBottom: 16,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 20,
          alignItems: "center",
        }}
      >
        {[
          { label: "Total estado · USD", v: fmtLine(totalUsd, "USD"), c: "var(--ink-inv)" },
          { label: "Total estado · RMB", v: fmtLine(totalRmb, "RMB"), c: "var(--ink-inv)" },
          {
            label: "Conciliado",
            v: `${pct}%`,
            c: pct === 100 ? "var(--success)" : "var(--wine-soft)",
          },
          {
            label: "A revisar",
            v: String(counts.revisar),
            c: counts.revisar > 0 ? "var(--warning)" : "var(--success)",
          },
        ].map((b) => (
          <div key={b.label}>
            <div
              style={{
                font: "700 10px/1 var(--f-sans)",
                color: "var(--ink-inv-mute)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              {b.label}
            </div>
            <div
              style={{
                font: "900 18px/1 var(--f-display)",
                color: b.c,
                letterSpacing: "-0.01em",
              }}
            >
              {b.v}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: "var(--r-md)",
            background: "var(--danger-bg)",
            color: "var(--danger)",
            font: "600 12px/1.4 var(--f-sans)",
            marginBottom: 14,
          }}
        >
          {error}
        </div>
      )}

      {/* Tabs por estado de match */}
      <div
        role="tablist"
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 14,
          flexWrap: "wrap",
        }}
      >
        {TABS.map((tEntry) => {
          const active = tab === tEntry.value;
          const count = counts[tEntry.value];
          return (
            <button
              key={tEntry.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setTab(tEntry.value);
                setDetailLineId(null);
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "7px 12px",
                borderRadius: "var(--r-sm)",
                background: active ? "var(--wine-tint)" : "transparent",
                color: active ? "var(--wine)" : "var(--ink-soft)",
                border: "none",
                font: "700 12px/1 var(--f-sans)",
                cursor: "pointer",
              }}
            >
              {tEntry.label}
              <span
                style={{
                  font: "800 10px/1 var(--f-mono)",
                  color: active ? "var(--wine)" : "var(--ink-mute)",
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: detailLine ? "1fr 380px" : "1fr",
          gap: 16,
          alignItems: "start",
        }}
      >
        <div>
          {visible.length === 0 ? (
            <div
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-lg)",
                padding: "28px 20px",
                textAlign: "center",
                font: "500 13px/1.5 var(--f-sans)",
                color: "var(--ink-soft)",
              }}
            >
              {tab === "revisar"
                ? "No quedan líneas por revisar en este estado."
                : "Ninguna línea en esta vista."}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {visible.map((line) => (
                <LineRow
                  key={line.id}
                  line={line}
                  charges={charges}
                  ledgerEntries={ledgerEntries}
                  active={detailLineId === line.id}
                  closed={closed}
                  pending={pending}
                  onOpen={() =>
                    setDetailLineId(line.id === detailLineId ? null : line.id)
                  }
                  onConfirm={() => onConfirm(line)}
                  onReject={() => onReject(line)}
                />
              ))}
            </div>
          )}
        </div>

        {detailLine && (
          <LineDetailPanel
            line={detailLine}
            charges={charges}
            ledgerEntries={ledgerEntries}
            closed={closed}
            pending={pending}
            onClose={() => setDetailLineId(null)}
            onConfirm={() => onConfirm(detailLine)}
            onReject={() => onReject(detailLine)}
            onPickCharge={(id) => onManualCharge(detailLine, id)}
            onPickEntry={(id) => onManualEntry(detailLine, id)}
          />
        )}
      </div>
    </div>
  );
}

// ── Una fila de línea del estado ─────────────────────────────────
function LineRow({
  line,
  charges,
  ledgerEntries,
  active,
  closed,
  pending,
  onOpen,
  onConfirm,
  onReject,
}: {
  line: PartnerStatementLine;
  charges: SupplierChargeWithNet[];
  ledgerEntries: PartnerLedgerEntry[];
  active: boolean;
  closed: boolean;
  pending: boolean;
  onOpen: () => void;
  onConfirm: () => void;
  onReject: () => void;
}) {
  const suggestedCharge = line.matched_charge_id
    ? charges.find((c) => c.id === line.matched_charge_id) ?? null
    : null;
  const suggestedEntry = line.matched_ledger_entry_id
    ? ledgerEntries.find((e) => e.id === line.matched_ledger_entry_id) ?? null
    : null;
  const hasSuggestion = !!(suggestedCharge || suggestedEntry);
  const isAuto = line.match_status === "match_auto";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="studio-tracking-row"
      style={{
        background: active ? "var(--wine-tint)" : "var(--bg-surface)",
        border: `1px solid ${active ? "var(--wine)" : "var(--border)"}`,
        borderRadius: "var(--r-lg)",
        padding: "14px 18px",
        cursor: "pointer",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "84px 1.4fr 1.3fr 120px 150px",
          gap: 14,
          alignItems: "center",
        }}
      >
        <div>
          <div style={{ font: "700 11px/1 var(--f-mono)", color: "var(--ink-soft)" }}>
            {line.line_date?.slice(5) ?? "—"}
          </div>
          <Badge tone={matchStatusTone(line.match_status)} size="sm" style={{ marginTop: 6 }}>
            {matchStatusLabel(line.match_status)}
          </Badge>
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{ font: "600 12.5px/1.3 var(--f-sans)", color: "var(--ink)" }}>
            {line.raw_description}
          </div>
          {line.raw_description_cn && (
            <div
              style={{
                font: "500 11px/1.2 var(--f-cn)",
                color: "var(--ink-soft)",
                marginTop: 3,
              }}
            >
              {line.raw_description_cn}
            </div>
          )}
        </div>

        <div>
          {hasSuggestion && line.match_confidence ? (
            <div
              style={{
                padding: "8px 10px",
                background: `var(--${matchConfidenceTone(line.match_confidence)}-bg)`,
                borderLeft: `3px solid var(--${matchConfidenceTone(line.match_confidence)})`,
                borderRadius: "var(--r-sm)",
              }}
            >
              <div
                style={{
                  font: "700 9.5px/1 var(--f-sans)",
                  color: `var(--${matchConfidenceTone(line.match_confidence)})`,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  marginBottom: 4,
                }}
              >
                Confianza {matchConfidenceLabel(line.match_confidence)}
              </div>
              <div style={{ font: "600 11.5px/1.3 var(--f-sans)", color: "var(--ink)" }}>
                {suggestedCharge
                  ? suggestedCharge.description
                  : suggestedEntry?.description ?? suggestedEntry?.entry_code}
              </div>
            </div>
          ) : (
            <span
              style={{
                font: "500 11.5px/1.4 var(--f-sans)",
                color: "var(--ink-soft)",
                fontStyle: "italic",
              }}
            >
              Sin sugerencia · matchear manual
            </span>
          )}
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ font: "900 16px/1 var(--f-display)", color: "var(--ink)" }}>
            {fmtLine(line.amount, line.currency)}
          </div>
          <div
            style={{
              font: "600 10px/1 var(--f-sans)",
              color: "var(--ink-soft)",
              letterSpacing: "0.1em",
              marginTop: 4,
            }}
          >
            {line.currency}
          </div>
        </div>

        <div
          style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}
          onClick={(e) => e.stopPropagation()}
        >
          {!closed && isAuto && hasSuggestion && (
            <button
              type="button"
              className="studio-btn studio-btn-primary studio-btn-xs"
              onClick={onConfirm}
              disabled={pending}
            >
              Confirmar
            </button>
          )}
          {!closed && line.match_status !== "match_manual" && (
            <button
              type="button"
              className="studio-btn studio-btn-ghost studio-btn-xs"
              onClick={onOpen}
              disabled={pending}
            >
              Match manual
            </button>
          )}
          {!closed && hasSuggestion && line.match_status !== "solo_en_estado" && (
            <button
              type="button"
              className="studio-btn studio-btn-ghost studio-btn-xs"
              onClick={onReject}
              disabled={pending}
              style={{ color: "var(--danger)" }}
            >
              Rechazar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Panel detalle · búsqueda de match manual ─────────────────────
function LineDetailPanel({
  line,
  charges,
  ledgerEntries,
  closed,
  pending,
  onClose,
  onConfirm,
  onReject,
  onPickCharge,
  onPickEntry,
}: {
  line: PartnerStatementLine;
  charges: SupplierChargeWithNet[];
  ledgerEntries: PartnerLedgerEntry[];
  closed: boolean;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onReject: () => void;
  onPickCharge: (id: string) => void;
  onPickEntry: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();

  const chargeCandidates = charges
    .filter((c) => c.status !== "cancelado")
    .filter(
      (c) =>
        !q ||
        c.description.toLowerCase().includes(q) ||
        (c.description_cn ?? "").toLowerCase().includes(q),
    )
    .slice(0, 6);

  const entryCandidates = ledgerEntries
    .filter(
      (e) =>
        !q ||
        (e.description ?? "").toLowerCase().includes(q) ||
        (e.description_cn ?? "").toLowerCase().includes(q) ||
        e.entry_code.toLowerCase().includes(q),
    )
    .slice(0, 6);

  const hasSuggestion = !!(line.matched_charge_id || line.matched_ledger_entry_id);

  return (
    <aside
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        position: "sticky",
        top: 16,
        maxHeight: "calc(100vh - 120px)",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header
        style={{
          padding: "16px 18px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div>
          <div className="studio-eyebrow">Línea del estado</div>
          <div
            style={{
              font: "900 16px/1 var(--f-display)",
              color: "var(--ink)",
              marginTop: 6,
            }}
          >
            {fmtLine(line.amount, line.currency)} · {line.currency}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar panel"
          style={{
            width: 28,
            height: 28,
            borderRadius: "var(--r-sm)",
            color: "var(--ink-soft)",
            background: "transparent",
            border: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          {Icon.close(14)}
        </button>
      </header>

      <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <div className="studio-eyebrow" style={{ marginBottom: 6 }}>
            Descripción del socio
          </div>
          <div
            style={{
              padding: "10px 12px",
              background: "var(--bg-elevated)",
              borderRadius: "var(--r-md)",
              font: "500 12.5px/1.4 var(--f-sans)",
              color: "var(--ink)",
            }}
          >
            {line.raw_description}
            {line.raw_description_cn && (
              <div style={{ font: "500 11px/1.3 var(--f-cn)", color: "var(--ink-soft)", marginTop: 4 }}>
                {line.raw_description_cn}
              </div>
            )}
          </div>
        </div>

        {!closed && (
          <>
            <div>
              <div className="studio-eyebrow" style={{ marginBottom: 8 }}>
                Buscar match manual
              </div>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cargo o movimiento por descripción / código…"
                className="studio-input"
                style={{ marginBottom: 10 }}
              />

              {chargeCandidates.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div
                    style={{
                      font: "700 9.5px/1 var(--f-sans)",
                      color: "var(--ink-soft)",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      marginBottom: 6,
                    }}
                  >
                    Cargos
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {chargeCandidates.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => onPickCharge(c.id)}
                        disabled={pending}
                        style={candidateBtnStyle()}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              font: "600 11.5px/1.2 var(--f-sans)",
                              color: "var(--ink)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {c.description}
                          </div>
                          <div style={{ font: "500 10px/1 var(--f-mono)", color: "var(--ink-soft)", marginTop: 3 }}>
                            {fmtLine(c.net_amount, c.currency)} · {c.status}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {entryCandidates.length > 0 && (
                <div>
                  <div
                    style={{
                      font: "700 9.5px/1 var(--f-sans)",
                      color: "var(--ink-soft)",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      marginBottom: 6,
                    }}
                  >
                    Libro mayor
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {entryCandidates.map((e) => (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => onPickEntry(e.id)}
                        disabled={pending}
                        style={candidateBtnStyle()}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <code style={{ font: "700 10.5px/1 var(--f-mono)", color: "var(--wine)" }}>
                            {e.entry_code}
                          </code>
                          <div
                            style={{
                              font: "600 11px/1.2 var(--f-sans)",
                              color: "var(--ink)",
                              marginTop: 3,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {e.description ?? "—"}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {chargeCandidates.length === 0 && entryCandidates.length === 0 && (
                <div
                  style={{
                    font: "500 12px/1.4 var(--f-sans)",
                    color: "var(--ink-soft)",
                    textAlign: "center",
                    padding: "10px 0",
                  }}
                >
                  Sin candidatos.
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {!closed && (
        <footer
          style={{
            padding: "14px 18px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            background: "var(--bg-base)",
          }}
        >
          {hasSuggestion && line.match_status === "match_auto" && (
            <button
              type="button"
              className="studio-btn studio-btn-primary studio-btn-sm"
              onClick={onConfirm}
              disabled={pending}
            >
              {Icon.check(13)} Confirmar sugerencia
            </button>
          )}
          {hasSuggestion && line.match_status !== "solo_en_estado" && (
            <button
              type="button"
              className="studio-btn studio-btn-ghost studio-btn-sm"
              onClick={onReject}
              disabled={pending}
              style={{ color: "var(--danger)" }}
            >
              Rechazar match
            </button>
          )}
        </footer>
      )}
    </aside>
  );
}

function candidateBtnStyle(): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 10px",
    borderRadius: "var(--r-md)",
    background: "var(--bg-elevated)",
    textAlign: "left",
    border: "1px solid transparent",
    cursor: "pointer",
    width: "100%",
  };
}
