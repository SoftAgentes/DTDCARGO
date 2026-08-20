"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  OPEN_COOKIE_PREFS_EVENT,
  readCookieConsent,
  readCookieConsentServer,
  subscribeCookieConsent,
  updateGtagConsent,
  writeCookieConsent,
} from "@/lib/cookie-consent";

/**
 * Aviso de consentimiento de cookies.
 *
 * Se muestra al **acceder o registrarse** (no en la primera visita): con
 * Consent Mode v2 en `denied` por defecto no cae ninguna cookie opcional
 * mientras el usuario solo navega, así que pedir el permiso en el punto de
 * mayor intención es suficiente y menos intrusivo. También se reabre desde
 * "Preferencias de cookies" del footer, en cualquier página, vía el evento
 * global `OPEN_COOKIE_PREFS_EVENT`.
 *
 * Montado una sola vez en el layout raíz (junto a <Analytics/>).
 *
 * 🔴 UNA SOLA FUENTE DE VERDAD: la cookie. `useSyncExternalStore` la lee como
 * store externo, y `writeCookieConsent` notifica a los suscriptores — por eso
 * decidir cierra el aviso en el mismo tick del click.
 *
 * La versión anterior cerraba apagando un `useState` que en la apertura
 * automática YA valía `false`. React sale por el atajo de "mismo valor" y ni
 * siquiera programa un render, así que el aviso se quedaba clavado: el usuario
 * tocaba "Aceptar" y no pasaba nada hasta recargar. Por eso `reabierto` NO es
 * el interruptor del aviso: cubre sólo la reapertura manual desde el footer.
 */

const TRIGGER_PATHS = new Set(["/portal/login", "/registro"]);

export function CookieConsentBanner() {
  const pathname = usePathname();
  const decision = useSyncExternalStore(
    subscribeCookieConsent,
    readCookieConsent,
    readCookieConsentServer,
  );
  const [reabierto, setReabierto] = useState(false);
  const tarjeta = useRef<HTMLDivElement>(null);

  const abierto =
    reabierto || (decision === null && TRIGGER_PATHS.has(pathname));

  // Reapertura desde el footer ("Preferencias de cookies").
  useEffect(() => {
    function reabrir() {
      setReabierto(true);
    }
    window.addEventListener(OPEN_COOKIE_PREFS_EVENT, reabrir);
    return () => window.removeEventListener(OPEN_COOKIE_PREFS_EVENT, reabrir);
  }, []);

  // Quien llega por el enlace del footer navega con teclado o lector: sin mover
  // el foco, el aviso aparece fuera del orden de tabulación (está al final del
  // <body>) y para esa persona "no pasó nada". En la apertura automática NO se
  // toca el foco: ahí el usuario está escribiendo en el formulario de acceso.
  useEffect(() => {
    if (reabierto) tarjeta.current?.focus();
  }, [reabierto]);

  if (!abierto) return null;

  function decidir(acepta: boolean) {
    // Escribir la cookie notifica al store → este componente se desmonta ya.
    writeCookieConsent(acepta ? "granted" : "denied");
    updateGtagConsent(acepta);
    setReabierto(false);
  }

  return (
    <div role="region" aria-label="Aviso de cookies" className="cookie-dock">
      <div className="cookie-card" ref={tarjeta} tabIndex={-1}>
        <p className="cookie-title">Usamos cookies</p>
        <p className="cookie-text">
          Las necesarias mantienen tu sesión. Las de analítica y publicidad son
          opcionales y solo se activan si las aceptas.{" "}
          {/* LNK-01 · punto 5: este aviso sale sobre el formulario de acceso y
              registro, o sea una superficie de conversión. Leer la política es
              una CONSULTA — si se lleva la pestaña, se lleva el formulario a
              medio llenar. Abre aparte y se anuncia en el nombre accesible
              (WCAG G201), que el texto visible es demasiado corto para decirlo. */}
          <Link
            href="/cookies"
            target="_blank"
            rel="noopener"
            aria-label="Ver la política de cookies (abre en una pestaña nueva)"
          >
            Ver política
          </Link>
          .
        </p>
        <div className="cookie-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => decidir(false)}
          >
            Rechazar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => decidir(true)}
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}
