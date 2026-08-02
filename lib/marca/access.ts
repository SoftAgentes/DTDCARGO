/**
 * Gate de acceso a `/marca` (SDD-0238) — el código que abre el brand book.
 *
 * SOLO SERVIDOR.
 *
 * DOS LLAVES ABREN LA MISMA PUERTA:
 *   1. La sesión del ERP. El equipo no debería tener que acordarse de un número
 *      para ver su propia marca.
 *   2. El código de 4-6 dígitos. Es el que se le pasa a un diseñador externo por
 *      WhatsApp junto con el link, sin crearle una cuenta.
 *
 * BLOQUEO ESCALONADO (founder, 01-ago-2026): 3 fallos → 5 minutos · 3 más →
 * 1 hora. La cuenta y la escala viven en la RPC `verify_brand_access_code`
 * (migr 0334), no acá: si estuvieran en TypeScript, cualquiera que llame la RPC
 * por otro camino se las saltaría. Acá sólo se traduce el veredicto a UI.
 *
 * NO SE GUARDA LA IP. Lo que viaja a la DB es `attemptKeyFor()`: un SHA-256 de
 * la IP salada con el secreto del servidor. Sirve para contar intentos del mismo
 * visitante, pero no es reversible ni cruzable con otras tablas — y no convierte
 * el brand book en un registro de direcciones IP, que sería dato personal con su
 * deber de retención y aviso (ver `/revisar-datos-ve`).
 */

import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/db/admin";
import { getUser } from "@/lib/auth/session";
import { getRequestIp } from "@/lib/http/request-ip";
import { openToken, sealToken, type SealOptions } from "@/lib/shared/signed-token";

export const MARCA_COOKIE = "dtd_marca";

const SEAL: SealOptions = { version: "m1", aad: "dtd-marca-access-v1" };

type MarcaSession = {
  /** Tenant al que se le acertó el código. */
  t: string;
  /** Vencimiento en segundos epoch. */
  exp: number;
};

export type CodeVerdict =
  | { status: "ok"; sessionDays: number }
  | { status: "wrong"; attemptsLeft: number }
  | { status: "locked"; until: Date }
  | { status: "closed" }
  | { status: "unavailable" };

/**
 * Secreto para sellar la cookie y salar la huella. Dedicado si existe; si no, el
 * service-role key (ya presente en prod → sin variable de entorno nueva que
 * configurar). Mismo criterio que `unsubscribeSecret()`.
 */
function marcaSecret(): string | null {
  return (
    process.env.MARCA_ACCESS_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    null
  );
}

/**
 * Huella del visitante: SHA-256 de la IP salada con el secreto del servidor.
 * Salada a propósito — un hash pelado de una IPv4 se revierte con una tabla de
 * 4 mil millones de entradas en minutos, así que no sería anonimización.
 */
export function attemptKeyFor(ip: string, secret: string): string {
  return createHash("sha256").update(`marca:${secret}:${ip}`).digest("hex");
}

/**
 * El tenant operativo de DTD. Hoy hay uno solo; el criterio (el más antiguo) es
 * el mismo que ya usan `/registro` y `/api/registro/check`.
 */
export async function resolveBrandTenantId(
  admin: ReturnType<typeof createAdminClient> = createAdminClient(),
): Promise<string | null> {
  const { data } = await admin
    .from("tenants")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string }>();
  return data?.id ?? null;
}

/**
 * Verifica el código y, si acierta, deja la cookie puesta.
 *
 * FAIL-CLOSED: si falta el secreto, no se puede resolver el tenant o la RPC
 * revienta, devuelve `unavailable` y NO abre. Es lo contrario del throttle de
 * `/verificar` (fail-open a propósito para no romper el escaneo de un QR): acá
 * el mecanismo ES el control de acceso, y un control de acceso que se abre
 * cuando falla no es un control de acceso.
 */
