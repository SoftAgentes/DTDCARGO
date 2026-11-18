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

/**
 * Suscriptores de `useSyncExternalStore`.
 *
 * 🔴 POR QUÉ EXISTE ESTO — `document.cookie` es un almacén externo que React no
 * observa. Sin notificación, un componente que derive su render de
 * `readCookieConsent()` NUNCA se entera de que la decisión cambió: el snapshot
 * se recalcula solo si algo más provoca un render.
 *
 * Así se rompió el banner en producción. Cerraba apagando un `useState` que en
 * la apertura automática (`/portal/login`, `/registro`) YA valía `false`, así
 * que React salía por el atajo de "mismo valor" y ni siquiera programaba un
 * render — el banner se quedaba clavado tapando el formulario de acceso, y el
 * usuario tocaba "Aceptar" sin que pasara nada hasta recargar la página.
 *
 * Con el store, escribir la cookie ES la notificación: cualquier suscriptor
 * vuelve a leer y el banner desaparece en el mismo tick del click.
 */
const listeners = new Set<() => void>();

/** Se suscribe a los cambios de la decisión. Pareja de `readCookieConsent`. */
export function subscribeCookieConsent(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/**
 * Snapshot para el servidor: durante el SSR/hidratación no hay `document`, y
 * devolver `null` estable evita el render intermedio falso (SDD-0205).
 */
export function readCookieConsentServer(): CookieConsent | null {
  return null;
}

/**
 * Lee la decisión guardada, o `null` si el usuario todavía no eligió.
 *
 * Sirve de `getSnapshot`: devuelve un primitivo, así que dos lecturas iguales
 * son idénticas para React (no hay bucle de renders).
 */
export function readCookieConsent(): CookieConsent | null {
  if (typeof document === "undefined") return null;
  // Nombre y valor completos. Una coincidencia parcial no es una decisión:
  // cookies ajenas con prefijo o `granted-sufijo` nunca conceden permiso.
  // Dos cookies visibles del mismo nombre (paths/domain distintos) son ambiguas.
  const choices = document.cookie
    .split(";")
    .map((cookie) => cookie.trim())
    .filter((cookie) => cookie.startsWith(`${COOKIE_CONSENT_NAME}=`));
  if (choices.length !== 1) return null;
  const value = choices[0].slice(COOKIE_CONSENT_NAME.length + 1);
  return value === "granted" || value === "denied" ? value : null;
}

/** Guarda la decisión (6 meses) y avisa a los suscriptores. Añade `Secure` en https. */
export function writeCookieConsent(value: CookieConsent): void {
  if (typeof document === "undefined") return;
  const secure =
    typeof location !== "undefined" && location.protocol === "https:"
      ? "; Secure"
      : "";
  document.cookie = `${COOKIE_CONSENT_NAME}=${value}; path=/; max-age=${MAX_AGE}; SameSite=Lax${secure}`;
  for (const notify of listeners) notify();
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
