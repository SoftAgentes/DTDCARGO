/**
 * Resumen read-only del legado pendiente de migrar (SDD-0258).
 *
 * Sirve para pintar la pantalla ANTES de simular nada. El mapeo concreto NO se
 * calcula acá a propósito: lo produce la propia RPC `rename_legacy_markboxes` en
 * simulacro, para que lo que se previsualiza sea exactamente lo que se va a
 * ejecutar y no una reimplementación que puede desincronizarse.
 *
 * ⚠️ ESTE CONTEO ES ORIENTATIVO, NO AUTORITATIVO. PostgREST corta en 1000 filas
 * y esta consulta trae las fichas `DTD-*` para clasificarlas en el cliente: hoy
 * son ~440 de 447 clientes y entra holgado, pero el día que el catálogo pase de
 * mil el número se quedaría corto EN SILENCIO. El número que manda es el
 * `pendientes_despues` que devuelve la RPC, que lo cuenta en la base.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { LegacyResumen } from "./markbox-legacy-types";

/**
 * Espejo del predicado de la migr 0370 — si cambia allá, cambia acá.
 *
 * Un código de vendedor es `DTD-` + UNA letra + un DÍGITO. Las `DTD-LEG-*`
 * llevan tres letras y quedan fuera (decisión del founder, 2026-08-14).
 * ⚠️ Sin anclar al final a propósito: en prod hay una ficha `DTD-A102-`, de la
 * serie A con un guion de más, y anclar la dejaría fuera en silencio.
 */
const LEGADO_RE = /^DTD-[A-Za-z]\d/;

export async function getLegacyResumen(supabase: SupabaseClient): Promise<LegacyResumen> {
  const { data, error } = await supabase
    .from("clients")
    .select("markbox")
    .is("deleted_at", null)
    .is("merged_into_client_id", null)
    .is("aliado_id", null)
    .like("markbox", "DTD-%");

  if (error) throw error;

  const pendientes = (data ?? [])
    .map((r) => String(r.markbox ?? ""))
    .filter((m) => LEGADO_RE.test(m));

  const conteo = new Map<string, number>();
  for (const m of pendientes) {
    // La letra del vendedor. Se normaliza a mayúscula: hay 13 fichas con la
    // letra en minúscula (`DTD-j029`) y son la misma serie.
    const serie = m.slice(4, 5).toUpperCase();
    conteo.set(serie, (conteo.get(serie) ?? 0) + 1);
  }

  return {
    pendientes: pendientes.length,
    porSerie: [...conteo.entries()]
      .map(([serie, fichas]) => ({ serie, fichas }))
      .sort((a, b) => b.fichas - a.fichas),
  };
}
