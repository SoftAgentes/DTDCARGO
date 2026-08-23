/**
 * Enlace de acceso al portal corto y con marca propia (SDD-0253).
 *
 * ── El agujero que tapa ────────────────────────────────────────────────────
 * Compartir el acceso por WhatsApp mandaba el magic-link CRUDO de Supabase:
 *
 *   https://<ref>.supabase.co/auth/v1/verify?token=…&type=magiclink&redirect_to=…
 *
 * Medido en producción el 2026-08-09 con DTD-9017: la tarjeta de vista previa de
 * WhatsApp mostró el título y la descripción de **dtdcargo.com**. Esa metadata no
 * existe en `/auth/v1/verify` —ese endpoint devuelve un 302, no HTML—, así que el
 * robot recorrió la cadena entera, incluido el paso que **consume el token de un
 * solo uso**. El cliente recibió un enlace ya muerto.
 *
 * ── Cómo se arregla ────────────────────────────────────────────────────────
 * Metiendo una página en el medio. `/entrar/<código>` sólo LEE al abrirse; el
 * magic-link se acuña en el POST del botón. Los crawlers hacen GET y no aprietan
 * botones, así que ven la página (y sacan un preview con la marca DTD) sin gastar
 * nada.
 *
 * Efecto lateral buscado: el token deja de nacer cuando el ASESOR aprieta el
 * botón y nace cuando el CLIENTE lo lee → se acabó el TTL corto de Auth que
 * obligaba a coordinar en vivo. El código corto dura {@link ACCESS_LINK_TTL_HOURS}.
 *
 * ⚠️ El código es una **llave al portador**: quien lo tenga entra como el
 * cliente. Un solo uso, vence, revocable — y la ruta pública responde el MISMO
 * error para todos los modos de fallo (ver {@link AccessLinkState}).
 */

import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com";

/** Horas que vive un código. 3 días: el cliente contesta el WhatsApp cuando puede. */
export const ACCESS_LINK_TTL_HOURS = 72;

/** Largo del código. 10 chars sobre 30 símbolos ≈ 49 bits de entropía. */
export const ACCESS_CODE_LENGTH = 10;

/**
 * Alfabeto tipo Crockford sin ambigüedad visual: **30 símbolos**, sin `0/O`,
 * `1/I/L` ni `U`. Importa porque este código se dicta por teléfono y se copia a
 * mano cuando WhatsApp parte el enlace en dos líneas.
 */
export const ACCESS_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

export type AccessLinkRow = {
  id: string;
  tenant_id: string;
  client_id: string;
  code: string;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
};

/**
 * Estado de un código. `ok` es el único que abre la puerta.
 *
 * La ruta pública **no** distingue estos casos de cara al visitante: muestra un
 * único mensaje genérico. Diferenciar "no existe" de "existe pero está usado" le
 * confirmaría a un enumerador cuáles códigos son reales.
 */
export type AccessLinkState = "ok" | "used" | "expired" | "revoked";

/**
 * Genera un código con {@link ACCESS_CODE_ALPHABET}.
 *
 * Usa **rechazo** en vez de `% alfabeto.length` a secas: 256 no es múltiplo de
 * 30, así que el módulo pelado haría los 16 primeros símbolos más probables que
 * el resto. Descartar los bytes que caen fuera del último bloque completo
 * (`< 240`) mantiene la distribución uniforme, que es de donde salen los 49 bits.
 */
export function generateAccessCode(length: number = ACCESS_CODE_LENGTH): string {
  const alphabet = ACCESS_CODE_ALPHABET;
  const n = alphabet.length;
  // Mayor múltiplo de n que entra en un byte: todo lo de arriba se descarta.
  const limit = Math.floor(256 / n) * n;

  let out = "";
  while (out.length < length) {
    // Se pide de más para no volver al kernel por cada carácter descartado.
    const buf = randomBytes((length - out.length) * 2);
    for (const byte of buf) {
      if (byte >= limit) continue;
      out += alphabet[byte % n];
      if (out.length === length) break;
    }
  }
  return out;
}

/** URL que ve el cliente. Corta y en nuestro dominio — ése es el punto. */
export function accessLinkUrl(code: string): string {
  return `${SITE_URL}/entrar/${code}`;
}

/**
 * Clasifica una fila. Puro: recibe el "ahora" en vez de leer el reloj para que el
 * test pueda pararse en cualquier instante sin esperar 72 horas.
 */
