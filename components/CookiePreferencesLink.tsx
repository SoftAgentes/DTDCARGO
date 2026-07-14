"use client";

import { OPEN_COOKIE_PREFS_EVENT } from "@/lib/cookie-consent";

/**
 * Enlace "Preferencias de cookies" del footer. Reabre el banner de
 * consentimiento en cualquier página emitiendo el evento global que escucha
 * <CookieConsentBanner/>. Se estila como los demás links del footer.
 */
export function CookiePreferencesLink({ className }: { className?: string }) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => window.dispatchEvent(new Event(OPEN_COOKIE_PREFS_EVENT))}
    >
      Preferencias de cookies
    </button>
  );
}
