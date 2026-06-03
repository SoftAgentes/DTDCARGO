/**
 * Provider CNE gratis — consulta el padrón electoral por cédula (SDD-0046).
 *
 * Server-only (hace `fetch` a un endpoint público de consulta de cédula del CNE).
 * Implementa `IdentityProvider`: recibe el número de cédula limpio y devuelve el
 * nombre que el registro tiene asociado, o `null` si no se encontró.
 *
 * ── ESTADO V1: manual-only (auto diferido, código swap-ready) ──────────────────
 * Validado 2026-06-03: **no hay un wrapper CNE gratis hosteado confiable**. Los de
 * facto (megacreativo `api.megacreativo.com/public/cedula/...`, `cedula.com.ve`)
 * están **caídos o geo-restringidos** — desde Vercel (US) el hosted da
 * `ECONNREFUSED` y las fuentes VE bloquean por geografía. Por eso este provider
 * **NO está wired por default**: sin `IDENTITY_CNE_URL` configurada, `lookup`
 * devuelve `null` INMEDIATO (sin `fetch`, sin malgastar el timeout) → el motor
 * (`verifyIdentity`) reporta `unavailable` → la UI cae al **piso manual** (deep-link
 * a la consulta oficial + marca del asesor), que es el camino V1 para cédula Y
 * empresa.
 *
 * ── Swap-ready ─────────────────────────────────────────────────────────────────
 * Cuando exista un endpoint compatible (self-host de un wrapper o un proxy sin
 * geo-bloqueo), setear `IDENTITY_CNE_URL` apuntando a su base lo habilita sin
 * tocar código. El request sigue el **contrato de-facto megacreativo /
 * cedula.com.ve**:
 *
 *     GET {base}/?nac={V|E}&dni={numero}
 *     → { status, data: { nac, dni, name, lastname, fullname, ... } }
 *
 * Diseño:
 *   - **Sin default**: sin `IDENTITY_CNE_URL` → no se intenta nada (null inmediato).
 *   - **Query params** `?nac=&dni=` (NO el path `/{nac}/{num}`).
 *   - **Timeout corto** (AbortController, 8s) — el gov es lento/intermitente.
 *   - **Nunca tira sin control**: red caída, status != 2xx, body raro, parse fail o
 *     `status` de error en el body → `null`. El motor lo trata como `unavailable`.
 */

import "server-only";
import type { IdentityProvider } from "../types";
import type { CedulaParts } from "../document";

/** Timeout de la consulta al registro (ms). El gov es lento → corto pero realista. */
const LOOKUP_TIMEOUT_MS = 8_000;

/**
 * Extrae el nombre/razón social de la respuesta del wrapper.
 *
 * Shape PRIMARIO (megacreativo / cedula.com.ve, el de-facto):
 *   { status, data: { nac, dni, name, lastname, fullname, ... } }
 *   - `data.fullname` preferido; fallback `data.name` + `data.lastname` juntos.
 *   - `status` del body: 200 → ok · 404/303 → no encontrado · 306 → CNE offline.
 *
 * Para esos `status` de "no hay dato" devolvemos `null` aunque venga `data` vacío.
 * Mantenemos fallbacks defensivos para otros wrappers (nombre/fullName/primer_*),
 * pero el shape megacreativo manda.
 */
export function parseRegistryName(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;

  // Status del body (megacreativo): 200 ok · 404/303 no encontrado · 306 CNE caído.
  // Solo cortamos cuando el status indica explícitamente "no hay dato".
  const status = toStatusCode(o.status);
  if (status === 404 || status === 303 || status === 306) return null;

  // Algunos wrappers anidan el dato en `data`.
  const data =
    o.data && typeof o.data === "object"
      ? (o.data as Record<string, unknown>)
      : o;

  // Shape megacreativo primario: fullname directo.
  const fullname = str(data.fullname);
  if (fullname) return fullname;

  // Shape megacreativo: name + lastname por separado.
  const mcName = [str(data.name), str(data.lastname)]
    .filter((x): x is string => x.length > 0)
    .join(" ")
    .trim();
  if (mcName.length > 0) return mcName;

  // Fallbacks defensivos para otros wrappers: campo único con el nombre completo.
  const directKeys = ["nombre", "nombre_completo", "fullName"];
  for (const k of directKeys) {
    const v = str(data[k]);
    if (v) return v;
  }

  // Fallback: nombres + apellidos por separado (esquema español viejo).
  const first = [str(data.primer_nombre), str(data.segundo_nombre)]
    .filter((x): x is string => x.length > 0)
    .join(" ");
  const last = [str(data.primer_apellido), str(data.segundo_apellido)]
    .filter((x): x is string => x.length > 0)
    .join(" ");
  const joined = [first, last].filter((s) => s.length > 0).join(" ").trim();
  if (joined.length > 0) return joined;

  return null;
}

/** Coerce de `status` (number o string numérica) a número, o null si no aplica. */
function toStatusCode(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && /^\d+$/.test(v.trim())) return Number(v.trim());
  return null;
}

/** Devuelve el string trimmeado si es no-vacío, o "" si no es string útil. */
function str(v: unknown): string {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : "";
}

/**
 * Crea el provider CNE gratis. La función `lookup` cumple el contrato de
 * `IdentityProvider`: recibe el número de cédula crudo (lo que pasa el motor).
 *
 * **Sin `IDENTITY_CNE_URL` configurada → `lookup` devuelve `null` inmediato** (no
 * hay endpoint confiable hosteado; ver cabecera). Con la env seteada, arma el
 * request al contrato megacreativo (`?nac=&dni=`).
 */
export function createCedulaVeProvider(): IdentityProvider {
  return {
    async lookup(doc: string): Promise<{ registryName: string } | null> {
      // Sin endpoint configurado no se intenta nada: el wrapper gratis hosteado
      // está caído/geo-restringido. Degradamos a piso manual sin esperar timeout.
      const rawBase = process.env.IDENTITY_CNE_URL;
      if (!rawBase || rawBase.trim().length === 0) return null;
      const base = rawBase.trim().replace(/\/+$/, "");

      // `doc` puede venir como "V12345678" o "12345678". Separamos nacionalidad
      // (default V) + número para armar el query del wrapper.
      const parts = splitDoc(doc);
      if (!parts) return null;

      const qs = new URLSearchParams({
        nac: parts.nationality,
        dni: parts.number,
      });
      const url = `${base}/?${qs.toString()}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);

      try {
        const res = await fetch(url, {
          method: "GET",
          headers: { Accept: "application/json" },
          signal: controller.signal,
          // No queremos que Next cachee una consulta a un registro vivo.
          cache: "no-store",
        });

        if (!res.ok) return null;

        let body: unknown;
        try {
          body = await res.json();
        } catch {
          return null; // body no es JSON → registro no consultable.
        }

        const registryName = parseRegistryName(body);
        return registryName ? { registryName } : null;
      } catch {
        // Abort (timeout) / red caída / DNS / etc. → null (motor degrada a manual).
        return null;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

/** Separa "V12345678" → { nationality:'V', number:'12345678' }. Default V. */
function splitDoc(doc: string): CedulaParts | null {
  const cleaned = (doc ?? "").replace(/[\s.\-_]/g, "").toUpperCase();
  if (cleaned.length === 0) return null;
  let nationality: "V" | "E" = "V";
  let rest = cleaned;
  if (cleaned[0] === "V" || cleaned[0] === "E") {
    nationality = cleaned[0] as "V" | "E";
    rest = cleaned.slice(1);
  }
  const number = rest.replace(/\D/g, "");
  if (number.length === 0) return null;
  return { nationality, number };
}
