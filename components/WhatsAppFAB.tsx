"use client";

import { useEffect, useRef, useState } from "react";
import { CONTACT } from "@/lib/design-tokens";

const SCROLL_DOWN_THRESHOLD = 400;
const SCROLL_RESET_THRESHOLD = 200;

/**
 * Speed dial flotante: WhatsApp (FAB principal) + Instagram, YouTube y TikTok
 * (FABs secundarios).
 *
 * El nombre del export se mantiene `WhatsAppFAB` por compatibilidad — se importa
 * desde 28 páginas. Internamente renderiza un menú expandible.
 *
 * Comportamiento:
 * - Estado idle: solo el FAB de WhatsApp + dot wine pulsando cada 3s.
 * - Desktop hover: la dot wine se desvanece y los FABs secundarios "nacen" desde
 *   la posición de la dot, aterrizando arriba con un spring (cubic-bezier-back).
 * - Mobile: 1er tap expande el menú. 2do tap en WA abre WhatsApp.
 *   Tap fuera o en una red cierra/navega.
 * - Scroll abajo > 400px atenúa el stack entero (intent-to-leave).
 * - Respeta prefers-reduced-motion.
 *
 * **Orden del stack (de abajo hacia arriba): WA · Instagram · YouTube · TikTok.**
 * Como `.fab-stack` es `flex-direction: column`, en el DOM van al revés: el
 * primero es el de más arriba. Instagram queda pegado al WhatsApp porque es el
 * que ya estaba ahí — mover una red que el visitante ya tiene ubicada es peor
 * que el orden "perfecto".
 *
 * YouTube y TikTok (founder 2026-07-31) repiten el patrón de Instagram en vez de
 * refactorizar los tres a un `.map()`: el pedido fue explícito en que WhatsApp e
 * Instagram sirven de referencia pero su implementación no se toca. El precio es
 * duplicación; la ganancia es que un cambio acá no puede romper lo que ya
 * funciona en producción.
 */
export function WhatsAppFAB() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastYRef = useRef(0);
  const tickingRef = useRef(false);

  const waMessage = encodeURIComponent(
    "Hola DTD Cargo, vi su sitio web y quería consultar por un envío desde China."
  );
  const waUrl = `https://wa.me/${CONTACT.ve.whatsappRaw}?text=${waMessage}`;

  // Cerrar al click afuera del stack (importante en mobile, donde no hay mouseleave).
  useEffect(() => {
    if (!isExpanded) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsExpanded(false);
      }
    }
    document.addEventListener("click", onClickOutside);
    return () => document.removeEventListener("click", onClickOutside);
  }, [isExpanded]);

  // Scroll attenuation — throttled con requestAnimationFrame.
  useEffect(() => {
    if (typeof window === "undefined") return;
    lastYRef.current = window.scrollY;

    function onScroll() {
      if (tickingRef.current) return;
      tickingRef.current = true;
      window.requestAnimationFrame(() => {
        const y = window.scrollY;
        const goingDown = y > lastYRef.current;
        lastYRef.current = y;

        if (goingDown && y > SCROLL_DOWN_THRESHOLD) {
          setIsScrolled(true);
        } else if (!goingDown || y < SCROLL_RESET_THRESHOLD) {
          setIsScrolled(false);
        }
        tickingRef.current = false;
      });
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function handleWaClick(e: React.MouseEvent<HTMLAnchorElement>) {
    // En desktop hover ya expandió → este click navega a WhatsApp.
    // En mobile (sin hover previo), el 1er click expande en vez de navegar.
    if (!isExpanded) {
      e.preventDefault();
      setIsExpanded(true);
    }
  }

  return (
    <div
      ref={containerRef}
      className="fab-stack"
      data-expanded={isExpanded}
      data-scrolled={isScrolled}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      <a
        href={CONTACT.tiktok.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Seguir a DTD Cargo en TikTok"
        className="fab-tt"
        tabIndex={isExpanded ? 0 : -1}
        aria-hidden={!isExpanded}
      >
        {/* Nota musical: el glifo con el que se reconoce TikTok. Sólido, como
            el de WhatsApp — dentro de un círculo de 60px un contorno se pierde. */}
        <svg
          viewBox="0 0 24 24"
          width="30"
          height="30"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M14 4c.4 2.4 1.9 3.9 4.2 4.1v3c-1.5 0-2.9-.4-4.2-1.2v5.4a5.4 5.4 0 1 1-5.4-5.4c.3 0 .6 0 .9.1v3.1a2.4 2.4 0 1 0 1.7 2.3V4z" />
        </svg>
      </a>

      <a
        href={CONTACT.youtube.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Ver el canal de DTD Cargo en YouTube"
        className="fab-yt"
        tabIndex={isExpanded ? 0 : -1}
        aria-hidden={!isExpanded}
      >
        {/* Solo el play: el pill rojo del logo desaparecería contra el círculo,
            que ya es rojo YouTube. */}
        <svg
          viewBox="0 0 24 24"
          width="30"
          height="30"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M9.5 7.4 17 12l-7.5 4.6z" />
        </svg>
      </a>

      <a
        href={CONTACT.instagram.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Seguir a DTD Cargo en Instagram"
        className="fab-ig"
        tabIndex={isExpanded ? 0 : -1}
        aria-hidden={!isExpanded}
      >
        <svg
          viewBox="0 0 24 24"
          width="30"
          height="30"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
        </svg>
      </a>

      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Hablar por WhatsApp con DTD Cargo"
        className="fab-wa"
        data-has-dot={!isExpanded}
        onClick={handleWaClick}
      >
        <span className="fab-wa-dot" aria-hidden="true" />
        <svg
          viewBox="0 0 24 24"
          width="38"
          height="38"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.149-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z" />
        </svg>
      </a>
    </div>
  );
}
