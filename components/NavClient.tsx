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

/** SDD-0473 · El cotizador con documentos (founder 2026-09-18: «agrega el
 *  cotizador al menú principal»). Va pegado a Tarifas porque responden a la
 *  misma pregunta —cuánto cuesta traerlo—, una con los metros cúbicos que
 *  escribes y otra con la proforma que subes. Aparece SÓLO con
 *  `DOCUMENT_IMPORT_ENABLED`: apagada, /cotizador es 404 y un enlace roto en el
 *  menú de todo el sitio es peor que no tenerlo. La bandera la lee el envoltorio
 *  de servidor (`Nav.tsx`), porque este componente corre en el navegador. */
const cotizador = { href: "/cotizador", label: "Cotizador" };

function enlacesPrincipales(conCotizador: boolean) {
  if (!conCotizador) return links;
  const [tarifas, ...resto] = links;
  return [tarifas, cotizador, ...resto];
}

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
 * Desktop (lg+): logo + enlaces principales + Contáctenos +
 *                dropdown "Ayuda" (al final) + [Entrar o crear cuenta].
 * Mobile (<lg):  logo + [≡ hamburguesa] + [Entrar o crear cuenta]
 *                El hamburger abre un drawer con los enlaces + acordeón "Ayuda"
 *                + Contáctenos, y el mismo botón único en el pie.
 *
 * JERARQUÍA (founder 2026-08-20, SDD-0276 — SUPERSEDE la decisión del
 * 2026-07-31): **una sola puerta de cuenta en las tres superficies**, el botón
 * "Entrar o crear cuenta" → `/entrar`. Antes había dos disparadores, "Acceder"
 * de texto y "Regístrate" de color, y en la barra móvil "Acceder" ni aparecía.
 *
 * Por qué la etiqueta lleva las DOS palabras y no sólo "Entrar": el A/B de
 * Mozilla Persona (~1,25 M de impresiones) midió que la presencia de la palabra
 * "crear" es lo que mueve las altas — un botón único de sólo-login produjo 12,4×
 * menos cuentas. La ambigüedad "¿cuál de los dos era yo?" se resuelve en
 * `/entrar`, que ofrece las dos filas con peso comparable.
 *
 * "Contáctenos" sigue siendo enlace de texto y va a la izquierda: casi todo el
 * contacto entra por WhatsApp, que ya tiene su propio botón flotante.
 * Ojo: esto NO viene del Norte, que no norma el nav público (verificado
 * 2026-07-31) — es una decisión de producto tomada acá.
 *
 * 🔴 ANCHO: la etiqueta pasó de 10 a 21 caracteres — **+61 px medidos** en la
 * barra angosta (146 contra 85). Esta fila desborda con una facilidad que
 * sorprende, y ya lo hizo dos veces: sumar un enlace de texto la empujó a
 * 1039 px de contenido en 1024 de viewport, y a 320 px el lockup completo sacaba
 * el CTA de la pantalla — y un desborde acá ensancha el ICB, así que se lleva el
 * scroll horizontal a TODO el sitio público, no sólo a esta página.
 *
 * Quitar "Acceder" liberó espacio en escritorio; en la barra angosta hizo falta
 * además ocultar el wordmark bajo 440 px (regla en globals.css). Al tocar este
 * nav se MIDE `scrollWidth` contra `clientWidth` a 320, 360, 375, 1024 y 1280 —
 * mirar a 1366 no lo muestra. La red que lo atrapa es
 * `e2e/sin-scroll-horizontal.spec.ts`.
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

