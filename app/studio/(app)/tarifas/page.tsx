/**
 * Tarifas — catálogo de precios por servicio + ruta.
 *
 * SDD-0008. Reemplaza el placeholder del Sprint 0.1.
 *
 * Server component que fetchea las tarifas con filtros desde searchParams y
 * delega la UI interactiva (drawer, toolbar) al TarifasClient.
 *
 * Los parámetros del calculador y las ciudades de destino se movieron a
 * Administración › Calculadora pública (config admin-only, se edita poco).
 */

import { createClient } from "@/lib/db/server";
import { requireModuleView } from "@/lib/studio/rbac-guard";
import {
  listRates,
  parseRateFiltersFromSearchParams,
} from "@/lib/studio/rate-queries";
import { TarifasClient } from "./_components/TarifasClient";

export const metadata = { title: "Tarifas" };

export default async function TarifasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireModuleView("rates");

  const rawParams = await searchParams;
  const filters = parseRateFiltersFromSearchParams(rawParams);

  const supabase = await createClient();
  const rates = await listRates(supabase, filters);

  return <TarifasClient rates={rates} filters={filters} />;
}
