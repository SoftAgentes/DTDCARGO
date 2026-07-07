/**
 * Server actions del calculador público (Administración · sección "Calculadora
 * pública"). Movido desde el módulo Tarifas: los parámetros y las ciudades del
 * calculador son configuración administrativa que se edita muy pocas veces, así
 * que viven en Administración (grupo PRO), no en Comercial.
 *
 * - saveCalculatorSettingsAction: upsert singleton de las 8 reglas escalares.
 * - createCityAction / updateCityAction / deleteCityAction: CRUD de ciudades.
 *
 * Gate: `admin` (módulo admin-only en la matriz RBAC → solo rol admin edita).
 * La RLS de calculator_settings / calculator_cities lo refuerza en la DB.
 * Validación con validate*Input() — sin zod, patrón del proyecto.
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import {
  CALC_FIELDS,
  validateCalculatorSettingsInput,
  type CalculatorSettingsActionState,
  type CalculatorSettingsInput,
} from "@/lib/studio/calculator-settings-types";
import {
  validateCityInput,
  type CalculatorCityActionState,
  type CalculatorCityInput,
} from "@/lib/studio/calculator-cities-types";

function parseNumberOrNull(v: FormDataEntryValue | null): number | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseStringOrNull(v: FormDataEntryValue | null): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

type SupabaseLike = Awaited<ReturnType<typeof createClient>>;

/**
 * Resuelve el tenant del usuario logueado y si es admin. Filtra user_tenants
 * por user_id (post-0040 ese listado expone a TODOS los miembros del tenant).
 */
async function resolveTenantAdmin(
  supabase: SupabaseLike,
): Promise<
  | { ok: true; tenantId: string; userId: string; isAdmin: boolean }
  | { ok: false; error: string }
> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return { ok: false, error: "Sesión no válida." };

  const { data: link, error } = await supabase
    .from("user_tenants")
    .select("tenant_id, role")
    .eq("user_id", userId)
    .maybeSingle<{ tenant_id: string; role: string }>();
  if (error || !link?.tenant_id) {
    return { ok: false, error: "No se pudo resolver el tenant del usuario." };
  }
  return {
    ok: true,
    tenantId: link.tenant_id,
    userId,
    isAdmin: link.role === "admin",
  };
}

// ─────────────────────────────────────────────────────────────
// Parámetros del calculador · tabla calculator_settings.
// Upsert singleton por tenant. Alimenta el calculador público.
// ─────────────────────────────────────────────────────────────

/** camelCase (CalcParams) → columna snake_case de calculator_settings. */
const SETTINGS_COLUMN: Record<keyof CalculatorSettingsInput, string> = {
  pesoIncluidoKg: "peso_incluido_kg",
  recargoExcedenteKg: "recargo_excedente_kg",
  descuentoValencia: "descuento_valencia",
  recargoEmbalajeEspecial: "recargo_embalaje_especial",
  recargoBateriaMult: "recargo_bateria_mult",
  thresholdCascoKm: "threshold_casco_km",
  tarifaKmFueraCasco: "tarifa_km_fuera_casco",
  cbmMaxContenedor: "cbm_max_contenedor",
  pesoMaxContenedorKg: "peso_max_contenedor_kg",
};

function settingsFromFormData(
  formData: FormData,
): Partial<CalculatorSettingsInput> {
  const out: Partial<CalculatorSettingsInput> = {};
  for (const f of CALC_FIELDS) {
    out[f.key] = parseNumberOrNull(formData.get(f.key)) ?? undefined;
  }
  return out;
}

export async function saveCalculatorSettingsAction(
  _prev: CalculatorSettingsActionState,
  formData: FormData,
): Promise<CalculatorSettingsActionState> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "admin");
  if (denial) return { error: denial };

  const partial = settingsFromFormData(formData);
  const { input, fieldErrors } = validateCalculatorSettingsInput(partial);
  if (fieldErrors) return { fieldErrors };

  // Resolver el usuario y su tenant. Filtramos user_tenants por user_id: tras
  // la migración 0040 ese listado expone a TODOS los miembros del tenant, así
  // que un maybeSingle() sin filtro rompería con >1 usuario.
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return { error: "Sesión no válida." };

  const { data: link, error: linkErr } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .eq("user_id", userId)
    .maybeSingle<{ tenant_id: string }>();
  if (linkErr || !link?.tenant_id) {
    return { error: "No se pudo resolver el tenant del usuario." };
  }

  // Construir el payload snake_case desde el input validado. tenant_id y
  // updated_by son server-controlled (no vienen del form) — el `with check`
  // de la RLS además impide upsertear la fila de otro tenant.
  const row: Record<string, unknown> = {
    tenant_id: link.tenant_id,
    updated_by: userId,
  };
  for (const f of CALC_FIELDS) {
    row[SETTINGS_COLUMN[f.key]] = input![f.key];
  }

  const { error } = await supabase
    .from("calculator_settings")
    .upsert(row, { onConflict: "tenant_id" });

  if (error) {
    return { error: `No se pudieron guardar los parámetros: ${error.message}` };
  }

  revalidatePath("/studio/admin");
  // Los parámetros alimentan el calculador del sitio → refrescar su cache ISR.
  revalidatePath("/calculadora");
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Ciudades del calculador · tabla calculator_cities.
// CRUD admin-only (la RLS de la migración también exige admin para write).
// ─────────────────────────────────────────────────────────────

