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
 *
 * SDD-0269: la pantalla ya no muestra UNA lista de tarifas sino LA LISTA QUE SE
 * ESTÉ VIENDO — la de la casa por defecto, o la de un aliado. Se mezclan en una
 * sola tabla sólo en apariencia: cada tarifa vive en una lista, y el precio que
 * ve un cliente depende de cuál le toca (`resolve_price_book`, migr 0382).
 */

import { createClient } from "@/lib/db/server";
import { requireModuleView } from "@/lib/studio/rbac-guard";
import {
  listRates,
  parseRateFiltersFromSearchParams,
} from "@/lib/studio/rate-queries";
import { listPriceBooks } from "@/lib/studio/price-books/price-book-queries";
import type { PriceBookOption } from "@/lib/studio/price-books/price-book-types";
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

  // Best-effort: si la migr 0382 todavía no está aplicada, la pantalla se
  // comporta exactamente como antes de existir las listas en vez de caerse.
  // Es el mismo orden código↔migración que documenta lib/studio/rate-queries.ts.
  let books: PriceBookOption[] = [];
  try {
    books = await listPriceBooks(supabase);
  } catch {
    books = [];
  }

  const casa = books.find((b) => b.isHouse) ?? null;
  const activa = books.find((b) => b.id === filters.priceBookId) ?? casa;

  const rates = await listRates(supabase, {
    ...filters,
    priceBookId: activa?.id,
  });

  return (
    <TarifasClient
      rates={rates}
      filters={filters}
      books={books}
      activeBook={activa}
    />
  );
}
