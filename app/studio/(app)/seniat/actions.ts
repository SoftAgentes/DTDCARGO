/**
 * Server actions del módulo Aduana SENIAT (SDD-0018).
 *
 * - createFilingAction: insert filing + trigger DB auto-insertea 7 docs
 *   + sync shipment.status si no estaba en in_customs
 * - updateFilingAction: edit campos del filing (no incluye docs)
 * - markDocumentUploadedAction: toggle del checklist (sin upload real V1)
 * - markFilingClearedAction: cambia status a liberado + cleared_at + sync shipment
 * - changeFilingStatusAction: cambio genérico de status
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import {
  CUSTOMS_DOC_REQUIRED,
  validateFilingInput,
  type CustomsFilingActionState,
  type CustomsFilingInput,
  type CustomsStatus,
} from "@/lib/studio/customs-types";

// ─────────────────────────────────────────────────────────────
// FormData parsing helpers
// ─────────────────────────────────────────────────────────────

function parseStringOrNull(v: FormDataEntryValue | null): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function parseNumber(v: FormDataEntryValue | null): number {
  if (v == null) return 0;
  const s = String(v).trim();
  if (s === "") return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function parseHsCodes(v: FormDataEntryValue | null): string[] {
  if (v == null) return [];
  const raw = String(v).trim();
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map(String).map((s) => s.trim()).filter(Boolean);
  } catch {
    // fallback: split por coma
    return raw
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
}

function inputFromFormData(
  formData: FormData,
): Partial<CustomsFilingInput> {
  return {
    shipment_id: parseStringOrNull(formData.get("shipment_id")) ?? undefined,
    agent_id: parseStringOrNull(formData.get("agent_id")),
    port_code: parseStringOrNull(formData.get("port_code")) ?? undefined,
    hs_codes: parseHsCodes(formData.get("hs_codes_json")),
    total_duty: parseNumber(formData.get("total_duty")),
    igtf: parseNumber(formData.get("igtf")),
    iva: parseNumber(formData.get("iva")),
    agent_fee: parseNumber(formData.get("agent_fee")),
    observations: parseStringOrNull(formData.get("observations")),
  };
}

// ─────────────────────────────────────────────────────────────
// createFilingAction
// ─────────────────────────────────────────────────────────────

export async function createFilingAction(
  _prev: CustomsFilingActionState,
  formData: FormData,
): Promise<CustomsFilingActionState> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "seniat");
  if (denial) return { error: denial };


  const partial = inputFromFormData(formData);
  const { input, fieldErrors } = validateFilingInput(partial);
  if (fieldErrors) return { fieldErrors };

  const { data: link, error: linkErr } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  if (linkErr || !link?.tenant_id) {
    return { error: "No se pudo resolver el tenant." };
  }

  // Verificar que el shipment existe y no tiene filing
  const { data: existing } = await supabase
    .from("customs_filings")
    .select("id")
    .eq("shipment_id", input!.shipment_id)
    .maybeSingle();
  if (existing) {
    return { error: "Este shipment ya tiene un trámite SENIAT creado." };
  }

  // Generar DUA code
  const { data: codeData, error: codeErr } = await supabase.rpc(
    "next_dua_code",
    { p_tenant_id: link.tenant_id },
  );
  if (codeErr || !codeData) {
    return { error: "No se pudo generar el código DUA." };
  }
  const dua_code = String(codeData);

  // Insert filing — trigger DB auto-insertea 7 docs
  const { data: created, error: insertErr } = await supabase
    .from("customs_filings")
    .insert({
      tenant_id: link.tenant_id,
      shipment_id: input!.shipment_id,
      dua_code,
      port_code: input!.port_code,
      agent_id: input!.agent_id,
      status: "en_revision",
      hs_codes: input!.hs_codes,
      total_duty: input!.total_duty,
      igtf: input!.igtf,
      iva: input!.iva,
      agent_fee: input!.agent_fee,
      observations: input!.observations,
    })
    .select("id")
    .single<{ id: string }>();

  if (insertErr || !created) {
    return {
      error: `No se pudo crear el trámite: ${insertErr?.message ?? "sin detalle"}`,
    };
  }

  // Sync shipment.status a in_customs si no estaba ya
  await supabase
    .from("shipments")
    .update({ status: "in_customs" })
    .eq("id", input!.shipment_id)
    .not("status", "in", "(in_customs,arrived_destination,out_for_delivery,last_mile,delivered,cancelled)");

  await supabase.from("shipment_events").insert({
    tenant_id: link.tenant_id,
    shipment_id: input!.shipment_id,
    status: "in_customs",
    note: `Trámite SENIAT creado · ${dua_code}`,
  });

  revalidatePath("/studio/seniat");
  revalidatePath("/studio/ve");
  return { ok: true, createdId: created.id, createdDuaCode: dua_code };
}

// ─────────────────────────────────────────────────────────────
// updateFilingAction
// ─────────────────────────────────────────────────────────────

export async function updateFilingAction(
  filingId: string,
  _prev: CustomsFilingActionState,
  formData: FormData,
): Promise<CustomsFilingActionState> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "seniat");
  if (denial) return { error: denial };


  const partial = inputFromFormData(formData);
  // Para update, shipment_id viene del filing existente — no del form
  partial.shipment_id = "placeholder-skip-validation";
  const { input, fieldErrors } = validateFilingInput(partial);
  if (fieldErrors) return { fieldErrors };

  const { error } = await supabase
    .from("customs_filings")
    .update({
      agent_id: input!.agent_id,
      port_code: input!.port_code,
      hs_codes: input!.hs_codes,
      total_duty: input!.total_duty,
      igtf: input!.igtf,
      iva: input!.iva,
      agent_fee: input!.agent_fee,
      observations: input!.observations,
    })
    .eq("id", filingId);

  if (error) {
    return { error: `No se pudo guardar: ${error.message}` };
  }

  revalidatePath("/studio/seniat");
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// markDocumentUploadedAction (toggle del checkbox)
// ─────────────────────────────────────────────────────────────

export async function markDocumentUploadedAction(
  documentId: string,
  uploaded: boolean,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "seniat");
  if (denial) return { error: denial };


  const { error } = await supabase
    .from("customs_documents")
    .update({
      uploaded,
      uploaded_at: uploaded ? new Date().toISOString() : null,
    })
    .eq("id", documentId);

  if (error) return { error: error.message };

  revalidatePath("/studio/seniat");
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// markFilingClearedAction
// ─────────────────────────────────────────────────────────────

export async function markFilingClearedAction(
  filingId: string,
): Promise<{ ok?: boolean; error?: string; missingDocs?: string[] }> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "seniat");
  if (denial) return { error: denial };


  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  if (!link?.tenant_id) return { error: "No se pudo resolver el tenant." };

  // Validar required docs OK
  const { data: docs, error: docsErr } = await supabase
    .from("customs_documents")
    .select("doc_type, uploaded")
    .eq("filing_id", filingId);

  if (docsErr) return { error: docsErr.message };

  const missing = ((docs as { doc_type: keyof typeof CUSTOMS_DOC_REQUIRED; uploaded: boolean }[] | null) ?? [])
    .filter((d) => CUSTOMS_DOC_REQUIRED[d.doc_type] && !d.uploaded)
    .map((d) => d.doc_type);

  if (missing.length > 0) {
    return {
      error: `Faltan documentos obligatorios: ${missing.join(", ")}`,
      missingDocs: missing,
    };
  }

  // Obtener shipment_id del filing
  const { data: filing, error: filingErr } = await supabase
    .from("customs_filings")
    .select("shipment_id, dua_code")
    .eq("id", filingId)
    .maybeSingle<{ shipment_id: string; dua_code: string }>();

  if (filingErr || !filing) return { error: "Filing no encontrado." };

  const today = new Date().toISOString().slice(0, 10);

  // Update filing
  const { error: updErr } = await supabase
    .from("customs_filings")
    .update({ status: "liberado", cleared_at: today, alert: null })
    .eq("id", filingId);

  if (updErr) return { error: updErr.message };

  // Sync shipment.status -> arrived_destination (listo retiro)
  await supabase
    .from("shipments")
    .update({ status: "arrived_destination" })
    .eq("id", filing.shipment_id)
    .eq("status", "in_customs");

  await supabase.from("shipment_events").insert({
    tenant_id: link.tenant_id,
    shipment_id: filing.shipment_id,
    status: "arrived_destination",
    note: `SENIAT liberó el container · DUA ${filing.dua_code}`,
  });

  revalidatePath("/studio/seniat");
  revalidatePath("/studio/ve");
  revalidatePath(`/studio/tracking/${filing.shipment_id}`);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// changeFilingStatusAction
// ─────────────────────────────────────────────────────────────

const VALID_STATUSES: CustomsStatus[] = [
  "en_revision",
  "observacion",
  "liberacion",
  "pagado",
  "liberado",
];

export async function changeFilingStatusAction(
  filingId: string,
  newStatus: CustomsStatus,
  alertText?: string | null,
): Promise<{ ok?: boolean; error?: string }> {
  if (!VALID_STATUSES.includes(newStatus)) {
    return { error: "Estado inválido." };
  }

  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "seniat");
  if (denial) return { error: denial };


  const extra: Record<string, unknown> = { status: newStatus };
  if (newStatus === "observacion" && alertText?.trim()) {
    extra.alert = alertText.trim();
  } else if (newStatus !== "observacion") {
    extra.alert = null;
  }

  const { error } = await supabase
    .from("customs_filings")
    .update(extra)
    .eq("id", filingId);

  if (error) return { error: error.message };

  revalidatePath("/studio/seniat");
  return { ok: true };
}
