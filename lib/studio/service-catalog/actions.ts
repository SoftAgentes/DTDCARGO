/**
 * Server actions del módulo Configuración de servicios (SDD-0076 Fase 2).
 *
 * - upsertServiceConfigAction  · guarda el contenido de un servicio (asistente)
 * - toggleServicePublishAction · publica/despublica (corre el GUARDRAIL del founder)
 * - upsert/toggle/delete FAQ   · FAQ públicas e internas
 * - upsert/delete addon        · adicionales (ADS)
 * - addPriceHistoryAction      · registra un precio en el historial
 *
 * Sin Zod (patrón del Studio). RLS filtra por tenant; igual resolvemos tenant_id
 * para el insert/upsert. El shipment_service y la validez del service_key salen del
 * catálogo de código (lib/shared/service-catalog.ts) — no del form.
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import {
  SERVICE_CATALOG_BY_ID,
  type ServicioId,
} from "@/lib/shared/service-catalog";
import {
  validateServicioConfigInput,
  servicioPublishReadiness,
  type ServicioConfigActionState,
  type ServicioConfigInput,
  type ChargeMoment,
} from "./types";
import { getServiceConfig } from "./queries";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/studio/payment-types";

type SupabaseLike = Awaited<ReturnType<typeof createClient>>;

function isServicioId(key: string): key is ServicioId {
  return key in SERVICE_CATALOG_BY_ID;
}

async function resolveTenant(
  supabase: SupabaseLike,
): Promise<
  | { ok: true; tenantId: string; userId: string }
  | { ok: false; error: string }
> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return { ok: false, error: "Sesión no válida." };

  const { data: link, error } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .eq("user_id", userId)
    .maybeSingle<{ tenant_id: string }>();
  if (error || !link?.tenant_id) {
    return { ok: false, error: "No se pudo resolver el tenant del usuario." };
  }
  return { ok: true, tenantId: link.tenant_id, userId };
}

// ── parsing FormData ─────────────────────────────────────────
function lines(v: FormDataEntryValue | null): string[] {
  if (v == null) return [];
  return String(v)
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s !== "");
}

function str(v: FormDataEntryValue | null): string {
  return v == null ? "" : String(v).trim();
}

function configFromFormData(formData: FormData): Partial<ServicioConfigInput> {
  const chargeRaw = str(formData.get("charge_moment"));
  const methods = formData
    .getAll("payment_methods")
    .map((m) => String(m))
    .filter((m): m is PaymentMethod => (PAYMENT_METHODS as string[]).includes(m));

  return {
    title_public: str(formData.get("title_public")),
    description_public: str(formData.get("description_public")),
    includes_public: lines(formData.get("includes_public")),
    excludes_public: lines(formData.get("excludes_public")),
    price_text: str(formData.get("price_text")),
    charge_moment: chargeRaw === "" ? null : (chargeRaw as ChargeMoment),
    payment_methods: methods,
    how_to_request: str(formData.get("how_to_request")),
    timelines_public: str(formData.get("timelines_public")),
    note_public: str(formData.get("note_public")) || null,
    condiciones_politicas: str(formData.get("condiciones_politicas")) || null,
    notes_internal: str(formData.get("notes_internal")) || null,
    internal_price_ref: str(formData.get("internal_price_ref")) || null,
    mapeo_contable: str(formData.get("mapeo_contable")) || null,
    service_state:
      (str(formData.get("service_state")) as ServicioConfigInput["service_state"]) ||
      "activo",
  };
}

// ── service_configs ──────────────────────────────────────────
export async function upsertServiceConfigAction(
  serviceKey: string,
  _prev: ServicioConfigActionState,
  formData: FormData,
): Promise<ServicioConfigActionState> {
  if (!isServicioId(serviceKey)) {
    return { error: "Servicio desconocido." };
  }
  const supabase = await createClient();

  const partial = configFromFormData(formData);
  const { input, fieldErrors } = validateServicioConfigInput(partial);
  if (fieldErrors) return { fieldErrors };

  const who = await resolveTenant(supabase);
  if (!who.ok) return { error: who.error };

  const entry = SERVICE_CATALOG_BY_ID[serviceKey];

  const { error } = await supabase.from("service_configs").upsert(
    {
      tenant_id: who.tenantId,
      service_key: serviceKey,
      shipment_service: entry.shipmentService, // del catálogo, no del form
      title_public: input!.title_public,
      description_public: input!.description_public,
      includes_public: input!.includes_public,
      excludes_public: input!.excludes_public,
      price_text: input!.price_text,
      charge_moment: input!.charge_moment,
      payment_methods: input!.payment_methods,
      how_to_request: input!.how_to_request,
      timelines_public: input!.timelines_public,
      note_public: input!.note_public,
      condiciones_politicas: input!.condiciones_politicas,
      notes_internal: input!.notes_internal,
      internal_price_ref: input!.internal_price_ref,
      mapeo_contable: input!.mapeo_contable,
      service_state: input!.service_state,
      updated_by: who.userId,
    },
    { onConflict: "tenant_id, service_key" },
  );

  if (error) {
    return { error: `No se pudo guardar el servicio: ${error.message}` };
  }

  revalidatePath("/studio/servicios");
  revalidatePath("/servicios"); // el sitio público consume el contenido publicado
  return { ok: true };
}

/**
 * Publica/despublica un servicio. GUARDRAIL: para publicar, lo descriptivo
 * mínimo (descripción + alcance + cómo se solicita) debe estar lleno — no se
 * publica un servicio con solo la parte contable.
 */
