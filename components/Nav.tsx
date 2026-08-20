"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "./BrandMark";

/** Orden del Norte (founder 2026-07-31): **Tarifas primero** — es la pregunta
 *  con la que llega el visitante, y la calculadora es la superficie de
 *  conversión. Después el qué (Servicios), el cómo (Pre-alertas) y el contenido
 *  (Actualidad). */
const links = [
  { href: "/tarifas", label: "Tarifas" },
  { href: "/servicios", label: "Servicios" },
  { href: "/pre-alertas", label: "Pre-alertas" },
  { href: "/noticias", label: "Actualidad" },
];

/** Contenido de apoyo del desplegable "Ayuda", en DOS grupos con título
 *  (founder 2026-07-31, opción C): de un vistazo se entiende qué hay adentro,
 *  que era el problema — "Ayuda" no se leía como algo que se despliega.
 *  ("Cómo trabajamos" es un ENLACE: la sección homónima se retiró y el proceso
 *  se cuenta en un solo lugar, los 8 pasos de /shipping-mark. El rastreo
 *  público vive en el footer.) */
const recursos = [
  {
    titulo: "Aprender",
    items: [
      { href: "/academia", label: "Academia" },
      { href: "/shipping-mark", label: "Cómo trabajamos" },
    ],
  },
  {
    titulo: "Soporte",
    items: [
      { href: "/faq", label: "Preguntas frecuentes" },
      { href: "/glosario", label: "Glosario" },
    ],
  },
];

/** Plano, para el acordeón del menú móvil y para el focus trap. */
const recursosPlano = recursos.flatMap((g) => g.items);

/** Selector de elementos enfocables para focus trap (WCAG 2.4.3) */
const FOCUSABLE_SEL =
  'a[href], button:not([disabled]), summary, input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Top navigation — sticky, blur, drawer mobile completo con focus trap.
 *
 * Desktop (lg+): logo + enlaces principales + Acceder + Contáctenos +
 *                dropdown "Ayuda" (al final) + [Regístrate].
 * Mobile (<lg):  logo + [≡ hamburguesa] + [Regístrate]
 *                El hamburger abre un drawer con los enlaces + acordeón "Ayuda"
 *                + cuenta + Contáctenos, y "Regístrate" como botón del pie.
 *
 * JERARQUÍA (founder 2026-07-31): el único botón de color, en las tres
 * superficies, es "Regístrate" — es la acción que queremos que el visitante
 * haga. "Contáctenos" es enlace de texto y va a la izquierda: casi todo el
 * contacto entra por WhatsApp, que ya tiene su propio botón flotante.
 * Ojo: esto NO viene del Norte, que no norma el nav público (verificado
 * 2026-07-31) — es una decisión de producto tomada acá.
 *
 * Accesibilidad (WCAG 2.2):
 * - Drawer y dropdown "Recursos" cierran con tecla Escape
 * - Body scroll bloqueado mientras el drawer está abierto
 * - aria-modal + aria-label + aria-expanded + aria-controls
 * - Focus se mueve al primer link al abrir (SC 2.4.3)
 * - Focus trap: Tab y Shift+Tab ciclan dentro del drawer (SC 2.4.3)
 * - Focus retorna al botón hamburguesa al cerrar (SC 2.4.3)
 * - Touch targets de 44×44px (SC 2.5.8)
 */
/**
 * Determina si un link del nav debe mostrarse como "activo" basándose
 * en la ruta actual.
 *
 * - Match exacto: `/glosario` activa el link `/glosario`.
 * - Match de subpath: `/noticias/incoterm-exw-explicado` activa el link `/noticias`.
 * - Anchors del home (`/#servicios`, etc.) nunca activan — necesitarían IntersectionObserver
 *   para detectar cuando la sección está visible, fuera del scope actual.
 */
function isLinkActive(pathname: string, linkHref: string): boolean {
  // Anchors al home → nunca marcamos activo
  if (linkHref.startsWith("/#")) return false;
  // Match exacto
  if (pathname === linkHref) return true;
  // Subpath (ej. /noticias/[slug] activa el link /noticias)
  // Pero solo si linkHref no es `/` para evitar que /noticias active el link de la home
  if (linkHref !== "/" && pathname.startsWith(linkHref + "/")) return true;
  return false;
}

