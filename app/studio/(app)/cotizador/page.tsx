/**
 * Estimados — lista de estimados.
 *
 * SDD-0011. Reemplaza el placeholder.
 *
 * Server component que fetchea quotes con filtros desde searchParams y
 * delega la UI interactiva al CotizadorClient.
 */

import { createClient } from "@/lib/db/server";
import { requireModuleView } from "@/lib/studio/rbac-guard";
import {
  listQuotes,
  parseQuoteFiltersFromSearchParams,
} from "@/lib/studio/quote-queries";
import { CotizadorClient } from "./_components/CotizadorClient";

export const metadata = { title: "Estimados" };

export default async function CotizadorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireModuleView("quotes");

  const rawParams = await searchParams;
  const filters = parseQuoteFiltersFromSearchParams(rawParams);

  const supabase = await createClient();
  const quotes = await listQuotes(supabase, filters);

  return <CotizadorClient quotes={quotes} filters={filters} />;
}