export async function toggleServicePublishAction(
  serviceKey: string,
  publish: boolean,
): Promise<{ ok?: boolean; error?: string }> {
  if (!isServicioId(serviceKey)) return { error: "Servicio desconocido." };
  const supabase = await createClient();

  if (publish) {
    const cfg = await getServiceConfig(supabase, serviceKey);
    if (!cfg) {
      return { error: "Primero guarda el contenido del servicio." };
    }
    const { ready, missing } = servicioPublishReadiness(cfg);
    if (!ready) {
      return {
        error: `No se puede publicar: falta ${missing.join(", ")}.`,
      };
    }
  }

  const { error } = await supabase
    .from("service_configs")
    .update({ is_public: publish })
    .eq("service_key", serviceKey);

  if (error) {
    return { error: `No se pudo actualizar la publicación: ${error.message}` };
  }

  revalidatePath("/studio/servicios");
  revalidatePath("/servicios"); // publicar/despublicar cambia lo que ve el sitio público
  return { ok: true };
}

// ── service_faqs ─────────────────────────────────────────────
export async function upsertServiceFaqAction(
  _prev: { ok?: boolean; error?: string },
  formData: FormData,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  const id = str(formData.get("id"));
  const serviceKey = str(formData.get("service_key"));
  const question = str(formData.get("question"));
  const answer = str(formData.get("answer"));
  const audience = str(formData.get("audience")) === "internal" ? "internal" : "public";
  const sortOrder = Number(str(formData.get("sort_order"))) || 0;

  if (!isServicioId(serviceKey)) return { error: "Servicio desconocido." };
  if (!question || !answer) return { error: "La FAQ necesita pregunta y respuesta." };

  const who = await resolveTenant(supabase);
  if (!who.ok) return { error: who.error };

  if (id) {
    const { error } = await supabase
      .from("service_faqs")
      .update({ question, answer, audience, sort_order: sortOrder })
      .eq("id", id);
    if (error) return { error: `No se pudo guardar la FAQ: ${error.message}` };
  } else {
    const { error } = await supabase.from("service_faqs").insert({
      tenant_id: who.tenantId,
      service_key: serviceKey,
      question,
      answer,
      audience,
      is_public: false, // nace sin publicar; se publica aparte
      sort_order: sortOrder,
      updated_by: who.userId,
    });
    if (error) return { error: `No se pudo crear la FAQ: ${error.message}` };
  }

  revalidatePath("/studio/servicios");
  return { ok: true };
}

