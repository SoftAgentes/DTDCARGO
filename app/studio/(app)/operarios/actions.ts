"use server";

/**
 * Server actions del módulo Operarios (SDD-0028).
 *
 * Patrón Studio: cliente Supabase con session del usuario authenticated,
 * llama RPCs admin_* que validan assert_tenant_match() server-side.
 * NO service_role — el admin tiene su propio JWT.
 *
 * SDD-0515 (migr 0475):
 *  - alta, restablecimiento y «Ver PIN» exigen un motivo que va a la auditoría;
 *  - alta y restablecimiento rechazan con P0018 un PIN que ya usa otro operario
 *    activo del mismo tenant y región: si el PIN lo generó el servidor, se
 *    sortea otro y se reintenta; si lo escribió el admin, vuelve como error del
 *    campo PIN para que elija otro;
 *  - reactivar a un operario de baja se hace restableciendo su PIN
 *    (`reactivar=1`): el toggle ya no lo reactiva (P0019).
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import {
  OPERARIO_MOTIVO_MESSAGE,
  OPERARIO_PIN_IN_USE_MESSAGE,
  OPERARIO_PIN_PROBLEM_MESSAGE,
  isOperarioMotivoRejected,
  isOperarioPinInUse,
  operarioMotivoProblem,
  operarioPinProblem,
  type ViewPinResult,
} from "@/lib/studio/operario-pin";
import { saveWithGeneratedOperarioPin } from "@/lib/studio/operario-pin-generator";

type State = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Si la action creó un operario o restableció su PIN, devolvemos el PIN
   *  en claro para mostrarlo al admin UNA vez en esa respuesta. La base
   *  guarda el hash bcrypt y una copia cifrada que sólo sale por «Ver PIN». */
  pinReveal?: string;
};

type RpcError = { code?: string; message: string };

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

/**
 * Traduce el rechazo de la base al estado del formulario: el PIN repetido y el
 * motivo inválido van a su campo (el mensaje de la base ya está en tuteo); lo
 * demás, al aviso general con el prefijo de la acción.
 */
function rpcErrorState(error: RpcError, prefix: string, pinField: boolean): State {
  if (pinField && isOperarioPinInUse(error)) {
    return { fieldErrors: { pin: OPERARIO_PIN_IN_USE_MESSAGE } };
  }
  if (isOperarioMotivoRejected(error)) {
    return { fieldErrors: { motivo: error.message } };
  }
  return { error: `${prefix}: ${error.message}` };
}

type PinMode = "generar" | "manual";

function parsePinMode(v: FormDataEntryValue | null): PinMode {
  return parseStr(v) === "manual" ? "manual" : "generar";
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
  const role = parseStr(formData.get("role")) || "operario";
  const motivo = parseStr(formData.get("motivo"));
  // SDD-0515: por defecto el PIN lo genera el servidor, como al restablecer;
  // el cliente ya no sortea nada. «Escribirlo yo» manda el PIN escrito.
  const mode = parsePinMode(formData.get("pin_mode"));
  const pin = mode === "manual" ? parseStr(formData.get("pin")) : null;

  const fieldErrors: Record<string, string> = {};
  if (!warehouseId) fieldErrors.warehouse_id = "Elige un warehouse";
  if (!displayName) fieldErrors.display_name = "Nombre requerido";
  if (!["operario", "supervisor"].includes(role))
    fieldErrors.role = "Rol inválido";
  if (pin !== null) {
    const problem = operarioPinProblem(pin);
    if (problem) fieldErrors.pin = OPERARIO_PIN_PROBLEM_MESSAGE[problem];
  }
  const motivoProblem = operarioMotivoProblem(motivo, pin);
  if (motivoProblem) fieldErrors.motivo = OPERARIO_MOTIVO_MESSAGE[motivoProblem];
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const create = (candidate: string) =>
    supabase.rpc("admin_create_operario", {
      p_tenant_id: tenantId,
      p_warehouse_id: warehouseId,
      p_display_name: displayName,
      p_display_name_cn: displayNameCn || null,
      p_pin: candidate,
      p_role: role,
      p_motivo: motivo,
    });

  if (pin !== null) {
    const { error } = await create(pin);
    if (error) return rpcErrorState(error, "No se pudo crear", true);
    revalidatePath("/studio/operarios");
    return { ok: true, pinReveal: pin };
  }

  const saved = await saveWithGeneratedOperarioPin(create);
  if (saved.error) return rpcErrorState(saved.error, "No se pudo crear", false);
  revalidatePath("/studio/operarios");
  return { ok: true, pinReveal: saved.pin };
}

