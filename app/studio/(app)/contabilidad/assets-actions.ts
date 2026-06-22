/**
 * Server actions de Activos fijos (SDD-0105).
 *
 * Patrón del repo: "use server" + parse manual de FormData + validate*Input()
 * (sin Zod) + revalidatePath(). `moduleEditDenial("accounting")` primero.
 *
 *  - createAsset: registra un bien (no toca el mayor).
 *  - disposeAsset: marca status='baja' + disposed_on (sin asiento de baja, V1).
 *  - postDepreciationAction: corre el posteo mensual de depreciación
 *    (DR 6.17 / CR 1.2.9), idempotente por (activo, mes), respeta cierre de
 *    período. Único write-path al mayor de esta feature.
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import {
  validateAssetInput,
  type AssetActionState,
  type AssetInput,
} from "@/lib/studio/accounting/fixed-asset-types";
import { listAssets } from "@/lib/studio/accounting/fixed-asset-queries";
import {
  getAccountingSettings,
  isPeriodClosed,
} from "@/lib/studio/accounting/period-queries";
import {
  postDepreciationForPeriod,
  endOfMonth,
  type PostDepreciationResult,
} from "@/lib/studio/accounting/depreciation-posting";

type Supa = Awaited<ReturnType<typeof createClient>>;

async function resolveTenant(
  supabase: Supa,
): Promise<{ tenantId?: string; error?: string }> {
  const { data: link, error } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  if (error || !link?.tenant_id) {
    return { error: "No se pudo resolver el tenant del usuario." };
  }
  return { tenantId: link.tenant_id };
}

async function currentUserId(supabase: Supa): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

function assetInputFromFormData(formData: FormData): Partial<AssetInput> {
  return {
    name: String(formData.get("name") ?? "").trim() || undefined,
    asset_account_id:
      String(formData.get("asset_account_id") ?? "").trim() || undefined,
    accum_dep_account_id:
      String(formData.get("accum_dep_account_id") ?? "").trim() || null,
    expense_account_id:
      String(formData.get("expense_account_id") ?? "").trim() || null,
    cost: Number(formData.get("cost") ?? 0) || 0,
    salvage_value: Number(formData.get("salvage_value") ?? 0) || 0,
    acquired_on: String(formData.get("acquired_on") ?? "").trim() || undefined,
    useful_life_months: Number(formData.get("useful_life_months") ?? 0) || 0,
  };
}

/** Valida que un account_id (si viene) sea del tenant y postable. */
async function accountIsPostable(
  supabase: Supa,
  tenantId: string,
  accountId: string | null,
): Promise<boolean> {
  if (!accountId) return true; // null = se usa el default por code al postear
  const { data } = await supabase
    .from("accounts")
    .select("id, is_postable")
    .eq("id", accountId)
    .eq("tenant_id", tenantId)
    .maybeSingle<{ id: string; is_postable: boolean }>();
  return Boolean(data?.id && data.is_postable);
}

export async function createAsset(
  _prev: AssetActionState,
  formData: FormData,
): Promise<AssetActionState> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "accounting");
  if (denial) return { error: denial };

  const partial = assetInputFromFormData(formData);
  const { input, fieldErrors } = validateAssetInput(partial);
  if (fieldErrors) return { fieldErrors };

  const { tenantId, error: tErr } = await resolveTenant(supabase);
  if (tErr || !tenantId) return { error: tErr };

  // La cuenta del activo debe ser del tenant y postable.
  if (!(await accountIsPostable(supabase, tenantId, input!.asset_account_id))) {
    return {
      fieldErrors: {
        asset_account_id: "Elige una cuenta de activo postable (1.2.x).",
      },
    };
  }
  // Las cuentas de acumulada/gasto (si se eligieron explícitas) también.
  if (!(await accountIsPostable(supabase, tenantId, input!.accum_dep_account_id))) {
    return {
      fieldErrors: { accum_dep_account_id: "Cuenta de depreciación inválida." },
    };
  }
  if (!(await accountIsPostable(supabase, tenantId, input!.expense_account_id))) {
    return {
      fieldErrors: { expense_account_id: "Cuenta de gasto inválida." },
    };
  }

  const userId = await currentUserId(supabase);

  const { data: inserted, error } = await supabase
    .from("fixed_assets")
    .insert({
      tenant_id: tenantId,
      name: input!.name,
      asset_account_id: input!.asset_account_id,
      accum_dep_account_id: input!.accum_dep_account_id,
      expense_account_id: input!.expense_account_id,
      cost: input!.cost,
      salvage_value: input!.salvage_value,
      acquired_on: input!.acquired_on,
      useful_life_months: input!.useful_life_months,
      created_by: userId,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return { error: `No se pudo registrar el activo: ${error?.message}` };
  }

  revalidatePath("/studio/contabilidad");
  return { ok: true, createdId: inserted.id };
}

/** Marca un activo como dado de baja (status='baja' + disposed_on). V1: sin asiento. */
export async function disposeAsset(
  id: string,
  disposedOn?: string | null,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "accounting");
  if (denial) return { error: denial };

  const { tenantId, error: tErr } = await resolveTenant(supabase);
  if (tErr || !tenantId) return { error: tErr };

  const disposed = disposedOn?.trim() || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(disposed)) {
    return { error: "Fecha de baja inválida (YYYY-MM-DD)." };
  }

  const { data: asset, error: readErr } = await supabase
    .from("fixed_assets")
    .select("id, status")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle<{ id: string; status: string }>();
  if (readErr) return { error: readErr.message };
  if (!asset?.id) return { error: "Activo no encontrado." };
  if (asset.status === "baja") return { error: "El activo ya está dado de baja." };

  const { error } = await supabase
    .from("fixed_assets")
    .update({ status: "baja", disposed_on: disposed })
    .eq("id", id)
    .eq("tenant_id", tenantId);
  if (error) return { error: `No se pudo dar de baja: ${error.message}` };

  revalidatePath("/studio/contabilidad");
  return { ok: true };
}

export type PostDepreciationActionResult = {
  ok?: boolean;
  error?: string;
  result?: PostDepreciationResult;
};

/**
 * Corre el posteo de depreciación del mes para todos los activos del tenant.
 * Idempotente (re-correr el mismo mes no duplica). Respeta el cierre de período
 * (chequeo app + trigger DB). El posteo real corre con admin client en
 * depreciation-posting.ts (espejo de expense-posting).
 */
export async function postDepreciationAction(
  period: string,
): Promise<PostDepreciationActionResult> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "accounting");
  if (denial) return { error: denial };

  const p = period?.trim();
  if (!p || !/^\d{4}-\d{2}$/.test(p)) {
    return { error: "Indica el mes a depreciar (YYYY-MM)." };
  }

  const { tenantId, error: tErr } = await resolveTenant(supabase);
  if (tErr || !tenantId) return { error: tErr };

  // Guard de período cerrado (SDD-0080): si el mes está cerrado, no posteamos.
  // El trigger de DB es la defensa dura; esto da un mensaje claro antes.
  const settings = await getAccountingSettings(supabase);
  const entryDate = endOfMonth(p);
  if (isPeriodClosed(settings.closing_date, entryDate)) {
    return {
      error: `Período contable cerrado al ${settings.closing_date}: no puedes depreciar ${p}.`,
    };
  }

  const userId = await currentUserId(supabase);
  const assets = await listAssets(supabase);
  const activos = assets.filter((a) => a.status === "activo");

  const result = await postDepreciationForPeriod(activos, p, {
    closingDate: settings.closing_date,
    postedBy: userId,
  });

  revalidatePath("/studio/contabilidad");
  return { ok: true, result };
}
