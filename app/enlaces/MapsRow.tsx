"use client";

import { useEffect, useRef } from "react";

/**
 * Fila "Cómo llegar" del hub de enlaces — abre la app de mapas NATIVA por
 * plataforma: Apple Maps en iPhone/iPad, Google Maps (pin verificado de DTD)
 * en Android/desktop. Isla cliente mínima: la página /enlaces sigue siendo
 * estática; esto solo reescribe el href tras hidratar según el dispositivo.
 *
 * SSR / sin JS → el <a> ya trae el pin de Google Maps (universal, seguro).
 * En iOS, el efecto reescribe el href a Apple Maps directo sobre el DOM
 * (external system → uso canónico de useEffect, sin setState ni re-render).
 */
type Props = {
  /** Pin verificado de DTD en Google Maps (CONTACT.ve.mapsUrl). Default seguro. */
  googleMapsUrl: string;
  /** URL de Apple Maps (maps.apple.com) — abre la app nativa en iOS. */
  appleMapsUrl: string;
  label: string;
  sub: string;
};

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // iPhone/iPod/iPad clásico + iPadOS 13+ (que se reporta como "MacIntel" táctil).
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function MapsRow({ googleMapsUrl, appleMapsUrl, label, sub }: Props) {
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (ref.current && isIOS()) ref.current.href = appleMapsUrl;
  }, [appleMapsUrl]);

  return (
    <a
      ref={ref}
      className="enlaces-row"
      href={googleMapsUrl}
      target="_blank"
      rel="noopener noreferrer"
    >
      <span className="ic">
        {/* Pin de ubicación (mismo trazo que el resto del set) */}
        <svg
          width={20}
          height={20}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      </span>
      <span className="tx">
        <b>{label}</b>
        <span>{sub}</span>
      </span>
      <span className="chev">
        <svg
          width={16}
          height={16}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M9 6l6 6-6 6" />
        </svg>
      </span>
    </a>
  );
}
