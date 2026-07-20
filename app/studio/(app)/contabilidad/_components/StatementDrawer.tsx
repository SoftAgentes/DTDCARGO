"use client";

/**
 * StatementDrawer (SDD-0105) — "Cargar extracto" con editor de movimientos.
 *
 * Cabecera (cuenta banco/caja, período, saldo inicial/final, banco, ref) +
 * editor de movimientos (fecha, descripción, sentido, monto). Tira de saldos en
 * vivo (computeStatementBalance, la misma fn pura que el server). No crea
 * asientos: solo el extracto y sus movimientos.
 */

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  computeStatementBalance,
  type LineDirection,
  type StatementActionState,
} from "@/lib/studio/accounting/bank-statement-types";
import type { Account } from "@/lib/studio/account-types";
import { compareCodes } from "@/lib/studio/account-types";
import { createStatement } from "../reconcile-actions";
import { Icon } from "@/app/studio/_components/icons";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { NumericInput } from "@/app/studio/_components/ui/NumericInput";
import { fmtAmount } from "./format";

interface Props {
  bankAccounts: Account[];
  onClose: () => void;
}

const initialState: StatementActionState = {};

type DraftLine = {
  line_date: string;
  description: string;
  reference: string;
  direction: LineDirection;
  amount: string;
};

