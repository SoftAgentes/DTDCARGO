/**
 * /studio/despacho/dashboard — Reportes operativos del Despacho (SDD-0029).
 *
 * 5 KPIs + Ranking rutas + Top ciudades por volumen.
 * Selector de periodo via ?period=7d|30d|90d.
 */

import { createClient } from "@/lib/db/server";
import { requireModuleView } from "@/lib/studio/rbac-guard";
import {
  computeDispatchDashboardStats,
  listDispatchRouteRanking,
  listDispatchTopCities,
  type DispatchDashboardPeriod,
} from "@/lib/studio/dispatch-queries";
import { DispatchDashboardClient } from "./_components/DispatchDashboardClient";

export const metadata = { title: "Dashboard Despacho · DTD Studio" };

type SearchParams = { [key: string]: string | string[] | undefined };

const VALID_PERIODS: DispatchDashboardPeriod[] = ["7d", "30d", "90d"];

function parsePeriod(raw: string | string[] | undefined): DispatchDashboardPeriod {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v && VALID_PERIODS.includes(v as DispatchDashboardPeriod)) {
    return v as DispatchDashboardPeriod;
  }
  return "7d";
}

export default async function DispatchDashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireModuleView("despacho-dashboard");

  const params = await searchParams;
  const period = parsePeriod(params.period);

  const supabase = await createClient();

  const [stats, ranking, topCities] = await Promise.all([
    computeDispatchDashboardStats(supabase, period),
    listDispatchRouteRanking(supabase, period),
    listDispatchTopCities(supabase, period),
  ]);

  return (
    <div style={{ maxWidth: 1480 }}>
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
          <span className="studio-eyebrow">Reportes · Despacho</span>
          <h1
            className="studio-display"
            style={{ fontSize: 30, margin: "var(--s-2) 0 var(--s-2)", color: "var(--ink)" }}
          >
            Dashboard de despacho
          </h1>
          <p
            style={{
              font: "400 13px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: 0,
              maxWidth: "76ch",
            }}
          >
            Métricas operativas de los últimos{" "}
            {period === "7d" ? "7 días" : period === "30d" ? "30 días" : "90 días"}.
            Mira qué rutas son más eficientes, dónde hay demoras y volumen por
            ciudad destino.
          </p>
        </div>
      </div>

      <DispatchDashboardClient
        period={period}
        stats={stats}
        ranking={ranking}
        topCities={topCities}
      />
    </div>
  );
}
