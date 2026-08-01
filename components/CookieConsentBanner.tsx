"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  OPEN_COOKIE_PREFS_EVENT,
  readCookieConsent,
  updateGtagConsent,
  writeCookieConsent,
} from "@/lib/cookie-consent";

/**
 * Banner de consentimiento de cookies.
 *
 * Se muestra automáticamente al **acceder o registrarse** (no en la primera
 * visita): con Consent Mode v2 en `denied` por defecto, no cae ninguna cookie
 * opcional mientras el usuario solo navega, así que pedir el permiso en el punto
 * de mayor intención (login/registro) es suficiente y menos intrusivo.
 *
 * También se reabre desde el enlace "Preferencias de cookies" del footer, en
 * cualquier página, vía el evento global `OPEN_COOKIE_PREFS_EVENT`.
 *
 * Montado una sola vez en el layout raíz (junto a <Analytics/>).
 */

const TRIGGER_PATHS = new Set(["/portal/login", "/registro"]);

export function CookieConsentBanner() {
  const pathname = usePathname();
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const [manualOpen, setOpen] = useState(false);
  const autoOpen =
    mounted && !readCookieConsent() && TRIGGER_PATHS.has(pathname);
  const open = manualOpen || autoOpen;

  // Reapertura desde el footer ("Preferencias de cookies").
  useEffect(() => {
    function reopen() {
      setOpen(true);
    }
    window.addEventListener(OPEN_COOKIE_PREFS_EVENT, reopen);
    return () => window.removeEventListener(OPEN_COOKIE_PREFS_EVENT, reopen);
  }, []);

  if (!open) return null;

  function decide(granted: boolean) {
    writeCookieConsent(granted ? "granted" : "denied");
    updateGtagConsent(granted);
    setOpen(false);
  }

  return (
    <div
      role="region"
      aria-label="Aviso de cookies"
      className="fixed inset-x-0 bottom-0 z-[100] p-3 sm:p-5"
    >
      <div
        className="mx-auto max-w-[720px] rounded-2xl border p-5 sm:p-6 shadow-lg"
        style={{
          background: "var(--color-paper)",
          borderColor: "color-mix(in srgb, var(--color-ink) 14%, transparent)",
          color: "var(--color-ink)",
        }}
      >
        <p className="text-[15px] font-bold tracking-[-0.01em]">
          Usamos cookies
        </p>
        <p className="mt-2 text-[13.5px] leading-[1.6]" style={{ opacity: 0.8 }}>
          Las cookies necesarias mantienen tu sesión segura. Las de{" "}
          <strong>analítica y publicidad</strong> son opcionales y solo se
          activan si las aceptas. Puedes cambiar tu decisión cuando quieras.{" "}
          <Link
            href="/cookies"
            className="underline underline-offset-2"
            style={{ color: "var(--color-wine-text)" }}
          >
            Ver Política de Cookies
          </Link>
          .
        </p>
        <div className="mt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => decide(false)}
          >
            Rechazar opcionales
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => decide(true)}
          >
            Aceptar todas
          </button>
        </div>
      </div>
    </div>
  );
}
