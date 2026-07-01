"use server";

/**
 * Server actions de "Datos de la empresa" (SDD-0120, admin only).
 *
 * Cubre las 4 tarjetas de la sección company:
 *   · updateCompanyIdentityAction  → identidad fiscal + contacto + impuestos
 *                                     (columnas de `tenants`).
 *   · saveOfficeAction / deleteOfficeAction        → oficinas (1-a-N).
 *   · saveBankAccountAction / deleteBankAccountAction → cuentas bancarias.
 *
 * Todas gatean rol admin (moduleEditDenial "admin") — backstop server-side,
 * porque las actions son invocables directo. RLS por tenant es el aislamiento
 * duro; el tenant se resuelve desde user_tenants.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import {
  validateBankAccountInput,
  validateCompanyIdentityInput,
  validateOfficeInput,
  type CompanyActionState,
} from "@/lib/studio/company-types";

async function resolveTenantId(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const { data } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .limit(1)
    .maybeSingle<{ tenant_id: string }>();
  return data?.tenant_id ?? null;
}

// ── Identidad fiscal + contacto + impuestos ───────────────────
export async function updateCompanyIdentityAction(
  _prev: CompanyActionState,
  formData: FormData,
): Promise<CompanyActionState> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "admin");
  if (denial) return { error: denial };

  const { input, fieldErrors } = validateCompanyIdentityInput(formData);
  if (fieldErrors) return { fieldErrors };

  const tenantId = await resolveTenantId(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant." };

  const { error } = await supabase
    .from("tenants")
    .update({
      legal_name: input!.legalName,
      trade_name: input!.tradeName || null,
      rif: input!.rif || null,
      commercial_email: input!.commercialEmail || null,
      phone: input!.phone || null,
      whatsapp: input!.whatsapp || null,
      website: input!.website || null,
      iva_enabled: input!.ivaEnabled,
      iva_rate: input!.ivaRate,
      islr_rate: input!.islrRate,
      igtf_rate: input!.igtfRate,
    })
    .eq("id", tenantId);

  if (error) {
    if (error.code === "42501") return { error: "RLS bloqueó el cambio (no eres admin)." };
    return { error: `No se pudo guardar: ${error.message}` };
  }

  revalidatePath("/studio/admin");
  return { ok: true };
}

// ── Oficinas ──────────────────────────────────────────────────
export async function saveOfficeAction(
  _prev: CompanyActionState,
  formData: FormData,
): Promise<CompanyActionState> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "admin");
  if (denial) return { error: denial };

  const { input, fieldErrors } = validateOfficeInput(formData);
  if (fieldErrors) return { fieldErrors };

  const tenantId = await resolveTenantId(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant." };

  const id = typeof formData.get("id") === "string" ? (formData.get("id") as string) : "";

  if (id) {
    const { error } = await supabase
      .from("company_offices")
      .update({
        country: input!.country,
        name: input!.name,
        address: input!.address,
      })
      .eq("id", id)
      .eq("tenant_id", tenantId);
    if (error) return { error: `No se pudo guardar la oficina: ${error.message}` };
  } else {
    const { error } = await supabase.from("company_offices").insert({
      tenant_id: tenantId,
      country: input!.country,
      name: input!.name,
      address: input!.address,
    });
    if (error) return { error: `No se pudo crear la oficina: ${error.message}` };
  }

  revalidatePath("/studio/admin");
  return { ok: true };
}

export async function deleteOfficeAction(
  _prev: CompanyActionState,
  formData: FormData,
): Promise<CompanyActionState> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "admin");
  if (denial) return { error: denial };

  const id = typeof formData.get("id") === "string" ? (formData.get("id") as string) : "";
  if (!id) return { error: "Falta el id de la oficina." };

  const tenantId = await resolveTenantId(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant." };

  const { error } = await supabase
    .from("company_offices")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", tenantId);
  if (error) return { error: `No se pudo eliminar la oficina: ${error.message}` };

  revalidatePath("/studio/admin");
  return { ok: true };
}

// ── Cuentas bancarias ─────────────────────────────────────────
export async function saveBankAccountAction(
  _prev: CompanyActionState,
  formData: FormData,
): Promise<CompanyActionState> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "admin");
  if (denial) return { error: denial };

  const { input, fieldErrors } = validateBankAccountInput(formData);
  if (fieldErrors) return { fieldErrors };

  const tenantId = await resolveTenantId(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant." };

  const id = typeof formData.get("id") === "string" ? (formData.get("id") as string) : "";

  if (id) {
    const { error } = await supabase
      .from("company_bank_accounts")
      .update({
        bank_name: input!.bankName,
        account_type: input!.accountType,
        currency: input!.currency,
        account_number: input!.accountNumber,
      })
      .eq("id", id)
      .eq("tenant_id", tenantId);
    if (error) return { error: `No se pudo guardar la cuenta: ${error.message}` };
  } else {
    const { error } = await supabase.from("company_bank_accounts").insert({
      tenant_id: tenantId,
      bank_name: input!.bankName,
      account_type: input!.accountType,
      currency: input!.currency,
      account_number: input!.accountNumber,
    });
    if (error) return { error: `No se pudo crear la cuenta: ${error.message}` };
  }

  revalidatePath("/studio/admin");
  return { ok: true };
}

export async function deleteBankAccountAction(
  _prev: CompanyActionState,
  formData: FormData,
): Promise<CompanyActionState> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "admin");
  if (denial) return { error: denial };

  const id = typeof formData.get("id") === "string" ? (formData.get("id") as string) : "";
  if (!id) return { error: "Falta el id de la cuenta." };

  const tenantId = await resolveTenantId(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant." };

  const { error } = await supabase
    .from("company_bank_accounts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", tenantId);
  if (error) return { error: `No se pudo eliminar la cuenta: ${error.message}` };

  revalidatePath("/studio/admin");
  return { ok: true };
}
