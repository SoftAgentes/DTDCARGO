/**
 * Sesión del operario PWA (SDD-0027).
 *
 * El operario NO usa Supabase Auth (UX: PIN 4 dígitos). En su lugar,
 * después de validar el PIN contra `verify_operario_pin`, seteamos una
 * cookie HTTP-only con el `operario_id` (uuid v4, no enumerable).
 *
 * En cada server action, re-validamos contra DB (`getCurrentOperario`):
 *   - si la cookie falta → null
 *   - si el operario_id ya no existe o está `active = false` → null
 *
 * La cookie no está firmada con HMAC (V1). Riesgo aceptado porque:
 *   - es HTTP-only (no leíble desde JS del browser)
 *   - es uuid v4 random, no enumerable
 *   - cada request hace SELECT para validar (no podés mantener sesión
 *     contra un operario que se desactivó)
 *
 * V2 sumar HMAC + rotation cuando salga del piloto.
 */

import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/db/admin";
import type { OperarioSession } from "@/lib/studio/operario-types";

const COOKIE_NAME = "dtd_op";
const COOKIE_MAX_AGE_SEC = 60 * 60 * 12; // 12 horas — turno del operario

// ─────────────────────────────────────────────────────────────
// Sign in: llama RPC verify_operario_pin y setea cookie
// ─────────────────────────────────────────────────────────────

export async function signInWithPin(
  pin: string,
): Promise<OperarioSession | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("verify_operario_pin", { p_pin: pin });
  if (error) {
    console.error("[operario-session] verify_operario_pin error:", error);
    return null;
  }
  // RPC retorna setof — array vacío si no match
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return null;

  const session: OperarioSession = {
    operario_id: row.operario_id,
    tenant_id: row.tenant_id,
    warehouse_id: row.warehouse_id,
    display_name: row.display_name,
    display_name_cn: row.display_name_cn,
    role: row.role,
    region: row.region,
  };

  // Setear cookie HTTP-only con el operario_id
  const store = await cookies();
  store.set({
    name: COOKIE_NAME,
    value: session.operario_id,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/m",                       // sólo namespace mobile
    maxAge: COOKIE_MAX_AGE_SEC,
  });

  return session;
}

// ─────────────────────────────────────────────────────────────
// Get current: lee cookie y re-valida contra DB
// ─────────────────────────────────────────────────────────────

export async function getCurrentOperario(): Promise<OperarioSession | null> {
  const store = await cookies();
  const operarioId = store.get(COOKIE_NAME)?.value;
  if (!operarioId) return null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("operario_pins")
    .select("id, tenant_id, warehouse_id, display_name, display_name_cn, role, region, active")
    .eq("id", operarioId)
    .maybeSingle<{
      id: string;
      tenant_id: string;
      warehouse_id: string | null;
      display_name: string;
      display_name_cn: string | null;
      role: "operario" | "supervisor" | "bodeguero" | "camionero";
      region: "cn" | "ve";
      active: boolean;
    }>();

  if (error || !data || !data.active) {
    // Operario desactivado o borrado → limpiar cookie
    await signOutOperario();
    return null;
  }

  return {
    operario_id: data.id,
    tenant_id: data.tenant_id,
    warehouse_id: data.warehouse_id,
    display_name: data.display_name,
    display_name_cn: data.display_name_cn,
    role: data.role,
    region: data.region,
  };
}

// ─────────────────────────────────────────────────────────────
// Sign out: borra cookie
// ─────────────────────────────────────────────────────────────

export async function signOutOperario(): Promise<void> {
  const store = await cookies();
  store.set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/m",
    maxAge: 0,
  });
}
