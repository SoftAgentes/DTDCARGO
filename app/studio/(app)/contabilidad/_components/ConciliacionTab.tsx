"use client";

/**
 * Tab "Conciliación" (SDD-0105).
 *
 * Lista de extractos bancarios. Al abrir uno: tira de saldos (display), KPIs y
 * sus movimientos con su estado de conciliación. Cada movimiento se liga a un
 * asiento EXISTENTE (LineMatchDrawer) o se marca manual / ignorado. Conciliar
 * NO crea ni muta asientos del mayor (solo el vínculo).
 */

import { useState } from "react";
import {
  computeStatementBalance,
  computeStatementKpis,
  lineDirectionLabel,
  lineStatusBadgeTone,
  lineStatusLabel,
  statementStatusBadgeTone,
  statementStatusLabel,
  type BankStatement,
  type BankStatementLine,
} from "@/lib/studio/accounting/bank-statement-types";
import type { Account } from "@/lib/studio/account-types";
import {
  suggestMatch,
  type EntryCandidate,
} from "@/lib/studio/accounting/bank-statement-queries";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { KpiCard } from "@/app/studio/_components/ui/KpiCard";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { fmtAmount } from "./format";
import { StatementDrawer } from "./StatementDrawer";
import { LineMatchDrawer } from "./LineMatchDrawer";
import { setLineStatus } from "../reconcile-actions";

export function ConciliacionTab({
  statements,
  activeStatement,
  bankAccounts,
  candidates,
  showCreate,
  onCloseCreate,
}: {
  statements: BankStatement[];
  activeStatement: BankStatement | null;
  bankAccounts: Account[];
  candidates: EntryCandidate[];
  showCreate: boolean;
  onCloseCreate: () => void;
}) {
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [matchLine, setMatchLine] = useState<BankStatementLine | null>(null);

  const noAccounts = bankAccounts.length === 0;

  if (statements.length === 0) {
    return (
      <>
        <EmptyState
          eyebrow="Sin extractos"
          title="Aún no hay extractos cargados."
          description={
            noAccounts
              ? "Primero necesitas una cuenta de banco / caja postable en el plan de cuentas (1.1.1.x)."
              : "Carga el extracto del banco con sus movimientos y crúzalos contra el libro diario. Conciliar solo liga cada movimiento a su asiento; no crea asientos."
          }
        />
        {showCreate && (
          <StatementDrawer bankAccounts={bankAccounts} onClose={onCloseCreate} />
        )}
      </>
    );
  }

  return (
    <>
      {error && <ErrorBanner msg={error} />}

      {/* Listado de extractos */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          marginBottom: activeStatement ? 24 : 0,
        }}
      >
        <div className="studio-eyebrow">Extractos</div>
        {statements.map((s) => {
          const active = activeStatement?.id === s.id;
          return (
            <a
              key={s.id}
              href={
                active
                  ? "/studio/contabilidad?tab=conciliacion"
                  : `/studio/contabilidad?tab=conciliacion&extracto=${s.id}`
              }
              style={{
                display: "grid",
                gridTemplateColumns: "120px 1fr 160px 120px",
                gap: 14,
                alignItems: "center",
                padding: "13px 18px",
                background: active ? "var(--wine-tint)" : "var(--bg-surface)",
                border: `1px solid ${active ? "var(--wine)" : "var(--border)"}`,
                borderRadius: "var(--r-lg)",
                textDecoration: "none",
              }}
            >
              <span
                style={{
                  font: "700 12px/1 var(--f-mono)",
                  color: "var(--ink)",
                  letterSpacing: "0.02em",
                }}
              >
                {s.period_label}
              </span>
              <span
                style={{
                  font: "600 12.5px/1.3 var(--f-sans)",
                  color: "var(--ink)",
                }}
              >
                {s.bank_name ?? s.account_name ?? "Extracto"}
                <span
                  style={{
                    font: "500 11px/1 var(--f-mono)",
                    color: "var(--ink-soft)",
                    marginLeft: 8,
                  }}
                >
                  {s.account_code}
                </span>
              </span>
              <span
                style={{
                  font: "700 13px/1 var(--f-mono)",
                  color: "var(--ink)",
                  textAlign: "right",
                }}
              >
                ${fmtAmount(s.closing_balance)}
              </span>
              <span style={{ textAlign: "right" }}>
                <Badge tone={statementStatusBadgeTone(s.status)} size="sm" dot>
                  {statementStatusLabel(s.status)}
                </Badge>
              </span>
            </a>
          );
        })}
      </div>

      {activeStatement && (
        <StatementDetail
          statement={activeStatement}
          candidates={candidates}
          onMatch={(line) => setMatchLine(line)}
          onSetStatus={async (lineId, status, label) => {
            setError(null);
            const r = await setLineStatus(lineId, status);
            if (r.error) setError(r.error);
            else toast.info(`Movimiento marcado como ${label}`);
          }}
        />
      )}

      {showCreate && (
        <StatementDrawer bankAccounts={bankAccounts} onClose={onCloseCreate} />
      )}
      {matchLine && activeStatement && (
        <LineMatchDrawer
          line={matchLine}
          candidates={candidates}
          onClose={() => setMatchLine(null)}
        />
      )}
    </>
  );
}

