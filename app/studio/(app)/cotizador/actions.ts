/**
 * Server actions del módulo Estimados (ex-Cotizador · SDD-0011, renombrado en SDD-0061).
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
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import { createAdminClient } from "@/lib/db/admin";
import {
  enqueueKommoWriteback,
  enqueueKommoStageWriteback,
} from "@/lib/studio/kommo-writeback";
import {
  calcQuoteTotal,
  validateQuoteInput,
  type QuoteActionState,
  type QuoteInput,
} from "@/lib/studio/quote-types";
import {
  linkEstimateToClient,
  suggestRateForQuote,
} from "@/lib/studio/quote-queries";
import type { Rate } from "@/lib/studio/rate-types";
import {
  type ShipmentService,
  SERVICE_LABELS,
} from "@/lib/studio/shipment-types";
import { fireMailEvent } from "@/lib/studio/mail/mail-rule-engine";
import type { MailRuleEvent } from "@/lib/studio/mail-types";

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
  const denial = await moduleEditDenial(supabase, "quotes");
  if (denial) return { error: denial };


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

  // Generar el código del estimado atómico (EST-YYYY-NNNN, SDD-0061 Fase C).
  // La columna sigue siendo `quote_code` (sin DDL); solo cambia el prefijo.
  const { data: codeData, error: codeErr } = await supabase.rpc(
    "next_estimate_code",
    { p_tenant_id: link.tenant_id },
  );
  if (codeErr || !codeData) {
    return { error: "No se pudo generar el código del estimado." };
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
    return { error: `No se pudo crear el estimado: ${error.message}` };
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
  const denial = await moduleEditDenial(supabase, "quotes");
  if (denial) return { error: denial };


  // Validar que sigue siendo draft (defensa server-side)
  const { data: current, error: readErr } = await supabase
    .from("quotes")
    .select("status, quote_code")
    .eq("id", id)
    .maybeSingle();
  if (readErr || !current) {
    return { error: "Estimado no encontrado." };
  }
  if (current.status !== "draft") {
    return { error: "Solo los estimados en borrador pueden editarse." };
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
    .select(
      "id, tenant_id, status, quote_code, client_name, client_markbox, prospect_email, service, origin, destination, cbm, total_usd, valid_until",
    )
    .eq("id", id)
    .maybeSingle<{
      id: string;
      tenant_id: string;
      status: string;
      quote_code: string;
      client_name: string | null;
      client_markbox: string | null;
      prospect_email: string | null;
      service: ShipmentService;
      origin: string | null;
      destination: string | null;
      cbm: number | null;
      total_usd: number | null;
      valid_until: string | null;
    }>();
  if (readErr || !current) return { error: "Estimado no encontrado." };

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

  // Admin client compartido por los efectos best-effort post-transición (mailing +
  // write-back de valor y de etapa). Ninguno debe romper la transición del estimado.
  const admin = createAdminClient();

  // Disparar reglas de mailing según la transición (best-effort).
  const mailEvent: MailRuleEvent | null =
    to === "sent" ? "quote_sent" : to === "accepted" ? "quote_accepted" : null;

  if (mailEvent) {
    const validityDays = current.valid_until
      ? Math.max(
          0,
          Math.ceil(
            (new Date(current.valid_until).getTime() - Date.now()) /
              (1000 * 60 * 60 * 24),
          ),
        )
      : 30;

    const svcLabel = SERVICE_LABELS[current.service];
    const serviceText = svcLabel
      ? svcLabel.sub
        ? `${svcLabel.primary} (${svcLabel.sub})`
        : svcLabel.primary
      : current.service;

    await fireMailEvent(admin, current.tenant_id, {
      event: mailEvent,
      vars: {
        customer_name: current.client_name ?? "cliente",
        quote_code: current.quote_code,
        origin: current.origin ?? "—",
        destination: current.destination ?? "—",
        service: serviceText,
        cbm: current.cbm != null ? String(current.cbm) : "—",
        total_usd:
          current.total_usd != null
            ? Number(current.total_usd).toFixed(2)
            : "—",
        validity_days: String(validityDays),
      },
      clientMarkbox: current.client_markbox,
      // SDD-0061: estimado web sin markbox → el mail va al prospecto.
      prospectEmail: current.prospect_email,
      clientName: current.client_name,
      sourceRef: { kind: "quote", id: current.id },
    });

    // SDD-0083 Slice B — write-back del valor a Kommo (best-effort, dry-run por
    // default). Si el estimado tiene cliente con lead vinculado, encola un
    // patch_price (total_usd → price del lead) que apaga la ceguera del $0. NO
    // escribe a Kommo desde acá: solo encola; la edge function kommo-writeback drena
    // con el token de Vault. Un fallo nunca rompe la transición del estimado.
    await enqueueKommoWriteback(admin, current.tenant_id, {
      clientMarkbox: current.client_markbox,
      totalUsd: current.total_usd,
    });
  }

  // SDD-0084 — write-back de ETAPA a Kommo (best-effort, dry-run por default).
  // Mueve el lead a la etapa que el founder mapeó para el nuevo estado. Dispara en
  // las 3 transiciones (incl. rejected → etapa de perdido, que limpia el cementerio
  // del tablero SDD-0078). Inerte hasta que exista el mapa; hereda el gate del valor.
  await enqueueKommoStageWriteback(admin, current.tenant_id, {
    clientMarkbox: current.client_markbox,
    estimateStatus: to,
  });

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
  const denial = await moduleEditDenial(supabase, "quotes");
  if (denial) return { error: denial };


  // Leer la quote completa
  const { data: quote, error: readErr } = await supabase
    .from("quotes")
    .select(
      "id, tenant_id, quote_code, client_markbox, client_name, service, origin, destination, cbm, weight_kg, boxes, status, converted_to_shipment_id, notes, total_usd",
    )
    .eq("id", id)
    .maybeSingle();
  if (readErr || !quote) return { error: "Estimado no encontrado." };

  if (quote.status !== "accepted") {
    return { error: "Solo estimados aceptados pueden convertirse." };
  }
  if (quote.converted_to_shipment_id) {
    return { error: "Este estimado ya fue convertido a un embarque." };
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
      notes: `Convertido desde estimado ${quote.quote_code} · Total $${Number(quote.total_usd).toFixed(2)}${quote.notes ? `\n\n${quote.notes}` : ""}`,
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

/**
 * SDD-0061 Fase B2 · Slice 3 — vínculo manual de un estimado web a un cliente
 * por MARKBOX (red de seguridad para los casos ambiguos que no resolvió el
 * vínculo automático del registro). La validación vive en la query pura.
 */
export async function linkEstimateToClientAction(
  quoteId: string,
  markbox: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const result = await linkEstimateToClient(supabase, quoteId, markbox);
  if (result.error) return { error: result.error };

  revalidatePath("/studio/cotizador");
  return { ok: true };
}

export async function softDeleteQuote(
  id: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "quotes");
  if (denial) return { error: denial };


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