export function NavClient({ cotizador: conCotizador = false }: { cotizador?: boolean }) {
  const principales = enlacesPrincipales(conCotizador);
  // Relleno horizontal de la barra entre lg y xl. Con el cotizador baja de 8 a
  // 6 px; sin él queda el de siempre (ver el comentario de la fila, abajo).
  const pad = conCotizador ? "px-1.5" : "px-2";
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
              cambia el tamaño).

              🔴 Y por debajo de 440px NO alcanza con achicarlo: ahí el wordmark
              se oculta por CSS (`.site-nav .brandmark-wordmark`, globals.css).
              MEDIDO, no estimado: el botón "Entrar o crear cuenta" de SDD-0276
              mide 146px contra los 85 del viejo "Regístrate" — cuesta **+61px**,
              y con el lockup completo el cluster no entra ni a 375. La regla
              vive en CSS y no acá para conservar el span único de arriba. */}
          <span className="flex items-center shrink-0">
            <BrandMark asLink size="var(--nav-brand, 30px)" />
          </span>

          {/* Desktop nav: full horizontal desde lg (1024px). Actualidad es
              enlace principal; Academia, proceso, FAQ y Glosario viven en Ayuda. */}
          {/* gap apretado entre lg y xl: sumar "Contáctenos" como enlace de
              texto empujó la fila 30px más allá del ancho de la ventana a
              1024px (medido: 1039 de contenido en 1024 de viewport) y aparecía
              scroll horizontal. Desde xl vuelve al aire de siempre. */}
          {/* SDD-0473 · con «Cotizador» la fila no entra a 1024. MEDIDO con la
              bandera encendida y el espaciado de siempre: scrollWidth 1021
              contra clientWidth 1009 (el enlace ocupa 75 px). Bajar sólo el
              hueco (6→2 px) quitaba el scroll pero la fila seguía comiéndose
              24 px del margen derecho y el logo quedaba pegado a «Tarifas».
              Por eso, entre lg y xl y SÓLO con el cotizador: hueco 0 y relleno
              6 px (antes 8) en enlaces, «Contáctenos» y «Ayuda». Medido a 1024:
              sobran 18 px y quedan 17 px entre el logo y el primer enlace (hoy,
              sin cotizador, son 28). Apagada la bandera las clases son las de
              siempre y la barra no cambia ni un píxel. Desde xl sobra aire
              (botón en 1214 de 1265 a 1280) y no se toca. */}
          <div
            className={`hidden lg:flex items-center ${conCotizador ? "gap-x-0" : "gap-x-1.5"} xl:gap-x-3`}
          >
            {principales.map((l) => {
              const active = isLinkActive(pathname, l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={`text-[13.5px] xl:text-[14.5px] ${pad} xl:px-2.5 py-2 rounded-md transition-colors whitespace-nowrap ${
                    active
                      ? "text-wine font-bold bg-wine/30"
                      : "text-ink font-medium hover:text-wine hover:bg-wine/15"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}

            {/* Jerarquía de la derecha: el único botón de color es la puerta de
                cuenta (SDD-0276). "Acceder" ya NO vive acá — se fusionó con
                "Regístrate" en un solo botón, ver el docblock de arriba.
                "Contáctenos" es enlace de texto y se corre a la izquierda: casi
                todo el contacto entra por WhatsApp —que ya tiene su botón
                flotante— así que ocupar el CTA del nav con él competía contra la
                conversión que sí importa. */}
            <Link
              href="/contacto"
              className={`text-[13.5px] xl:text-[14.5px] ${pad} xl:px-2.5 py-2 rounded-md text-ink font-semibold hover:text-wine hover:bg-wine/15 transition-colors whitespace-nowrap`}
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
              <summary className={`list-none cursor-pointer select-none text-[13.5px] xl:text-[14.5px] ${pad} xl:px-2.5 py-2 rounded-md text-ink font-medium hover:text-wine hover:bg-wine/15 transition-colors whitespace-nowrap flex items-center gap-1.5 group-[[open]]:text-wine [&::-webkit-details-marker]:hidden`}>
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

            <Link href="/entrar" className="btn btn-primary whitespace-nowrap">
              Entrar o crear cuenta
            </Link>
          </div>

          {/* Mobile + tablet: hamburger + la puerta única (<lg = <1024px) */}
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
            {/* En la barra angosta solo cabe UN botón — y desde SDD-0276 uno es
                justo lo que hace falta: la puerta es una sola, así que ya no hay
                que elegir cuál sacrificar. Contáctenos sigue a un toque de
                distancia, dentro del menú. El tamaño lo pone `.nav-cta-compact`
                en globals.css, no un `style` inline. */}
            <Link
              href="/entrar"
              className="btn btn-primary nav-cta-compact whitespace-nowrap"
            >
              Entrar o crear cuenta
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
        // Cerrado, el cajón está fuera de pantalla: `inert` impide que el
        // teclado entre a enlaces invisibles (auditoría SEO 2026-11-07).
        inert={!open}
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
          {principales.map((l) => {
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

          {/* La puerta de cuenta NO va en esta lista: es el botón del pie, para
              que el menú tenga la misma jerarquía que la barra de escritorio y
              no aparezca dos veces. Antes había acá un "Acceder" de texto que
              duplicaba la entrada; SDD-0276 lo fusionó con el botón del pie. */}
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
            href="/entrar"
            onClick={close}
            className="btn btn-primary w-full"
          >
            Entrar o crear cuenta
          </Link>
        </div>
      </aside>
    </>
  );
}
