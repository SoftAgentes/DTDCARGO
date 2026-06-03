/**
 * Parser de @menciones (SDD-0045) — el corazón puro y testeable del módulo.
 *
 * El composer del componente inserta tokens del estilo `@Nombre A.` (primer
 * nombre + inicial del apellido + punto, igual que el mockup comments.jsx).
 * El servidor NO confía en lo que el cliente diga que mencionó: re-resuelve los
 * tokens del cuerpo contra la lista REAL de usuarios del tenant y devuelve los
 * userIds. Tokens que no resuelven a nadie se ignoran (no rompen el comentario).
 *
 * Funciones puras (sin I/O): testeables sin DB.
 */

import type { CommentTenantUser } from "./types";

/**
 * Normaliza para matchear sin sensibilidad a mayúsculas/acentos.
 * "Martína" → "martina". Quita diacríticos (NFD + strip combining marks).
 */
function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Tokens de mención en el cuerpo. Captura, sin desbordar a la oración entera,
 * `@` + primer palabra + OPCIONALMENTE una segunda (apellido o inicial `A.`).
 * Bounded a 2 palabras a propósito: si capturara secuencias largas, "@Diego N.
 * asegurate que…" se tragaría toda la frase y no resolvería a nadie.
 *
 * Acepta:
 *   - "@Martina A."   (primer nombre + inicial apellido)   → grupos: Martina | A.
 *   - "@Martina"      (solo primer nombre)                 → grupos: Martina | ∅
 *   - "@Luis F"       (sin punto final)                    → grupos: Luis | F
 *   - "@Yusneidy Ramírez" (nombre + apellido completo)     → grupos: Yusneidy | Ramírez
 *
 * G1 = primer palabra · G2 = segunda palabra opcional (con punto opcional).
 */
const WORD = "[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+";
const MENTION_TOKEN_RE = new RegExp(
  `@(${WORD})(?:\\s+(${WORD}\\.?))?`,
  "gu",
);

/**
 * Construye, para un usuario, las "claves" normalizadas con las que un token de
 * mención podría referirse a él. Soporta:
 *   - nombre completo                  ("Martina Acosta")
 *   - primer nombre + inicial apellido ("Martina A")  ← formato del composer
 *   - solo primer nombre               ("Martina")
 */
function userMatchKeys(user: CommentTenantUser): string[] {
  const parts = user.name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return [];
  const first = parts[0];
  const keys = new Set<string>();
  keys.add(normalize(user.name)); // completo
  keys.add(normalize(first)); // solo primer nombre
  if (parts.length > 1) {
    const lastInitial = parts[1][0];
    keys.add(normalize(`${first} ${lastInitial}`)); // "martina a"
  }
  return [...keys];
}

/** Match exacto (claves) o por prefijo del nombre completo. */
function matchKey(token: string, users: CommentTenantUser[]): string | null {
  const t = normalize(token.replace(/\.$/, ""));
  if (!t) return null;
  for (const u of users) {
    if (userMatchKeys(u).includes(t)) return u.id;
  }
  for (const u of users) {
    if (normalize(u.name).startsWith(t)) return u.id;
  }
  return null;
}

/**
 * Resuelve un token de mención (primer palabra + segunda palabra OPCIONAL) a un
 * userId. Estrategia greedy-then-fallback:
 *   1. probar [first + second]  ("martina a." → Martina Acosta)
 *   2. si no, probar solo [first] ("@Diego que…" → cae a "Diego")
 * Devuelve { userId, consumedSecond } — consumedSecond indica si la 2da palabra
 * forma parte del nombre (para que el resaltado no incluya texto ajeno).
 */
function resolveToken(
  first: string,
  second: string | undefined,
  users: CommentTenantUser[],
): { userId: string; consumedSecond: boolean } | null {
  if (second) {
    const both = matchKey(`${first} ${second}`, users);
    if (both) return { userId: both, consumedSecond: true };
  }
  const onlyFirst = matchKey(first, users);
  if (onlyFirst) return { userId: onlyFirst, consumedSecond: false };
  return null;
}

/**
 * Extrae los userIds mencionados en un cuerpo de comentario, resueltos contra
 * la lista de usuarios del tenant. Dedup. Ignora tokens que no resuelven.
 *
 * @param body cuerpo del comentario (texto libre con tokens `@…`)
 * @param tenantUsers usuarios reales del tenant
 * @returns userIds únicos mencionados (orden de aparición en el texto)
 */
export function parseMentions(
  body: string,
  tenantUsers: CommentTenantUser[],
): string[] {
  if (!body || tenantUsers.length === 0) return [];

  const found: string[] = [];
  const seen = new Set<string>();

  for (const match of body.matchAll(MENTION_TOKEN_RE)) {
    const resolved = resolveToken(match[1], match[2], tenantUsers);
    if (resolved && !seen.has(resolved.userId)) {
      seen.add(resolved.userId);
      found.push(resolved.userId);
    }
  }
  return found;
}

/**
 * Helper opcional para resaltar las menciones en HTML (lo usa el componente en
 * cliente, pero se exporta para tests / SSR). Envuelve los tokens que resuelven
 * a un usuario real en `<span class="mention-chip">`. Los que no resuelven se
 * dejan tal cual (texto plano).
 *
 * IMPORTANTE: escapa el cuerpo entero ANTES de inyectar el markup, así un body
 * con `<script>` no se vuelve XSS al renderizarse con dangerouslySetInnerHTML.
 */
export function renderMentionHtml(
  body: string,
  tenantUsers: CommentTenantUser[],
): string {
  const escaped = escapeHtml(body);
  if (tenantUsers.length === 0) return escaped;

  return escaped.replace(
    MENTION_TOKEN_RE,
    (full: string, first: string, second: string | undefined) => {
      const resolved = resolveToken(first, second, tenantUsers);
      if (!resolved) return full;
      if (resolved.consumedSecond || !second) {
        // toda la coincidencia es el nombre → un solo chip
        return `<span class="mention-chip">${full}</span>`;
      }
      // la 2da palabra NO es parte del nombre → solo resaltar "@first",
      // dejar el resto del match (espacio + segunda palabra) como texto.
      const chip = `<span class="mention-chip">@${first}</span>`;
      const rest = full.slice(`@${first}`.length);
      return chip + rest;
    },
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
