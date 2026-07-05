"use client";

import { type ComponentType, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  GridIcon,
  BoxIcon,
  PaymentIcon,
  StarIcon,
  ShieldIcon,
  ChatIcon,
  CrownIcon,
} from "@/components/Icon";

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
 *   · Mensajes + Reclamos → fundidos en **Soporte** (`/portal/soporte`, SDD-0147).
 * Por eso los `match` de Mis envíos y Soporte cubren esas sub-rutas: el destino
 * queda activo aunque estés en una sub-sección.
 */
type IconCmp = ComponentType<{ size?: number; className?: string }>;

const LINKS: {
  href: string;
  label: string;
  icon: IconCmp;
  match: (pathname: string) => boolean;
}[] = [
  {
    href: "/portal",
    label: "Inicio",
    icon: GridIcon,
    match: (p) => p === "/portal",
  },
  {
    href: "/portal/envios",
    label: "Alertas mis envíos",
    icon: BoxIcon,
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
    icon: PaymentIcon,
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
    icon: StarIcon,
    match: (p) => p.startsWith("/portal/referidos"),
  },
  {
    href: "/portal/academia",
    label: "Academia",
    icon: ShieldIcon,
    match: (p) => p.startsWith("/portal/academia"),
  },
  {
    href: "/portal/soporte",
    label: "Soporte",
    icon: ChatIcon,
    // Pantalla única (SDD-0147): chat con el asesor + casos/reclamos. `/mensajes`
    // y `/reclamos` redirigen a `/soporte` — se matchean por si un link viejo pasa.
    match: (p) =>
      p.startsWith("/portal/soporte") ||
      p.startsWith("/portal/mensajes") ||
      p.startsWith("/portal/reclamos"),
  },
];

/** Club va junto a Referidos, pero solo si el cliente está habilitado (gated). */
const CLUB_LINK = {
  href: "/portal/club",
  label: "Club",
  icon: CrownIcon as IconCmp,
  match: (p: string) => p.startsWith("/portal/club"),
};

export function PortalNav({
  showClub = false,
  soporteLastReplyAt = null,
}: {
  showClub?: boolean;
  /** Último reply del equipo (SDD-0148 #4): punto en "Soporte" si es más nuevo
   *  que la última visita del cliente (guardada en localStorage). */
  soporteLastReplyAt?: string | null;
}) {
  const pathname = usePathname() ?? "";
  // Club se inserta junto a Referidos (índice 3) solo si está habilitado.
  const links = showClub
    ? [...LINKS.slice(0, 4), CLUB_LINK, ...LINKS.slice(4)]
    : LINKS;

  // #4 Badge de Soporte: al entrar a /portal/soporte marcamos "visto" (localStorage);
  // en otras rutas leemos el visto para decidir si mostrar el punto. Sin migración.
  const onSoporte = pathname.startsWith("/portal/soporte");
  const [seenAt, setSeenAt] = useState<string | null>(null);
  useEffect(() => {
    try {
      if (onSoporte) {
        const now = new Date().toISOString();
        localStorage.setItem("dtd-portal-soporte-seen", now);
        setSeenAt(now);
      } else {
        setSeenAt(localStorage.getItem("dtd-portal-soporte-seen"));
      }
    } catch {
      /* localStorage no disponible — sin badge, sin ruido */
    }
  }, [onSoporte]);

  const showSoporteDot =
    !!soporteLastReplyAt &&
    !onSoporte &&
    (!seenAt ||
      new Date(soporteLastReplyAt).getTime() > new Date(seenAt).getTime());

  return (
    <nav
      className="flex items-center gap-0.5 sm:gap-1 min-w-0 overflow-x-auto no-scrollbar"
      aria-label="Secciones del portal"
    >
      {links.map((l) => {
        const active = l.match(pathname);
        const Icon = l.icon;
        const dot = l.href === "/portal/soporte" && showSoporteDot;
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            title={dot ? `${l.label} · tienes una respuesta nueva` : undefined}
            className={`relative inline-flex items-center gap-1.5 sm:gap-2 flex-shrink-0 whitespace-nowrap text-[13px] font-semibold rounded-md px-2 sm:px-3 py-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
              active
                ? "text-wine"
                : "text-grey-500 hover:text-ink hover:bg-grey-100"
            }`}
            style={
              active
                ? { background: "color-mix(in srgb, var(--color-wine) 12%, transparent)" }
                : undefined
            }
          >
            <span className="relative flex-shrink-0">
              <Icon size={15} />
              {dot && (
                <span
                  aria-hidden
                  className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-wine ring-2 ring-white"
                />
              )}
            </span>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
