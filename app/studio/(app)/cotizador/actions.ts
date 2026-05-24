/**
 * Server actions del módulo Cotizador (SDD-0011).
 *
 * State machine:
 *   draft → sent → accepted → (convert) → shipment
 *               ↘ rejected
 *
 * - createQuote: autogenera quote_code via rpc + insert como draft
 * - updateQuote: edit (solo permite si status=draft)
 * - markQuoteSent / Accepted / Rejected: transiciones de status
 * - convertQuoteToShipment: crea shipment con datos copiados + link bidirec
 * - softDeleteQuote: deleted_at = now()
 * - lookupSuggestedRate: helper para que el drawer llame on blur del destino
 */

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import {
  calcQuoteTotal,
  validateQuoteInput,
  type QuoteActionState,
  type QuoteInput,
} from "@/lib/studio/quote-types";
import { suggestRateForQuote } from "@/lib/studio/quote-queries";
import type { Rate } from "@/lib/studio/rate-types";
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

function inputFromFormData(formData: FormData): Partial<QuoteInput> {
  const serviceRaw = String(formData.get("service") ?? "");
  const service = (VALID_SERVICES as string[]).includes(serviceRaw)
    ? (serviceRaw as ShipmentService)
    : undefined;

  return {
    client_markbox: parseStringOrNull(formData.get("client_markbox")) ?? undefined,
    client_name: parseStringOrNull(formData.get("client_name")) ?? undefined,
    service,
    origin: parseStringOrNull(formData.get("origin")) ?? undefined,
    destination: parseStringOrNull(formData.get("destination")) ?? undefined,
    cbm: parseNumberOrNull(formData.get("cbm")),
    weight_kg: parseNumberOrNull(formData.get("weight_kg")),
    boxes: (() => {
      const n = parseNumberOrNull(formData.get("boxes"));
      return n == null ? null : Math.round(n);
    })(),
    packaging: parseStringOrNull(formData.get("packaging")) ?? "carton",
    rate_per_cbm: parseNumberOrNull(formData.get("rate_per_cbm")),
    flat_rate: parseNumberOrNull(formData.get("flat_rate")),
    rate_used_id: parseStringOrNull(formData.get("rate_used_id")),
    valid_until:
      parseStringOrNull(formData.get("valid_until")) ??
      new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10),
    notes: parseStringOrNull(formData.get("notes")),
  };
}

export async function createQuote(
  _prev: QuoteActionState,
  formData: FormData,
): Promise<QuoteActionState> {
  const supabase = await createClient();

  const partial = inputFromFormData(formData);
  const { input, fieldErrors } = validateQuoteInput(partial);
  if (fieldErrors) return { fieldErrors };

  const { data: link, error: linkErr } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  if (linkErr || !link?.tenant_id) {
    return { error: "No se pudo resolver el tenant del usuario." };
  }

  // Generar quote_code atómico
  const { data: codeData, error: codeErr } = await supabase.rpc(
    "next_quote_code",
    { p_tenant_id: link.tenant_id },
  );
  if (codeErr || !codeData) {
    return { error: "No se pudo generar el código de cotización." };
  }
  const quote_code = String(codeData);

  // Recalcular total server-side (defensa: no confiamos del client)
  const totals = calcQuoteTotal({
    service: input!.service,
    cbm: input!.cbm,
    ratePerCbm: input!.rate_per_cbm,
    flatRate: input!.flat_rate,
    packaging: input!.packaging,
  });

  const { error } = await supabase.from("quotes").insert({
    tenant_id: link.tenant_id,
    quote_code,
    client_markbox: input!.client_markbox,
    client_name: input!.client_name,
    service: input!.service,
    origin: input!.origin,
    destination: input!.destination,
    cbm: input!.cbm,
    weight_kg: input!.weight_kg,
    boxes: input!.boxes,
    packaging: input!.packaging,
    rate_per_cbm: input!.rate_per_cbm,
    flat_rate: input!.flat_rate,
    rate_used_id: input!.rate_used_id,
    subtotal_usd: totals.subtotal,
    packaging_cost: totals.packagingCost,
    total_usd: totals.total,
    valid_until: input!.valid_until,
    notes: input!.notes,
    status: "draft",
  });

  if (error) {
    return { error: `No se pudo crear la cotización: ${error.message}` };
  }

  revalidatePath("/studio/cotizador");
  return { ok: true, createdCode: quote_code };
}

