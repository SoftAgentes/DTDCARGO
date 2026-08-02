"use client";

/**
 * Tab "Reportes" (SDD-0040).
 *
 * P&L (Ingresos − Costo de ventas = Utilidad bruta − Gastos = Utilidad neta)
 * y Balance general (Activo = Pasivo + Patrimonio + Resultado), en cards/tabla
 * navy estilo del sistema. Reportes gerenciales en USD; sin export.
 */

import type { ProfitAndLoss, BalanceSheet } from "@/lib/studio/accounting/reports";
import { Icon } from "@/app/studio/_components/icons";
import { fmtAmount } from "./format";

export function ReportesTab({
  pnl,
  balanceSheet,
}: {
  pnl: ProfitAndLoss;
  balanceSheet: BalanceSheet;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))",
        gap: 18,
        alignItems: "start",
      }}
    >
      {/* Estado de resultados (P&L) */}
      <ReportCard title="Estado de resultados" subtitle="P&L · acumulado en USD">
        <Row label="Ingresos" value={pnl.income} />
        <Row label="Costo de ventas" value={pnl.cogs} negative />
        <Divider />
        <Row label="Utilidad bruta" value={pnl.grossProfit} strong />
        <Row label="Gastos operativos" value={pnl.expenses} negative />
        <Divider />
        <Row label="Utilidad neta" value={pnl.netIncome} highlight />
      </ReportCard>

      {/* Balance general */}
      <ReportCard
        title="Balance general"
        subtitle="A = P + Patrimonio + resultado · USD"
      >
        <Row label="Activo" value={balanceSheet.assets} strong />
        <Divider />
        <Row label="Pasivo" value={balanceSheet.liabilities} />
        <Row label="Patrimonio" value={balanceSheet.equity} />
        <Row label="Resultado del ejercicio" value={balanceSheet.netIncome} />
        <Divider />
        <Row
          label="Pasivo + Patrimonio + Resultado"
          value={
            balanceSheet.liabilities +
            balanceSheet.equity +
            balanceSheet.netIncome
          }
          strong
        />
        <div
          style={{
            marginTop: 14,
            paddingTop: 14,
            borderTop: "1px solid var(--ink-side-soft)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span
            style={{
              font: "600 10.5px/1 var(--f-sans)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--ink-side-soft)",
            }}
          >
            {balanceSheet.ok ? "Balance cuadra" : "Descuadre"}
          </span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              font: "800 13px/1 var(--f-mono)",
              color: balanceSheet.ok ? "var(--success)" : "var(--warning)",
            }}
          >
            {balanceSheet.ok ? (
              <>
                {Icon.check(13)}
                A = P + PT + R
              </>
            ) : (
              `$${fmtAmount(Math.abs(balanceSheet.difference))}`
            )}
          </span>
        </div>
      </ReportCard>
    </div>
  );
}

function ReportCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "var(--bg-sidebar)",
        color: "var(--ink-side)",
        borderRadius: "var(--r-lg)",
        padding: "22px 24px",
      }}
    >
      <div
        style={{
          font: "900 16px/1.1 var(--f-display)",
          color: "var(--ink-side-strong)",
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </div>
      <div
        style={{
          font: "500 11px/1.3 var(--f-sans)",
          color: "var(--ink-side-soft)",
          marginTop: 4,
          marginBottom: 18,
        }}
      >
        {subtitle}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {children}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  highlight,
  negative,
}: {
  label: string;
  value: number;
  strong?: boolean;
  highlight?: boolean;
  negative?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 12,
      }}
    >
      <span
        style={{
          font: `${strong || highlight ? "700" : "500"} ${highlight ? 14 : 13}px/1.2 var(--f-sans)`,
          color: highlight ? "var(--ink-side-strong)" : "var(--ink-side)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          font: `${strong || highlight ? "800" : "600"} ${highlight ? 18 : 13}px/1 var(--f-mono)`,
          color: highlight ? "var(--ink-side-strong)" : "var(--ink-side)",
          whiteSpace: "nowrap",
        }}
      >
        {negative && value !== 0 ? "− " : ""}${fmtAmount(Math.abs(value))}
      </span>
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "var(--ink-side-soft)" }} />;
}
