/**
 * Helpers de idioma del operario PWA (SDD-0027) · CLIENT-SAFE.
 *
 * Cookie regular (NO HttpOnly) `dtd_op_lang` con valor "es" | "cn".
 * Path scope al namespace `/m`. MaxAge 90 días.
 *
 * El server lee esta cookie via `getOperarioLang()` en `lib/lang-server.ts`
 * (separado para evitar bundle de `next/headers` en client).
 *
 * Bridge con el sistema i18n unificado del Studio:
 *   - operarioLangToLocale(lang) → BCP-47 Locale ("es-VE" | "zh-CN")
 *   - regionToOperarioLang(region) → "es" | "cn"
 * Estos helpers permiten que la PWA coopere con el LocaleProvider del
 * Studio sin reescribir los 1600+ strings del wizard `t(lang, es, cn)`.
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

/**
 * Bridge: `Lang` (PWA cookie) → `Locale` (BCP-47 del sistema unificado).
 *
 * "es" → "es-VE"
 * "cn" → "zh-CN"
 *
 * Sirve cuando un componente del Studio (BugFAB, Toast, Drawer) se
 * embedea en la PWA y necesita leer el locale activo del LocaleProvider.
 */
export function operarioLangToLocale(lang: Lang): "es-VE" | "zh-CN" {
  return lang === "cn" ? "zh-CN" : "es-VE";
}

/**
 * Bridge inverso: region del operario → cookie lang.
 *
 * Sirve al login para auto-setear la cookie según `operario.region`:
 * un operario CN ve la PWA en chino desde el primer login sin tocar nada.
 */
export function regionToOperarioLang(region: "ve" | "cn"): Lang {
  return region === "cn" ? "cn" : "es";
}
