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

/** Cookie de la SEGUNDA capa — las piezas de producto (SDD-0242). */
export const MARCA_COOKIE_INTERNA = "dtd_marca_int";

const SEAL: SealOptions = { version: "m1", aad: "dtd-marca-access-v1" };

/**
 * AAD distinto para la cookie interna. No es cosmético: con el mismo AAD, una
 * cookie de marca válida se podría pegar en el campo de la interna y abriría —
 * el sello sólo prueba que lo firmamos nosotros, no PARA QUÉ. El AAD ata cada
 * token a su puerta.
 */
const SEAL_INTERNO: SealOptions = { version: "i1", aad: "dtd-marca-interno-v1" };

/**
 * Cuánto dura la sesión interna. **12 horas, y no los 30 días de la de marca.**
 *
 * La de marca dura un mes porque es para un diseñador externo que va a volver
 * durante un encargo. Esta es la capa profunda: da al ERP por dentro, a la app
 * del operario y a los formularios de inspección. Una jornada de trabajo es el
 * horizonte razonable — al día siguiente se vuelve a teclear.
 *
 * Va acá y no en la DB a propósito: una columna sin control en el ERP es una
 * perilla que nadie encuentra. Si hace falta cambiarla, es esta línea.
 */
const HORAS_SESION_INTERNA = 12;

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
  return verificar(code, "public");
}

/**
 * La segunda capa (SDD-0242): el código que abre las piezas de producto.
 *
 * Misma RPC, otro `scope`. Los contadores de bloqueo son independientes —
 * fallar éste no deja al visitante fuera del book, y al revés tampoco.
 */
export async function submitBrandInternalCode(code: string): Promise<CodeVerdict> {
  return verificar(code, "internal");
}

async function verificar(
  code: string,
  scope: "public" | "internal",
): Promise<CodeVerdict> {
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
      p_scope: scope,
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
    if (scope === "internal") {
      await setInternalCookie(tenantId, secret);
      return { status: "ok", sessionDays: HORAS_SESION_INTERNA / 24 };
    }
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

async function setInternalCookie(tenantId: string, secret: string) {
  const maxAge = HORAS_SESION_INTERNA * 60 * 60;
  const token = sealToken(
    { t: tenantId, exp: Math.floor(Date.now() / 1000) + maxAge } satisfies MarcaSession,
    secret,
    SEAL_INTERNO,
  );
  (await cookies()).set(MARCA_COOKIE_INTERNA, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
}

/** Cierra la sesión del visitante externo (no toca la del ERP). */
export async function clearBrandCookie() {
  const c = await cookies();
  c.delete(MARCA_COOKIE);
  // La interna se va con la de marca: dejarla viva sería que "Salir" mintiera —
  // el visitante creería que cerró y la capa profunda seguiría abierta.
  c.delete(MARCA_COOKIE_INTERNA);
}

/** Cierra SÓLO la capa interna, sin echar al visitante del brand book. */
export async function clearBrandInternalCookie() {
  (await cookies()).delete(MARCA_COOKIE_INTERNA);
}

/**
 * ¿Puede ver las piezas de producto?
 *
 * ⚠️ EXIGE LAS DOS PUERTAS: la de marca (cookie o sesión del ERP) **y** el
 * código interno. Es lo que hace que sea una segunda capa y no una alternativa
 * — sin esto, alguien con sólo el código interno entraría directo, y la capa
 * "extra" habría terminado siendo un atajo.
 *
 * La sesión del ERP NO alcanza por sí sola: la tienen los 57 módulos, y estas
 * piezas son de producto. Ése fue el punto del pedido.
 */
export async function hasBrandInternalAccess(): Promise<boolean> {
  const secret = marcaSecret();
  if (!secret) return false;
  const raw = (await cookies()).get(MARCA_COOKIE_INTERNA)?.value;
  const payload = openToken<MarcaSession>(raw, secret, SEAL_INTERNO);
  if (!payload?.exp || payload.exp * 1000 <= Date.now()) return false;
  return hasBrandAccess();
}

/** ¿Hay código interno puesto? Para que el ERP muestre el estado de la capa. */
export async function brandInternalIsOpen(): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const tenantId = await resolveBrandTenantId(admin);
    if (!tenantId) return false;
    const { data } = await admin
      .from("brand_access")
      .select("internal_code_hash")
      .eq("tenant_id", tenantId)
      .maybeSingle<{ internal_code_hash: string | null }>();
    return Boolean(data?.internal_code_hash);
  } catch {
    return false;
  }
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
