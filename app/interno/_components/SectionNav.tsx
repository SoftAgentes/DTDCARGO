/**
 * Menú de secciones STICKY del hub de marca. Fijo bajo el header (siempre visible
 * → "sé dónde estoy") y resalta la sección activa con scroll-spy. El click hace
 * scroll SUAVE en JS (scoped al hub, respetando `prefers-reduced-motion`); el
 * offset bajo el header+menú lo da `STACK` (mismo número que el `scroll-mt` de
 * cada sección, para que el pill activo y el contenido coincidan).
 */

"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";

export type NavItem = { id: string; label: string };

/**
 * Umbral del scroll-spy: una sección es "actual" cuando su tope cruza esta línea.
 * Va un poco POR DEBAJO del landing del click (`scroll-mt-[116px]`) para que la
 * sección recién aterrizada (top≈116) quede activa sin fallar por fracciones de px.
 * El stack sticky real (header 64 + menú ~46) es ~110px.
 */
const STACK = 130;

export function SectionNav({ items }: { items: NavItem[] }) {
  const [active, setActive] = useState<string>("");
  const navRef = useRef<HTMLElement>(null);

  // Scroll-spy: activo = la ÚLTIMA sección cuyo tope ya cruzó debajo del stack.
  useEffect(() => {
    const els = items
      .map((it) => document.getElementById(it.id))
      .filter((el): el is HTMLElement => el != null);
    if (!els.length) return;

    let raf = 0;
    const compute = () => {
      raf = 0;
      // Si ni la primera sección cruzó el stack (estamos en el hero) → nada activo.
      let current = els[0].getBoundingClientRect().top > STACK ? "" : els[0].id;
      for (const el of els) {
        if (el.getBoundingClientRect().top <= STACK) current = el.id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(compute);
    };

    compute();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [items]);

  // Trae el pill activo a la vista (en mobile el menú scrollea horizontal).
  useEffect(() => {
    if (!active) return;
    navRef.current
      ?.querySelector<HTMLElement>(`[data-id="${active}"]`)
      ?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [active]);

  const onClick = (e: MouseEvent<HTMLAnchorElement>, id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
  };

  return (
    <nav
      ref={navRef}
      aria-label="Secciones del centro de marca"
      className="sticky top-[63px] z-20 bg-paper border-b border-grey-200"
    >
      <div className="wrap flex gap-1 overflow-x-auto py-2.5">
        {items.map((it) => {
          const isActive = active === it.id;
          return (
            <a
              key={it.id}
              data-id={it.id}
              href={`#${it.id}`}
              onClick={(e) => onClick(e, it.id)}
              aria-current={isActive ? "location" : undefined}
              className={`whitespace-nowrap text-[13px] font-semibold rounded-full px-3.5 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 ${
                isActive
                  ? "bg-ink text-white"
                  : "text-grey-700 hover:text-ink hover:bg-grey-100"
              }`}
            >
              {it.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