function cityFromFormData(formData: FormData): Partial<CalculatorCityInput> {
  return {
    slug: parseStringOrNull(formData.get("slug")) ?? undefined,
    label: parseStringOrNull(formData.get("label")) ?? undefined,
    km: parseNumberOrNull(formData.get("km")) ?? undefined,
    sort_order: parseNumberOrNull(formData.get("sort_order")) ?? undefined,
    casco: (() => {
      const v = formData.get("casco");
      return v === "on" || v === "true" || v === "1";
    })(),
  };
}

const CITY_ADMIN_ONLY_MSG =
  "Solo los administradores pueden editar las ciudades del calculador.";
const CITY_SLUG_CONFLICT_MSG =
  "Ya existe una ciudad con ese identificador (slug). Usa otro.";

function isCitySlugConflict(error: { code?: string } | null): boolean {
  return error?.code === "23505";
}

export async function createCityAction(
  _prev: CalculatorCityActionState,
  formData: FormData,
): Promise<CalculatorCityActionState> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "admin");
  if (denial) return { error: denial };

  const partial = cityFromFormData(formData);
  const { input, fieldErrors } = validateCityInput(partial);
  if (fieldErrors) return { fieldErrors };

  const who = await resolveTenantAdmin(supabase);
  if (!who.ok) return { error: who.error };
  if (!who.isAdmin) return { error: CITY_ADMIN_ONLY_MSG };

  const { data: inserted, error } = await supabase
    .from("calculator_cities")
    .insert({
      tenant_id: who.tenantId,
      slug: input!.slug,
      label: input!.label,
      km: input!.km,
      casco: input!.casco,
      sort_order: input!.sort_order,
    })
    .select("id")
    .single();

  if (error) {
    if (isCitySlugConflict(error)) return { error: CITY_SLUG_CONFLICT_MSG };
    return { error: `No se pudo crear la ciudad: ${error.message}` };
  }

  revalidatePath("/studio/admin");
  revalidatePath("/calculadora");
  return { ok: true, createdId: inserted.id };
}

export async function updateCityAction(
  id: string,
  _prev: CalculatorCityActionState,
  formData: FormData,
): Promise<CalculatorCityActionState> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "admin");
  if (denial) return { error: denial };

  const partial = cityFromFormData(formData);
  const { input, fieldErrors } = validateCityInput(partial);
  if (fieldErrors) return { fieldErrors };

  const who = await resolveTenantAdmin(supabase);
  if (!who.ok) return { error: who.error };
  if (!who.isAdmin) return { error: CITY_ADMIN_ONLY_MSG };

  const { error } = await supabase
    .from("calculator_cities")
    .update({
      slug: input!.slug,
      label: input!.label,
      km: input!.km,
      casco: input!.casco,
      sort_order: input!.sort_order,
    })
    .eq("id", id);

  if (error) {
    if (isCitySlugConflict(error)) return { error: CITY_SLUG_CONFLICT_MSG };
    return { error: `No se pudo guardar la ciudad: ${error.message}` };
  }

  revalidatePath("/studio/admin");
  revalidatePath("/calculadora");
  return { ok: true };
}

export async function deleteCityAction(
  id: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "admin");
  if (denial) return { error: denial };

  const who = await resolveTenantAdmin(supabase);
  if (!who.ok) return { error: who.error };
  if (!who.isAdmin) return { error: CITY_ADMIN_ONLY_MSG };

  const { error } = await supabase
    .from("calculator_cities")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: `No se pudo eliminar la ciudad: ${error.message}` };

  revalidatePath("/studio/admin");
  revalidatePath("/calculadora");
  return { ok: true };
}
