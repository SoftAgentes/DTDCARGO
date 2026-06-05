/**
 * Server actions del módulo Tarifas (SDD-0008).
 *
 * - createRate: crea una tarifa nueva
 * - updateRate: edita una tarifa existente
 * - softDeleteRate: setea deleted_at = now()
 *
 * Validación con validateRateInput() — sin zod, sigue el patrón del proyecto.
 * RLS filtra por tenant_id automáticamente (no se pasa).
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import {
  validateRateInput,
  type RateActionState,
  type RateInput,
} from "@/lib/studio/rate-types";
import type { ShipmentService } from "@/lib/studio/shipment-types";
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
import {
  parseRatesCsv,
  rateDedupKey,
  type RateImportPreview,
} from "@/lib/studio/rate-import";

const VALID_SERVICES: ShipmentService[] = [
  "consolidacion",
  "puerta_a_puerta_DDP",
  "reserva_FCL",
  "transporte_terrestre",
];

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

function inputFromFormData(formData: FormData): Partial<RateInput> {
  const serviceRaw = String(formData.get("service") ?? "");
  const service = (VALID_SERVICES as string[]).includes(serviceRaw)
    ? (serviceRaw as ShipmentService)
    : undefined;

  return {
    service,
    origin: parseStringOrNull(formData.get("origin")) ?? undefined,
    destination: parseStringOrNull(formData.get("destination")) ?? undefined,
    per_cbm: parseNumberOrNull(formData.get("per_cbm")),
    flat_rate: parseNumberOrNull(formData.get("flat_rate")),
    min_charge: parseNumberOrNull(formData.get("min_charge")),
    transit_days: (() => {
      const n = parseNumberOrNull(formData.get("transit_days"));
      return n == null ? null : Math.round(n);
    })(),
    valid_from: parseStringOrNull(formData.get("valid_from")),
    valid_until: parseStringOrNull(formData.get("valid_until")),
    is_public: (() => {
      const v = formData.get("is_public");
      return v === "on" || v === "true" || v === "1";
    })(),
    notes: parseStringOrNull(formData.get("notes")),
  };
}

/** Mensaje amigable cuando se intenta marcar una 2ª tarifa como pública. */
const PUBLIC_RATE_CONFLICT_MSG =
  "Ya hay otra tarifa marcada como pública del calculador. Desmarcá esa primero.";

/** ¿El error es la violación del índice único parcial de tarifa pública? */
function isPublicRateConflict(
  error: { code?: string; message?: string } | null,
): boolean {
  if (!error) return false;
  return (
    error.code === "23505" &&
    (error.message ?? "").includes("rates_one_public_cbm")
  );
}

