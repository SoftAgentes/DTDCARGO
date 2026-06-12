"use client";

/**
 * Cuenta corriente del Socio China (SDD-0059 · Slice B2).
 *
 * Selector de socio + KPIs de saldo neto (USD + RMB) + tabla de movimientos
 * del libro mayor con saldo corriente (debit/credit/runBalance), espejo de
 * pantallas/estado-cuenta.jsx (MovementsTable). + drawer para asentar un
 * movimiento manual (libro mayor bilateral).
 *
 * El saldo neto y el runBalance se derivan en lib (computePartnerBalance) y
 * acá (forward). Convención de saldo: positivo = le debemos al socio.
 */

import { useMemo, useState } from "react";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { KpiCard } from "@/app/studio/_components/ui/KpiCard";
import { Badge } from "@/app/studio/_components/ui/Badge";
import {
  ledgerEntryTypeLabel,
  type PartnerBalance,
  type PartnerLedgerEntry,
} from "@/lib/studio/partner-finance/types";
import type { SupplierOption } from "./FinancieroChinaClient";
import { SupplierPicker } from "./SupplierPicker";

function fmtUsd(n: number): string {
  if (n === 0) return "—";
  const sign = n < 0 ? "−" : "";
  return `${sign}$${Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
function fmtRmb(n: number): string {
  if (n === 0) return "—";
  const sign = n < 0 ? "−" : "";
  return `${sign}¥${Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const GRID = "92px 150px 1fr 110px 110px 130px";

export function LedgerTab({
  suppliers,
  selectedSupplier,
  supplierId,
  onSupplierChange,
  balance,
  ledgerEntries,
  loading,
  loadError,
}: {
  suppliers: SupplierOption[];
  selectedSupplier: SupplierOption | null;
  supplierId: string | null;
  onSupplierChange: (id: string) => void;
  balance: PartnerBalance;
  ledgerEntries: PartnerLedgerEntry[];
  loading: boolean;
  loadError: string | null;
}) {
  const [currencyView, setCurrencyView] = useState<"usd" | "rmb">("usd");

  // Movimientos vivos ordenados ascendente para computar el saldo corriente
  // (forward en el tiempo), luego se muestran descendente. Espejo de
  // estado-cuenta.jsx → MovementsTable.
  const rows = useMemo(() => {
    const live = ledgerEntries.filter((e) => e.deleted_at == null);
    const asc = [...live].sort((a, b) => {
      const da = a.occurred_on ?? a.created_at;
      const db = b.occurred_on ?? b.created_at;
      if (da !== db) return da < db ? -1 : 1;
      return a.created_at < b.created_at ? -1 : 1;
    });
    let runUsd = 0;
    let runRmb = 0;
    const withBalance = asc.map((e) => {
      const signUsd = e.direction === "haber" ? 1 : -1;
      runUsd += signUsd * e.amount_usd;
      runRmb += signUsd * e.amount_rmb;
      return { entry: e, runUsd, runRmb };
    });
    return withBalance.reverse();
  }, [ledgerEntries]);

  return (
    <div>
      {/* Selector de socio */}
      <div style={{ marginBottom: 18 }}>
        <SupplierPicker
          suppliers={suppliers}
          value={supplierId}
          onChange={onSupplierChange}
          disabled={loading}
        />
      </div>

      {loadError && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: "var(--r-md)",
            background: "var(--danger-bg)",
            color: "var(--danger)",
            font: "600 12px/1.4 var(--f-sans)",
            marginBottom: 16,
          }}
        >
          {loadError}
        </div>
      )}

      {/* KPIs de saldo neto */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 14,
          marginBottom: 20,
        }}
      >
        <KpiCard
          value={fmtUsd(balance.net_usd)}
          label="Saldo neto · USD"
          valueColor={
            balance.net_usd > 0
              ? "var(--wine)"
              : balance.net_usd < 0
                ? "var(--success)"
                : "var(--ink)"
          }
          sub={
            balance.net_usd > 0
              ? "Le debemos al socio"
              : balance.net_usd < 0
                ? "El socio nos retiene / nos debe"
                : "Cuenta saldada"
          }
        />
        <KpiCard
          value={fmtRmb(balance.net_rmb)}
          label="Saldo neto · RMB"
          valueColor={
            balance.net_rmb > 0
              ? "var(--wine)"
              : balance.net_rmb < 0
                ? "var(--success)"
                : "var(--ink)"
          }
          sub="Posición en yuanes"
        />
        <KpiCard
          value={balance.entry_count}
          label="Movimientos"
          sub={selectedSupplier ? selectedSupplier.code : "—"}
        />
      </div>

      {/* Toggle moneda de la tabla */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <span className="studio-eyebrow">
          Cuenta corriente · {rows.length} movimientos
        </span>
        <div style={{ display: "flex", gap: 4 }}>
          {(["usd", "rmb"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCurrencyView(c)}
              style={{
                padding: "5px 12px",
                borderRadius: "var(--r-sm)",
                background:
                  currencyView === c ? "var(--wine-tint)" : "transparent",
                color: currencyView === c ? "var(--wine)" : "var(--ink-soft)",
                font: "700 11px/1 var(--f-sans)",
                border: "none",
                cursor: "pointer",
              }}
            >
              {c === "usd" ? "USD" : "RMB ¥"}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          eyebrow="Sin movimientos"
          title="El libro mayor con este socio está vacío."
          description="Los costos de contenedor, pagos a fábrica (PP/CA), conversiones y notas de crédito aparecerán acá a medida que se asienten."
        />
      ) : (
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            overflow: "hidden",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {/* Header */}
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
            <span>Tipo</span>
            <span>Concepto</span>
            <span style={{ textAlign: "right" }}>Debe</span>
            <span style={{ textAlign: "right" }}>Haber</span>
            <span style={{ textAlign: "right" }}>Saldo</span>
          </div>

          {rows.map(({ entry, runUsd, runRmb }, i) => {
            const amount =
              currencyView === "usd" ? entry.amount_usd : entry.amount_rmb;
            const run = currencyView === "usd" ? runUsd : runRmb;
            const fmt = currencyView === "usd" ? fmtUsd : fmtRmb;
            const isDebe = entry.direction === "debe";
            return (
              <div
                key={entry.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: GRID,
                  gap: 12,
                  padding: "13px 20px",
                  borderTop: i > 0 ? "1px solid var(--border)" : 0,
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    font: "700 11px/1 var(--f-mono)",
                    color: "var(--ink-soft)",
                  }}
                >
                  {(entry.occurred_on ?? entry.created_at).slice(0, 10)}
                </span>
                <Badge tone="neutral" size="sm">
                  {ledgerEntryTypeLabel(entry.entry_type)}
                </Badge>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      font: "600 12px/1.3 var(--f-sans)",
                      color: "var(--ink)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {entry.description ?? entry.entry_code}
                  </div>
                  <code
                    style={{
                      font: "500 10px/1 var(--f-mono)",
                      color: "var(--ink-mute)",
                      marginTop: 3,
                      display: "inline-block",
                    }}
                  >
                    {entry.entry_code} · pago {entry.currency_paid}
                  </code>
                </div>
                <span
                  style={{
                    textAlign: "right",
                    font: "700 12px/1 var(--f-mono)",
                    color: isDebe ? "var(--ink)" : "var(--ink-mute)",
                  }}
                >
                  {isDebe ? fmt(amount) : "—"}
                </span>
                <span
                  style={{
                    textAlign: "right",
                    font: "700 12px/1 var(--f-mono)",
                    color: !isDebe ? "var(--success)" : "var(--ink-mute)",
                  }}
                >
                  {!isDebe ? fmt(amount) : "—"}
                </span>
                <span
                  style={{
                    textAlign: "right",
                    font: "800 12px/1 var(--f-mono)",
                    color: run > 0 ? "var(--wine)" : "var(--ink)",
                  }}
                >
                  {fmt(run)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
