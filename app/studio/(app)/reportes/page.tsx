/**
 * Reportes & Analytics (SDD-0052 · Slice A) — reemplaza el stub.
 *
 * Server component, READ-ONLY: lee ?period= (default 1A) + ?rep=, carga en
 * PARALELO los 4 agregados operacionales (overview/rutas/navieras/servicios) y
 * delega la UI a ReportesClient. Capa de presentación sobre tablas existentes
 * (patrón Dirección 0048) — sin migración, sin mutaciones.
 *
 * Frontera RSC: de ReportesClient importamos SOLO el componente (JSX), nunca un
 * helper/constante. Los tipos/helpers compartidos viven en
 * lib/studio/reports/types.ts (server-safe).
 */

import { createClient } from "@/lib/db/server";
import {
  operationalOverview,
  reportByRoute,
  reportByService,
  reportByCarrier,
} from "@/lib/studio/reports/queries";
import { asPeriod } from "@/lib/studio/reports/types";
import { ReportesClient } from "./_components/ReportesClient";

export const metadata = { title: "Reportes & Analytics" };
export const dynamic = "force-dynamic";

type OpReport = "overview" | "routes" | "carriers" | "services";

function asReport(raw: unknown): OpReport {
  return raw === "routes" || raw === "carriers" || raw === "services"
    ? raw
    : "overview";
}

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const single = (k: string): string | undefined => {
    const v = raw[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const period = asPeriod(single("period"));
  const report = asReport(single("rep"));

  const supabase = await createClient();

  const [overview, routes, carriers, services] = await Promise.all([
    operationalOverview(supabase, period),
    reportByRoute(supabase, period),
    reportByCarrier(supabase, period),
    reportByService(supabase, period),
  ]);

  return (
    <ReportesClient
      period={period}
      report={report}
      overview={overview}
      routes={routes}
      carriers={carriers}
      services={services}
    />
  );
}