export async function createRate(
  _prev: RateActionState,
  formData: FormData,
): Promise<RateActionState> {
  const supabase = await createClient();

  const partial = inputFromFormData(formData);
  const { input, fieldErrors } = validateRateInput(partial);
  if (fieldErrors) return { fieldErrors };

  // tenant_id viene de la sesión via función RLS, pero NEEDed para el insert.
  // Hacemos un select previo del propio user_tenants para resolverlo.
  const { data: link, error: linkErr } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  if (linkErr || !link?.tenant_id) {
    return { error: "No se pudo resolver el tenant del usuario." };
  }

  const { data: inserted, error } = await supabase
    .from("rates")
    .insert({
      tenant_id: link.tenant_id,
      service: input!.service,
      origin: input!.origin,
      destination: input!.destination,
      per_cbm: input!.per_cbm,
      flat_rate: input!.flat_rate,
      min_charge: input!.min_charge,
      transit_days: input!.transit_days,
      valid_from: input!.valid_from,
      valid_until: input!.valid_until,
      is_public: input!.is_public,
      notes: input!.notes,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !inserted) {
    if (isPublicRateConflict(error)) {
      return { error: PUBLIC_RATE_CONFLICT_MSG };
    }
    return {
      error: `No se pudo crear la tarifa: ${error?.message ?? "desconocido"}`,
    };
  }

  revalidatePath("/studio/tarifas");
  // La tarifa pública alimenta el calculador del sitio → refrescar su cache ISR.
  revalidatePath("/calculadora");
  return { ok: true, createdId: inserted.id };
}

export async function updateRate(
  id: string,
  _prev: RateActionState,
  formData: FormData,
): Promise<RateActionState> {
  const supabase = await createClient();

  const partial = inputFromFormData(formData);
  const { input, fieldErrors } = validateRateInput(partial);
  if (fieldErrors) return { fieldErrors };

  const { error } = await supabase
    .from("rates")
    .update({
      service: input!.service,
      origin: input!.origin,
      destination: input!.destination,
      per_cbm: input!.per_cbm,
      flat_rate: input!.flat_rate,
      min_charge: input!.min_charge,
      transit_days: input!.transit_days,
      valid_from: input!.valid_from,
      valid_until: input!.valid_until,
      is_public: input!.is_public,
      notes: input!.notes,
    })
    .eq("id", id);

  if (error) {
    if (isPublicRateConflict(error)) {
      return { error: PUBLIC_RATE_CONFLICT_MSG };
    }
    return { error: `No se pudo guardar la tarifa: ${error.message}` };
  }

  revalidatePath("/studio/tarifas");
  // La tarifa pública alimenta el calculador del sitio → refrescar su cache ISR.
  revalidatePath("/calculadora");
  return { ok: true };
}

export async function softDeleteRate(
  id: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("rates")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return { error: `No se pudo eliminar la tarifa: ${error.message}` };
  }

  revalidatePath("/studio/tarifas");
  revalidatePath("/calculadora");
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Parámetros del calculador (Fase 3 Slice A) · tabla calculator_settings.
// Upsert singleton por tenant. Alimenta el calculador público.
// ─────────────────────────────────────────────────────────────

/** camelCase (CalcParams) → columna snake_case de calculator_settings. */
const SETTINGS_COLUMN: Record<keyof CalculatorSettingsInput, string> = {
  pesoIncluidoKg: "peso_incluido_kg",
  pesoMaxKg: "peso_max_kg",
  recargoExcedenteKg: "recargo_excedente_kg",
  descuentoValencia: "descuento_valencia",
  recargoEmbalajeEspecial: "recargo_embalaje_especial",
  recargoBateriaMult: "recargo_bateria_mult",
  thresholdCascoKm: "threshold_casco_km",
  tarifaKmFueraCasco: "tarifa_km_fuera_casco",
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

  revalidatePath("/studio/tarifas");
  // Los parámetros alimentan el calculador del sitio → refrescar su cache ISR.
  revalidatePath("/calculadora");
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Helpers de tenant + admin (Slice B/C · SDD-0055)
// ─────────────────────────────────────────────────────────────

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
// Ciudades del calculador (Slice B) · tabla calculator_cities.
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
  "Ya existe una ciudad con ese identificador (slug). Usá otro.";

function isCitySlugConflict(
  error: { code?: string } | null,
): boolean {
  return error?.code === "23505";
}

export async function createCityAction(
  _prev: CalculatorCityActionState,
  formData: FormData,
): Promise<CalculatorCityActionState> {
  const supabase = await createClient();

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

  revalidatePath("/studio/tarifas");
  revalidatePath("/calculadora");
  return { ok: true, createdId: inserted.id };
}

export async function updateCityAction(
  id: string,
  _prev: CalculatorCityActionState,
  formData: FormData,
): Promise<CalculatorCityActionState> {
  const supabase = await createClient();

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

  revalidatePath("/studio/tarifas");
  revalidatePath("/calculadora");
  return { ok: true };
}

export async function deleteCityAction(
  id: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  const who = await resolveTenantAdmin(supabase);
  if (!who.ok) return { error: who.error };
  if (!who.isAdmin) return { error: CITY_ADMIN_ONLY_MSG };

  const { error } = await supabase
    .from("calculator_cities")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: `No se pudo eliminar la ciudad: ${error.message}` };

  revalidatePath("/studio/tarifas");
  revalidatePath("/calculadora");
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Estados de tarifa (Slice C) · rates.status draft|published|archived.
// Publicar = draft→published (respeta el singleton de is_public).
// Archivar = →archived (y desmarca is_public para no servir un archivado).
// ─────────────────────────────────────────────────────────────

export async function publishRateAction(
  id: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("rates")
    .update({ status: "published" })
    .eq("id", id);

  if (error) {
    // El singleton de is_public puede chocar si ya hay otra pública published.
    if (isPublicRateConflict(error)) return { error: PUBLIC_RATE_CONFLICT_MSG };
    return { error: `No se pudo publicar la tarifa: ${error.message}` };
  }

  revalidatePath("/studio/tarifas");
  revalidatePath("/calculadora");
  return { ok: true };
}

export async function archiveRateAction(
  id: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  // Al archivar, una tarifa nunca debe seguir siendo la pública del calculador.
  const { error } = await supabase
    .from("rates")
    .update({ status: "archived", is_public: false })
    .eq("id", id);

  if (error) {
    return { error: `No se pudo archivar la tarifa: ${error.message}` };
  }

  revalidatePath("/studio/tarifas");
  revalidatePath("/calculadora");
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Importador masivo (Slice C) · pega CSV → preview → insert como draft.
// Dedup por (service, origin, destination) contra el CSV y contra la DB.
// ─────────────────────────────────────────────────────────────

export type RateImportResult = {
  ok?: boolean;
  error?: string;
  /** Cantidad insertada (draft). */
  inserted?: number;
  /** Filas válidas en el CSV que ya existían en la DB (no se insertan). */
  skippedExisting?: number;
  /** Preview con el detalle por fila (para que la UI muestre el resultado). */
  preview?: RateImportPreview;
};

/**
 * Valida el CSV (sin insertar) — alimenta la preview de la UI antes de confirmar.
 */
export async function previewRatesImportAction(
  csv: string,
): Promise<RateImportPreview> {
  return parseRatesCsv(csv ?? "");
}

/**
 * Inserta las filas válidas del CSV como tarifas `draft`. Dedup contra la DB:
 * si ya existe una tarifa viva con el mismo (service, origin, destination), la
 * salta. Admin-only no es requisito (cualquier usuario del tenant edita rates),
 * pero la inserción la cubre la RLS de rates (por tenant).
 */
export async function importRatesAction(
  csv: string,
): Promise<RateImportResult> {
  const supabase = await createClient();

  const preview = parseRatesCsv(csv ?? "");
  if (preview.error) return { error: preview.error, preview };

  const valid = preview.rows
    .map((r) => r.input)
    .filter((x): x is RateInput => !!x);
  if (valid.length === 0) {
    return {
      error: "No hay filas válidas para importar.",
      preview,
    };
  }

  const who = await resolveTenantAdmin(supabase);
  if (!who.ok) return { error: who.error, preview };

  // Dedup contra la DB: traemos las llaves vivas existentes del tenant.
  const { data: existing, error: existErr } = await supabase
    .from("rates")
    .select("service, origin, destination")
    .is("deleted_at", null);
  if (existErr) {
    return { error: `No se pudo verificar duplicados: ${existErr.message}`, preview };
  }
  const existingKeys = new Set(
    ((existing as Pick<RateInput, "service" | "origin" | "destination">[] | null) ?? []).map(
      rateDedupKey,
    ),
  );

  const toInsert = valid.filter((r) => !existingKeys.has(rateDedupKey(r)));
  const skippedExisting = valid.length - toInsert.length;

  if (toInsert.length === 0) {
    return {
      ok: true,
      inserted: 0,
      skippedExisting,
      preview,
    };
  }

  const rows = toInsert.map((r) => ({
    tenant_id: who.tenantId,
    service: r.service,
    origin: r.origin,
    destination: r.destination,
    per_cbm: r.per_cbm,
    flat_rate: r.flat_rate,
    min_charge: r.min_charge,
    transit_days: r.transit_days,
    valid_from: r.valid_from,
    valid_until: r.valid_until,
    is_public: false,
    status: "draft", // importadas entran como borrador, NO van live
    notes: r.notes,
  }));

  const { error } = await supabase.from("rates").insert(rows);
  if (error) {
    return { error: `No se pudieron importar las tarifas: ${error.message}`, preview };
  }

  revalidatePath("/studio/tarifas");
  return { ok: true, inserted: toInsert.length, skippedExisting, preview };
}
