/**
 * SDD-0674 · EXC-0674 — Lectura de la lista transitoria y de lo ya facturado.
 *
 * Usa la sesión del usuario y su RLS (migr 0564): solo `accounting` y `admin` de su tenant ven
 * filas. No lee `invoices`. El rastro `exc0674_facturas` guarda el código, el total
 * tecleado y a quién se facturó, así que la frontera SDD-0357 no cambia (ver la nota EXC-0674 en
 * `scripts/__tests__/invoice-read-boundary.test.mjs`).
 *
 * Devuelve `{ estado: "no_disponible" }` si una lectura falla: sin la 0564, PostgREST responde
 * PGRST205 (o 42P01) y el botón no se pinta.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { claveMarkbox, type FacturacionExc0674, type FacturadoExc0674 } from "./exc0674";

type Fila = Record<string, unknown>;

export async function leerFacturacionExc0674(
  supabase: SupabaseClient,
  contenedorIds: readonly string[],
): Promise<FacturacionExc0674> {
  const ids = [...new Set(contenedorIds.filter((x) => !!x))];
  if (ids.length === 0) return { estado: "lista", contenedores: [], facturados: {} };

  const lista = await supabase
    .from("exc0674_contenedores")
    .select("consolidation_id")
    .in("consolidation_id", ids);
  if (lista.error) return { estado: "no_disponible" };
  const contenedores = ((lista.data ?? []) as Fila[])
    .map((r) => (typeof r.consolidation_id === "string" ? r.consolidation_id : null))
    .filter((x): x is string => !!x);
  if (contenedores.length === 0) return { estado: "lista", contenedores: [], facturados: {} };

  const hechas = await supabase
    .from("exc0674_facturas")
    .select("consolidation_id, client_markbox, invoice_code, total_usd, billed_markbox")
    .in("consolidation_id", contenedores)
    // Una factura anulada en Facturación deja de contar: el cliente se puede volver a facturar.
    .is("anulada_at", null)
    .order("consolidation_id")
    .order("client_markbox");
  if (hechas.error) return { estado: "no_disponible" };

  const facturados: Record<string, Record<string, FacturadoExc0674>> = {};
  for (const r of (hechas.data ?? []) as Fila[]) {
    const cons = typeof r.consolidation_id === "string" ? r.consolidation_id : null;
    const mb = claveMarkbox(typeof r.client_markbox === "string" ? r.client_markbox : "");
    if (!cons || !mb) continue;
    (facturados[cons] ??= {})[mb] = {
      invoiceCode: String(r.invoice_code ?? ""),
      totalUsd: Number(r.total_usd ?? 0),
      billedMarkbox: String(r.billed_markbox ?? ""),
    };
  }
  return { estado: "lista", contenedores, facturados };
}
