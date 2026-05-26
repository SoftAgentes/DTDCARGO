/**
 * Server actions CRUD de rutas y ciudades + seed del catálogo VE público.
 * SDD-0029 §3.7.
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import {
  validateCityInput,
  validateRouteInput,
  type CityInput,
  type DispatchRouteType,
  type IntermediateCity,
  type RouteInput,
  type RoutesActionState,
} from "@/lib/studio/dispatch-routes-types";
import type { DispatchHub } from "@/lib/studio/dispatch-types";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function parseStringOrNull(v: FormDataEntryValue | null): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}
function parseNumber(v: FormDataEntryValue | null): number {
  if (v == null) return 0;
  const n = Number(String(v));
  return Number.isFinite(n) ? n : 0;
}
function parseBool(v: FormDataEntryValue | null): boolean {
  if (v == null) return false;
  const s = String(v).trim().toLowerCase();
  return s === "true" || s === "1" || s === "on";
}
function parseIntermediates(v: FormDataEntryValue | null): IntermediateCity[] {
  if (v == null) return [];
  const raw = String(v).trim();
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((it: unknown) => {
        const o = it as Record<string, unknown>;
        return {
          city: String(o.city ?? "").trim(),
          radius_km: Number(o.radius_km ?? 0),
          order: Number(o.order ?? 0),
        };
      })
      .filter((ic) => ic.city);
  } catch {
    return [];
  }
}

async function resolveTenantId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  return link?.tenant_id ?? null;
}

// ─────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────

export async function createRouteAction(
  _prev: RoutesActionState,
  formData: FormData,
): Promise<RoutesActionState> {
  const supabase = await createClient();

  const partial: Partial<RouteInput> = {
    name: parseStringOrNull(formData.get("name")) ?? undefined,
    route_type: (parseStringOrNull(formData.get("route_type")) as DispatchRouteType) ?? "directa",
    hub: (parseStringOrNull(formData.get("hub")) as DispatchHub) ?? undefined,
    origin_city: parseStringOrNull(formData.get("origin_city")) ?? undefined,
    destination_city: parseStringOrNull(formData.get("destination_city")) ?? undefined,
    intermediate_cities: parseIntermediates(formData.get("intermediate_cities")),
    sla_hours: parseNumber(formData.get("sla_hours")),
    active: parseBool(formData.get("active")),
    notes: parseStringOrNull(formData.get("notes")),
  };

  const { input, fieldErrors } = validateRouteInput(partial);
  if (fieldErrors) return { fieldErrors };

  const tenantId = await resolveTenantId();
  if (!tenantId) return { error: "No se pudo resolver el tenant." };

  // Generar route_code via RPC
  const { data: codeRaw, error: codeErr } = await supabase.rpc("next_route_code", {
    p_tenant_id: tenantId,
  });
  if (codeErr || !codeRaw) return { error: `No se pudo generar route_code: ${codeErr?.message}` };

  const { data: created, error } = await supabase
    .from("dispatch_routes")
    .insert({
      tenant_id: tenantId,
      route_code: String(codeRaw),
      name: input!.name,
      route_type: input!.route_type,
      hub: input!.hub,
      origin_city: input!.origin_city,
      destination_city: input!.destination_city,
      intermediate_cities: input!.intermediate_cities,
      sla_hours: input!.sla_hours,
      active: input!.active,
      notes: input!.notes,
    })
    .select("id, route_code")
    .single<{ id: string; route_code: string }>();

  if (error || !created) {
    return { error: `No se pudo crear la ruta: ${error?.message}` };
  }

  revalidatePath("/studio/admin/rutas");
  revalidatePath("/studio/despacho");
  return { ok: true, createdId: created.id, createdCode: created.route_code };
}

export async function updateRouteAction(
  _prev: RoutesActionState,
  formData: FormData,
): Promise<RoutesActionState> {
  const supabase = await createClient();

  const id = parseStringOrNull(formData.get("id"));
  if (!id) return { fieldErrors: { id: "Falta el ID de la ruta." } };

  const partial: Partial<RouteInput> = {
    name: parseStringOrNull(formData.get("name")) ?? undefined,
    route_type: (parseStringOrNull(formData.get("route_type")) as DispatchRouteType) ?? "directa",
    hub: (parseStringOrNull(formData.get("hub")) as DispatchHub) ?? undefined,
    origin_city: parseStringOrNull(formData.get("origin_city")) ?? undefined,
    destination_city: parseStringOrNull(formData.get("destination_city")) ?? undefined,
    intermediate_cities: parseIntermediates(formData.get("intermediate_cities")),
    sla_hours: parseNumber(formData.get("sla_hours")),
    active: parseBool(formData.get("active")),
    notes: parseStringOrNull(formData.get("notes")),
  };

  const { input, fieldErrors } = validateRouteInput(partial);
  if (fieldErrors) return { fieldErrors };

  const { error } = await supabase
    .from("dispatch_routes")
    .update({
      name: input!.name,
      route_type: input!.route_type,
      hub: input!.hub,
      origin_city: input!.origin_city,
      destination_city: input!.destination_city,
      intermediate_cities: input!.intermediate_cities,
      sla_hours: input!.sla_hours,
      active: input!.active,
      notes: input!.notes,
    })
    .eq("id", id);

  if (error) return { error: `No se pudo actualizar: ${error.message}` };

  revalidatePath("/studio/admin/rutas");
  revalidatePath("/studio/despacho");
  return { ok: true };
}

export async function softDeleteRouteAction(
  _prev: RoutesActionState,
  formData: FormData,
): Promise<RoutesActionState> {
  const supabase = await createClient();
  const id = parseStringOrNull(formData.get("id"));
  if (!id) return { fieldErrors: { id: "Falta el ID de la ruta." } };

  const { error } = await supabase
    .from("dispatch_routes")
    .update({ deleted_at: new Date().toISOString(), active: false })
    .eq("id", id);

  if (error) return { error: `No se pudo eliminar: ${error.message}` };

  revalidatePath("/studio/admin/rutas");
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Cities (per-tenant catalog)
// ─────────────────────────────────────────────────────────────

export async function createCityAction(
  _prev: RoutesActionState,
  formData: FormData,
): Promise<RoutesActionState> {
  const supabase = await createClient();

  const partial: Partial<CityInput> = {
    state_code: parseStringOrNull(formData.get("state_code")) ?? undefined,
    state_name: parseStringOrNull(formData.get("state_name")) ?? undefined,
    municipio: parseStringOrNull(formData.get("municipio")) ?? undefined,
    city: parseStringOrNull(formData.get("city")) ?? undefined,
    postal_code: parseStringOrNull(formData.get("postal_code")),
    default_radius_km: parseNumber(formData.get("default_radius_km")),
    is_hq: parseBool(formData.get("is_hq")),
    active: parseBool(formData.get("active")),
  };

  const { input, fieldErrors } = validateCityInput(partial);
  if (fieldErrors) return { fieldErrors };

  const tenantId = await resolveTenantId();
  if (!tenantId) return { error: "No se pudo resolver el tenant." };

  const { data: created, error } = await supabase
    .from("dispatch_city_catalog")
    .insert({ tenant_id: tenantId, ...input! })
    .select("id")
    .single<{ id: string }>();

  if (error || !created) {
    if (error?.code === "23505") {
      return { error: "Esta ciudad ya existe en tu catálogo." };
    }
    return { error: `No se pudo crear la ciudad: ${error?.message}` };
  }

  revalidatePath("/studio/admin/rutas");
  return { ok: true, createdId: created.id };
}

export async function updateCityAction(
  _prev: RoutesActionState,
  formData: FormData,
): Promise<RoutesActionState> {
  const supabase = await createClient();

  const id = parseStringOrNull(formData.get("id"));
  if (!id) return { fieldErrors: { id: "Falta el ID de la ciudad." } };

  const partial: Partial<CityInput> = {
    state_code: parseStringOrNull(formData.get("state_code")) ?? undefined,
    state_name: parseStringOrNull(formData.get("state_name")) ?? undefined,
    municipio: parseStringOrNull(formData.get("municipio")) ?? undefined,
    city: parseStringOrNull(formData.get("city")) ?? undefined,
    postal_code: parseStringOrNull(formData.get("postal_code")),
    default_radius_km: parseNumber(formData.get("default_radius_km")),
    is_hq: parseBool(formData.get("is_hq")),
    active: parseBool(formData.get("active")),
  };

  const { input, fieldErrors } = validateCityInput(partial);
  if (fieldErrors) return { fieldErrors };

  const { error } = await supabase
    .from("dispatch_city_catalog")
    .update(input!)
    .eq("id", id);

  if (error) return { error: `No se pudo actualizar: ${error.message}` };

  revalidatePath("/studio/admin/rutas");
  return { ok: true };
}

export async function softDeleteCityAction(
  _prev: RoutesActionState,
  formData: FormData,
): Promise<RoutesActionState> {
  const supabase = await createClient();
  const id = parseStringOrNull(formData.get("id"));
  if (!id) return { fieldErrors: { id: "Falta el ID de la ciudad." } };

  const { error } = await supabase
    .from("dispatch_city_catalog")
    .update({ active: false })
    .eq("id", id);

  if (error) return { error: `No se pudo desactivar: ${error.message}` };

  revalidatePath("/studio/admin/rutas");
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Seed catálogo VE público → ciudades del tenant
// ─────────────────────────────────────────────────────────────

export async function seedTenantCitiesFromVeCatalogAction(
  _prev: RoutesActionState,
  _formData: FormData,
): Promise<RoutesActionState> {
  const supabase = await createClient();
  const tenantId = await resolveTenantId();
  if (!tenantId) return { error: "No se pudo resolver el tenant." };

  const { data, error } = await supabase.rpc("seed_tenant_cities_from_ve_catalog", {
    p_tenant_id: tenantId,
  });

  if (error) return { error: `No se pudo seedear: ${error.message}` };

  const inserted = Number(data ?? 0);
  revalidatePath("/studio/admin/rutas");
  return {
    ok: true,
    createdCode: inserted > 0 ? `${inserted} ciudades agregadas` : "Catálogo ya estaba sincronizado",
  };
}
