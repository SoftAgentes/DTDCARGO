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
  commercialByAgent,
  incomeStatement,
  agingReport,
  cashflowReport,
  ivaPosition,
  builderRows,
  combinedReport,
} from "@/lib/studio/reports/queries";
import { asPeriod } from "@/lib/studio/reports/types";
import { asSourceId } from "@/lib/studio/reports/builder-types";
import { ReportesClient } from "./_components/ReportesClient";

export const metadata = { title: "Reportes & Analytics" };
export const dynamic = "force-dynamic";

type Category = "op" | "com" | "con" | "build" | "mix";

function asCategory(raw: unknown): Category {
  return raw === "com" ||
    raw === "con" ||
    raw === "build" ||
    raw === "mix"
    ? raw
    : "op";
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
    const [byClient, byAgent] = await Promise.all([
      commercialByClient(supabase),
      commercialByAgent(supabase),
    ]);
    return (
      <ReportesClient
        period={period}
        category="com"
        rep={rep}
        byClient={byClient}
        byAgent={byAgent}
      />
    );
  }

  if (category === "con") {
    const [income, aging, cashflow, iva] = await Promise.all([
      incomeStatement(supabase, period),
      agingReport(supabase),
      cashflowReport(supabase, period),
      ivaPosition(supabase, period),
    ]);
    return (
      <ReportesClient
        period={period}
        category="con"
        rep={rep}
        income={income}
        aging={aging}
        cashflow={cashflow}
        iva={iva}
      />
    );
  }

  if (category === "mix") {
    // Combinados (Slice C): rentabilidad REAL del período. Compone costingRows
    // (Costing 0053) — revenue real + costo real de `shipment_costs`. NUNCA se
    // fabrica costo (§3.2). Una sola query (costingRows) cruza todo.
    const combined = await combinedReport(supabase, period);
    return (
      <ReportesClient
        period={period}
        category="mix"
        rep={rep}
        combined={combined}
      />
    );
  }

  if (category === "build") {
    // El constructor carga las filas de la fuente activa (?src=); el agregado
    // (dim/métrica/filtro) lo arma el client sobre estas filas (sin volver al
    // server por cada combinación).
    const source = asSourceId(single("src"));
    const rows = await builderRows(supabase, source, period);
    return (
      <ReportesClient
        period={period}
        category="build"
        rep={rep}
        builderSource={source}
        builderData={rows}
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
