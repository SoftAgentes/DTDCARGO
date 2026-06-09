"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Navegación del portal autenticado (client — estado activo por `usePathname`).
 * Inicio (dashboard) · Mis envíos · Estimados · Compras · Facturas · Documentos · Mensajes · Cuenta.
 * Etiquetas cortas para que entren en mobile sin romper el header de 68px.
 * "Compras" (SDD-0057) cubre Tus proveedores + Mis compras. (Referidos / Soporte
 * del Norte son slices futuros — no se incluyen.)
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
    href: "/portal/estimados",
    label: "Estimados",
    match: (p) => p.startsWith("/portal/estimados"),
  },
  {
    href: "/portal/proveedores",
    label: "Compras",
    match: (p) =>
      p.startsWith("/portal/proveedores") || p.startsWith("/portal/compras"),
  },
  {
    href: "/portal/facturas",
    label: "Facturas",
    match: (p) => p.startsWith("/portal/facturas"),
  },
  {
    href: "/portal/documentos",
    label: "Documentos",
    match: (p) => p.startsWith("/portal/documentos"),
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
