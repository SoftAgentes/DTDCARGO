"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Navegación del portal autenticado (client — estado activo por `usePathname`).
 * Inicio · Mis envíos · Compras · Finanzas · Documentos · Referidos · Academia · Club · Mensajes · Cuenta.
 * Etiquetas cortas para que entren en mobile sin romper el header de 68px.
 * "Compras" (SDD-0057) cubre Tus proveedores + Mis compras. "Finanzas" (founder
 * 2026-06-20) es el hub que agrupa Estimados + Facturas + Cotizaciones (las dos
 * primeras salieron del top-level). "Referidos" = cara cliente de SDD-0051.
 */
const LINKS: {
  href: string;
  label: string;
  match: (pathname: string) => boolean;
}[] = [
  {
    href: "/portal",
    label: "Inicio",
    match: (p) => p === "/portal",
  },
  {
    href: "/portal/envios",
    label: "Mis envíos",
    match: (p) => p.startsWith("/portal/envios"),
  },
  {
    href: "/portal/proveedores",
    label: "Compras",
    match: (p) =>
      p.startsWith("/portal/proveedores") || p.startsWith("/portal/compras"),
  },
  {
    href: "/portal/finanzas",
    label: "Finanzas",
    // Hub: activo también en sus sub-secciones (Estimados, Facturas), que ya no
    // están en el top-level pero viven bajo Finanzas.
    match: (p) =>
      p.startsWith("/portal/finanzas") ||
      p.startsWith("/portal/estimados") ||
      p.startsWith("/portal/facturas"),
  },
  {
    href: "/portal/documentos",
    label: "Documentos",
    match: (p) => p.startsWith("/portal/documentos"),
  },
  {
    href: "/portal/reclamos",
    label: "Reclamos",
    match: (p) => p.startsWith("/portal/reclamos"),
  },
  {
    href: "/portal/referidos",
    label: "Referidos",
    match: (p) => p.startsWith("/portal/referidos"),
  },
  {
    href: "/portal/academia",
    label: "Academia",
    match: (p) => p.startsWith("/portal/academia"),
  },
  {
    href: "/portal/club",
    label: "Club",
    match: (p) => p.startsWith("/portal/club"),
  },
  {
    href: "/portal/mensajes",
    label: "Mensajes",
    match: (p) => p.startsWith("/portal/mensajes"),
  },
  {
    href: "/portal/cuenta",
    label: "Cuenta",
    match: (p) => p.startsWith("/portal/cuenta"),
  },
];

export function PortalNav() {
  const pathname = usePathname() ?? "";
  return (
    <nav
      className="flex items-center gap-0.5 sm:gap-1 min-w-0 overflow-x-auto no-scrollbar"
      aria-label="Secciones del portal"
    >
      {LINKS.map((l) => {
        const active = l.match(pathname);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`flex-shrink-0 whitespace-nowrap text-[13px] font-semibold rounded-md px-2 sm:px-3 py-2 transition-colors ${
              active
                ? "text-ink bg-grey-100"
                : "text-grey-500 hover:text-ink hover:bg-grey-100"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
