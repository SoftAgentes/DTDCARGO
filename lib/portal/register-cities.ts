import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Catálogo de ciudades para el registro (SDD-0225 punto 3 · migr 0348).
 *
 * Sale de `ve_locality_catalog` (24 estados · 98 ciudades · IPOSTEL) y NO de
 * `calculator_cities`: esa tiene más ciudades (179) pero **no tiene estado**, y
 * lo que pidió el founder es que el estado se autocomplete al elegir la ciudad
 * en vez de que el cliente lo escriba a mano.
 *
 * Devuelve la lista YA aplanada y sin repetidos: el catálogo trae una fila por
 * ciudad/municipio, así que la misma ciudad puede aparecer más de una vez.
 */

export type RegisterCity = {
  /** Nombre visible y valor que se guarda en `clients.city`. */
  city: string;
  /** Estado al que pertenece — se guarda en `clients.state`. */
  state: string;
};

/**
 * Lee el catálogo para el selector del registro. Ordenado por ciudad.
 *
 * Falla BLANDO a propósito (`[]` ante cualquier error): sin catálogo el
 * formulario degrada a texto libre y el alta sigue funcionando. Un fallo leyendo
 * una lista de ciudades no puede costarnos un cliente.
 */
export async function listRegisterCities(
  supabase: SupabaseClient,
): Promise<RegisterCity[]> {
  const { data, error } = await supabase
    .from("ve_locality_catalog")
    .select("city, state_name")
    .order("city", { ascending: true });

  if (error || !data) return [];

  const vistas = new Set<string>();
  const out: RegisterCity[] = [];
  for (const row of data as { city: string; state_name: string }[]) {
    const city = (row.city ?? "").trim();
    const state = (row.state_name ?? "").trim();
    if (!city || !state) continue;
    const clave = `${city.toLowerCase()}|${state.toLowerCase()}`;
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    out.push({ city, state });
  }
  return out;
}
