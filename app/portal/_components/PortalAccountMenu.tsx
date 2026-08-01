"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutAction } from "../actions";

/**
 * Menú de cuenta del portal (Norte 2026-07): el perfil "cuelga del nombre del
 * cliente", no del top-nav. El botón muestra nombre + Shipping Mark; el
 * dropdown lleva a Mi perfil (unificado, SDD-0145) y Cerrar sesión.
 *
 * Client: maneja abierto/cerrado + cierre por clic afuera / Escape. El logout
 * sigue siendo la server action `signOutAction` (mismo `<form>` de antes).
 */
export function PortalAccountMenu({
  name,
  markbox,
}: {
  name: string;
  markbox: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname() ?? "";
  const [menuState, setMenuState] = useState({ path: pathname, open: false });
  const open = menuState.path === pathname && menuState.open;
  const setOpen = useCallback((next: boolean | ((current: boolean) => boolean)) => {
    setMenuState((current) => ({
      path: pathname,
      open:
        typeof next === "function"
          ? next(current.path === pathname && current.open)
          : next,
    }));
  }, [pathname]);

  // Cierra por clic afuera o Escape.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus(); // devolver el foco al disparador (a11y)
      }
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen]);

  const accountActive = pathname.startsWith("/portal/perfil");

  return (
    <div className="relative" ref={ref}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        // Sin aria-haspopup: es un disclosure de links (Tab los recorre), no un
        // menú con navegación por flechas — no prometemos semántica que no hay.
        aria-expanded={open}
        className={`flex items-center gap-2 rounded-md pl-2 pr-1.5 py-1 border transition-colors ${
          open || accountActive
            ? "border-ink"
            : "border-transparent hover:border-grey-200"
        }`}
      >
        <span className="text-right hidden sm:block leading-tight">
          <span className="block text-[13px] font-semibold text-ink truncate max-w-[180px]">
            {name}
          </span>
          <span
            className="block text-[11.5px] text-grey-500"
            style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
          >
            {markbox}
          </span>
        </span>
        {/* Avatar con iniciales (siempre visible; en mobile es el único disparador). */}
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-wine text-[12px] font-bold"
          style={{
            fontFamily: "var(--font-archivo-black)",
            // on-accent es estable entre temas; `text-white` vira a navy en oscuro
            // (contraste roto sobre wine). Patrón ya usado en el portal.
            color: "var(--color-on-accent)",
          }}
          aria-hidden
        >
          {initials(name)}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-56 rounded-lg border border-grey-200 bg-white shadow-lg py-1.5">
          {/* Sin role="menu": son links + botón nativos, Tab los recorre. Evita
              prometer semántica de menú (flechas) que no implementamos. */}
          {/* Identidad (sobre todo para mobile, donde el botón no la muestra). */}
          <div className="px-3 py-2 sm:hidden border-b border-grey-200 mb-1">
            <div className="text-[13px] font-semibold text-ink truncate">{name}</div>
            <div
              className="text-[11.5px] text-grey-500"
              style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
            >
              {markbox}
            </div>
          </div>

          <Link
            href="/portal/perfil"
            className="block px-3 py-2 text-[14px] font-medium text-grey-700 hover:bg-grey-100 hover:text-ink transition-colors"
          >
            Mi perfil
          </Link>

          <div className="my-1 border-t border-grey-200" />

          <form action={signOutAction}>
            <button
              type="submit"
              className="block w-full text-left px-3 py-2 text-[14px] font-medium text-wine hover:bg-grey-100 transition-colors"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

/** Iniciales (máx 2) del nombre del cliente para el avatar. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}
