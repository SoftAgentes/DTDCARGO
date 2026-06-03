/**
 * Provider CNE gratis — consulta el padrón electoral por cédula (SDD-0046 · Slice B).
 *
 * Server-only (hace `fetch` a un endpoint público de consulta de cédula del CNE).
 * Implementa `IdentityProvider`: recibe el número de cédula limpio y devuelve el
 * nombre que el registro tiene asociado, o `null` si no se encontró.
 *
 * Diseño:
 *   - **Base URL por env** `IDENTITY_CNE_URL` (default documentado abajo). El
 *     endpoint del CNE/wrappers cambia de host seguido; no lo hardcodeamos.
 *   - **Timeout corto** (AbortController, 8s) — el sitio gov es lento/intermitente.
 *   - **Nunca tira sin control**: ante red caída, status != 2xx, body raro o parse
 *     fallido devuelve `null`. El motor (`verifyIdentity`) lo trata como
 *     `unavailable` y degrada al piso manual. (Igual el motor envuelve en try/catch,
 *     pero acá ya no propagamos.)
 *
 * NOTA (follow-up manual, como el spike SENIAT): la validación contra el endpoint
 * REAL vivo es trabajo manual posterior — el host/forma de respuesta del wrapper
 * CNE gratis varía y puede requerir ajustar `parseRegistryName`. La lógica + los
 * tests con provider mock son lo que cierra B1; NO bloqueamos en red acá.
 */

import "server-only";
import type { IdentityProvider } from "../types";
import type { CedulaParts } from "../document";

/**
 * Default del wrapper CNE gratis. Patrón `{base}/{nacionalidad}/{numero}` que
 * responde JSON con el nombre. Override con `IDENTITY_CNE_URL` cuando el host
 * cambie o se quiera apuntar a otro wrapper. Se valida contra el real como
 * follow-up manual (ver nota de cabecera).
 */
const DEFAULT_CNE_URL = "https://api.cedula.com.ve/api/v1";

/** Timeout de la consulta al registro (ms). El gov es lento → corto pero realista. */
const LOOKUP_TIMEOUT_MS = 8_000;

/**
 * Extrae el nombre/razón social de la respuesta del wrapper. Los wrappers CNE
 * gratis no comparten un esquema único, así que probamos las formas más comunes
 * de forma defensiva. Devuelve el nombre o `null` si la cédula no existe / el body
 * no trae nombre.
 */
export function parseRegistryName(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;

  // Algunos wrappers anidan el dato en `data`.
  const data =
    o.data && typeof o.data === "object"
      ? (o.data as Record<string, unknown>)
      : o;

  // Forma 1: campo único con el nombre completo.
  const directKeys = ["nombre", "name", "nombre_completo", "fullName"];
  for (const k of directKeys) {
    const v = data[k];
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }

  // Forma 2: nombres + apellidos por separado.
  const first = [data.primer_nombre, data.segundo_nombre]
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .join(" ");
  const last = [data.primer_apellido, data.segundo_apellido]
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .join(" ");
  const joined = [first, last].filter((s) => s.length > 0).join(" ").trim();
  if (joined.length > 0) return joined;

  // Algunos wrappers marcan "no encontrado" con error/`null`.
  return null;
}

/**
 * Crea el provider CNE gratis. Recibe `parseCedula` ya aplicado afuera no — acá
 * recibe el número crudo (lo que pasa el motor); la nacionalidad ayuda a algunos
 * wrappers. La función `lookup` cumple el contrato de `IdentityProvider`.
 */
export function createCedulaVeProvider(): IdentityProvider {
  const base = (process.env.IDENTITY_CNE_URL ?? DEFAULT_CNE_URL).replace(
    /\/+$/,
    "",
  );

  return {
    async lookup(doc: string): Promise<{ registryName: string } | null> {
      // `doc` puede venir como "V12345678" o "12345678". Separamos nacionalidad
      // (default V) + número para armar la URL del wrapper.
      const parts = splitDoc(doc);
      if (!parts) return null;

      const url = `${base}/${parts.nationality}/${parts.number}`;
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
