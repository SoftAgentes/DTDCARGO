/**
 * /studio/documentos — Hub central de Documentos (DMS · SDD-0049 Slice B).
 *
 * Server Component: lee TODO el repositorio del tenant (RLS filtra) + los conteos
 * por carpeta + los tres conjuntos de filtro (por-vencer / pendientes / sin-vincular),
 * y delega la navegación (árbol + búsqueda + chips) a DocumentosHubClient.
 *
 * Reemplaza el stub. Reusa los queries puros de lib/studio/documents (Slice A):
 * listAllDocuments / folderCounts / expiringDocuments / pendingDocuments /
 * unlinkedDocuments. Deep-link a la transacción via LINK_KIND.
 */

import { createClient } from "@/lib/db/server";
import {
  listAllDocuments,
  folderCounts,
  expiringDocuments,
  pendingDocuments,
  unlinkedDocuments,
} from "@/lib/studio/documents/queries";
import type { DocumentRow } from "@/lib/studio/documents/types";
import { DocumentosHubClient } from "./_components/DocumentosHubClient";

export const metadata = { title: "Documentos · DTD Studio" };

export type HubView = "all" | "por-vencer" | "pendientes" | "sin-vincular";

const VIEWS: ReadonlySet<string> = new Set([
  "all",
  "por-vencer",
  "pendientes",
  "sin-vincular",
]);

/** Fecha de hoy en ISO YYYY-MM-DD (para el filtro de vencimiento). */
function todayIso(): string {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default async function DocumentosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; folder?: string; view?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const folder = (sp.folder ?? "all").trim() || "all";
  const view: HubView = VIEWS.has(sp.view ?? "all")
    ? (sp.view as HubView)
    : "all";

  const supabase = await createClient();
  const today = todayIso();

  // Conteos del árbol + KPIs (siempre globales, sin filtro de vista).
  const [counts, expiring, pending, unlinked] = await Promise.all([
    folderCounts(supabase),
    expiringDocuments(supabase, today),
    pendingDocuments(supabase),
    unlinkedDocuments(supabase),
  ]);

  // Filas a mostrar: la vista activa decide la fuente; folder + q solo aplican
  // a la vista "all" (los filtros especiales ya traen su subconjunto).
  let rows: DocumentRow[];
  if (view === "por-vencer") {
    rows = expiring;
  } else if (view === "pendientes") {
    rows = pending;
  } else if (view === "sin-vincular") {
    rows = unlinked;
  } else {
    rows = await listAllDocuments(supabase, { folder, q });
  }

  return (
    <DocumentosHubClient
      rows={rows}
      counts={counts}
      folder={folder}
      view={view}
      q={q}
      today={today}
      kpis={{
        total: counts.all ?? 0,
        expiring: expiring.length,
        pending: pending.length,
        unlinked: unlinked.length,
      }}
    />
  );
}
