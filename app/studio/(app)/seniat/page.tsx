/**
 * /studio/seniat — Aduana SENIAT (SDD-0018).
 *
 * Server component. Fetchea en paralelo:
 * - filings (queue o cleared según tab)
 * - agents (catálogo global)
 * - shipments elegibles para nuevo filing
 * - tax breakdown YTD
 * - KPIs
 * - filing detail (si ?filing=<id>)
 *
 * Delega UI interactiva al SeniatClient.
 */

import { createClient } from "@/lib/db/server";
import { requireModuleView } from "@/lib/studio/rbac-guard";
import {
  computeCustomsKpis,
  computeTaxBreakdownYtd,
  getFilingDetailById,
  listAgents,
  listFilings,
  listShipmentsEligibleForFiling,
  parseCustomsFiltersFromSearchParams,
} from "@/lib/studio/customs-queries";
import { CustomsKpis } from "./_components/CustomsKpis";
import { SeniatClient } from "./_components/SeniatClient";
import { SeniatHeaderActions } from "./_components/SeniatHeaderActions";

export const metadata = { title: "Aduana SENIAT" };

export default async function SeniatPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireModuleView("seniat");

  const rawParams = await searchParams;
  const filters = parseCustomsFiltersFromSearchParams(rawParams);

  const single = (k: string): string | undefined => {
    const v = rawParams[k];
    if (Array.isArray(v)) return v[0];
    return v;
  };
  const filingId = single("filing");

  const supabase = await createClient();

  const [filings, agents, eligibleShipments, taxBreakdown, kpis, filingDetail] =
    await Promise.all([
      listFilings(supabase, filters),
      listAgents(supabase),
      listShipmentsEligibleForFiling(supabase),
      computeTaxBreakdownYtd(supabase),
      computeCustomsKpis(supabase),
      filingId
        ? getFilingDetailById(supabase, filingId)
        : Promise.resolve(null),
    ]);

  // Counts para badges en tabs — independientes de los filtros activos
  const [queueCountResult, clearedCountResult] = await Promise.all([
    supabase
      .from("customs_filings")
      .select("id", { count: "exact", head: true })
      .neq("status", "liberado"),
    supabase
      .from("customs_filings")
      .select("id", { count: "exact", head: true })
      .eq("status", "liberado"),
  ]);

  const counts = {
    queue: queueCountResult.count ?? 0,
    cleared: clearedCountResult.count ?? 0,
  };

  return (
    <div style={{ maxWidth: 1480 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 24,
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        <div>
          <span className="studio-eyebrow">Operación · Aduana</span>
          <h1
            className="studio-display"
            style={{
              fontSize: 30,
              margin: "8px 0 8px",
              color: "var(--ink)",
            }}
          >
            Aduana SENIAT
          </h1>
          <p
            style={{
              font: "400 13px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: 0,
              maxWidth: "76ch",
            }}
          >
            Trámite aduanero por embarque · DUA, agente aduanal, aranceles,
            IGTF, IVA. Checklist documental de 7 items y tracking de
            liberación con timeline 6-step.{" "}
            <span style={{ color: "var(--ink-mute)" }}>
              Cada trámite se gestiona desde su fila — abre el detalle para
              cargar costos y marcar documentos.
            </span>
          </p>
        </div>
        <SeniatHeaderActions />
      </div>

      <CustomsKpis kpis={kpis} />

      <SeniatClient
        filings={filings}
        agents={agents}
        eligibleShipments={eligibleShipments}
        taxBreakdown={taxBreakdown}
        filingDetail={filingDetail}
        counts={counts}
      />
    </div>
  );
}
