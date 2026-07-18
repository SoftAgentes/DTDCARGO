/**
 * Sesión de desbloqueo del No-Olvidar — SDD-0025 §4.11.
 *
 * El No-Olvidar se "desbloquea" con 2FA (+ master password si el user la
 * configuró). El desbloqueo dura config.session_timeout_minutes (default 30);
 * pasado ese tiempo cualquier acción que descifre exige re-2FA. Acá vive el
 * cálculo de vigencia, el marcado de desbloqueo y el rate-limit de intentos
 * fallidos (§4.5).
 *
 * Mutaciones (markUnlocked / incrementFailedAttempt) requieren service_role o
 * el propio user (RLS permite UPDATE de su fila). Pasar el cliente adecuado.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

interface ConfigRow {
  session_timeout_minutes: number;
  failed_attempts_lockout: number;
  lockout_minutes: number;
}

const DEFAULTS: ConfigRow = {
  session_timeout_minutes: 30,
  failed_attempts_lockout: 5,
  lockout_minutes: 15,
};

// ─── validateUnlockSession ───────────────────────────────────

export interface SessionState {
  unlocked: boolean;
  /** ISO en que expira el desbloqueo, o null si no está desbloqueado. */
  expiresAt: string | null;
  /** true si el user está bloqueado por intentos fallidos (locked_until futuro). */
  locked: boolean;
  lockedUntil: string | null;
}

/**
 * Estado de la sesión del No-Olvidar para `userId`: ¿está desbloqueado (unlock
 * dentro de la ventana)? ¿está bloqueado por brute-force? Lee last_unlock_at,
 * locked_until y el timeout de config. Defensivo: si no encuentra la fila,
 * devuelve locked=false / unlocked=false (fuerza el 2FA).
 */
export async function validateUnlockSession(
  supabase: SupabaseClient,
  userId: string,
): Promise<SessionState> {
  const [keys, config] = await Promise.all([
    fetchKeys(supabase, userId),
    fetchConfig(supabase),
  ]);
  const now = Date.now();

  const lockedUntil = keys?.locked_until ?? null;
  const locked = lockedUntil != null && new Date(lockedUntil).getTime() > now;

  if (locked || !keys?.last_unlock_at) {
    return { unlocked: false, expiresAt: null, locked, lockedUntil };
  }

  const expiresMs =
    new Date(keys.last_unlock_at).getTime() + config.session_timeout_minutes * 60_000;
  const unlocked = expiresMs > now;
  return {
    unlocked,
    expiresAt: unlocked ? new Date(expiresMs).toISOString() : null,
    locked: false,
    lockedUntil,
  };
}

// ─── markUnlocked ────────────────────────────────────────────

/**
 * Marca el No-Olvidar como recién desbloqueado: last_unlock_at = now, resetea
 * los intentos fallidos y limpia el lockout. Llamar tras un 2FA exitoso.
 *
 * `totpStep` (opcional): step TOTP que se acaba de consumir. Se persiste como
 * `totp_last_step` para el anti-replay (§4.5) — el próximo unlock rechazará
 * cualquier código cuyo step sea ≤ a este.
 */
export async function markUnlocked(
  supabase: SupabaseClient,
  userId: string,
  totpStep?: number | null,
): Promise<boolean> {
  const patch: Record<string, unknown> = {
    last_unlock_at: new Date().toISOString(),
    failed_unlock_attempts: 0,
    locked_until: null,
    updated_at: new Date().toISOString(),
  };

  // Con step: el UPDATE es ATÓMICO y condicional — solo aplica si el step es
  // NUEVO (`totp_last_step` null o menor). Así el anti-replay (§4.5) no tiene la
  // carrera del read-then-write: dos requests con el mismo código fresco, solo
  // uno avanza; el otro matchea 0 filas y el caller lo trata como código ya usado.
  if (totpStep != null) {
    patch.totp_last_step = totpStep;
    const { data, error } = await supabase
      .from("no_olvidar_user_keys")
      .update(patch)
      .eq("user_id", userId)
      .or(`totp_last_step.is.null,totp_last_step.lt.${totpStep}`)
      .select("user_id");
    if (error) throw new Error(`No se pudo marcar el desbloqueo: ${error.message}`);
    return (data?.length ?? 0) > 0;
  }

  const { error } = await supabase.from("no_olvidar_user_keys").update(patch).eq("user_id", userId);
  if (error) throw new Error(`No se pudo marcar el desbloqueo: ${error.message}`);
  return true;
}

// ─── incrementFailedAttempt ──────────────────────────────────

export interface FailedAttemptResult {
  locked: boolean;
  until: string | null;
  attempts: number;
}

/**
 * Suma un intento fallido de desbloqueo de forma ATÓMICA vía el RPC
 * `no_olvidar_increment_failed_attempt` (migración 0224). Al alcanzar
 * config.failed_attempts_lockout, el RPC fija locked_until = now + lockout_minutes
 * (bloqueo total: aun con TOTP correcto el unlock se rechaza mientras dure). El
 * contador se resetea con markUnlocked al primer éxito.
 *
 * Se usa RPC (no read-then-write en TS) para no perder incrementos bajo carrera
 * de intentos casi simultáneos.
 */
export async function incrementFailedAttempt(
  supabase: SupabaseClient,
  userId: string,
): Promise<FailedAttemptResult> {
  const { data, error } = await supabase.rpc("no_olvidar_increment_failed_attempt", {
    p_user_id: userId,
  });
  if (error) throw new Error(`No se pudo registrar el intento fallido: ${error.message}`);
  const r = (data ?? {}) as { attempts?: number; locked?: boolean; until?: string | null };
  return {
    attempts: r.attempts ?? 0,
    locked: r.locked ?? false,
    until: r.until ?? null,
  };
}

// ─── Internos ────────────────────────────────────────────────

interface KeysRow {
  last_unlock_at: string | null;
  failed_unlock_attempts: number;
  locked_until: string | null;
}

async function fetchKeys(supabase: SupabaseClient, userId: string): Promise<KeysRow | null> {
  const { data } = await supabase
    .from("no_olvidar_user_keys")
    .select("last_unlock_at, failed_unlock_attempts, locked_until")
    .eq("user_id", userId)
    .maybeSingle<KeysRow>();
  return data;
}

async function fetchConfig(supabase: SupabaseClient): Promise<ConfigRow> {
  const { data } = await supabase
    .from("no_olvidar_config")
    .select("session_timeout_minutes, failed_attempts_lockout, lockout_minutes")
    .eq("id", 1)
    .maybeSingle<ConfigRow>();
  return data ?? DEFAULTS;
}