// ─────────────────────────────────────────────────────────────
// Restablecer PIN (SDD-0513, SDD-0515)
//
// Dos caminos, el mismo candado (`moduleEditDenial` + la matriz de módulos que
// exige la RPC desde 0475) y la misma RPC: el PIN llega a la base en claro solo
// para que `admin_reset_operario_pin` lo guarde como hash bcrypt y cifrado.
//
//  · generateOperarioPinAction — el servidor sortea el PIN con
//    crypto.randomInt DESPUÉS del candado. Ignora cualquier `pin` que mande el
//    formulario. Si la base contesta que otro operario activo del mismo tenant
//    y región ya lo usa (P0018), sortea otro distinto y reintenta.
//  · resetOperarioPinAction — el admin escribe el PIN (camino de siempre); un
//    PIN repetido vuelve como error del campo.
//
// Los dos piden motivo, y con `reactivar=1` reactivan a un operario de baja.
// En los dos, el PIN viaja de vuelta en `pinReveal` y no se escribe en ningún
// log, tabla, URL ni almacenamiento; un PIN rechazado por repetido tampoco. La
// auditoría la escribe la RPC en su misma transacción (AUD-01), sin el PIN.
// ─────────────────────────────────────────────────────────────

const RESET_PREFIX = "No se pudo restablecer el PIN";

export async function generateOperarioPinAction(
  _prev: State,
  formData: FormData,
): Promise<State> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "operarios");
  if (denial) return { error: denial };
  const operarioId = parseStr(formData.get("operario_id"));
  if (!operarioId) return { error: "Falta el operario." };
  const motivo = parseStr(formData.get("motivo"));
  const motivoProblem = operarioMotivoProblem(motivo);
  if (motivoProblem) return { fieldErrors: { motivo: OPERARIO_MOTIVO_MESSAGE[motivoProblem] } };
  const reactivar = parseBool(formData.get("reactivar"));

  const saved = await saveWithGeneratedOperarioPin((candidate) =>
    supabase.rpc("admin_reset_operario_pin", {
      p_operario_id: operarioId,
      p_pin: candidate,
      p_motivo: motivo,
      p_reactivar: reactivar,
    }),
  );
  if (saved.error) return rpcErrorState(saved.error, RESET_PREFIX, false);

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
  const motivo = parseStr(formData.get("motivo"));
  const reactivar = parseBool(formData.get("reactivar"));

  if (!operarioId) return { error: "Falta el operario." };
  const fieldErrors: Record<string, string> = {};
  const problem = operarioPinProblem(pin);
  if (problem) fieldErrors.pin = OPERARIO_PIN_PROBLEM_MESSAGE[problem];
  const motivoProblem = operarioMotivoProblem(motivo, problem ? null : pin);
  if (motivoProblem) fieldErrors.motivo = OPERARIO_MOTIVO_MESSAGE[motivoProblem];
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const { error } = await supabase.rpc("admin_reset_operario_pin", {
    p_operario_id: operarioId,
    p_pin: pin,
    p_motivo: motivo,
    p_reactivar: reactivar,
  });
  if (error) return rpcErrorState(error, RESET_PREFIX, true);

  revalidatePath("/studio/operarios");
  return { ok: true, pinReveal: pin };
}

// ─────────────────────────────────────────────────────────────
// Ver PIN (SDD-0515)
//
// Misma regla que restablecer (la matriz, en edición) y un motivo obligatorio.
// La RPC escribe el evento `pin_visto` en su misma transacción antes de
// devolver el PIN; si el operario es anterior a 0475 no hay copia cifrada y
// devuelve null. El PIN sólo viaja en esta respuesta: nada de logs, tablas ni
// revalidatePath, porque ver no cambia nada.
// ─────────────────────────────────────────────────────────────

export async function viewOperarioPinAction(
  operarioId: string,
  motivoInput: string,
): Promise<ViewPinResult> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "operarios");
  if (denial) return { error: denial };
  if (!operarioId) return { error: "Falta el operario." };
  const motivo = String(motivoInput ?? "").trim();
  const motivoProblem = operarioMotivoProblem(motivo);
  if (motivoProblem) return { error: OPERARIO_MOTIVO_MESSAGE[motivoProblem], fieldError: "motivo" };

  const { data, error } = await supabase.rpc("admin_ver_operario_pin", {
    p_operario_id: operarioId,
    p_motivo: motivo,
  });
  if (error) {
    if (isOperarioMotivoRejected(error)) return { error: error.message, fieldError: "motivo" };
    return { error: `No se pudo mostrar el PIN: ${error.message}` };
  }
  return { ok: true, pin: typeof data === "string" && data.length > 0 ? data : null };
}

// ─────────────────────────────────────────────────────────────
// Toggle active
//
// Desde 0475 sólo desactiva: reactivar a un operario de baja se hace con el
// cajón «Reactivar», que le da un PIN nuevo (la base responde P0019 aquí).
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