function emptyLine(): DraftLine {
  return {
    line_date: todayISO(),
    description: "",
    reference: "",
    direction: "credit",
    amount: "",
  };
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function thisMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function StatementDrawer({ bankAccounts, onClose }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [state, formAction, isPending] = useActionState(
    createStatement,
    initialState,
  );

  const [accountId, setAccountId] = useState("");
  const [periodLabel, setPeriodLabel] = useState(thisMonth());
  const [bankName, setBankName] = useState("");
  const [statementRef, setStatementRef] = useState("");
  const [opening, setOpening] = useState("");
  const [closing, setClosing] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);

  const sortedAccounts = bankAccounts
    .slice()
    .sort((a, b) => compareCodes(a.code, b.code));

  useEffect(() => {
    if (!state.ok) return;
    toast.success("Extracto cargado");
    router.refresh();
    onClose();
  }, [state.ok, router, toast, onClose]);

  const numericLines = lines.map((l) => ({
    line_date: l.line_date,
    description: l.description.trim(),
    reference: l.reference.trim() || null,
    direction: l.direction,
    amount: Number(l.amount) || 0,
  }));

  const balance = computeStatementBalance(
    Number(opening) || 0,
    Number(closing) || 0,
    numericLines,
  );

  const linesJson = JSON.stringify(
    numericLines.filter((l) => l.line_date && l.description && l.amount > 0),
  );

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (idx: number) =>
    setLines((prev) =>
      prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx),
    );
  const updateLine = (idx: number, patch: Partial<DraftLine>) =>
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  const filledLines = numericLines.filter(
    (l) => l.line_date && l.description && l.amount > 0,
  ).length;
  const canSubmit = Boolean(accountId) && periodLabel.length > 0 && filledLines >= 1;

  return (
    <div
      onClick={() => !isPending && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="statement-drawer-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--scrim)",
        zIndex: 100,
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(760px, 96vw)",
          height: "100vh",
          background: "var(--bg-surface)",
          borderLeft: "1px solid var(--border)",
          boxShadow: "var(--shadow-pop)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <header
          style={{
            padding: "18px 22px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexShrink: 0,
          }}
        >
          <h2
            id="statement-drawer-title"
            className="studio-display"
            style={{ fontSize: 18, margin: 0, color: "var(--ink)" }}
          >
            Cargar extracto
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            aria-label="Cerrar"
            style={{
              width: 32,
              height: 32,
              display: "grid",
              placeItems: "center",
              borderRadius: "var(--r-sm)",
              color: "var(--ink-soft)",
              background: "transparent",
              border: 0,
              cursor: isPending ? "wait" : "pointer",
              flexShrink: 0,
            }}
          >
            {Icon.close(14)}
          </button>
        </header>

        <form
          id="statement-drawer-form"
          action={formAction}
          style={{
            flex: 1,
            overflow: "auto",
            padding: "20px 22px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <input type="hidden" name="account_id" value={accountId} />
          <input type="hidden" name="period_label" value={periodLabel} />
          <input type="hidden" name="bank_name" value={bankName} />
          <input type="hidden" name="statement_ref" value={statementRef} />
          <input type="hidden" name="opening_balance" value={opening || "0"} />
          <input type="hidden" name="closing_balance" value={closing || "0"} />
          <input type="hidden" name="lines" value={linesJson} />

          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <div>
              <label className="studio-label" htmlFor="stmt-account">
                Cuenta banco / caja <span style={{ color: "var(--wine-text)" }}>*</span>
              </label>
              <select
                id="stmt-account"
                className="studio-input"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              >
                <option value="">— Elige la cuenta —</option>
                {sortedAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} · {a.name}
                  </option>
                ))}
              </select>
              {state.fieldErrors?.account_id && (
                <FieldError msg={state.fieldErrors.account_id} />
              )}
            </div>
            <div>
              <label className="studio-label" htmlFor="stmt-period">
                Período (YYYY-MM) <span style={{ color: "var(--wine-text)" }}>*</span>
              </label>
              <input
                id="stmt-period"
                type="month"
                className="studio-input"
                value={periodLabel}
                onChange={(e) => setPeriodLabel(e.target.value)}
              />
              {state.fieldErrors?.period_label && (
                <FieldError msg={state.fieldErrors.period_label} />
              )}
            </div>
          </div>

          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <div>
              <label className="studio-label" htmlFor="stmt-bank">
                Banco (display)
              </label>
              <input
                id="stmt-bank"
                type="text"
                className="studio-input"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="Banesco USD"
              />
            </div>
            <div>
              <label className="studio-label" htmlFor="stmt-ref">
                Nº de extracto / archivo
              </label>
              <input
                id="stmt-ref"
                type="text"
                className="studio-input"
                value={statementRef}
                onChange={(e) => setStatementRef(e.target.value)}
                placeholder="EXT-2026-05"
              />
            </div>
          </div>

          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <div>
              <label className="studio-label" htmlFor="stmt-opening">
                Saldo inicial
              </label>
              <NumericInput
                id="stmt-opening"
                type="currency"
                currency="USD"
                placeholder="0.00"
                value={opening === "" ? null : Number(opening)}
                onChange={(v) => setOpening(v != null ? String(v) : "")}
              />
            </div>
            <div>
              <label className="studio-label" htmlFor="stmt-closing">
                Saldo final
              </label>
              <NumericInput
                id="stmt-closing"
                type="currency"
                currency="USD"
                placeholder="0.00"
                value={closing === "" ? null : Number(closing)}
                onChange={(v) => setClosing(v != null ? String(v) : "")}
              />
            </div>
          </div>

          {/* Editor de movimientos */}
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <div className="studio-eyebrow">Movimientos</div>
              <button
                type="button"
                className="studio-btn studio-btn-ghost studio-btn-xs"
                onClick={addLine}
              >
                + Agregar movimiento
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {lines.map((l, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "130px 1fr 110px 120px 28px",
                    gap: 8,
                    alignItems: "start",
                  }}
                >
                  <input
                    type="date"
                    className="studio-input"
                    value={l.line_date}
                    onChange={(e) =>
                      updateLine(idx, { line_date: e.target.value })
                    }
                    aria-label={`Fecha movimiento ${idx + 1}`}
                  />
                  <input
                    type="text"
                    className="studio-input"
                    value={l.description}
                    onChange={(e) =>
                      updateLine(idx, { description: e.target.value })
                    }
                    placeholder="Descripción del movimiento"
                    aria-label={`Descripción movimiento ${idx + 1}`}
                  />
                  <select
                    className="studio-input"
                    value={l.direction}
                    onChange={(e) =>
                      updateLine(idx, {
                        direction: e.target.value as LineDirection,
                      })
                    }
                    aria-label={`Sentido movimiento ${idx + 1}`}
                  >
                    <option value="credit">Crédito</option>
                    <option value="debit">Débito</option>
                  </select>
                  <NumericInput
                    type="currency"
                    currency="USD"
                    min={0}
                    placeholder="0.00"
                    value={l.amount === "" ? null : Number(l.amount)}
                    onChange={(v) =>
                      updateLine(idx, { amount: v != null ? String(v) : "" })
                    }
                    aria-label={`Monto movimiento ${idx + 1}`}
                  />
                  <button
                    type="button"
                    onClick={() => removeLine(idx)}
                    disabled={lines.length <= 1}
                    aria-label={`Quitar movimiento ${idx + 1}`}
                    title="Quitar movimiento"
                    style={{
                      height: 38,
                      display: "grid",
                      placeItems: "center",
                      borderRadius: "var(--r-sm)",
                      border: "1px solid var(--border)",
                      background: "var(--bg-surface)",
                      color:
                        lines.length <= 1 ? "var(--ink-mute)" : "var(--danger)",
                      cursor: lines.length <= 1 ? "not-allowed" : "pointer",
                    }}
                  >
                    {Icon.trash(13)}
                  </button>
                </div>
              ))}
            </div>
            {state.fieldErrors?.lines && (
              <FieldError msg={state.fieldErrors.lines} />
            )}
          </div>

          {state.error && (
            <p
              role="alert"
              style={{
                font: "500 12px/1.4 var(--f-sans)",
                color: "var(--danger)",
                margin: 0,
                padding: "10px 12px",
                background: "var(--danger-bg)",
                border: "1px solid var(--danger)",
                borderRadius: "var(--r-sm)",
              }}
            >
              {state.error}
            </p>
          )}

          {/* Tira de saldos LIVE (navy) */}
          <div
            style={{
              padding: "var(--s-4) var(--s-5)",
              background: "var(--bg-sidebar)",
              color: "var(--ink-side)",
              borderRadius: "var(--r-lg)",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              marginTop: 4,
            }}
          >
            <SaldoRow label="Saldo inicial" value={Number(opening) || 0} />
            <SaldoRow label="+ Créditos" value={balance.totalCredit} color="var(--success)" />
            <SaldoRow label="− Débitos" value={balance.totalDebit} color="var(--wine-soft)" />
            <div style={{ height: 1, background: "var(--ink-inv-mute)" }} />
            <SaldoRow label="Saldo final esperado" value={balance.expectedClosing} />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  font: "600 10.5px/1 var(--f-sans)",
                  color: "var(--ink-inv-mute)",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                }}
              >
                {balance.balanced ? "Cuadra" : "Diferencia"}
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  font: "800 14px/1 var(--f-mono)",
                  color: balance.balanced
                    ? "var(--success)"
                    : "var(--warning)",
                }}
              >
                {balance.balanced ? (
                  <>
                    {Icon.check(13)}
                    OK
                  </>
                ) : (
                  `$${fmtAmount(Math.abs(balance.difference))}`
                )}
              </span>
            </div>
          </div>

          <div style={{ flex: 1, minHeight: 8 }} />
        </form>

        <footer
          style={{
            padding: "14px 22px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: 10,
            background: "var(--bg-surface)",
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            className="studio-btn studio-btn-ghost"
            onClick={onClose}
            disabled={isPending}
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="statement-drawer-form"
            className="studio-btn studio-btn-primary"
            disabled={isPending || !canSubmit}
            title={
              !canSubmit && !isPending
                ? "Elige la cuenta, el período y carga al menos un movimiento"
                : undefined
            }
          >
            {isPending ? "Guardando…" : "Cargar extracto"}
          </button>
        </footer>
      </aside>
    </div>
  );
}

function SaldoRow({
  label,
  value,
  color = "var(--ink-inv-soft)",
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        font: "500 13px/1 var(--f-sans)",
        color: "var(--ink-inv-soft)",
      }}
    >
      <span>{label}</span>
      <span style={{ font: "700 13px/1 var(--f-mono)", color }}>
        ${fmtAmount(value)}
      </span>
    </div>
  );
}

function FieldError({ msg }: { msg: string }) {
  return (
    <p
      style={{
        font: "500 11px/1.3 var(--f-sans)",
        color: "var(--danger)",
        margin: "var(--s-1) 0 0",
      }}
    >
      {msg}
    </p>
  );
}
