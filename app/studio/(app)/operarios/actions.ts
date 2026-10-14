"use server";

/**
 * Server actions del módulo Operarios (SDD-0028).
 *
 * Patrón Studio: cliente Supabase con session del usuario authenticated,
 * llama RPCs admin_* que validan assert_tenant_match() server-side.
 * NO service_role — el admin tiene su propio JWT.
 *
 * SDD-0515 (migr 0475): alta y restablecimiento rechazan con P0018 un PIN que
 * ya usa otro operario activo del mismo tenant y región. Si el PIN lo generó
 * el servidor, se sortea otro y se reintenta; si lo escribió el admin, vuelve
 * como error del campo PIN para que elija otro.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import {
  OPERARIO_PIN_IN_USE_MESSAGE,
  OPERARIO_PIN_PROBLEM_MESSAGE,
  isOperarioPinInUse,
  operarioPinProblem,
} from "@/lib/studio/operario-pin";
import { saveWithGeneratedOperarioPin } from "@/lib/studio/operario-pin-generator";

type State = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Si la action creó un operario o restableció su PIN, devolvemos el PIN
   *  en claro para mostrarlo al admin UNA vez (no se guarda en ningún lado
   *  más: la base solo conserva el hash bcrypt).  */
  pinReveal?: string;
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function parseStr(v: FormDataEntryValue | null): string {
  return v == null ? "" : String(v).trim();
}

function parseBool(v: FormDataEntryValue | null): boolean {
  if (v == null) return false;
  const s = String(v).trim().toLowerCase();
  return s === "true" || s === "1" || s === "on";
}

async function resolveTenant(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const { data } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  return data?.tenant_id ?? null;
}

// ─────────────────────────────────────────────────────────────
// Create
// ─────────────────────────────────────────────────────────────

export async function createOperarioAction(
  _prev: State,
  formData: FormData,
): Promise<State> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "operarios");
  if (denial) return { error: denial };
  const tenantId = await resolveTenant(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant." };

  const warehouseId = parseStr(formData.get("warehouse_id"));
  const displayName = parseStr(formData.get("display_name"));
  const displayNameCn = parseStr(formData.get("display_name_cn"));
  const pin = parseStr(formData.get("pin"));
  const role = parseStr(formData.get("role")) || "operario";

  const fieldErrors: Record<string, string> = {};
  if (!warehouseId) fieldErrors.warehouse_id = "Elige un warehouse";
  if (!displayName) fieldErrors.display_name = "Nombre requerido";
  if (!/^\d{4}$/.test(pin)) fieldErrors.pin = "PIN = 4 dígitos numéricos";
  if (!["operario", "supervisor"].includes(role))
    fieldErrors.role = "Rol inválido";
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const { error } = await supabase.rpc("admin_create_operario", {
    p_tenant_id: tenantId,
    p_warehouse_id: warehouseId,
    p_display_name: displayName,
    p_display_name_cn: displayNameCn || null,
    p_pin: pin,
    p_role: role,
  });

  if (error) {
    if (isOperarioPinInUse(error)) {
      return { fieldErrors: { pin: OPERARIO_PIN_IN_USE_MESSAGE } };
    }
    return { error: `No se pudo crear: ${error.message}` };
  }

  revalidatePath("/studio/operarios");
  return { ok: true, pinReveal: pin };
}

// ─────────────────────────────────────────────────────────────
// Restablecer PIN (SDD-0513)
//
// Dos caminos, el mismo candado (`moduleEditDenial` + la matriz de módulos que
// exige la RPC desde 0475) y la misma RPC: el PIN llega a la base en claro solo
// para que `admin_reset_operario_pin` lo guarde como hash bcrypt.
//
//  · generateOperarioPinAction — el servidor sortea el PIN con
//    crypto.randomInt DESPUÉS del candado. Ignora cualquier `pin` que mande el
//    formulario. Si la base contesta que otro operario activo del mismo tenant
//    y región ya lo usa (P0018), sortea otro distinto y reintenta.
//  · resetOperarioPinAction — el admin escribe el PIN (camino de siempre); un
//    PIN repetido vuelve como error del campo.
//
// En los dos, el PIN viaja de vuelta UNA vez en `pinReveal` y no se escribe
// en ningún log, tabla, URL ni almacenamiento; un PIN rechazado por repetido
// tampoco. La auditoría de quién lo restableció la escribe la RPC en su misma
// transacción (AUD-01), sin el PIN: ver SDD-0515.
// ─────────────────────────────────────────────────────────────

