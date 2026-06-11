/**
 * Tipos + validators de rutas y catálogo de ciudades (SDD-0029 §3.7).
 * Matchea dispatch_routes + dispatch_city_catalog.
 */

import type { DispatchHub } from "./dispatch-types";

export type DispatchRouteType = "directa" | "intermedias";

export type IntermediateCity = {
  city: string;
  radius_km: number;
  order: number;
};

export type DispatchRoute = {
  id: string;
  tenant_id: string;
  route_code: string;
  name: string;
  route_type: DispatchRouteType;
  hub: DispatchHub;
  origin_city: string;
  destination_city: string;
  intermediate_cities: IntermediateCity[];
  sla_hours: number;
  active: boolean;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type DispatchCity = {
  id: string;
  tenant_id: string;
  state_code: string;
  state_name: string;
  municipio: string;
  city: string;
  postal_code: string | null;
  default_radius_km: number;
  is_hq: boolean;
  active: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
};

// ─────────────────────────────────────────────────────────────
// Action state + validators
// ─────────────────────────────────────────────────────────────

export type RoutesActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  createdId?: string;
  createdCode?: string;
};

export type RouteInput = {
  name: string;
  route_type: DispatchRouteType;
  hub: DispatchHub;
  origin_city: string;
  destination_city: string;
  intermediate_cities: IntermediateCity[];
  sla_hours: number;
  active: boolean;
  notes: string | null;
};

export function validateRouteInput(
  input: Partial<RouteInput>,
): { input?: RouteInput; fieldErrors?: Record<string, string> } {
  const errors: Record<string, string> = {};

  const name = input.name?.trim();
  if (!name) errors.name = "Indica el nombre.";
  if (name && name.length > 200) errors.name = "Nombre demasiado largo.";

  if (!input.hub) errors.hub = "Indica el hub.";

  const origin = input.origin_city?.trim();
  if (!origin) errors.origin_city = "Indica ciudad origen.";

  const destination = input.destination_city?.trim();
  if (!destination) errors.destination_city = "Indica ciudad destino.";

  const sla = Number(input.sla_hours ?? 0);
  if (!Number.isFinite(sla) || sla <= 0) errors.sla_hours = "SLA horas debe ser > 0.";
  if (sla > 720) errors.sla_hours = "SLA horas debe ser ≤ 720 (30 días).";

  const intermediates = input.intermediate_cities ?? [];
  if (input.route_type === "intermedias" && intermediates.length === 0) {
    errors.intermediate_cities = "Ruta intermedias requiere al menos 1 ciudad intermedia.";
  }
  for (const ic of intermediates) {
    if (!ic.city || ic.radius_km <= 0) {
      errors.intermediate_cities = "Cada ciudad intermedia requiere nombre y radio_km > 0.";
      break;
    }
  }

  if (Object.keys(errors).length > 0) return { fieldErrors: errors };

  return {
    input: {
      name: name!,
      route_type: input.route_type ?? "directa",
      hub: input.hub!,
      origin_city: origin!,
      destination_city: destination!,
      intermediate_cities: intermediates,
      sla_hours: sla,
      active: input.active ?? true,
      notes: input.notes?.trim() || null,
    },
  };
}

export type CityInput = {
  state_code: string;
  state_name: string;
  municipio: string;
  city: string;
  postal_code: string | null;
  default_radius_km: number;
  is_hq: boolean;
  active: boolean;
};

export function validateCityInput(
  input: Partial<CityInput>,
): { input?: CityInput; fieldErrors?: Record<string, string> } {
  const errors: Record<string, string> = {};

  const state_code = input.state_code?.trim();
  if (!state_code) errors.state_code = "Indica el código del estado.";
  if (state_code && state_code.length > 8) errors.state_code = "Código demasiado largo.";

  const state_name = input.state_name?.trim();
  if (!state_name) errors.state_name = "Indica el nombre del estado.";

  const municipio = input.municipio?.trim();
  if (!municipio) errors.municipio = "Indica el municipio.";

  const city = input.city?.trim();
  if (!city) errors.city = "Indica la ciudad.";

  const radius = Number(input.default_radius_km ?? 5);
  if (!Number.isFinite(radius) || radius <= 0) errors.default_radius_km = "Radio debe ser > 0.";
  if (radius > 100) errors.default_radius_km = "Radio máximo 100 km.";

  if (Object.keys(errors).length > 0) return { fieldErrors: errors };

  return {
    input: {
      state_code: state_code!,
      state_name: state_name!,
      municipio: municipio!,
      city: city!,
      postal_code: input.postal_code?.trim() || null,
      default_radius_km: radius,
      is_hq: !!input.is_hq,
      active: input.active ?? true,
    },
  };
}