export function classifyAccessLink(
  row: Pick<AccessLinkRow, "expires_at" | "used_at" | "revoked_at">,
  nowMs: number,
): AccessLinkState {
  if (row.revoked_at) return "revoked";
  if (row.used_at) return "used";
  const expiresMs = Date.parse(row.expires_at);
  // Una fecha ilegible se trata como vencida: ante la duda, no se abre la puerta.
  if (Number.isNaN(expiresMs) || expiresMs <= nowMs) return "expired";
  return "ok";
}

// ── Acceso a datos ──────────────────────────────────────────────────────────

export type CreateAccessLinkResult =
  | { ok: true; code: string; url: string; expiresAt: string }
  | { ok: false; error: string };

/**
 * Emite un código para un cliente. Lo llama el Studio con la sesión del asesor:
 * el RPC es SECURITY DEFINER y verifica el tenant adentro.
 *
 * @param supabase cliente con la sesión del asesor (NO el admin).
 */
export async function createAccessLink(
  supabase: SupabaseClient,
  clientId: string,
  ttlHours: number = ACCESS_LINK_TTL_HOURS,
): Promise<CreateAccessLinkResult> {
  const code = generateAccessCode();

  const { data, error } = await supabase.rpc("portal_create_access_link", {
    p_client_id: clientId,
    p_code: code,
    p_ttl_hours: ttlHours,
  });

  if (error) {
    return { ok: false, error: "No se pudo emitir el acceso. Intenta de nuevo." };
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | { expires_at?: string }
    | null;

  return {
    ok: true,
    code,
    url: accessLinkUrl(code),
    expiresAt: row?.expires_at ?? "",
  };
}

/**
 * Busca un código. Lo llama la ruta pública con `service_role`: el visitante es
 * anónimo y `anon` no tiene ningún permiso sobre esta tabla.
 *
 * **No marca nada.** Que este camino sea de sólo lectura es lo que impide que el
 * crawler de WhatsApp queme el enlace.
 */
export async function resolveAccessLink(
  admin: SupabaseClient,
  code: string,
): Promise<AccessLinkRow | null> {
  const clean = code.trim().toUpperCase();
  if (!clean || clean.length > 64) return null;

  const { data, error } = await admin
    .from("portal_access_links")
    .select("id, tenant_id, client_id, code, expires_at, used_at, revoked_at")
    .eq("code", clean)
    .maybeSingle<AccessLinkRow>();

  if (error) return null;
  return data ?? null;
}

/**
 * Sella el código como usado. Devuelve `false` si alguien llegó primero.
 *
 * El `is("used_at", null)` es la parte que importa: hace del sellado un
 * **claim atómico**. Sin él, dos POST simultáneos (doble toque en un teléfono
 * lento) acuñarían dos sesiones con el mismo código.
 */
export async function consumeAccessLink(
  admin: SupabaseClient,
  linkId: string,
  nowIso: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from("portal_access_links")
    .update({ used_at: nowIso })
    .eq("id", linkId)
    .is("used_at", null)
    .is("revoked_at", null)
    .select("id");

  if (error) return false;
  return (data ?? []).length > 0;
}

/**
 * Devuelve el código a "sin usar" cuando el sellado salió bien pero acuñar el
 * magic-link falló.
 *
 * Sin esto, un hipo de Supabase Auth le quemaría el acceso al cliente y lo
 * dejaría con un error definitivo y ninguna salida. Se reclama primero y se
 * suelta si el trabajo no se pudo hacer — no al revés.
 */
export async function releaseAccessLink(
  admin: SupabaseClient,
  linkId: string,
): Promise<void> {
  await admin
    .from("portal_access_links")
    .update({ used_at: null })
    .eq("id", linkId);
}

/** Datos del cliente que necesita la página pública: saludo + correo del enlace. */
export type AccessTarget = { name: string | null; email: string | null };

/**
 * Cliente al que apunta un código. Con `service_role`: el visitante es anónimo.
 * Un cliente borrado (soft delete) devuelve `null` → el código deja de abrir.
 */
export async function loadAccessTarget(
  admin: SupabaseClient,
  clientId: string,
): Promise<AccessTarget | null> {
  const { data, error } = await admin
    .from("clients")
    .select("name, email")
    .eq("id", clientId)
    .is("deleted_at", null)
    .maybeSingle<AccessTarget>();

  if (error) return null;
  return data ?? null;
}

/**
 * Primer nombre, para saludar sin volcar el nombre completo en una página que
 * abre cualquiera que tenga el enlace.
 */
export function firstName(name: string | null): string | null {
  const clean = (name ?? "").trim();
  if (!clean) return null;
  const first = clean.split(/\s+/)[0];
  // Los nombres importados vienen en MAYÚSCULA SOSTENIDA; se ve como un grito.
  return first.length > 2 && first === first.toUpperCase()
    ? first.charAt(0) + first.slice(1).toLowerCase()
    : first;
}
