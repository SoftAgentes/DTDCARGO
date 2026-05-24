/**
 * WarehouseKpis — 4 KPI cards horizontales del módulo Almacén CN.
 * Server component. Recibe el resultado de computeWarehouseKpis().
 *
 * - Recepciones del mes (neutral, value-color ink)
 * - Pendientes consolidar (warning si > 0)
 * - CBM en bodega (mono)
 * - Incidencias (danger si > 0)
 */

import { KpiCard } from "@/app/studio/_components/ui/KpiCard";
import type { WarehouseKpis as KpisType } from "@/lib/studio/warehouse-cn-queries";

export function WarehouseKpis({ kpis }: { kpis: KpisType }) {
  const cbmDisplay =
    kpis.cbmInWarehouse > 0
      ? kpis.cbmInWarehouse.toLocaleString("es-VE", {
          minimumFractionDigits: 1,
          maximumFractionDigits: 3,
        })
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
        label="Recepciones del mes"
        value={kpis.receiptsThisMonth}
        sub="Cajas registradas desde el 1 del mes"
      />
      <KpiCard
        label="Pendientes consolidar"
        value={kpis.pendingCount}
        sub={
          kpis.pendingCount > 0
            ? "Esperando container"
            : "Sin pendientes"
        }
        valueColor={
          kpis.pendingCount > 0 ? "var(--warning)" : "var(--ink)"
        }
      />
      <KpiCard
        label="CBM en bodega"
        value={cbmDisplay}
        sub="Suma de pendientes (m³)"
      />
      <KpiCard
        label="Incidencias"
        value={kpis.incidentsCount}
        sub={
          kpis.incidentsCount > 0
            ? "Requieren atención"
            : "Sin incidencias activas"
        }
        valueColor={
          kpis.incidentsCount > 0 ? "var(--danger)" : "var(--ink)"
        }
      />
    </div>
  );
}
