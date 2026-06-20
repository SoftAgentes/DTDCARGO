/**
 * Academia DTD (SDD-0093) — formación.
 *
 * Server component: gate de rol (requireModuleView) + carga de datos (queries
 * puras) → AcademiaClient (pestañas Catálogo + Cohortes). Slice A = catálogo;
 * Slice B = cohortes en vivo + asistencia + emisión de diplomas.
 */

import { createClient } from "@/lib/db/server";
import { requireModuleView } from "@/lib/studio/rbac-guard";
import {
  academiaStats,
  listCohortDetails,
  listCoursesWithCounts,
} from "@/lib/studio/academia/queries";
import { AcademiaClient } from "./_components/AcademiaClient";

export const metadata = { title: "Academia · Formación" };

export default async function AcademiaPage() {
  await requireModuleView("academia");
  const supabase = await createClient();

  const [stats, courses, cohorts] = await Promise.all([
    academiaStats(supabase),
    listCoursesWithCounts(supabase),
    listCohortDetails(supabase),
  ]);

  return (
    <div style={{ padding: "var(--s-6)" }}>
      <AcademiaClient stats={stats} courses={courses} cohorts={cohorts} />
    </div>
  );
}