export async function submitBrandCode(code: string): Promise<CodeVerdict> {
  const secret = marcaSecret();
  if (!secret) return { status: "unavailable" };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { status: "unavailable" };
  }

  const tenantId = await resolveBrandTenantId(admin);
  if (!tenantId) return { status: "unavailable" };

  const ip = await getRequestIp();
  const { data, error } = await admin
    .rpc("verify_brand_access_code", {
      p_tenant_id: tenantId,
      p_code: code,
      p_attempt_key: attemptKeyFor(ip, secret),
    })
    .maybeSingle<{
      ok: boolean;
      locked_until: string | null;
      attempts_left: number;
      session_days: number;
    }>();

  if (error || !data) return { status: "unavailable" };

  if (data.locked_until) return { status: "locked", until: new Date(data.locked_until) };
  if (data.ok) {
    await setBrandCookie(tenantId, data.session_days, secret);
    return { status: "ok", sessionDays: data.session_days };
  }
  // `attempts_left = 0` sin bloqueo = no hay código puesto (acceso cerrado).
  // La RPC responde igual que ante un código errado; la diferencia se deduce
  // acá para poder decirle al visitante que pida el enlace de nuevo en vez de
  // dejarlo tecleando contra una puerta tapiada.
  if (data.attempts_left === 0) return { status: "closed" };
  return { status: "wrong", attemptsLeft: data.attempts_left };
}

async function setBrandCookie(tenantId: string, days: number, secret: string) {
  const maxAge = days * 24 * 60 * 60;
  const token = sealToken(
    { t: tenantId, exp: Math.floor(Date.now() / 1000) + maxAge } satisfies MarcaSession,
    secret,
    SEAL,
  );
  (await cookies()).set(MARCA_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
}

/** Cierra la sesión del visitante externo (no toca la del ERP). */
export async function clearBrandCookie() {
  (await cookies()).delete(MARCA_COOKIE);
}

/** `true` si la cookie está bien sellada y no venció. */
async function hasValidCookie(): Promise<boolean> {
  const secret = marcaSecret();
  if (!secret) return false;
  const raw = (await cookies()).get(MARCA_COOKIE)?.value;
  const payload = openToken<MarcaSession>(raw, secret, SEAL);
  if (!payload?.exp) return false;
  return payload.exp * 1000 > Date.now();
}

/**
 * ¿Puede ver el brand book? Sesión del ERP **o** cookie del código.
 *
 * El orden importa poco pero la cookie se mira primero: es una operación de
 * cripto local, mientras que `getUser()` sale a validar el JWT contra Supabase.
 */
export async function hasBrandAccess(): Promise<boolean> {
  if (await hasValidCookie()) return true;
  return (await getUser()) !== null;
}

/**
 * CUÁL de las dos llaves abrió la puerta. `null` = no está abierta.
 *
 * Existe porque "Salir" sólo tiene sentido para una de las dos. Quien entró con
 * el código tiene una cookie que se puede borrar; quien entró con la sesión del
 * ERP no — se le borra la cookie (que quizá ni tiene), se le manda a `/marca`, y
 * la sesión lo deja pasar otra vez. Desde afuera parece que el botón está roto.
 * Con esto la cabecera puede ofrecer la acción que de verdad aplica.
 */
export async function brandAccessSource(): Promise<"code" | "session" | null> {
  if (await hasValidCookie()) return "code";
  return (await getUser()) !== null ? "session" : null;
}

/** ¿Hay un código puesto? Para que el ERP muestre el estado del acceso. */
export async function brandAccessIsOpen(): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const tenantId = await resolveBrandTenantId(admin);
    if (!tenantId) return false;
    const { data } = await admin
      .from("brand_access")
      .select("code_hash")
      .eq("tenant_id", tenantId)
      .maybeSingle<{ code_hash: string | null }>();
    return Boolean(data?.code_hash);
  } catch {
    return false;
  }
}
