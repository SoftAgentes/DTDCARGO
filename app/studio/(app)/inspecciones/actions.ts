/**
 * Server actions del módulo Inspecciones (SDD-0066 · Fase 1-3).
 *
 *  - createInspectionReportAction · genera DTD-QC/FA-NNNN (RPC correlativo
 *                                   server-side via admin client) + snapshot del
 *                                   cliente + insert de la cabecera + payload.
 *  - updateInspectionReportAction · edita cabecera + payload completo (PSI o
 *                                   fábrica según el tipo). score (fábrica) va a
 *                                   la columna `score` además del payload.
 *  - softDeleteInspectionReportAction · deleted_at = now().
 *  - uploadInspectionPhotosAction / deleteInspectionPhotoAction · fotos en el
 *                                   bucket privado `inspections`.
 *
 * Toda mutación pasa el gate de edición por módulo (moduleEditDenial, SDD-0085):
 * las server actions son invocables directo como un endpoint → validan su rol.
 *
 * El correlativo se emite con el ADMIN client porque la RPC
 * next_inspection_report_no solo concede EXECUTE a service_role (anti
 * anon-execute). El insert sí va con el user client → la RLS por tenant lo
 * scopea y el snapshot del cliente respeta el aislamiento.
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import {
  validateInspectionInput,
  parsePsiPayload,
  parseFactoryPayload,
  type InspectionActionState,
} from "@/lib/studio/inspecciones/validators";
import {
  collectInspectionPhotos,
  uploadInspectionPhotoBatch,
  deleteInspectionPhoto,
} from "@/lib/studio/inspecciones/photos";
import type { InspectionPayload } from "@/lib/studio/inspecciones/types";

const MODULE_ID = "inspecciones";

function strOrNull(v: FormDataEntryValue | null): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function inputFromFormData(formData: FormData) {
  return {
    type: strOrNull(formData.get("type")) ?? "",
    client_id: strOrNull(formData.get("client_id")),
    title: strOrNull(formData.get("title")) ?? "",
    product: strOrNull(formData.get("product")),
    inspection_date: strOrNull(formData.get("inspection_date")),
    duration_mandays: strOrNull(formData.get("duration_mandays")),
    score: strOrNull(formData.get("score")),
    conclusion: strOrNull(formData.get("conclusion")),
    provider_internal: strOrNull(formData.get("provider_internal")),
  };
}

async function resolveTenantId(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const { data } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  return data?.tenant_id ?? null;
}

export async function createInspectionReportAction(
  _prev: InspectionActionState,
  formData: FormData,
): Promise<InspectionActionState> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };

  const { input, fieldErrors } = validateInspectionInput(
    inputFromFormData(formData),
  );
  if (fieldErrors) return { fieldErrors };

  const tenantId = await resolveTenantId(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant del usuario." };

  // Snapshot del cliente (opcional; RLS garantiza que es del tenant del usuario).
  let clientName: string | null = null;
  if (input!.client_id) {
    const { data: client, error: clientErr } = await supabase
      .from("clients")
      .select("id, name")
      .eq("id", input!.client_id)
      .is("deleted_at", null)
      .maybeSingle<{ id: string; name: string }>();
    if (clientErr) {
      return { error: `No se pudo leer el cliente: ${clientErr.message}` };
    }
    if (!client)
      return { fieldErrors: { client_id: "Cliente no encontrado." } };
    clientName = client.name;
  }

  // Correlativo DTD-QC/FA-NNNN. La RPC solo la ejecuta service_role → admin client.
  const admin = createAdminClient();
  const { data: noData, error: noErr } = await admin.rpc(
    "next_inspection_report_no",
    { p_tenant_id: tenantId, p_type: input!.type },
  );
  if (noErr || !noData) {
    return { error: "No se pudo generar el número del reporte." };
  }
  const reportNo = String(noData);

  const { data: userResp } = await supabase.auth.getUser();

  const { error } = await supabase.from("inspection_reports").insert({
    tenant_id: tenantId,
    report_no: reportNo,
    type: input!.type,
    client_id: input!.client_id,
    client_name: clientName,
    title: input!.title,
    product: input!.product,
    inspection_date: input!.inspection_date,
    duration_mandays: input!.duration_mandays,
    score: input!.score,
    conclusion: input!.conclusion,
    status: "draft",
    payload: {},
    provider_internal: input!.provider_internal,
    created_by: userResp.user?.id ?? null,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Carrera al generar el número. Intenta de nuevo." };
    }
    return { error: `No se pudo crear el reporte: ${error.message}` };
  }

  revalidatePath("/studio/inspecciones");
  return { ok: true, createdNo: reportNo };
}

export async function updateInspectionReportAction(
  reportId: string,
  _prev: InspectionActionState,
  formData: FormData,
): Promise<InspectionActionState> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };

  const { input, fieldErrors } = validateInspectionInput(
    inputFromFormData(formData),
  );
  if (fieldErrors) return { fieldErrors };

  // Snapshot del cliente si cambió.
  let clientName: string | null = null;
  if (input!.client_id) {
    const { data: client } = await supabase
      .from("clients")
      .select("id, name")
      .eq("id", input!.client_id)
      .is("deleted_at", null)
      .maybeSingle<{ id: string; name: string }>();
    if (!client)
      return { fieldErrors: { client_id: "Cliente no encontrado." } };
    clientName = client.name;
  }

  // El builder (Fase 2/3) marca `__builder=1`; solo entonces se reescribe el
  // payload. El drawer de cabecera (sin esa marca) NO toca el payload existente.
  const isBuilder = formData.get("__builder") === "1";
  let payload: InspectionPayload | undefined;
  let score = input!.score;
  if (isBuilder) {
    payload =
      input!.type === "factory_audit"
        ? parseFactoryPayload(formData)
        : parsePsiPayload(formData);
    if (input!.type === "factory_audit") {
      score = payload.score ?? input!.score;
    }
  }

  const patch: Record<string, unknown> = {
    type: input!.type,
    client_id: input!.client_id,
    client_name: clientName,
    title: input!.title,
    product: input!.product,
    inspection_date: input!.inspection_date,
    duration_mandays: input!.duration_mandays,
    score,
    conclusion: input!.conclusion,
    provider_internal: input!.provider_internal,
  };
  if (payload !== undefined) patch.payload = payload;

  const { error } = await supabase
    .from("inspection_reports")
    .update(patch)
    .eq("id", reportId);

  if (error)
    return { error: `No se pudo guardar el reporte: ${error.message}` };

  revalidatePath("/studio/inspecciones");
  return { ok: true };
}

export async function softDeleteInspectionReportAction(
  reportId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };

  const { error } = await supabase
    .from("inspection_reports")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", reportId);

  if (error)
    return { error: `No se pudo eliminar el reporte: ${error.message}` };

  revalidatePath("/studio/inspecciones");
  return { ok: true };
}

/**
 * Sube fotos a un reporte (bucket privado `inspections`,
 * {tenant}/inspection/{report_id}/{uuid}.ext) + registra en
 * inspection_report_photos. User client: la storage RLS por tenant valida el
 * path. Best-effort por archivo.
 */
