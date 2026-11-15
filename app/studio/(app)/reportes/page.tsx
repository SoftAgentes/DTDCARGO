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

import Link from "next/link";
import { createClient } from "@/lib/db/server";
import {
  operationalOverview,
  reportByRoute,
  reportByService,
  reportByCarrier,
  commercialByClient,
  commercialByAgent,
  commercialPipeline,
  commercialRepurchase,
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
import { requireModuleView } from "@/lib/studio/rbac-guard";

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
  // SDD-0624: el gate va también en la página, no sólo en el layout: un
  // layout compartido no se vuelve a ejecutar en la navegación parcial.
  await requireModuleView("reports");

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
    const [byClient, byAgent, repurchase, pipeline] = await Promise.all([
      commercialByClient(supabase),
      commercialByAgent(supabase),
      commercialRepurchase(supabase),
      commercialPipeline(supabase, period),
    ]);
    return (
      <ReportesClient
        period={period}
        category="com"
        rep={rep}
        byClient={byClient}
        byAgent={byAgent}
        repurchase={repurchase}
        pipeline={pipeline}
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
      <>
        {/* SDD-0574: «Embarques sin facturar» vive en su propia página. */}
        <p style={{ margin: "0 0 var(--s-3)", font: "500 12.5px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
          ¿Qué falta por facturar?{" "}
          <Link href="/studio/reportes/embarques-sin-facturar" style={{ color: "var(--wine-text)", fontWeight: 600 }}>
            Ver embarques sin facturar →
          </Link>
        </p>
        <ReportesClient
          period={period}
          category="con"
          rep={rep}
          income={income}
          aging={aging}
          cashflow={cashflow}
          iva={iva}
        />
      </>
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
