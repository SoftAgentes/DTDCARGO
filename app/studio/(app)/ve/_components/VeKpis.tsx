/**
 * VeKpis — 4 KPI cards del módulo Almacén VE.
 * Server component. Recibe el resultado de computeVeKpis().
 */

import { KpiCard } from "@/app/studio/_components/ui/KpiCard";
import type { VeKpis as KpisType } from "@/lib/studio/warehouse-ve-queries";

export function VeKpis({ kpis }: { kpis: KpisType }) {
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
        label="En aduana SENIAT"
        value={kpis.inCustoms}
        sub={
          kpis.inCustoms > 0
            ? "Trámite aduanal en curso"
            : "Sin trámites activos"
        }
      />
      <KpiCard
        label="Listos para retiro"
        value={kpis.readyForPickup}
        sub={
          kpis.readyForPickup > 0
            ? "Liberados aduana, esperando reparto"
            : "Sin liberados pendientes"
        }
      />
      <KpiCard
        label="En reparto"
        value={kpis.outForDelivery}
        sub={
          kpis.outForDelivery > 0
            ? "DDP en camino al cliente"
            : "Ningún reparto activo"
        }
      />
      <KpiCard
        label="Entregados este mes"
        value={kpis.deliveredThisMonth}
        sub="POD firmado"
      />
    </div>
  );
}