export async function toggleFaqPublishAction(
  id: string,
  publish: boolean,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  // El CHECK de la DB ya impide publicar una FAQ interna; igual lo cortamos acá
  // con un mensaje amable.
  if (publish) {
    const { data: faq } = await supabase
      .from("service_faqs")
      .select("audience")
      .eq("id", id)
      .maybeSingle<{ audience: string }>();
    if (faq?.audience === "internal") {
      return { error: "Una FAQ interna no se publica. Cámbiala a pública primero." };
    }
  }

  const { error } = await supabase
    .from("service_faqs")
    .update({ is_public: publish })
    .eq("id", id);
  if (error) return { error: `No se pudo actualizar la FAQ: ${error.message}` };

  revalidatePath("/studio/servicios");
  return { ok: true };
}

export async function softDeleteFaqAction(
  id: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("service_faqs")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: `No se pudo eliminar la FAQ: ${error.message}` };
  revalidatePath("/studio/servicios");
  return { ok: true };
}

// ── service_addons (ADS) ─────────────────────────────────────
export async function upsertServiceAddonAction(
  _prev: { ok?: boolean; error?: string },
  formData: FormData,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  const id = str(formData.get("id"));
  const serviceKey = str(formData.get("service_key"));
  const nombre = str(formData.get("nombre"));
  const condicion = str(formData.get("condicion")) || null;
  const tarifa = str(formData.get("tarifa")) || null;
  const politica = str(formData.get("politica_texto")) || null;
  const sortOrder = Number(str(formData.get("sort_order"))) || 0;

  if (!isServicioId(serviceKey)) return { error: "Servicio desconocido." };
  if (!nombre) return { error: "El adicional necesita un nombre." };

  const who = await resolveTenant(supabase);
  if (!who.ok) return { error: who.error };

  if (id) {
    const { error } = await supabase
      .from("service_addons")
      .update({ nombre, condicion, tarifa, politica_texto: politica, sort_order: sortOrder })
      .eq("id", id);
    if (error) return { error: `No se pudo guardar el adicional: ${error.message}` };
  } else {
    const { error } = await supabase.from("service_addons").insert({
      tenant_id: who.tenantId,
      service_key: serviceKey,
      nombre,
      condicion,
      tarifa,
      politica_texto: politica,
      sort_order: sortOrder,
      updated_by: who.userId,
    });
    if (error) return { error: `No se pudo crear el adicional: ${error.message}` };
  }

  revalidatePath("/studio/servicios");
  return { ok: true };
}

export async function softDeleteAddonAction(
  id: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("service_addons")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: `No se pudo eliminar el adicional: ${error.message}` };
  revalidatePath("/studio/servicios");
  return { ok: true };
}

// ── service_price_history ────────────────────────────────────
export async function addPriceHistoryAction(
  _prev: { ok?: boolean; error?: string },
  formData: FormData,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  const serviceKey = str(formData.get("service_key"));
  const montoTexto = str(formData.get("monto_texto"));
  const moneda = str(formData.get("moneda")) || "USD";
  const validFrom = str(formData.get("valid_from"));
  const nota = str(formData.get("nota")) || null;

  if (!isServicioId(serviceKey)) return { error: "Servicio desconocido." };
  if (!montoTexto) return { error: "Indica el precio o condición." };

  const who = await resolveTenant(supabase);
  if (!who.ok) return { error: who.error };

  const { error } = await supabase.from("service_price_history").insert({
    tenant_id: who.tenantId,
    service_key: serviceKey,
    monto_texto: montoTexto,
    moneda,
    valid_from: validFrom || new Date().toISOString().slice(0, 10),
    nota,
    created_by: who.userId,
  });
  if (error) return { error: `No se pudo registrar el precio: ${error.message}` };

  revalidatePath("/studio/servicios");
  return { ok: true };
}
