"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "./BrandMark";

const links = [
  { href: "/track", label: "Rastrear envío" },
  { href: "/servicios", label: "Servicios", hasCaret: true },
  { href: "/calculadora", label: "Calculadora" },
  { href: "/#how", label: "Cómo trabajamos" },
  { href: "/glosario", label: "Glosario" },
  { href: "/noticias", label: "Noticias" },
];

/** Selector de elementos enfocables para focus trap (WCAG 2.4.3) */
const FOCUSABLE_SEL =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Top navigation — sticky, blur, drawer mobile completo con focus trap.
 *
 * Desktop (md+): logo + 4 links + CTA "Contáctanos"
 * Mobile (<md):  logo + [≡ hamburguesa] + [Contacto btn]
 *                El hamburger abre un drawer derecho con los 4 links + CTA.
 *
 * Accesibilidad (WCAG 2.2):
 * - Drawer cierra con tecla Escape
 * - Body scroll bloqueado mientras está abierto
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
 * - Anchors del home (`/#how`, etc.) nunca activan — necesitarían IntersectionObserver
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
  const pathname = usePathname();
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  // Cerrar drawer y retornar foco al hamburger (focus return)
  const close = useCallback(() => {
    setOpen(false);
    // Retornar foco después de que termine la animación slide-out
    setTimeout(() => hamburgerRef.current?.focus(), 50);
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

  return (
    <>
      <nav
        className="sticky top-0 z-50 border-b border-grey-200"
        style={{
          background: "rgba(251,250,247,0.92)",
          backdropFilter: "blur(14px)",
        }}
      >
        <div className="wrap flex items-center justify-between h-[76px]">
          {/* Logo · lockup más compacto en móvil (<sm) para no chocar con el
              cluster hamburguesa + CTA; tamaño pleno en sm+. `shrink-0` evita
              que el flex comprima el wordmark y lo monte sobre el menú (mismo
              componente, mismas proporciones/colores — solo cambia el tamaño). */}
          <span className="flex items-center shrink-0 sm:hidden">
            <BrandMark asLink size={30} />
          </span>
          <span className="hidden sm:flex items-center shrink-0">
            <BrandMark asLink size={38} />
          </span>

          {/* Desktop nav: full horizontal solo en xl+ (1280px). Por debajo el
              contenido (6 links + Acceder + CTA + logo) no entra en el ancho
              útil de .wrap (maxw 1280 → ~1160px usables) y se montaba sobre el
              logo → usamos el drawer hamburguesa hasta xl. */}
          <div className="hidden xl:flex items-center gap-x-4">
            {links.map((l) => {
              const active = isLinkActive(pathname, l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={`text-[14.5px] px-2.5 py-2 rounded-md transition-colors whitespace-nowrap ${
                    active
                      ? "text-wine font-bold bg-wine/30"
                      : "text-ink font-medium hover:text-wine hover:bg-wine/15"
                  }`}
                >
                  {l.label}
                  {l.hasCaret && (
                    <span className="text-[9px] ml-1.5 text-grey-500">▾</span>
                  )}
                </Link>
              );
            })}
            <Link
              href="/portal/login"
              className="text-[14.5px] px-2.5 py-2 rounded-md text-ink font-semibold hover:text-wine hover:bg-wine/15 transition-colors whitespace-nowrap"
            >
              Acceder
            </Link>
            <Link href="/contacto" className="btn btn-primary whitespace-nowrap">
              Contáctanos
            </Link>
          </div>

          {/* Mobile + tablet + laptop angosto: hamburger + Contacto (<xl = <1280px) */}
          <div className="xl:hidden flex items-center gap-2">
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
            <Link
              href="/contacto"
              className="btn btn-primary"
              style={{ height: 40, padding: "0 16px", fontSize: 13 }}
            >
              Contacto
            </Link>
          </div>
        </div>
      </nav>

      {/* Backdrop */}
      <div
        onClick={close}
        aria-hidden
        className={`xl:hidden fixed inset-0 z-[60] transition-opacity duration-300 ${
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
        className={`xl:hidden fixed top-0 right-0 bottom-0 z-[70] w-[82vw] max-w-[360px] bg-paper flex flex-col transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        style={{
          boxShadow: open ? "-30px 0 50px -20px rgba(15,30,61,0.30)" : undefined,
        }}
      >
        <div className="flex items-center justify-between p-6 border-b border-grey-200">
          <BrandMark size={32} />
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

          {/* Cuenta · Acceder al portal + Registrate */}
          <Link
            href="/portal/login"
            onClick={close}
            className="text-[18px] py-4 px-3 -mx-3 rounded-md border-b border-grey-200 text-ink font-semibold hover:text-wine hover:bg-wine/15 transition-colors"
          >
            Acceder al portal
          </Link>
          <Link
            href="/registro"
            onClick={close}
            className="text-[18px] py-4 px-3 -mx-3 rounded-md border-b border-grey-200 text-wine font-bold hover:bg-wine/15 transition-colors"
          >
            Registrate como cliente
          </Link>
        </nav>

        <div className="p-6 border-t border-grey-200">
          <Link
            href="/contacto"
            onClick={close}
            className="btn btn-primary w-full"
          >
            Contáctanos
          </Link>
        </div>
      </aside>
    </>
  );
}
