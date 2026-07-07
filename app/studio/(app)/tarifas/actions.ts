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
import type { ShipmentService } from "@/lib/studio/shipment-types";
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
  revalidatePath("/calculadora");
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
  revalidatePath("/calculadora");
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
