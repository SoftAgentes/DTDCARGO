"use client";

/**
 * Operación (SDD-0048) — embarques activos + naviera (consolidando / carga
 * suelta / próximo cut-off). Conteos reales de getOperationalCounts + navieraKpis.
 *
 * Solo tokens var(--*). Cada celda deep-linkea a su módulo.
 */

import Link from "next/link";
import { Icon } from "@/app/studio/_components/icons";
import type { OpsSummary } from "@/lib/studio/direccion/queries";
import { MiniStat } from "./MiniStat";

export function OpsCard({ ops }: { ops: OpsSummary }) {
  const cutoffValue = ops.cutoffDays != null ? `${ops.cutoffDays}d` : "—";
  const cutoffTone = ops.cutoffDays != null && ops.cutoffDays <= 3 ? "danger" : "wine";

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: "var(--s-5) var(--s-5)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: "var(--s-4)",
        }}
      >
        <span
          style={{
            font: "700 10px/1 var(--f-sans)",
            color: "var(--wine)",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          Operación
        </span>
        <Link
          href="/studio/naviera"
          style={{
            font: "600 11.5px/1 var(--f-sans)",
            color: "var(--wine)",
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--s-1)",
            textDecoration: "none",
          }}
        >
          Naviera {Icon.arrowR(11)}
        </Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--s-3)" }}>
        <MiniStat
          label="Embarques activos"
          value={ops.activos}
          sub="en tránsito + aduana"
          icon={Icon.box(16)}
          href="/studio/embarques"
        />
        <MiniStat
          label="Contenedores"
          value={ops.consolidando}
          sub="consolidando"
          icon={Icon.ship(16)}
          href="/studio/naviera"
        />
        <MiniStat
          label="Carga suelta CN"
          value={ops.looseCbm.toFixed(1)}
          sub="CBM por consolidar"
          icon={Icon.warehouse(16)}
          href="/studio/naviera"
        />
        <MiniStat
          label="Próximo cut-off"
          value={cutoffValue}
          sub={ops.cutoffVessel ?? "sin salidas"}
          icon={Icon.clock(16)}
          tone={cutoffTone}
          href="/studio/naviera"
        />
      </div>
    </div>
  );
}
