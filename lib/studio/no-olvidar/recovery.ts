/**
 * Emergency recovery M-of-N del No-Olvidar — SDD-0025 §4.6.
 *
 * ┌─ REVIEW EXTERNO ─────────────────────────────────────────────────────────┐
 * │ Parte del bundle de code review crypto (spec §7.6). El flujo de recovery │
 * │ es un vector de abuso (un admin podría intentar resetear el acceso de    │
 * │ otro user), por eso las validaciones de abajo son de seguridad, no UX.    │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Flujo: un user que perdió el acceso crea un request → ≥N admins DISTINTOS lo
 * aprueban (default 2, config.recovery_approvals_required) → recién ahí el user
 * fija una nueva master password. Reglas duras:
 *   - Un admin NO puede aprobar su propio request (§4.6).
 *   - Un admin no cuenta dos veces (idempotencia por approver_id).
 *   - No se ejecuta si el request expiró (24 h) o ya se completó.
 *
 * Modelo V1 (custodial): los DEK de los items están envueltos por el KEK
 * (server-held), NO por la master password — así que resetear la master
 * password RESTAURA el acceso por completo (§269/§408-410). La master password
 * es un segundo factor de desbloqueo, no lo que protege los items. Re-envolver
 * la private_key (sharing V2) queda documentado como pendiente: en V1 la
 * private_key es null y no hay nada que re-envolver.
 *
 * Todas las mutaciones exigen cliente service_role (createAdminClient): el
 * GRANT de UPDATE sobre no_olvidar_recovery_requests / no_olvidar_user_keys
 * relevante es solo service_role.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  NoOlvidarRecoveryApproval,
  NoOlvidarRecoveryRequest,
} from "../no-olvidar-types";
import { generateSalt, hashForVerifier, toBase64 } from "./crypto";
import { logAccess } from "./audit";

const RECOVERY_TTL_HOURS = 24;

// ─── requestRecovery ─────────────────────────────────────────

/**
 * Crea un request de recovery pendiente para `userId`. `approvals_required` se
 * toma de la config al momento de crear (congela el umbral aunque luego cambie).
 * Audita recovery_requested.
 */
