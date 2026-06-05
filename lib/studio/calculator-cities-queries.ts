/**
 * Query del módulo Ciudades del calculador (Fase 3 Slice B, SDD-0055).
 *
 * RLS filtra por tenant_id automáticamente — no se pasa tenant_id como param.
 * Consumido por app/studio/(app)/tarifas/page.tsx para poblar la pestaña Ciudades.
 *
 * Postgres devuelve numeric (km) como string vía PostgREST; lo normalizamos.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CalculatorCity } from "./calculator-cities-types";

type CityRow = {
  id: string;
  tenant_id: string;
  slug: string;
  label: string;
  km: number | string;
  casco: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

const CITY_COLUMNS =
  "id, tenant_id, slug, label, km, casco, sort_order, created_at, updated_at";

/**
 * Lista las ciudades del calculador del tenant logueado (solo vivas).
 * Ordenadas por sort_order + label, igual que el RPC público.
 */
export async function listCalculatorCities(
  supabase: SupabaseClient,
): Promise<CalculatorCity[]> {
  const { data, error } = await supabase
    .from("calculator_cities")
    .select(CITY_COLUMNS)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });

  if (error) throw error;

  return ((data as CityRow[] | null) ?? []).map((r) => ({
    id: r.id,
    tenant_id: r.tenant_id,
    slug: r.slug,
    label: r.label,
    km: Number(r.km),
    casco: r.casco,
    sort_order: r.sort_order,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
}
