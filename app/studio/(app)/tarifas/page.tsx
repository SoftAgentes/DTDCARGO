/**
 * Tarifas — catálogo de precios por servicio + ruta.
 *
 * SDD-0008. Reemplaza el placeholder del Sprint 0.1.
 *
 * Server component que fetchea las tarifas con filtros desde searchParams y
 * delega la UI interactiva (drawer, toolbar) al TarifasClient.
 */

import { createClient } from "@/lib/db/server";
import {
  listRates,
  parseRateFiltersFromSearchParams,
} from "@/lib/studio/rate-queries";
import { getCalculatorSettings } from "@/lib/studio/calculator-settings-queries";
import { listCalculatorCities } from "@/lib/studio/calculator-cities-queries";
import { TarifasClient } from "./_components/TarifasClient";

export const metadata = { title: "Tarifas" };

export default async function TarifasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const rawParams = await searchParams;
  const filters = parseRateFiltersFromSearchParams(rawParams);

  const supabase = await createClient();

  // Rol del usuario: la pestaña Ciudades es admin-only (igual que la RLS de
  // calculator_cities para write). Filtramos por user_id (post-0040 el listado
  // de user_tenants expone a todos los miembros del tenant).
  const { data: auth } = await supabase.auth.getUser();
  let isAdmin = false;
  if (auth.user?.id) {
    const { data: link } = await supabase
      .from("user_tenants")
      .select("role")
      .eq("user_id", auth.user.id)
      .maybeSingle<{ role: string }>();
    isAdmin = link?.role === "admin";
  }

  const [rates, settings, cities] = await Promise.all([
    listRates(supabase, filters),
    getCalculatorSettings(supabase),
    listCalculatorCities(supabase),
  ]);

  return (
    <TarifasClient
      rates={rates}
      filters={filters}
      settings={settings}
      cities={cities}
      isAdmin={isAdmin}
    />
  );
}