function StatementDetail({
  statement,
  candidates,
  onMatch,
  onSetStatus,
}: {
  statement: BankStatement;
  candidates: EntryCandidate[];
  onMatch: (line: BankStatementLine) => void;
  onSetStatus: (
    lineId: string,
    status: "manual" | "ignored" | "pending",
    label: string,
  ) => Promise<void>;
}) {
  const lines = statement.lines ?? [];
  const balance = computeStatementBalance(
    statement.opening_balance,
    statement.closing_balance,
    lines,
  );
  const kpis = computeStatementKpis(lines);

  return (
    <div>
      {/* KPIs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 14,
          marginBottom: 16,
        }}
      >
        <KpiCard value={kpis.imported} label="Movimientos importados" />
        <KpiCard
          value={kpis.reconciled}
          label="Conciliados"
          sub={`${kpis.reconciledPct}% del extracto`}
          valueColor="var(--success)"
        />
        <KpiCard
          value={kpis.pending}
          label="Pendientes"
          valueColor={kpis.pending > 0 ? "var(--warning)" : "var(--ink)"}
          sub={kpis.pending > 0 ? "requieren acción" : "todos al día"}
        />
        <KpiCard
          value={
            balance.balanced
              ? "OK"
              : `$${fmtAmount(Math.abs(balance.difference))}`
          }
          label="Tira de saldos"
          valueColor={balance.balanced ? "var(--success)" : "var(--warning)"}
          sub={balance.balanced ? "cuadra" : "revisa el extracto"}
          highlightWhenPositive={false}
        />
      </div>

      {/* Tira de saldos (navy) */}
      <div
        style={{
          padding: "16px 22px",
          background: "var(--bg-sidebar)",
          color: "var(--ink-side)",
          borderRadius: "var(--r-lg)",
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 18,
          marginBottom: 18,
        }}
      >
        <BalanceCell label="Saldo inicial" value={statement.opening_balance} />
        <BalanceCell
          label="Créditos"
          value={balance.totalCredit}
          sign="+"
          color="var(--success)"
        />
        <BalanceCell
          label="Débitos"
          value={balance.totalDebit}
          sign="−"
          color="var(--wine-soft)"
        />
        <BalanceCell label="Saldo final" value={statement.closing_balance} />
        <BalanceCell
          label="Diferencia"
          value={balance.difference}
          color={balance.balanced ? "var(--success)" : "var(--warning)"}
        />
      </div>

      {/* Movimientos */}
      {lines.length === 0 ? (
        <EmptyState title="Este extracto no tiene movimientos." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {lines.map((line) => (
            <MovementRow
              key={line.id}
              line={line}
              suggestion={suggestMatch({ amount: line.amount }, candidates)}
              onMatch={() => onMatch(line)}
              onSetStatus={onSetStatus}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MovementRow({
  line,
  suggestion,
  onMatch,
  onSetStatus,
}: {
  line: BankStatementLine;
  suggestion: (EntryCandidate & { confidence: string }) | null;
  onMatch: () => void;
  onSetStatus: (
    lineId: string,
    status: "manual" | "ignored" | "pending",
    label: string,
  ) => Promise<void>;
}) {
  const isCredit = line.direction === "credit";
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "100px 1fr 160px 140px 180px",
        gap: 14,
        alignItems: "center",
        padding: "13px 18px",
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
      }}
    >
      <div>
        <div
          style={{ font: "700 11.5px/1 var(--f-mono)", color: "var(--ink-soft)" }}
        >
          {line.line_date.slice(5)}
        </div>
        {line.reference && (
          <code
            style={{
              font: "500 10px/1 var(--f-mono)",
              color: "var(--ink-soft)",
              marginTop: 4,
              display: "inline-block",
            }}
          >
            {line.reference}
          </code>
        )}
      </div>

      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 4,
          }}
        >
          <Badge tone={isCredit ? "success" : "wine"} size="sm" dot>
            {lineDirectionLabel(line.direction)}
          </Badge>
        </div>
        <div style={{ font: "600 12.5px/1.3 var(--f-sans)", color: "var(--ink)" }}>
          {line.description}
        </div>
      </div>

      {/* Sugerencia / asiento ligado */}
      <div>
        {line.status === "matched" && line.matched_entry_code ? (
          <code
            style={{ font: "700 11px/1 var(--f-mono)", color: "var(--success)" }}
          >
            → {line.matched_entry_code}
          </code>
        ) : suggestion && line.status === "pending" ? (
          <span
            style={{ font: "500 11px/1.3 var(--f-sans)", color: "var(--ink-soft)" }}
          >
            Sugerido:{" "}
            <code style={{ color: "var(--wine-text)" }}>{suggestion.entry_code}</code>
          </span>
        ) : (
          <span
            style={{
              font: "500 11px/1.3 var(--f-sans)",
              color: "var(--ink-soft)",
              fontStyle: "italic",
            }}
          >
            Sin sugerencia
          </span>
        )}
      </div>

      {/* Monto */}
      <div style={{ textAlign: "right" }}>
        <div
          style={{
            font: "800 15px/1 var(--f-mono)",
            color: isCredit ? "var(--success)" : "var(--ink)",
          }}
        >
          {isCredit ? "+" : "−"}${fmtAmount(line.amount)}
        </div>
      </div>

      {/* Acciones / estado */}
      <div
        style={{
          display: "flex",
          gap: 6,
          justifyContent: "flex-end",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        {line.status === "pending" && (
          <>
            <button
              type="button"
              className="studio-btn studio-btn-primary studio-btn-xs"
              onClick={onMatch}
            >
              Ligar
            </button>
            <button
              type="button"
              className="studio-btn studio-btn-ghost studio-btn-xs"
              onClick={() => onSetStatus(line.id, "ignored", "ignorado")}
            >
              Ignorar
            </button>
          </>
        )}
        {line.status !== "pending" && (
          <>
            <Badge tone={lineStatusBadgeTone(line.status)} size="sm" dot>
              {lineStatusLabel(line.status)}
            </Badge>
            <ActionButton
              variant="ghost"
              size="xs"
              idleLabel="Revertir"
              successLabel={null}
              onAction={() => onSetStatus(line.id, "pending", "pendiente")}
            />
          </>
        )}
      </div>
    </div>
  );
}

function BalanceCell({
  label,
  value,
  sign,
  color = "var(--ink-side-strong)",
}: {
  label: string;
  value: number;
  sign?: string;
  color?: string;
}) {
  return (
    <div>
      <div
        style={{
          font: "700 10px/1 var(--f-sans)",
          color: "var(--ink-side-soft)",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div style={{ font: "900 18px/1 var(--f-mono)", color }}>
        {sign ?? ""}${fmtAmount(Math.abs(value))}
      </div>
    </div>
  );
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <p
      role="alert"
      style={{
        font: "500 12px/1.4 var(--f-sans)",
        color: "var(--danger)",
        margin: "0 0 12px",
        padding: "10px 12px",
        background: "var(--danger-bg)",
        border: "1px solid var(--danger)",
        borderRadius: "var(--r-sm)",
      }}
    >
      {msg}
    </p>
  );
}
