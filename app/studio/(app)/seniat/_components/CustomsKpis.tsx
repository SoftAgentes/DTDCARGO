/**
 * CustomsKpis — 4 KPI cards del módulo SENIAT.
 */

import { KpiCard } from "@/app/studio/_components/ui/KpiCard";
import type { CustomsKpis as KpisType } from "@/lib/studio/customs-queries";

export function CustomsKpis({ kpis }: { kpis: KpisType }) {
  const totalPaidDisplay =
    kpis.totalPaidUsd >= 1000
      ? `$${(kpis.totalPaidUsd / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 })}K`
      : `$${kpis.totalPaidUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

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
        label="En trámite"
        value={kpis.inProcess}
        sub={
          kpis.inProcess > 0
            ? "Esperando liberación SENIAT"
            : "Sin trámites activos"
        }
      />
      <KpiCard
        label="Liberados YTD"
        value={kpis.clearedYtd}
        sub="Completados este año"
      />
      <KpiCard
        label="Impuestos pagados"
        value={totalPaidDisplay}
        sub="Aranceles + IGTF + IVA + agente"
      />
      <KpiCard
        label="Con alertas"
        value={kpis.withAlert}
        sub={
          kpis.withAlert > 0
            ? "Requieren atención inmediata"
            : "Todos los trámites OK"
        }
        status={kpis.withAlert > 0 ? { tono: "danger", texto: "Requiere acción" } : undefined}
      />
    </div>
  );
}