export async function updateQuote(
  id: string,
  _prev: QuoteActionState,
  formData: FormData,
): Promise<QuoteActionState> {
  const supabase = await createClient();

  // Validar que sigue siendo draft (defensa server-side)
  const { data: current, error: readErr } = await supabase
    .from("quotes")
    .select("status, quote_code")
    .eq("id", id)
    .maybeSingle();
  if (readErr || !current) {
    return { error: "Cotización no encontrada." };
  }
  if (current.status !== "draft") {
    return { error: "Solo las cotizaciones en borrador pueden editarse." };
  }

  const partial = inputFromFormData(formData);
  const { input, fieldErrors } = validateQuoteInput(partial);
  if (fieldErrors) return { fieldErrors };

  const totals = calcQuoteTotal({
    service: input!.service,
    cbm: input!.cbm,
    ratePerCbm: input!.rate_per_cbm,
    flatRate: input!.flat_rate,
    packaging: input!.packaging,
  });

  const { error } = await supabase
    .from("quotes")
    .update({
      client_markbox: input!.client_markbox,
      client_name: input!.client_name,
      service: input!.service,
      origin: input!.origin,
      destination: input!.destination,
      cbm: input!.cbm,
      weight_kg: input!.weight_kg,
      boxes: input!.boxes,
      packaging: input!.packaging,
      rate_per_cbm: input!.rate_per_cbm,
      flat_rate: input!.flat_rate,
      rate_used_id: input!.rate_used_id,
      subtotal_usd: totals.subtotal,
      packaging_cost: totals.packagingCost,
      total_usd: totals.total,
      valid_until: input!.valid_until,
      notes: input!.notes,
    })
    .eq("id", id);

  if (error) {
    return { error: `No se pudo guardar: ${error.message}` };
  }

  revalidatePath("/studio/cotizador");
  revalidatePath(`/studio/cotizador/${current.quote_code}`);
  return { ok: true };
}

async function transitionStatus(
  id: string,
  from: string,
  to: "sent" | "accepted" | "rejected",
  extraFields: Record<string, string> = {},
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  const { data: current, error: readErr } = await supabase
    .from("quotes")
    .select("status, quote_code")
    .eq("id", id)
    .maybeSingle();
  if (readErr || !current) return { error: "Cotización no encontrada." };

  if (current.status !== from) {
    return {
      error: `Solo se puede pasar a "${to}" desde el estado "${from}".`,
    };
  }

  const { error } = await supabase
    .from("quotes")
    .update({ status: to, ...extraFields })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/studio/cotizador");
  revalidatePath(`/studio/cotizador/${current.quote_code}`);
  return { ok: true };
}

export async function markQuoteSent(id: string) {
  return transitionStatus(id, "draft", "sent", {
    sent_at: new Date().toISOString(),
  });
}

export async function markQuoteAccepted(id: string) {
  return transitionStatus(id, "sent", "accepted", {
    accepted_at: new Date().toISOString(),
  });
}

export async function markQuoteRejected(id: string) {
  return transitionStatus(id, "sent", "rejected");
}

export async function convertQuoteToShipment(
  id: string,
): Promise<{ ok?: boolean; error?: string; shipmentId?: string }> {
  const supabase = await createClient();

  // Leer la quote completa
  const { data: quote, error: readErr } = await supabase
    .from("quotes")
    .select(
      "id, tenant_id, quote_code, client_markbox, client_name, service, origin, destination, cbm, weight_kg, boxes, status, converted_to_shipment_id, notes, total_usd",
    )
    .eq("id", id)
    .maybeSingle();
  if (readErr || !quote) return { error: "Cotización no encontrada." };

  if (quote.status !== "accepted") {
    return { error: "Solo cotizaciones aceptadas pueden convertirse." };
  }
  if (quote.converted_to_shipment_id) {
    return { error: "Esta cotización ya fue convertida a un embarque." };
  }

  // Generar code del shipment basado en counter de shipments del tenant
  const { count: shipmentCount } = await supabase
    .from("shipments")
    .select("id", { count: "exact", head: true });
  const nextNum = (shipmentCount ?? 0) + 1;
  const shipmentCode = `DTDU-${String(nextNum).padStart(4, "0")}`;

  // Crear shipment con datos copiados
  const { data: shipment, error: insertErr } = await supabase
    .from("shipments")
    .insert({
      tenant_id: quote.tenant_id,
      code: shipmentCode,
      client_name: quote.client_name,
      client_markbox: quote.client_markbox,
      origin: quote.origin,
      destination: quote.destination,
      shipment_service: quote.service,
      status: "draft",
      weight_kg: quote.weight_kg,
      volume_m3: quote.cbm,
      notes: `Convertido desde cotización ${quote.quote_code} · Total $${Number(quote.total_usd).toFixed(2)}${quote.notes ? `\n\n${quote.notes}` : ""}`,
    })
    .select("id")
    .single();

  if (insertErr || !shipment) {
    return { error: `No se pudo crear el embarque: ${insertErr?.message}` };
  }

  // Actualizar la quote con el link bidireccional
  await supabase
    .from("quotes")
    .update({ converted_to_shipment_id: shipment.id })
    .eq("id", id);

  revalidatePath("/studio/cotizador");
  revalidatePath(`/studio/cotizador/${quote.quote_code}`);
  revalidatePath("/studio/tracking");
  return { ok: true, shipmentId: shipment.id };
}

export async function softDeleteQuote(
  id: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("quotes")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/studio/cotizador");
  return { ok: true };
}

/**
 * Lookup helper que el QuoteDrawer llama on blur del input destino.
 * Devuelve la rate sugerida para (service, destination) o null.
 */
export async function lookupSuggestedRate(
  service: ShipmentService,
  destination: string,
): Promise<{ rate: Rate | null }> {
  if (!destination?.trim()) return { rate: null };
  const supabase = await createClient();
  try {
    const rate = await suggestRateForQuote(supabase, service, destination);
    return { rate };
  } catch {
    return { rate: null };
  }
}
