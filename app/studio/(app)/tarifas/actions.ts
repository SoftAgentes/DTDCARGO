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
    valid_until: parseStringOrNull(formData.get("valid_until")),
    notes: parseStringOrNull(formData.get("notes")),
  };
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
      valid_until: input!.valid_until,
      notes: input!.notes,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !inserted) {
    return {
      error: `No se pudo crear la tarifa: ${error?.message ?? "desconocido"}`,
    };
  }

  revalidatePath("/studio/tarifas");
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
      valid_until: input!.valid_until,
      notes: input!.notes,
    })
    .eq("id", id);

  if (error) {
    return { error: `No se pudo guardar la tarifa: ${error.message}` };
  }

  revalidatePath("/studio/tarifas");
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
  return { ok: true };
}
