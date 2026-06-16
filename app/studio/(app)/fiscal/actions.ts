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

function parseStrOrNull(v: FormDataEntryValue | null): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function inputFromFormData(formData: FormData): Partial<FiscalSettingsInput> {
  const defMode = String(formData.get("default_invoice_iva_mode") ?? "");
  const mode = String(formData.get("purchase_iva_mode") ?? "");
  const period = String(formData.get("declaration_period") ?? "");
  return {
    // A · master
    fiscal_module_enabled: parseBool(formData, "fiscal_module_enabled"),
    // B · SPE
    is_special_taxpayer: parseBool(formData, "is_special_taxpayer"),
    // C · alícuotas
    iva_rate_general: parseNumber(formData.get("iva_rate_general")),
    iva_rate_reduced: parseNumber(formData.get("iva_rate_reduced")),
    iva_rate_export: parseNumber(formData.get("iva_rate_export")),
    iva_rate_luxury_surcharge: parseNumber(
      formData.get("iva_rate_luxury_surcharge"),
    ),
    // D · default factura
    default_invoice_iva_mode: (defMode ||
      undefined) as FiscalSettingsInput["default_invoice_iva_mode"],
    // E · IGTF
    igtf_enabled: parseBool(formData, "igtf_enabled"),
    igtf_rate_fx: parseNumber(formData.get("igtf_rate_fx")),
    igtf_is_perception_agent: parseBool(formData, "igtf_is_perception_agent"),
    // F · retención
    iva_withholding_agent: parseBool(formData, "iva_withholding_agent"),
    iva_withholding_pct: parseNumber(formData.get("iva_withholding_pct")),
    // G · facturación digital
    digital_invoicing_enabled: parseBool(formData, "digital_invoicing_enabled"),
    homologated_provider: parseStrOrNull(formData.get("homologated_provider")),
    // H · período + compras
    declaration_period: (period ||
      undefined) as FiscalSettingsInput["declaration_period"],
    purchase_iva_mode: (mode ||
      undefined) as FiscalSettingsInput["purchase_iva_mode"],
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
    fiscal_module_enabled: input!.fiscal_module_enabled,
    is_special_taxpayer: input!.is_special_taxpayer,
    iva_rate_general: input!.iva_rate_general,
    iva_rate_reduced: input!.iva_rate_reduced,
    iva_rate_export: input!.iva_rate_export,
    iva_rate_luxury_surcharge: input!.iva_rate_luxury_surcharge,
    default_invoice_iva_mode: input!.default_invoice_iva_mode,
    igtf_enabled: input!.igtf_enabled,
    igtf_rate_fx: input!.igtf_rate_fx,
    igtf_is_perception_agent: input!.igtf_is_perception_agent,
    iva_withholding_agent: input!.iva_withholding_agent,
    iva_withholding_pct: input!.iva_withholding_pct,
    digital_invoicing_enabled: input!.digital_invoicing_enabled,
    homologated_provider: input!.homologated_provider,
    declaration_period: input!.declaration_period,
    purchase_iva_mode: input!.purchase_iva_mode,
    updated_by: userId,
  };

  const { error } = await supabase
    .from("fiscal_settings")
    .upsert(row, { onConflict: "tenant_id" });

  if (error) {
    // No exponemos el mensaje crudo de Postgres/PostgREST al usuario (puede
    // revelar nombres de constraint/estructura); lo logueamos server-side.
    console.error("[fiscal] saveFiscalSettings upsert error:", error);
    return {
      error:
        "No se pudo guardar la configuración fiscal. Revisa los valores e intenta de nuevo.",
    };
  }

  revalidatePath("/studio/fiscal");
  return { ok: true };
}
