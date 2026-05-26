/**
 * Tipos del catálogo público VE (SDD-0029 §3.3).
 * Matchea tabla pública ve_locality_catalog (24 estados · ~98 ciudades · IPOSTEL).
 */

export type VeLocalityEntry = {
  state_code: string;
  state_name: string;
  state_region: string;
  state_capital: string;
  municipio: string;
  city: string;
  postal_code: string;
  parroquias: string[];
  barrios: string[];
};

export type VeRegion = string;

/** Groupado por estado, listo para render en selectores cascade. */
export type VeStatesByRegion = Record<VeRegion, Array<{
  state_code: string;
  state_name: string;
  state_capital: string;
  city_count: number;
}>>;

export function groupCatalogByRegion(catalog: VeLocalityEntry[]): VeStatesByRegion {
  const map: Record<string, Map<string, { state_name: string; state_capital: string; city_count: number }>> = {};

  for (const entry of catalog) {
    if (!map[entry.state_region]) map[entry.state_region] = new Map();
    const region = map[entry.state_region];
    const existing = region.get(entry.state_code);
    if (existing) {
      existing.city_count += 1;
    } else {
      region.set(entry.state_code, {
        state_name: entry.state_name,
        state_capital: entry.state_capital,
        city_count: 1,
      });
    }
  }

  const result: VeStatesByRegion = {};
  for (const [region, states] of Object.entries(map)) {
    result[region] = Array.from(states.entries())
      .map(([code, info]) => ({ state_code: code, ...info }))
      .sort((a, b) => a.state_name.localeCompare(b.state_name));
  }
  return result;
}

/** Filtra el catálogo público a las ciudades de un estado. */
export function citiesOfState(
  catalog: VeLocalityEntry[],
  state_code: string,
): VeLocalityEntry[] {
  return catalog.filter((c) => c.state_code === state_code);
}

/** Búsqueda por substring case-insensitive en city/municipio/state_name/postal_code. */
export function searchCatalog(
  catalog: VeLocalityEntry[],
  query: string,
): VeLocalityEntry[] {
  if (!query.trim()) return catalog;
  const q = query.trim().toLowerCase();
  return catalog.filter(
    (c) =>
      c.city.toLowerCase().includes(q) ||
      c.municipio.toLowerCase().includes(q) ||
      c.state_name.toLowerCase().includes(q) ||
      c.postal_code.includes(q),
  );
}
