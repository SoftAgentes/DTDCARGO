/**
 * /studio/ve — Almacén VE (SDD-0017).
 *
 * Server component. Lista shipments en estados VE-relevant
 * (arrived_destination / in_customs / out_for_delivery / last_mile /
 * delivered / exception) con 4 KPIs operativos + filtros + acciones.
 *
 * Modelado como vista derivada de shipments (sin tabla nueva).
 */

import { createClient } from "@/lib/db/server";
import {
  computeVeKpis,
  listVeReceipts,
  parseVeFiltersFromSearchParams,
} from "@/lib/studio/warehouse-ve-queries";
import { AlmacenVeClient } from "./_components/AlmacenVeClient";
import { VeKpis } from "./_components/VeKpis";

export const metadata = { title: "Almacén VE" };

export default async function VePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const rawParams = await searchParams;
  const filters = parseVeFiltersFromSearchParams(rawParams);

  const supabase = await createClient();
  const [rows, kpis] = await Promise.all([
    listVeReceipts(supabase, filters),
    computeVeKpis(supabase),
  ]);

  return (
    <div style={{ maxWidth: 1480 }}>
      {/* Header */}
      <div
        style={{
          marginBottom: "var(--s-6)",
        }}
      >
        <span className="studio-eyebrow">Operación · Venezuela</span>
        <h1
          className="studio-display"
          style={{
            fontSize: 30,
            margin: "8px 0 8px",
            color: "var(--ink)",
          }}
        >
          Almacén VE
        </h1>
        <p
          style={{
            font: "400 13px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
            maxWidth: "72ch",
          }}
        >
          Recepción de containers en puertos VE, trámites{" "}
          <strong style={{ color: "var(--ink)" }}>aduana SENIAT</strong>,
          desconsolidación y entrega DDP final con POD firmado.{" "}
          <span style={{ color: "var(--ink-soft)" }}>
            Cada operación se gestiona desde el menú{" "}
            <code
              style={{
                font: "700 12px/1 var(--f-mono)",
                color: "var(--wine)",
                padding: "0 4px",
                background: "var(--wine-tint)",
                borderRadius: "var(--r-xs)",
              }}
            >
              ···
            </code>{" "}
            de cada embarque.
          </span>
        </p>
      </div>

      <VeKpis kpis={kpis} />

      <AlmacenVeClient rows={rows} filters={filters} />
    </div>
  );
}
