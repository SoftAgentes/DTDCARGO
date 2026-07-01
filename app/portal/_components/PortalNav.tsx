"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Navegación del portal autenticado (client — estado activo por `usePathname`).
 *
 * Nav de SEIS destinos del Norte (2026-07 · "Un nav de seis destinos"):
 *   Inicio · Mis envíos · Finanzas · Referidos · Academia · Soporte
 * (+ Club, gateado: solo si el cliente está habilitado). "Cuenta" salió del
 * top-nav → cuelga del nombre (PortalAccountMenu).
 *
 * Lo que se plegó (vive DENTRO de un destino, se alcanza por sub-pestañas —
 * `PortalHubTabs`):
 *   · Compras (proveedores + compras) y Documentos → dentro de **Mis envíos**.
 *   · Mensajes + Reclamos → dentro de **Soporte** (`/portal/mensajes`).
 * Por eso los `match` de Mis envíos y Soporte cubren esas sub-rutas: el destino
 * queda activo aunque estés en una sub-sección.
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
    // Hub: activo también en Compras (proveedores/compras) y Documentos, que
    // salieron del top-level pero viven dentro de Mis envíos (Norte).
    match: (p) =>
      p.startsWith("/portal/envios") ||
      p.startsWith("/portal/proveedores") ||
      p.startsWith("/portal/compras") ||
      p.startsWith("/portal/documentos"),
  },
  {
    href: "/portal/finanzas",
    label: "Finanzas",
    // Hub: activo también en sus sub-secciones (Estimados, Facturas, Cotizaciones).
    match: (p) =>
      p.startsWith("/portal/finanzas") ||
      p.startsWith("/portal/estimados") ||
      p.startsWith("/portal/facturas") ||
      p.startsWith("/portal/cotizaciones"),
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
    href: "/portal/mensajes",
    label: "Soporte",
    // Hub: chat con el asesor + casos/reclamos (Norte: "Soporte").
    match: (p) =>
      p.startsWith("/portal/mensajes") || p.startsWith("/portal/reclamos"),
  },
];

/** Club va junto a Referidos, pero solo si el cliente está habilitado (gated). */
const CLUB_LINK = {
  href: "/portal/club",
  label: "Club",
  match: (p: string) => p.startsWith("/portal/club"),
};

export function PortalNav({ showClub = false }: { showClub?: boolean }) {
  const pathname = usePathname() ?? "";
  // Club se inserta junto a Referidos (índice 3) solo si está habilitado.
  const links = showClub
    ? [...LINKS.slice(0, 4), CLUB_LINK, ...LINKS.slice(4)]
    : LINKS;
  return (
    <nav
      className="flex items-center gap-0.5 sm:gap-1 min-w-0 overflow-x-auto no-scrollbar"
      aria-label="Secciones del portal"
    >
      {links.map((l) => {
        const active = l.match(pathname);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`flex-shrink-0 whitespace-nowrap text-[13px] font-semibold rounded-md px-2 sm:px-3 py-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
              active
                ? "text-ink bg-grey-100"
                : "text-grey-500 hover:text-ink"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
