/**
 * Server actions del módulo Fiscal/SENIAT (SDD-0073).
 *
 * Única mutación V1: guardar la configuración fiscal del tenant (singleton).
 * Patrón Studio: "use server" + useActionState + parsing manual de FormData +
 * validateFiscalSettingsInput() (sin Zod) + revalidatePath. Upsert lazy: si la
 * row no existe, la crea; si existe, la actualiza.
 *
 * Admin-only: aunque la RLS de 0126 ya restringe write a admin del tenant,
 * verificamos el rol en la action para devolver un error amable (no un 403 de
 * PostgREST). tenant_id + updated_by son server-controlled (no vienen del form).
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import {
  validateFiscalSettingsInput,
  type FiscalSettingsActionState,
  type FiscalSettingsInput,
} from "@/lib/studio/fiscal/config-types";

function parseNumber(v: FormDataEntryValue | null): number | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  if (s === "") return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

function parseBool(formData: FormData, key: string): boolean {
  // El form manda un hidden "0" + (si está ON) un checkbox "1" con el mismo
  // name → getAll captura ambos y nos quedamos con el último presente. Así un
  // checkbox desmarcado llega como false sin ambigüedad.
  const all = formData.getAll(key).map((v) => String(v));
  if (all.length === 0) return false;
  const last = all[all.length - 1];
  return last === "1" || last === "true" || last === "on";
}

function inputFromFormData(formData: FormData): Partial<FiscalSettingsInput> {
  const treatment = String(formData.get("service_iva_treatment") ?? "");
  const mode = String(formData.get("purchase_iva_mode") ?? "");
  const period = String(formData.get("declaration_period") ?? "");
  return {
    service_iva_treatment: (treatment ||
      undefined) as FiscalSettingsInput["service_iva_treatment"],
    iva_rate: parseNumber(formData.get("iva_rate")),
    is_special_taxpayer: parseBool(formData, "is_special_taxpayer"),
    is_iva_withholding_agent: parseBool(formData, "is_iva_withholding_agent"),
    iva_withholding_pct: parseNumber(formData.get("iva_withholding_pct")),
    purchase_iva_mode: (mode ||
      undefined) as FiscalSettingsInput["purchase_iva_mode"],
    declaration_period: (period ||
      undefined) as FiscalSettingsInput["declaration_period"],
  };
}

const ADMIN_ONLY_MSG =
  "Solo los administradores pueden editar la configuración fiscal.";

export async function saveFiscalSettingsAction(
  _prev: FiscalSettingsActionState,
  formData: FormData,
): Promise<FiscalSettingsActionState> {
  const supabase = await createClient();

  const partial = inputFromFormData(formData);
  const { input, fieldErrors } = validateFiscalSettingsInput(partial);
  if (fieldErrors) return { fieldErrors };

  // Resolver usuario + tenant + rol. Filtramos user_tenants por user_id: tras
  // la migración 0040 ese listado expone a TODOS los miembros del tenant, así
  // que un maybeSingle() sin filtro rompería con >1 usuario.
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return { error: "Sesión no válida." };

  const { data: link, error: linkErr } = await supabase
    .from("user_tenants")
    .select("tenant_id, role")
    .eq("user_id", userId)
    .maybeSingle<{ tenant_id: string; role: string }>();
  if (linkErr || !link?.tenant_id) {
    return { error: "No se pudo resolver el tenant del usuario." };
  }
  if (link.role !== "admin") return { error: ADMIN_ONLY_MSG };

  const row = {
    tenant_id: link.tenant_id,
    service_iva_treatment: input!.service_iva_treatment,
    iva_rate: input!.iva_rate,
    is_special_taxpayer: input!.is_special_taxpayer,
    is_iva_withholding_agent: input!.is_iva_withholding_agent,
    iva_withholding_pct: input!.iva_withholding_pct,
    purchase_iva_mode: input!.purchase_iva_mode,
    declaration_period: input!.declaration_period,
    updated_by: userId,
  };

  const { error } = await supabase
    .from("fiscal_settings")
    .upsert(row, { onConflict: "tenant_id" });

  if (error) {
    return { error: `No se pudo guardar la configuración: ${error.message}` };
  }

  revalidatePath("/studio/fiscal");
  return { ok: true };
}
