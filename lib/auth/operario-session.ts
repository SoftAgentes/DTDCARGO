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
 *   - cada request hace SELECT para validar (no puedes mantener sesión
 *     contra un operario que se desactivó)
 *
 * V2 sumar HMAC + rotation cuando salga del piloto.
 */

import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/db/admin";
import { getRequestIp } from "@/lib/http/request-ip";
import type { OperarioSession } from "@/lib/studio/operario-types";
import {
  LANG_COOKIE_MAX_AGE_DAYS,
  LANG_COOKIE_NAME,
  regionToOperarioLang,
} from "@/lib/lang";

const COOKIE_NAME = "dtd_op";
const MODE_COOKIE_NAME = "dtd_op_mode";
const COOKIE_MAX_AGE_SEC = 60 * 60 * 12; // 12 horas — turno del operario

// ─────────────────────────────────────────────────────────────
// Mode cookie helpers (Sprint F v3 · multi-rol selector "Modos")
// ─────────────────────────────────────────────────────────────

const VALID_MODES: ReadonlyArray<"operario" | "supervisor" | "bodeguero" | "camionero"> = [
  "operario",
  "supervisor",
  "bodeguero",
  "camionero",
];

/**
 * Setea cookie del rol activo del día (12h). Llamado desde:
 *  - server action de `/m/ve/modos` cuando el operario elige modo.
 *  - login post-success si el operario es mono-rol (auto-set al único role).
 */
export async function setOperarioMode(
  mode: "operario" | "supervisor" | "bodeguero" | "camionero",
): Promise<void> {
  if (!VALID_MODES.includes(mode)) {
    throw new Error(`Modo inválido: ${mode}`);
  }
  const store = await cookies();
  store.set({
    name: MODE_COOKIE_NAME,
    value: mode,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/m",
    maxAge: COOKIE_MAX_AGE_SEC,
  });
}

/**
 * Lee la cookie de modo activo. Retorna null si no existe o es inválida.
 * Server-side only.
 */
export async function getOperarioMode(): Promise<
  "operario" | "supervisor" | "bodeguero" | "camionero" | null
> {
  const store = await cookies();
  const raw = store.get(MODE_COOKIE_NAME)?.value;
  if (!raw) return null;
  return VALID_MODES.includes(raw as (typeof VALID_MODES)[number])
    ? (raw as (typeof VALID_MODES)[number])
    : null;
}

/**
 * Limpia la cookie del modo activo (forzar re-selección en `/m/ve/modos`).
 * Llamado desde "Cambiar modo" en Settings menu del header.
 */
export async function clearOperarioMode(): Promise<void> {
  const store = await cookies();
  store.set({
    name: MODE_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/m",
    maxAge: 0,
  });
}

// ─────────────────────────────────────────────────────────────
// Sign in: llama RPC verify_operario_pin y setea cookie
// ─────────────────────────────────────────────────────────────

export async function signInWithPin(
  pin: string,
  region: "cn" | "ve",
): Promise<OperarioSession | null> {
  const admin = createAdminClient();

  // DTD opera con un tenant hoy. Resolverlo server-side evita que el cliente
  // pueda escoger otro namespace. Si deja de ser mono-tenant, esto falla cerrado
  // (maybeSingle) hasta que exista un selector gobernado.
  const { data: tenant, error: tenantError } = await admin
    .from("tenants")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (tenantError || !tenant?.id) return null;

  const requestIp = await getRequestIp();
  const attemptKey = createHash("sha256")
    .update(`${tenant.id}:${region}:${requestIp}`)
    .digest("hex");
  const { data, error } = await admin.rpc("verify_operario_pin", {
    p_pin: pin,
    p_tenant_id: tenant.id,
    p_region: region,
    p_attempt_key: attemptKey,
  });
  if (error) {
    console.error("[operario-session] verify_operario_pin error:", error);
    return null;
  }
  // RPC retorna setof — array vacío si no match
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return null;

  const roles = Array.isArray(row.roles) && row.roles.length > 0
    ? (row.roles as OperarioSession["roles"])
    : [row.role as OperarioSession["role"]];

  const session: OperarioSession = {
    operario_id: row.operario_id,
    tenant_id: row.tenant_id,
    warehouse_id: row.warehouse_id,
    display_name: row.display_name,
    display_name_cn: row.display_name_cn,
    role: row.role,
    roles,
    region: row.region,
    tms_driver_id: row.tms_driver_id ?? null,
    current_mode: null,            // se setea via setOperarioMode post-login
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

  // Sprint F v3: si el operario es mono-rol, auto-setear el modo del día.
  // Si es multi-rol, dejar la cookie sin setear · el flow `/m/ve/modos`
  // la setea cuando el operario elige.
  if (roles.length === 1) {
    store.set({
      name: MODE_COOKIE_NAME,
      value: roles[0],
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/m",
      maxAge: COOKIE_MAX_AGE_SEC,
    });
    session.current_mode = roles[0];
  }

  // Auto-setear cookie de idioma según operario.region (i18n bridge).
  // Un operario CN ve la PWA en chino desde el primer login sin tocar
  // nada · si después cambia manualmente el toggle, su elección persiste
  // (porque solo setea aquí Y al login, no a cada request).
  store.set({
    name: LANG_COOKIE_NAME,
    value: regionToOperarioLang(session.region),
    httpOnly: false,                  // legible desde client para toggle UI
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/m",
    maxAge: LANG_COOKIE_MAX_AGE_DAYS * 24 * 60 * 60,
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
    .select("id, tenant_id, warehouse_id, display_name, display_name_cn, role, roles, region, active, tms_driver_id")
    .eq("id", operarioId)
    .maybeSingle<{
      id: string;
      tenant_id: string;
      warehouse_id: string | null;
      display_name: string;
      display_name_cn: string | null;
      role: "operario" | "supervisor" | "bodeguero" | "camionero";
      roles: ("operario" | "supervisor" | "bodeguero" | "camionero")[] | null;
      region: "cn" | "ve";
      active: boolean;
      tms_driver_id: string | null;
    }>();

  if (error || !data || !data.active) {
    // Operario desactivado o borrado → limpiar cookie
    await signOutOperario();
    return null;
  }

  const roles =
    Array.isArray(data.roles) && data.roles.length > 0 ? data.roles : [data.role];

  const current_mode = await getOperarioMode();

  return {
    operario_id: data.id,
    tenant_id: data.tenant_id,
    warehouse_id: data.warehouse_id,
    display_name: data.display_name,
    display_name_cn: data.display_name_cn,
    role: data.role,
    roles,
    region: data.region,
    tms_driver_id: data.tms_driver_id,
    current_mode: current_mode && roles.includes(current_mode) ? current_mode : null,
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
