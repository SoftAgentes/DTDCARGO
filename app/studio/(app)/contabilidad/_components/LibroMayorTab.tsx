"use client";

/**
 * Tab "Libro mayor" (SDD-0040).
 *
 * Selector de cuenta (postable) → movimientos de asientos asentados con saldo
 * corrido. La cuenta seleccionada va por URL (?cuenta=) para que sea linkeable.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import {
  acctTypeLabel,
  compareCodes,
  normalSide,
  type Account,
} from "@/lib/studio/account-types";
import type { AccountBalanceMap } from "@/lib/studio/account-queries";
import type { AccountLedger } from "@/lib/studio/journal-queries";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { fmtAmount, fmtSigned } from "./format";

export function LibroMayorTab({
  accounts,
  balances,
  ledger,
  ledgerAccountId,
}: {
  accounts: Account[];
  balances: AccountBalanceMap;
  ledger: AccountLedger | null;
  ledgerAccountId: string | null;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const postable = accounts
    .filter((a) => a.is_postable)
    .sort((a, b) => compareCodes(a.code, b.code));

  const selectAccount = (id: string) => {
    const s = new URLSearchParams(params.toString());
    s.set("tab", "mayor");
    if (id) s.set("cuenta", id);
    else s.delete("cuenta");
    startTransition(() => {
      router.push(`/studio/contabilidad?${s.toString()}`);
    });
  };

  const GRID = "120px 130px 1.2fr 120px 120px 130px";

  return (
    <div>
      {/* Selector */}
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "flex-end",
          marginBottom: 18,
          flexWrap: "wrap",
          opacity: isPending ? 0.6 : 1,
          transition: "opacity 0.12s",
        }}
      >
        <div style={{ flex: "1 1 360px", minWidth: 280 }}>
          <label className="studio-label" htmlFor="mayor-account">
            Cuenta
          </label>
          <select
            id="mayor-account"
            className="studio-input"
            value={ledgerAccountId ?? ""}
            onChange={(e) => selectAccount(e.target.value)}
          >
            <option value="">— Elige una cuenta —</option>
            {postable.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} · {a.name}
              </option>
            ))}
          </select>
        </div>
        {ledger && (
          <div
            style={{
              display: "flex",
              gap: 18,
              padding: "8px 16px",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-md)",
            }}
          >
            <Stat label="Debe" value={`$${fmtAmount(ledger.totalDebit)}`} />
            <Stat label="Haber" value={`$${fmtAmount(ledger.totalCredit)}`} />
            <Stat
              label="Saldo"
              value={`$${fmtSigned(ledger.balance)}`}
              strong
            />
          </div>
        )}
      </div>

      {!ledgerAccountId || !ledger ? (
        <EmptyState
          eyebrow="Libro mayor"
          title="Elige una cuenta para ver sus movimientos."
          description="El mayor muestra los movimientos de asientos asentados con saldo corrido."
        />
      ) : ledger.movements.length === 0 ? (
        <EmptyState
          eyebrow={`${ledger.account.code} · ${acctTypeLabel(ledger.account.type)}`}
          title={`${ledger.account.name} no tiene movimientos.`}
          description={
            balances[ledger.account.id]?.balance
              ? "Esta cuenta tiene saldo por rollup de sus hijas, pero no recibe movimientos directos."
              : "Aún no se asentó nada contra esta cuenta."
          }
        />
      ) : (
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: GRID,
              gap: 12,
              padding: "12px 20px",
              background: "var(--bg-elevated)",
              borderBottom: "1px solid var(--border)",
              font: "700 10px/1 var(--f-sans)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--ink-soft)",
            }}
          >
            <span>Fecha</span>
            <span>Asiento</span>
            <span>Concepto</span>
            <span style={{ textAlign: "right" }}>Debe</span>
            <span style={{ textAlign: "right" }}>Haber</span>
            <span style={{ textAlign: "right" }}>Saldo</span>
          </div>

          {ledger.movements.map((m, i) => (
            <div
              key={`${m.entry_id}-${i}`}
              className="studio-tracking-row"
              style={{
                display: "grid",
                gridTemplateColumns: GRID,
                gap: 12,
                padding: "12px 20px",
                borderTop: i > 0 ? "1px solid var(--border)" : 0,
                alignItems: "center",
              }}
            >
              <span
                style={{
                  font: "500 11px/1 var(--f-mono)",
                  color: "var(--ink-soft)",
                }}
              >
                {m.entry_date}
              </span>
              <span
                style={{
                  font: "700 11.5px/1 var(--f-mono)",
                  color: "var(--wine)",
                }}
              >
                {m.entry_code}
              </span>
              <span
                style={{
                  font: "500 12px/1.3 var(--f-sans)",
                  color: "var(--ink)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {m.line_memo ?? m.memo ?? "—"}
              </span>
              <span
                style={{
                  font: "500 11.5px/1 var(--f-mono)",
                  color: m.debit > 0 ? "var(--ink)" : "var(--ink-mute)",
                  textAlign: "right",
                }}
              >
                {m.debit > 0 ? fmtAmount(m.debit) : "—"}
              </span>
              <span
                style={{
                  font: "500 11.5px/1 var(--f-mono)",
                  color: m.credit > 0 ? "var(--ink)" : "var(--ink-mute)",
                  textAlign: "right",
                }}
              >
                {m.credit > 0 ? fmtAmount(m.credit) : "—"}
              </span>
              <span
                style={{
                  font: "800 12px/1 var(--f-mono)",
                  color: "var(--ink)",
                  textAlign: "right",
                }}
              >
                {fmtSigned(m.running)}
              </span>
            </div>
          ))}
        </div>
      )}

      {ledger && ledger.movements.length > 0 && (
        <p
          style={{
            font: "500 11px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: "10px 2px 0",
          }}
        >
          Saldo {normalSide(ledger.account.type) === "debit" ? "deudor" : "acreedor"} (
          {acctTypeLabel(ledger.account.type)}).
        </p>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span
        style={{
          font: "600 9px/1 var(--f-sans)",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--ink-soft)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          font: `${strong ? "800" : "600"} 13px/1 var(--f-mono)`,
          color: strong ? "var(--wine)" : "var(--ink)",
        }}
      >
        {value}
      </span>
    </div>
  );
}
