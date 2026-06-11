/**
 * Geocoding helper · address → lat/lng usando OpenStreetMap Nominatim.
 *
 * Free, sin API key. Rate limit: 1 req/sec (respetamos via cache + UX).
 * Para volumen > ~1k req/día migrar a Mapbox / Google Maps.
 *
 * Usado por ClientDrawer · botón "Buscar desde dirección".
 */

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "DTD-Cargo-ERP/1.0 (bigbonnysam@gmail.com)";

export type GeocodeResult = {
  lat: number;
  lng: number;
  displayName: string;
};

export async function geocodeAddress(
  address: string,
  opts: { countryCode?: string } = {},
): Promise<
  | { ok: true; result: GeocodeResult }
  | { ok: false; error: string }
> {
  const trimmed = address.trim();
  if (!trimmed) return { ok: false, error: "Dirección vacía." };
  if (trimmed.length < 5) {
    return { ok: false, error: "Dirección demasiado corta." };
  }

  const params = new URLSearchParams({
    q: trimmed,
    format: "json",
    limit: "1",
    addressdetails: "0",
  });
  if (opts.countryCode) params.set("countrycodes", opts.countryCode);

  try {
    const res = await fetch(`${NOMINATIM_BASE}?${params.toString()}`, {
      headers: { "User-Agent": USER_AGENT },
      // Nominatim no permite caching agresivo; respect their guidelines.
      cache: "no-store",
    });

    if (!res.ok) {
      return {
        ok: false,
        error: `Nominatim HTTP ${res.status}`,
      };
    }

    const data = (await res.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
    }>;

    if (!Array.isArray(data) || data.length === 0) {
      return {
        ok: false,
        error: "Sin resultados para esa dirección. Prueba agregar ciudad y estado.",
      };
    }

    const hit = data[0];
    const lat = Number(hit.lat);
    const lng = Number(hit.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return { ok: false, error: "Respuesta inválida del servidor de geocoding." };
    }

    return {
      ok: true,
      result: {
        lat,
        lng,
        displayName: hit.display_name,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error de red",
    };
  }
}
