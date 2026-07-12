/**
 * Consentimiento de cookies (sitio público de DTD Cargo).
 *
 * Modelo: Google Consent Mode v2 con default = `denied`. Mientras el usuario solo
 * navega/lee, gtag corre en modo restringido y NO planta cookies reales de
 * analítica/publicidad. Cuando el usuario decide (banner al acceder/registrarse),
 * guardamos su elección en la cookie `dtd_cookie_consent` (6 meses) y actualizamos
 * el consentimiento de Google en caliente.
 *
 * La cookie es de primera parte, sin datos personales: solo `granted` | `denied`.
 */

export const COOKIE_CONSENT_NAME = "dtd_cookie_consent";
export type CookieConsent = "granted" | "denied";

/** 6 meses, en segundos. */
const MAX_AGE = 180 * 24 * 60 * 60;

/** Evento global para reabrir el banner desde el footer ("Preferencias de cookies"). */
export const OPEN_COOKIE_PREFS_EVENT = "dtd:cookie-prefs";

/** Lee la decisión guardada, o `null` si el usuario todavía no eligió. */
export function readCookieConsent(): CookieConsent | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(
    /(?:^|;\s*)dtd_cookie_consent=(granted|denied)/,
  );
  return (m?.[1] as CookieConsent | undefined) ?? null;
}

/** Guarda la decisión (6 meses). Añade `Secure` en https. */
export function writeCookieConsent(value: CookieConsent): void {
  if (typeof document === "undefined") return;
  const secure =
    typeof location !== "undefined" && location.protocol === "https:"
      ? "; Secure"
      : "";
  document.cookie = `${COOKIE_CONSENT_NAME}=${value}; path=/; max-age=${MAX_AGE}; SameSite=Lax${secure}`;
}

/**
 * Actualiza Google Consent Mode en caliente cuando el usuario acepta o rechaza.
 * Las cuatro señales de v2 se mueven juntas: analítica y publicidad comparten el
 * mismo botón (no fragmentamos el consentimiento en esta fase).
 */
export function updateGtagConsent(granted: boolean): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  const v: CookieConsent = granted ? "granted" : "denied";
  window.gtag("consent", "update", {
    ad_storage: v,
    ad_user_data: v,
    ad_personalization: v,
    analytics_storage: v,
  });
}