export function Nav() {
  const [open, setOpen] = useState(false);
  // Glass al hacer scroll: sobre el fondo de página, el nav pasa de sólido
  // (crema) a glass (tokens `--glass-*`). Cloud Design 2026-07 — solo navbar.
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const recursosRef = useRef<HTMLDetailsElement>(null);

  // Cerrar drawer y retornar foco al hamburger (focus return)
  const close = useCallback(() => {
    setOpen(false);
    // Retornar foco después de que termine la animación slide-out
    setTimeout(() => hamburgerRef.current?.focus(), 50);
  }, []);

  // Glass on scroll: activa el estado al pasar ~8px del tope.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Bloquear scroll del body cuando el drawer está abierto
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Al abrir: mover foco al primer elemento enfocable del drawer
  useEffect(() => {
    if (!open || !drawerRef.current) return;
    const first = drawerRef.current.querySelector<HTMLElement>(FOCUSABLE_SEL);
    first?.focus();
  }, [open]);

  // Focus trap + Escape mientras está abierto
  useEffect(() => {
    if (!open) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab" || !drawerRef.current) return;

      const focusables = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SEL),
      );
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      // Shift+Tab desde el primero → ir al último
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
        return;
      }
      // Tab desde el último → ir al primero
      if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  // Cerrar el dropdown "Recursos" (desktop) con Escape o click fuera.
  // <details> no trae estos comportamientos nativos.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const d = recursosRef.current;
      if (d?.open && !d.contains(e.target as Node)) d.open = false;
    }
    function onKey(e: KeyboardEvent) {
      const d = recursosRef.current;
      if (e.key === "Escape" && d?.open) {
        d.open = false;
        d.querySelector("summary")?.focus();
      }
    }
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <>
      <nav
        className="site-nav sticky top-0 z-50 border-b border-grey-200 transition-[background,box-shadow,border-color] duration-300"
        style={
          scrolled
            ? {
                background: "var(--glass-bg)",
                backdropFilter: "var(--glass-blur)",
                WebkitBackdropFilter: "var(--glass-blur)",
                borderColor: "var(--glass-border)",
                boxShadow: "var(--glass-shadow)",
              }
            : {
                background: "rgba(251,250,247,0.92)",
                backdropFilter: "blur(14px)",
              }
        }
      >
        <div className="wrap flex items-center justify-between h-[76px]">
          {/* Logo · el lockup se achica por tramos para no chocar con el cluster
              hamburguesa + CTA: 24px por debajo de 375, 30px en móvil normal,
              38px desde sm. El tamaño llega por `--nav-brand` (definido en
              globals.css sobre `.site-nav`) en vez de por dos <span> duplicados
              con `sm:hidden` — así el isólogo se preloadea UNA vez, no dos.
              `shrink-0` evita que el flex comprima el wordmark y lo monte sobre
              el menú (mismo componente, mismas proporciones/colores — solo
              cambia el tamaño). */}
          <span className="flex items-center shrink-0">
            <BrandMark asLink size="var(--nav-brand, 30px)" />
          </span>

          {/* Desktop nav: full horizontal desde lg (1024px). Actualidad es
              enlace principal; Academia, proceso, FAQ y Glosario viven en Ayuda. */}
          {/* gap apretado entre lg y xl: sumar "Contáctenos" como enlace de
              texto empujó la fila 30px más allá del ancho de la ventana a
              1024px (medido: 1039 de contenido en 1024 de viewport) y aparecía
              scroll horizontal. Desde xl vuelve al aire de siempre. */}
          <div className="hidden lg:flex items-center gap-x-1.5 xl:gap-x-3">
            {links.map((l) => {
              const active = isLinkActive(pathname, l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={`text-[13.5px] xl:text-[14.5px] px-2 xl:px-2.5 py-2 rounded-md transition-colors whitespace-nowrap ${
                    active
                      ? "text-wine font-bold bg-wine/30"
                      : "text-ink font-medium hover:text-wine hover:bg-wine/15"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}

            {/* Jerarquía de la derecha (founder 2026-07-31): el único botón de
                color es "Regístrate", porque el registro es lo que queremos que
                el visitante haga. "Contáctenos" baja a enlace de texto y se
                corre a la izquierda: casi todo el contacto entra por WhatsApp
                —que ya tiene su botón flotante— así que ocupar el CTA del nav
                con él competía contra la conversión que sí importa. */}
            <Link
              href="/portal/login"
              className="text-[13.5px] xl:text-[14.5px] px-2 xl:px-2.5 py-2 rounded-md text-ink font-semibold hover:text-wine hover:bg-wine/15 transition-colors whitespace-nowrap"
            >
              Acceder
            </Link>
            <Link
              href="/contacto"
              className="text-[13.5px] xl:text-[14.5px] px-2 xl:px-2.5 py-2 rounded-md text-ink font-semibold hover:text-wine hover:bg-wine/15 transition-colors whitespace-nowrap"
            >
              Contáctenos
            </Link>

            {/* "Ayuda" va AL FINAL de los enlaces, pegada al botón (founder
                2026-07-31). El indicador era un "▾" gris de 9px que no se leía
                como "esto se despliega": ahora es un chevron **wine** de 11px
                que gira 180° al abrir. <details> nativo da aria-expanded y
                teclado gratis; Escape y click-fuera se manejan en el useEffect
                de arriba. */}
            <details ref={recursosRef} className="group relative">
              <summary className="list-none cursor-pointer select-none text-[13.5px] xl:text-[14.5px] px-2 xl:px-2.5 py-2 rounded-md text-ink font-medium hover:text-wine hover:bg-wine/15 transition-colors whitespace-nowrap flex items-center gap-1.5 group-[[open]]:text-wine [&::-webkit-details-marker]:hidden">
                Ayuda
                <svg
                  aria-hidden
                  width="11"
                  height="11"
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="var(--color-wine)"
                  strokeWidth="2.1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="flex-shrink-0 transition-transform duration-200 group-[[open]]:rotate-180"
                >
                  <path d="M2.5 4.5 6 8l3.5-3.5" />
                </svg>
              </summary>
              {/* Panel en DOS columnas con título de grupo: el visitante entiende
                  de un vistazo qué hay adentro sin tener que leer los 4 enlaces. */}
              <div className="absolute right-0 top-full mt-1.5 grid w-[390px] grid-cols-2 gap-x-2.5 bg-paper border border-grey-200 rounded-lg card-shadow p-3 z-[60]">
                {recursos.map((grupo) => (
                  <div key={grupo.titulo}>
                    <p className="m-0 px-3 pb-1.5 pt-1 text-[10.5px] font-bold uppercase tracking-[0.13em] text-grey-500">
                      {grupo.titulo}
                    </p>
                    {grupo.items.map((r) => {
                      const active = isLinkActive(pathname, r.href);
                      return (
                        <Link
                          key={r.href}
                          href={r.href}
                          onClick={() => {
                            if (recursosRef.current)
                              recursosRef.current.open = false;
                          }}
                          aria-current={active ? "page" : undefined}
                          className={`block text-[14px] px-3 py-2.5 rounded-md transition-colors ${
                            active
                              ? "text-wine font-bold bg-wine/30"
                              : "text-ink hover:text-wine hover:bg-wine/15"
                          }`}
                        >
                          {r.label}
                        </Link>
                      );
                    })}
                  </div>
                ))}
              </div>
            </details>

            <Link href="/registro" className="btn btn-primary whitespace-nowrap">
              Regístrate
            </Link>
          </div>

          {/* Mobile + tablet: hamburger + Regístrate (<lg = <1024px) */}
          <div className="lg:hidden flex items-center gap-2 max-[374px]:gap-1.5">
            <button
              ref={hamburgerRef}
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Abrir menú"
              aria-expanded={open}
              aria-controls="mobile-drawer"
              className="w-11 h-11 grid place-items-center rounded-[10px] border border-grey-200 text-ink hover:border-ink transition-colors"
            >
              <svg
                width="20"
                height="14"
                viewBox="0 0 20 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden
              >
                <path d="M1 1h18M1 7h18M1 13h18" />
              </svg>
            </button>
            {/* En la barra angosta solo cabe UN botón: va el de conversión.
                Contáctenos sigue a un toque de distancia, dentro del menú. */}
            <Link href="/registro" className="btn btn-primary nav-cta-compact">
              Regístrate
            </Link>
          </div>
        </div>
      </nav>

      {/* Backdrop */}
      <div
        onClick={close}
        aria-hidden
        className={`lg:hidden fixed inset-0 z-[60] transition-opacity duration-300 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        style={{ background: "rgba(15,30,61,0.45)" }}
      />

      {/* Drawer */}
      <aside
        ref={drawerRef}
        id="mobile-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Menú de navegación"
        aria-hidden={!open}
        className={`lg:hidden fixed top-0 right-0 bottom-0 z-[70] w-[82vw] max-w-[360px] bg-paper flex flex-col transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        style={{
          boxShadow: open ? "-30px 0 50px -20px rgba(15,30,61,0.30)" : undefined,
        }}
      >
        <div className="flex items-center justify-between p-6 border-b border-grey-200">
          <BrandMark size="var(--drawer-brand, 32px)" />
          <button
            type="button"
            onClick={close}
            aria-label="Cerrar menú"
            className="w-11 h-11 grid place-items-center rounded-[10px] hover:bg-grey-100 text-ink transition-colors"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden
            >
              <path d="M3 3l12 12M15 3L3 15" />
            </svg>
          </button>
        </div>

        <nav className="flex flex-col px-6 pt-4 flex-1">
          {links.map((l) => {
            const active = isLinkActive(pathname, l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={close}
                aria-current={active ? "page" : undefined}
                className={`text-[18px] py-4 px-3 -mx-3 rounded-md border-b border-grey-200 transition-colors ${
                  active
                    ? "text-wine font-bold bg-wine/30"
                    : "text-ink font-semibold hover:text-wine hover:bg-wine/15"
                }`}
              >
                {l.label}
              </Link>
            );
          })}

          {/* Recursos — acordeón dentro del drawer (mismo contenido que el
              dropdown desktop). El focus-trap recoge el summary + sus links. */}
          <details className="group">
            <summary className="list-none cursor-pointer select-none text-[18px] py-4 px-3 -mx-3 rounded-md border-b border-grey-200 text-ink font-semibold hover:text-wine hover:bg-wine/15 transition-colors flex items-center justify-between [&::-webkit-details-marker]:hidden">
              <span>Ayuda</span>
              {/* Mismo chevron wine que en escritorio: el gris no se leía como
                  "esto se despliega". */}
              <svg
                aria-hidden
                width="14"
                height="14"
                viewBox="0 0 12 12"
                fill="none"
                stroke="var(--color-wine)"
                strokeWidth="2.1"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="flex-shrink-0 transition-transform duration-200 group-[[open]]:rotate-180"
              >
                <path d="M2.5 4.5 6 8l3.5-3.5" />
              </svg>
            </summary>
            {recursosPlano.map((r) => {
              const active = isLinkActive(pathname, r.href);
              return (
                <Link
                  key={r.href}
                  href={r.href}
                  onClick={close}
                  aria-current={active ? "page" : undefined}
                  className={`block text-[16px] py-3.5 pl-7 pr-3 -mx-3 border-b border-grey-200 transition-colors ${
                    active
                      ? "text-wine font-bold bg-wine/30"
                      : "text-ink hover:text-wine hover:bg-wine/15"
                  }`}
                >
                  {r.label}
                </Link>
              );
            })}
          </details>

          {/* Cuenta · Acceder + Contáctenos. "Regístrate" NO va acá: es el
              botón del pie, para que el menú tenga la misma jerarquía que la
              barra de escritorio y no aparezca dos veces. */}
          <Link
            href="/portal/login"
            onClick={close}
            className="text-[18px] py-4 px-3 -mx-3 rounded-md border-b border-grey-200 text-ink font-semibold hover:text-wine hover:bg-wine/15 transition-colors"
          >
            Acceder
          </Link>
          <Link
            href="/contacto"
            onClick={close}
            className="text-[18px] py-4 px-3 -mx-3 rounded-md border-b border-grey-200 text-ink font-semibold hover:text-wine hover:bg-wine/15 transition-colors"
          >
            Contáctenos
          </Link>
        </nav>

        <div className="p-6 border-t border-grey-200">
          <Link
            href="/registro"
            onClick={close}
            className="btn btn-primary w-full"
          >
            Regístrate
          </Link>
        </div>
      </aside>
    </>
  );
}
