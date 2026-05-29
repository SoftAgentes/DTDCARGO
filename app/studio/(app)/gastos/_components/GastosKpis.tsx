/**
 * GastosKpis — fila de KPIs del mes para /studio/gastos.
 *
 * Server component (sin estado). Todos los totales vienen ya normalizados
 * a USD desde computeExpenseKpis (amount_usd). Formato locale-aware.
 */

import { KpiCard } from "@/app/studio/_components/ui/KpiCard";
import { t, formatCurrency, type Locale } from "@/lib/i18n";
import type { ExpenseKpis } from "@/lib/studio/expense-queries";

export function GastosKpis({
  kpis,
  locale,
}: {
  kpis: ExpenseKpis;
  locale: Locale;
}) {
  const totalUsd = kpis.shipmentTotalUsd + kpis.externalTotalUsd;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: 14,
        marginBottom: 22,
      }}
    >
      <KpiCard
        value={formatCurrency(totalUsd, "USD", locale)}
        label={t(locale, "expenses.kpi.month_total_usd")}
        sub={t(locale, "expenses.kpi.month_total_sub")}
        valueColor="var(--wine)"
      />
      <KpiCard
        value={formatCurrency(kpis.shipmentTotalUsd, "USD", locale)}
        label={t(locale, "expenses.kpi.shipment_total")}
      />
      <KpiCard
        value={formatCurrency(kpis.externalTotalUsd, "USD", locale)}
        label={t(locale, "expenses.kpi.external_total")}
      />
      <KpiCard
        value={kpis.count}
        label={t(locale, "expenses.kpi.count")}
      />
    </div>
  );
}