export async function uploadInspectionPhotosAction(
  reportId: string,
  _prev: { ok?: boolean; error?: string },
  formData: FormData,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };

  const tenantId = await resolveTenantId(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant." };

  // El reporte debe ser del tenant (RLS ya lo scopea; filtro defensivo).
  const { data: report } = await supabase
    .from("inspection_reports")
    .select("id")
    .eq("id", reportId)
    .is("deleted_at", null)
    .maybeSingle<{ id: string }>();
  if (!report) return { error: "Reporte no encontrado." };

  const { files, skipped } = collectInspectionPhotos(formData);
  if (files.length === 0) {
    return {
      error:
        skipped > 0
          ? "Archivos no válidos (usa JPG/PNG/WebP, máx 25 MB)."
          : "Elige al menos una foto.",
    };
  }

  const category = String(formData.get("category") ?? "").trim() || null;
  const { uploaded } = await uploadInspectionPhotoBatch(supabase, {
    tenantId,
    reportId,
    files,
    category,
  });
  if (uploaded === 0) return { error: "No se pudo subir las fotos." };

  revalidatePath("/studio/inspecciones");
  return { ok: true };
}

/** Soft-delete de una foto + borra el objeto del bucket (best-effort). */
export async function deleteInspectionPhotoAction(
  photoId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  const denial = await moduleEditDenial(supabase, MODULE_ID);
  if (denial) return { error: denial };

  const r = await deleteInspectionPhoto(supabase, photoId);
  if (r.error) return { error: r.error };

  revalidatePath("/studio/inspecciones");
  return { ok: true };
}
