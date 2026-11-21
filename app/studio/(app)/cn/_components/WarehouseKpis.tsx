/**
 * WarehouseKpis — 4 KPI cards horizontales del módulo Almacén CN.
 * Server component. Recibe el resultado de computeWarehouseKpis().
 *
 * - Recepciones del mes (neutral, value-color ink)
 * - Pendientes consolidar (warning si > 0)
 * - CBM en bodega (mono)
 * - Incidencias (danger si > 0)
 */

import { formatCbm } from "@/lib/shared/cbm";
import { KpiCard } from "@/app/studio/_components/ui/KpiCard";
import type { WarehouseKpis as KpisType } from "@/lib/studio/warehouse-cn-queries";
import { t, type Locale } from "@/lib/i18n";

export function WarehouseKpis({
  kpis,
  locale,
}: {
  kpis: KpisType;
  locale: Locale;
}) {
  const cbmDisplay =
    kpis.cbmInWarehouse > 0
      ? formatCbm(kpis.cbmInWarehouse, { locale: locale === "zh-CN" ? "zh-CN" : "es-VE" })
      : "0";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap: 14,
        marginBottom: "var(--s-5)",
      }}
    >
      <KpiCard
        label={t(locale, "warehouse_cn.kpi.receipts_this_month")}
        value={kpis.receiptsThisMonth}
        sub={t(locale, "warehouse_cn.kpi.receipts_this_month_sub")}
      />
      <KpiCard
        label={t(locale, "warehouse_cn.kpi.pending_consolidation")}
        value={kpis.pendingCount}
        sub={
          kpis.pendingCount > 0
            ? t(locale, "warehouse_cn.kpi.pending_consolidation_sub_some")
            : t(locale, "warehouse_cn.kpi.pending_consolidation_sub_none")
        }
        status={kpis.pendingCount > 0 ? { tono: "warning", texto: "Pendiente" } : undefined}
      />
      <KpiCard
        label={t(locale, "warehouse_cn.kpi.cbm_in_warehouse")}
        value={cbmDisplay}
        sub={t(locale, "warehouse_cn.kpi.cbm_in_warehouse_sub")}
      />
      <KpiCard
        label={t(locale, "warehouse_cn.kpi.incidents")}
        value={kpis.incidentsCount}
        sub={
          kpis.incidentsCount > 0
            ? t(locale, "warehouse_cn.kpi.incidents_sub_some")
            : t(locale, "warehouse_cn.kpi.incidents_sub_none")
        }
        status={kpis.incidentsCount > 0 ? { tono: "danger", texto: "Requiere revisión" } : undefined}
      />
    </div>
  );
}