export async function requestRecovery(
  supabase: SupabaseClient,
  userId: string,
  reason: string,
): Promise<NoOlvidarRecoveryRequest> {
  const approvalsRequired = await getApprovalsRequired(supabase);
  const expiresAt = new Date(Date.now() + RECOVERY_TTL_HOURS * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("no_olvidar_recovery_requests")
    .insert({
      requester_user_id: userId,
      reason,
      status: "pending",
      approvals: [],
      approvals_required: approvalsRequired,
      expires_at: expiresAt,
    })
    .select("*")
    .single<NoOlvidarRecoveryRequest>();
  if (error) throw new Error(`No se pudo crear el request de recovery: ${error.message}`);

  await logAccess(supabase, {
    userId,
    action: "recovery_requested",
    metadata: { recovery_id: data.id, approvals_required: approvalsRequired },
  });
  return data;
}

// ─── approveRecovery ─────────────────────────────────────────

/**
 * Registra la aprobación de `approverId` sobre `recoveryId`. Idempotente: si
 * ese admin ya aprobó, no duplica. Cuando se alcanza approvals_required, marca
 * el request como 'approved'. Valida: el aprobador es admin y NO es el
 * solicitante. Audita recovery_approved.
 *
 * @param approverIp opcional, se guarda en el registro de la aprobación.
 */
export async function approveRecovery(
  supabase: SupabaseClient,
  recoveryId: string,
  approverId: string,
  approverIp?: string,
): Promise<NoOlvidarRecoveryRequest> {
  // Optimistic-locking con reintento: el append al array `approvals` es un
  // read-modify-write. Sin el guard `updated_at` dos admins aprobando a la vez
  // leen el mismo array y el 2º pisa la aprobación del 1º (lost-update →
  // el quórum nunca se alcanza aunque N admins distintos hayan aprobado). El
  // `.eq("updated_at", req.updated_at)` detecta la escritura concurrente (0 filas)
  // y reintentamos con el estado fresco.
  for (let attempt = 0; attempt < 5; attempt++) {
    const req = await fetchRequest(supabase, recoveryId);

    if (req.status !== "pending") {
      throw new RecoveryStateError(`El request no está pendiente (estado: ${req.status}).`);
    }
    if (isExpired(req)) {
      await markExpired(supabase, recoveryId);
      throw new RecoveryStateError("El request de recovery expiró.");
    }
    if (req.requester_user_id === approverId) {
      throw new RecoveryPolicyError("Un admin no puede aprobar su propio recovery.");
    }
    if (!(await isAdmin(supabase, approverId))) {
      throw new RecoveryPolicyError("Solo admins del No-Olvidar pueden aprobar recoveries.");
    }

    // Idempotencia: si ya aprobó, devolver el estado actual sin cambios.
    if (req.approvals.some((a) => a.approver_id === approverId)) {
      return req;
    }

    const approval: NoOlvidarRecoveryApproval = {
      approver_id: approverId,
      approved_at: new Date().toISOString(),
      ...(approverIp ? { ip: approverIp } : {}),
    };
    const approvals = [...req.approvals, approval];
    const reachedQuorum = approvals.length >= req.approvals_required;

    const { data, error } = await supabase
      .from("no_olvidar_recovery_requests")
      .update({
        approvals,
        status: reachedQuorum ? "approved" : "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", recoveryId)
      .eq("status", "pending") // no pisar un request ya resuelto
      .eq("updated_at", req.updated_at) // optimistic: detecta append concurrente
      .select("*")
      .maybeSingle<NoOlvidarRecoveryRequest>();
    if (error) throw new Error(`No se pudo registrar la aprobación: ${error.message}`);
    if (!data) continue; // 0 filas → otra aprobación ganó la carrera → releer y reintentar

    await logAccess(supabase, {
      userId: approverId,
      action: "recovery_approved",
      metadata: {
        recovery_id: recoveryId,
        requester: req.requester_user_id,
        approvals: approvals.length,
        required: req.approvals_required,
        reached_quorum: reachedQuorum,
      },
    });
    return data;
  }
  throw new RecoveryStateError(
    "No se pudo registrar la aprobación por contención concurrente. Reintentá.",
  );
}

// ─── executeRecovery ─────────────────────────────────────────

/**
 * Ejecuta el recovery: fija una nueva master password para el solicitante. Solo
 * si el request está 'approved' (quórum alcanzado), no expiró y no se completó.
 * Resetea verifier+salt, limpia intentos fallidos y lockout, y marca el request
 * 'completed'. Audita recovery_executed.
 *
 * V1: la private_key es null (sharing V2), así que no hay re-wrap de private_key.
 * Si algún día existe, hay un guard explícito que lo bloquea hasta implementarlo.
 */
export async function executeRecovery(
  supabase: SupabaseClient,
  recoveryId: string,
  newPassword: string,
  callerUserId: string,
): Promise<void> {
  const req = await fetchRequest(supabase, recoveryId);

  // Autorización: solo el propio solicitante fija su nueva master password. Sin
  // esto, cualquiera con el recoveryId de un request 'approved' (p.ej. un admin,
  // que ve todos por RLS) secuestraba el acceso de la víctima (§4.6).
  if (req.requester_user_id !== callerUserId) {
    throw new RecoveryPolicyError("Solo quien solicitó la recuperación puede ejecutarla.");
  }
  if (req.status === "completed") {
    throw new RecoveryStateError("El recovery ya fue ejecutado.");
  }
  if (req.status !== "approved" || req.approvals.length < req.approvals_required) {
    throw new RecoveryStateError("El recovery todavía no reunió las aprobaciones necesarias.");
  }
  if (isExpired(req)) {
    await markExpired(supabase, recoveryId);
    throw new RecoveryStateError("El request de recovery expiró antes de ejecutarse.");
  }

  // Guard V2: si el user tuviera private_key cifrada con la master vieja, no
  // podemos re-envolverla sin la clave vieja. En V1 esto es siempre null.
  const { data: keys, error: keysErr } = await supabase
    .from("no_olvidar_user_keys")
    .select("private_key_ciphertext")
    .eq("user_id", req.requester_user_id)
    .maybeSingle<{ private_key_ciphertext: string | null }>();
  if (keysErr) throw new Error(`No se pudo leer las llaves del user: ${keysErr.message}`);
  if (keys?.private_key_ciphertext) {
    throw new RecoveryStateError(
      "Este user tiene una private_key (sharing V2) — su recovery requiere re-wrap no implementado en V1.",
    );
  }

  const salt = await generateSalt();
  const verifier = await hashForVerifier(newPassword, salt);

  // ORDEN: resetear la master password ANTES de marcar el request 'completed'.
  // Sin transacción real (dos UPDATEs), este orden hace que la única cola de
  // fallo sea RECUPERABLE: si el 2º update (marcar completed) fallara, el user
  // igual recuperó el acceso y el request sigue 'approved' → re-ejecutable. Con el
  // orden inverso (claim primero), un fallo del reset dejaba el request quemado
  // sin recuperar el acceso. La doble-ejecución concurrente es inocua: la autz
  // `caller===requester` (arriba) la limita al mismo usuario con la misma
  // password, y el claim guardado por status='approved' asegura un solo cierre.
  const { error: upKeysErr } = await supabase
    .from("no_olvidar_user_keys")
    .update({
      master_password_verifier: toBase64(verifier),
      master_password_salt: toBase64(salt),
      has_master_password: true,
      failed_unlock_attempts: 0,
      locked_until: null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", req.requester_user_id);
  if (upKeysErr) throw new Error(`No se pudo resetear la master password: ${upKeysErr.message}`);

  const { data: claimed, error: upReqErr } = await supabase
    .from("no_olvidar_recovery_requests")
    .update({
      status: "completed",
      new_master_password_verifier: toBase64(verifier),
      new_master_password_salt: toBase64(salt),
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", recoveryId)
    .eq("status", "approved") // solo un cierre; 0 filas = otra ejecución concurrente ya cerró
    .select("id");
  if (upReqErr) throw new Error(`No se pudo cerrar el request: ${upReqErr.message}`);

  // Auditar solo si NOSOTROS cerramos el request (evita doble log en carrera). Si
  // 0 filas, el reset ya ocurrió y otra llamada concurrente registró el evento.
  if (claimed && claimed.length > 0) {
    await logAccess(supabase, {
      userId: req.requester_user_id,
      action: "recovery_executed",
      metadata: { recovery_id: recoveryId, approvals: req.approvals.length },
    });
  }
}

// ─── rejectRecovery ──────────────────────────────────────────

/**
 * Rechaza un request pendiente. Valida que `adminId` es admin. La razón queda
 * en el metadata del request (el estado 'rejected' es el registro inmutable).
 */
export async function rejectRecovery(
  supabase: SupabaseClient,
  recoveryId: string,
  adminId: string,
  reason: string,
): Promise<NoOlvidarRecoveryRequest> {
  if (!(await isAdmin(supabase, adminId))) {
    throw new RecoveryPolicyError("Solo admins pueden rechazar recoveries.");
  }
  const req = await fetchRequest(supabase, recoveryId);
  if (req.status !== "pending") {
    throw new RecoveryStateError(`Solo se rechazan requests pendientes (estado: ${req.status}).`);
  }

  const { data, error } = await supabase
    .from("no_olvidar_recovery_requests")
    .update({
      status: "rejected",
      updated_at: new Date().toISOString(),
    })
    .eq("id", recoveryId)
    .eq("status", "pending")
    .select("*")
    .single<NoOlvidarRecoveryRequest>();
  if (error) throw new Error(`No se pudo rechazar el request: ${error.message}`);

  await logAccess(supabase, {
    userId: adminId,
    action: "recovery_approved", // no hay enum 'recovery_rejected'; el metadata lo aclara
    metadata: { recovery_id: recoveryId, rejected: true, reason, requester: req.requester_user_id },
  });
  return data;
}

// ─── Internos ────────────────────────────────────────────────

async function fetchRequest(
  supabase: SupabaseClient,
  recoveryId: string,
): Promise<NoOlvidarRecoveryRequest> {
  const { data, error } = await supabase
    .from("no_olvidar_recovery_requests")
    .select("*")
    .eq("id", recoveryId)
    .maybeSingle<NoOlvidarRecoveryRequest>();
  if (error) throw new Error(`No se pudo leer el request: ${error.message}`);
  if (!data) throw new RecoveryStateError("El request de recovery no existe.");
  return data;
}

async function getApprovalsRequired(supabase: SupabaseClient): Promise<number> {
  const { data } = await supabase
    .from("no_olvidar_config")
    .select("recovery_approvals_required")
    .eq("id", 1)
    .maybeSingle<{ recovery_approvals_required: number }>();
  return data?.recovery_approvals_required ?? 2;
}

async function isAdmin(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("no_olvidar_check_admin", { p_user_id: userId });
  if (error || data == null) return false;
  return data === true;
}

function isExpired(req: NoOlvidarRecoveryRequest): boolean {
  return new Date(req.expires_at).getTime() <= Date.now();
}

async function markExpired(supabase: SupabaseClient, recoveryId: string): Promise<void> {
  await supabase
    .from("no_olvidar_recovery_requests")
    .update({ status: "expired", updated_at: new Date().toISOString() })
    .eq("id", recoveryId)
    .eq("status", "pending");
}

// ─── Errores ─────────────────────────────────────────────────

/** Violación de política de seguridad (self-approval, no-admin). */
export class RecoveryPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecoveryPolicyError";
  }
}

/** Estado inválido del request (expirado, ya completado, sin quórum). */
export class RecoveryStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecoveryStateError";
  }
}
