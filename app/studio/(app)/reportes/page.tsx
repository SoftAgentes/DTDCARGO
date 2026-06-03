/**
 * Reportes & Analytics (SDD-0052 · Slices A+B) — reemplaza el stub.
 *
 * Server component, READ-ONLY: lee ?cat= (categoría) + ?rep= (reporte) +
 * ?period= (default 1A). Según la categoría activa carga SOLO los agregados que
 * esa categoría necesita (en paralelo) y delega la UI a ReportesClient. Capa de
 * presentación sobre tablas existentes (patrón Dirección 0048) — sin migración,
 * sin mutaciones.
 *
 * Categorías operables: Operacionales (Slice A) · Comerciales (Slice B) ·
 * Contables & financieros (Slice B). Combinados + Constructor siguen "Pronto"
 * (Slice C). NUNCA se fabrica costo/margen (regla §3.2).
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
  commercialByClient,
  incomeStatement,
  agingReport,
  cashflowReport,
} from "@/lib/studio/reports/queries";
import { asPeriod } from "@/lib/studio/reports/types";
import { ReportesClient } from "./_components/ReportesClient";

export const metadata = { title: "Reportes & Analytics" };
export const dynamic = "force-dynamic";

type Category = "op" | "com" | "con";

function asCategory(raw: unknown): Category {
  return raw === "com" || raw === "con" ? raw : "op";
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
  const category = asCategory(single("cat"));
  const rep = single("rep");

  const supabase = await createClient();

  // Cargar SOLO lo que la categoría activa necesita (las otras categorías ni se
  // consultan → menos round-trips por vista).
  if (category === "com") {
    const byClient = await commercialByClient(supabase);
    return (
      <ReportesClient
        period={period}
        category="com"
        rep={rep}
        byClient={byClient}
      />
    );
  }

  if (category === "con") {
    const [income, aging, cashflow] = await Promise.all([
      incomeStatement(supabase, period),
      agingReport(supabase),
      cashflowReport(supabase, period),
    ]);
    return (
      <ReportesClient
        period={period}
        category="con"
        rep={rep}
        income={income}
        aging={aging}
        cashflow={cashflow}
      />
    );
  }

  // Operacionales (default, Slice A).
  const [overview, routes, carriers, services] = await Promise.all([
    operationalOverview(supabase, period),
    reportByRoute(supabase, period),
    reportByCarrier(supabase, period),
    reportByService(supabase, period),
  ]);

  return (
    <ReportesClient
      period={period}
      category="op"
      rep={rep}
      overview={overview}
      routes={routes}
      carriers={carriers}
      services={services}
    />
  );
}
