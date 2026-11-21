import { KpiCard } from "@/app/studio/_components/ui/KpiCard";
import type { TmsKpis as KpisType } from "@/lib/studio/tms-queries";

export function TmsKpis({ kpis }: { kpis: KpisType }) {
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
        label="Flota total"
        value={kpis.fleetTotal}
        sub={`${kpis.fleetOwned} propios · ${kpis.fleetContracted} contratados`}
      />
      <KpiCard
        label="En ruta ahora"
        value={kpis.inRoute}
        sub={
          kpis.inRoute > 0
            ? `${kpis.driversInRoute} ${kpis.driversInRoute === 1 ? "chofer activo" : "choferes activos"}`
            : "Nadie en ruta"
        }
      />
      <KpiCard
        label="Disponibles"
        value={kpis.available}
        sub={
          kpis.available > 0
            ? "Listos para asignar"
            : "Sin disponibles ahora"
        }
      />
      <KpiCard
        label="Mantenimiento"
        value={kpis.maintenance}
        sub={
          kpis.maintenance > 0
            ? "Requiere atención"
            : "Todos operativos"
        }
        status={kpis.maintenance > 0 ? { tono: "warning", texto: "Fuera de servicio" } : undefined}
      />
    </div>
  );
}
