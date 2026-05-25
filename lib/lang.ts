/**
 * Helpers de idioma del operario PWA (SDD-0027) · CLIENT-SAFE.
 *
 * Cookie regular (NO HttpOnly) `dtd_op_lang` con valor "es" | "cn".
 * Path scope al namespace `/m`. MaxAge 90 días.
 *
 * El server lee esta cookie via `getOperarioLang()` en `lib/lang-server.ts`
 * (separado para evitar bundle de `next/headers` en client).
 */

export type Lang = "es" | "cn";

export const LANG_COOKIE_NAME = "dtd_op_lang";
export const LANG_COOKIE_MAX_AGE_DAYS = 90;

/**
 * Setter para el cliente. Escribe la cookie via document.cookie.
 * Solo usar en client components.
 */
export function setOperarioLangClient(lang: Lang): void {
  if (typeof document === "undefined") return;
  const maxAge = LANG_COOKIE_MAX_AGE_DAYS * 24 * 60 * 60;
  document.cookie = `${LANG_COOKIE_NAME}=${lang}; Path=/m; Max-Age=${maxAge}; SameSite=Lax`;
}
