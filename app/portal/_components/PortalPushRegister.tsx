"use client";

import { useEffect } from "react";

/**
 * Registra el service worker raíz (`/sw.js`) desde el portal (SDD-0148 #3b) para
 * habilitar Web Push al cliente. Es el MISMO SW que usa el Studio: sus handlers
 * `push`/`notificationclick` son genéricos (el click abre `data.url` del payload,
 * que para el portal es `/portal/soporte`). Best-effort — si el browser no soporta
 * SW, no pasa nada. Renderiza null.
 */
export function PortalPushRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* best-effort: sin push si el registro falla */
    });
  }, []);

  return null;
}
