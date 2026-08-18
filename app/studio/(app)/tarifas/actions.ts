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
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import {
  validateRateInput,
  type RateActionState,
  type RateInput,
} from "@/lib/studio/rate-types";
import {
  isShipmentService,
} from "@/lib/studio/shipment-types";
import {
  parseRatesCsv,
  rateDedupKey,
  type RateImportPreview,
} from "@/lib/studio/rate-import";

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
  const service = isShipmentService(serviceRaw)
    ? serviceRaw
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

/**
 * El candado de la migr 0382: sólo una tarifa de la lista de la casa puede ser
 * la pública del sitio. Sin traducirlo, el founder vería el texto crudo de un
 * `raise` de Postgres y no sabría qué hacer con él.
 */
function esTarifaDeAliadoPublicada(
  error: { code?: string; message?: string } | null,
): boolean {
  if (!error) return false;
  return (
    error.code === "23514" &&
    (error.message ?? "").includes("lista de la casa")
  );
}

const ALIADO_PUBLIC_MSG =
  "La calculadora del sitio sólo puede mostrar una tarifa de la lista de la casa. " +
  "Esta pertenece a un aliado: publicarla sería mostrar su precio negociado en la web.";

export async function createRate(
  _prev: RateActionState,
  formData: FormData,
): Promise<RateActionState> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "rates");
  if (denial) return { error: denial };


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
      // La lista en la que nace (SDD-0269). Si no viene, el trigger
      // `rates_guard_price_book_t` la manda a la de la casa — que es lo que
      // hace el código ya desplegado, y por eso la columna es nullable.
      price_book_id: parseStringOrNull(formData.get("price_book_id")),
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !inserted) {
    if (isPublicRateConflict(error)) {
      return { error: PUBLIC_RATE_CONFLICT_MSG };
    }
    if (esTarifaDeAliadoPublicada(error)) {
      return { error: ALIADO_PUBLIC_MSG };
    }
    return {
      error: `No se pudo crear la tarifa: ${error?.message ?? "desconocido"}`,
    };
  }

  revalidatePath("/studio/tarifas");
  // La tarifa pública alimenta el calculador del sitio → refrescar su cache ISR.
  revalidatePath("/tarifas");
  return { ok: true, createdId: inserted.id };
}

export async function updateRate(
  id: string,
  _prev: RateActionState,
  formData: FormData,
): Promise<RateActionState> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "rates");
  if (denial) return { error: denial };


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
    if (esTarifaDeAliadoPublicada(error)) {
      return { error: ALIADO_PUBLIC_MSG };
    }
    return { error: `No se pudo guardar la tarifa: ${error.message}` };
  }

  revalidatePath("/studio/tarifas");
  // La tarifa pública alimenta el calculador del sitio → refrescar su cache ISR.
  revalidatePath("/tarifas");
  return { ok: true };
}

export async function softDeleteRate(
  id: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "rates");
  if (denial) return { error: denial };


  const { error } = await supabase
    .from("rates")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return { error: `No se pudo eliminar la tarifa: ${error.message}` };
  }

  revalidatePath("/studio/tarifas");
  revalidatePath("/tarifas");
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Helpers de tenant + admin (Slice B/C · SDD-0055)
//
// Los parámetros del calculador y el CRUD de ciudades se movieron a
// app/studio/(app)/admin/calculator-actions.ts (Administración › Calculadora
// pública). resolveTenantAdmin se conserva acá porque lo usa el importador CSV.
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
// Estados de tarifa (Slice C) · rates.status draft|published|archived.
// Publicar = draft→published (respeta el singleton de is_public).
// Archivar = →archived (y desmarca is_public para no servir un archivado).
// ─────────────────────────────────────────────────────────────

export async function publishRateAction(
  id: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "rates");
  if (denial) return { error: denial };


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
  revalidatePath("/tarifas");
  return { ok: true };
}

export async function archiveRateAction(
  id: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "rates");
  if (denial) return { error: denial };


  // Al archivar, una tarifa nunca debe seguir siendo la pública del calculador.
  const { error } = await supabase
    .from("rates")
    .update({ status: "archived", is_public: false })
    .eq("id", id);

  if (error) {
    return { error: `No se pudo archivar la tarifa: ${error.message}` };
  }

  revalidatePath("/studio/tarifas");
  revalidatePath("/tarifas");
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
 *
 * ⚠️ SDD-0269: el dedup es POR LISTA DE PRECIOS, no global. Que la casa ya tenga
 * «China → Venezuela» no puede impedir que Dynasty Cargo tenga la suya: el punto
 * entero de las listas es que la MISMA ruta valga distinto según a quién se le
 * cotice. Sin este scope, importar la tarifa de un aliado saltaría todas las
 * filas en silencio y el resultado diría «0 importadas, N ya existían».
 */
export async function importRatesAction(
  csv: string,
  priceBookId?: string | null,
): Promise<RateImportResult> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "rates");
  if (denial) return { error: denial };


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

  // Dedup contra la DB: las llaves vivas existentes DE ESTA LISTA.
  let dedupQuery = supabase
    .from("rates")
    .select("service, origin, destination")
    .is("deleted_at", null);
  if (priceBookId) dedupQuery = dedupQuery.eq("price_book_id", priceBookId);
  const { data: existing, error: existErr } = await dedupQuery;
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
    // La lista que se está viendo. Sin esto, importar estando en la tarifa de un
    // aliado metería sus precios en la de la casa — o sea, camino a la
    // calculadora del sitio.
    price_book_id: priceBookId ?? null,
  }));

  const { error } = await supabase.from("rates").insert(rows);
  if (error) {
    return { error: `No se pudieron importar las tarifas: ${error.message}`, preview };
  }

  revalidatePath("/studio/tarifas");
  return { ok: true, inserted: toInsert.length, skippedExisting, preview };
}
