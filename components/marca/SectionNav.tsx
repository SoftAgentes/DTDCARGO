/**
 * Menú de secciones STICKY del centro de marca. Fijo bajo el header (siempre
 * visible → "sé dónde estoy") y resalta la sección activa con scroll-spy. El
 * click hace scroll SUAVE en JS (respetando `prefers-reduced-motion`); el offset
 * bajo el header+menú lo da `STACK` (mismo número que el `scroll-mt` de cada
 * sección, para que el pill activo y el contenido coincidan).
 *
 * Vivía en `app/interno/_components/`; se movió acá (SDD-0238) cuando el centro
 * de marca pasó a ser la página pública `/marca` con código de acceso. Su único
 * consumidor anterior (`/interno/marca`) quedó como redirect.
 */

"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";

export type NavItem = { id: string; label: string };

/**
 * Umbral del scroll-spy: una sección es "actual" cuando su tope cruza esta línea.
 *
 * TIENE QUE QUEDAR POR DEBAJO del landing del click. En `/marca` las secciones
 * usan `scroll-mt-[132px]`: si el umbral fuera 130, la sección recién aterrizada
 * (top ≈ 132) NO pasaría `top <= STACK` y la pestaña no se resaltaría justo
 * después de clickearla — que es el único momento en que el usuario la mira.
 * Con 148 hay margen para el aterrizaje y para fracciones de píxel.
 */
const STACK = 148;

export function SectionNav({
  items,
  /** Alto del header bajo el que se pega. Cada superficie tiene el suyo. */
  stickyTop = "63px",
  /**
   * `true` cuando el llamador ya provee la barra fija y el contenedor `.wrap`
   * (es el caso de `/marca`, que comparte esa barra con el buscador). Sin esto
   * habría dos fondos, dos bordes y dos `sticky` peleándose.
   */
  embedded = false,
}: {
  items: NavItem[];
  stickyTop?: string;
  embedded?: boolean;
}) {
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
      className={embedded ? "" : "sticky z-20 bg-paper border-b border-grey-200"}
      style={embedded ? undefined : { top: stickyTop }}
    >
      <div
        className={
          embedded
            ? "flex gap-1 overflow-x-auto"
            : "wrap flex gap-1 overflow-x-auto py-2.5"
        }
      >
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