function resetErrorMessage(error: { message: string }): string {
  return `No se pudo restablecer el PIN: ${error.message}`;
}

export async function generateOperarioPinAction(
  _prev: State,
  formData: FormData,
): Promise<State> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "operarios");
  if (denial) return { error: denial };
  const operarioId = parseStr(formData.get("operario_id"));
  if (!operarioId) return { error: "Falta el operario." };

  const saved = await saveWithGeneratedOperarioPin((candidate) =>
    supabase.rpc("admin_reset_operario_pin", {
      p_operario_id: operarioId,
      p_pin: candidate,
    }),
  );
  if (saved.error) return { error: resetErrorMessage(saved.error) };

  revalidatePath("/studio/operarios");
  return { ok: true, pinReveal: saved.pin };
}

export async function resetOperarioPinAction(
  _prev: State,
  formData: FormData,
): Promise<State> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "operarios");
  if (denial) return { error: denial };
  const operarioId = parseStr(formData.get("operario_id"));
  const pin = parseStr(formData.get("pin"));

  if (!operarioId) return { error: "Falta el operario." };
  const problem = operarioPinProblem(pin);
  if (problem) {
    return { fieldErrors: { pin: OPERARIO_PIN_PROBLEM_MESSAGE[problem] } };
  }

  const { error } = await supabase.rpc("admin_reset_operario_pin", {
    p_operario_id: operarioId,
    p_pin: pin,
  });
  if (error) {
    if (isOperarioPinInUse(error)) {
      return { fieldErrors: { pin: OPERARIO_PIN_IN_USE_MESSAGE } };
    }
    return { error: resetErrorMessage(error) };
  }

  revalidatePath("/studio/operarios");
  return { ok: true, pinReveal: pin };
}

// ─────────────────────────────────────────────────────────────
// Toggle active
// ─────────────────────────────────────────────────────────────

export async function setOperarioActiveAction(
  formData: FormData,
): Promise<void> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "operarios");
  if (denial) return;
  const operarioId = parseStr(formData.get("operario_id"));
  const active = parseBool(formData.get("active"));
  if (!operarioId) return;

  await supabase.rpc("admin_set_operario_active", {
    p_operario_id: operarioId,
    p_active: active,
  });
  revalidatePath("/studio/operarios");
}

// ─────────────────────────────────────────────────────────────
// Update operario
// ─────────────────────────────────────────────────────────────

export async function updateOperarioAction(
  _prev: State,
  formData: FormData,
): Promise<State> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "operarios");
  if (denial) return { error: denial };
  const operarioId = parseStr(formData.get("operario_id"));
  const displayName = parseStr(formData.get("display_name"));
  const displayNameCn = parseStr(formData.get("display_name_cn"));
  const role = parseStr(formData.get("role")) || "operario";
  const warehouseId = parseStr(formData.get("warehouse_id"));

  const fieldErrors: Record<string, string> = {};
  if (!operarioId) return { error: "Falta operario_id" };
  if (!displayName) fieldErrors.display_name = "Nombre requerido";
  if (!warehouseId) fieldErrors.warehouse_id = "Warehouse requerido";
  if (!["operario", "supervisor"].includes(role))
    fieldErrors.role = "Rol inválido";
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const { error } = await supabase.rpc("admin_update_operario", {
    p_operario_id: operarioId,
    p_display_name: displayName,
    p_display_name_cn: displayNameCn || null,
    p_role: role,
    p_warehouse_id: warehouseId,
  });
  if (error) return { error: `No se pudo actualizar: ${error.message}` };

  revalidatePath("/studio/operarios");
  return { ok: true };
}
