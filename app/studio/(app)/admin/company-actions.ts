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
 * ## 🔴 Son DOS gates, no uno (SDD-0299)
 *
 * `moduleEditDenial("admin")` es el primero, en la app. El SEGUNDO vive en la
 * base: `audit_d1_execute` arranca llamando a `audit_d1_admin_tenant()`, que
 * exige `user_tenants.role = 'admin'` y lanza `permission_denied` si no lo
 * encuentra. Los dos no dicen lo mismo — el de la app deja pasar overrides por
 * rol, el de la base sólo acepta `admin` literal.
 *
 * Como la RPC aborta en su primera línea, la transacción se revierte entera y
 * **no queda ni la fila ni el registro de auditoría**. Desde afuera se ve
 * idéntico a "no pasó nada".
 *
 * RLS por tenant es el aislamiento duro; el tenant se resuelve desde
 * `user_tenants`.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import {
  D1OperationError,
  d1Reason,
  executeD1Operation,
} from "@/lib/studio/audit/d1-access-config-adapters";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import {
  mensajeDeErrorD1,
  validateBankAccountInput,
  validateCompanyIdentityInput,
  validateOfficeInput,
  type CompanyActionState,
} from "@/lib/studio/company-types";

/**
 * Extrae el código tipado del error D1. El texto que ve la persona lo arma
 * `mensajeDeErrorD1` en `company-types.ts` — ahí es una función pura y se
 * prueba; acá no puede vivir porque un archivo `"use server"` sólo exporta
 * funciones async, así que nada de esto sería testeable desde afuera.
 *
 * ⚠️ `D1OperationError` hace `super(code)`: su `.message` **es el código**.
 * Devolverlo crudo le mostraría "permission_denied" al usuario.
 */
function codigoD1(err: unknown): string | null {
  return err instanceof D1OperationError ? err.code : null;
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

  try {
    await executeD1Operation(supabase, {
      operationType: "tenant.identity_update",
      input: {
        legal_name: input!.legalName,
        trade_name: input!.tradeName,
        rif: input!.rif,
        commercial_email: input!.commercialEmail,
        phone: input!.phone,
        whatsapp: input!.whatsapp,
        website: input!.website,
        iva_enabled: input!.ivaEnabled,
        iva_rate: input!.ivaRate,
        islr_rate: input!.islrRate,
        igtf_rate: input!.igtfRate,
      },
    });
  } catch (err) {
    return {
      error: mensajeDeErrorD1(codigoD1(err), "No se pudo guardar la identidad de la empresa."),
    };
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

  const id = typeof formData.get("id") === "string" ? (formData.get("id") as string) : "";

  try {
    await executeD1Operation(supabase, {
      operationType: "office.save",
      targetId: id || null,
      input: {
        country: input!.country,
        name: input!.name,
        address: input!.address,
      },
    });
  } catch (err) {
    return { error: mensajeDeErrorD1(codigoD1(err), "No se pudo guardar la oficina.") };
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

  try {
    await executeD1Operation(supabase, {
      operationType: "office.delete",
      targetId: id,
      reason: d1Reason(
        formData.get("reason"),
        "Eliminación solicitada desde Administración",
      ),
    });
  } catch (err) {
    return { error: mensajeDeErrorD1(codigoD1(err), "No se pudo eliminar la oficina.") };
  }

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

  const id = typeof formData.get("id") === "string" ? (formData.get("id") as string) : "";

  try {
    await executeD1Operation(supabase, {
      operationType: "bank_account.save",
      targetId: id || null,
      input: {
        bank_name: input!.bankName,
        account_type: input!.accountType,
        currency: input!.currency,
        account_number: input!.accountNumber,
      },
    });
  } catch (err) {
    return { error: mensajeDeErrorD1(codigoD1(err), "No se pudo guardar la cuenta.") };
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

  try {
    await executeD1Operation(supabase, {
      operationType: "bank_account.delete",
      targetId: id,
      reason: d1Reason(
        formData.get("reason"),
        "Eliminación solicitada desde Administración",
      ),
    });
  } catch (err) {
    return { error: mensajeDeErrorD1(codigoD1(err), "No se pudo eliminar la cuenta.") };
  }

  revalidatePath("/studio/admin");
  return { ok: true };
}
