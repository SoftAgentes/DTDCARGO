/**
 * Inspecciones de calidad (SDD-0066 · Fase 1-3).
 *
 * Server component: gate de módulo (RBAC SDD-0085) + fetch de reportes, clientes,
 * KPIs del mes y fotos firmadas → render del orquestador client. El builder
 * completo (PSI / fábrica), las fotos y el preview imprimible viven en el editor.
 */

import { createClient } from "@/lib/db/server";
import { requireModuleView } from "@/lib/studio/rbac-guard";
import {
  listInspectionReports,
  listInspectionClients,
  getInspectionKpis,
} from "@/lib/studio/inspecciones/queries";
import {
  listInspectionPhotos,
  type InspectionPhotoItem,
} from "@/lib/studio/inspecciones/photos";
import { InspeccionesClient } from "./_components/InspeccionesClient";

export const metadata = { title: "Inspecciones de calidad · DTD Studio" };

export default async function InspeccionesPage() {
  const role = await requireModuleView("inspecciones");
  const canEdit = role !== "support";

  const supabase = await createClient();
  const [reports, clients, kpis] = await Promise.all([
    listInspectionReports(supabase),
    listInspectionClients(supabase),
    getInspectionKpis(supabase),
  ]);

  // Fotos firmadas por reporte (mismo user client → storage RLS por tenant).
  const photosMap = await listInspectionPhotos(
    supabase,
    reports.map((r) => r.id),
  );
  const photos: Record<string, InspectionPhotoItem[]> = {};
  for (const [k, v] of photosMap) photos[k] = v;

  return (
    <InspeccionesClient
      reports={reports}
      clients={clients}
      kpis={kpis}
      photos={photos}
      canEdit={canEdit}
    />
  );
}
