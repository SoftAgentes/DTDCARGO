"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Sub-navegación de un hub del portal (segunda fila, debajo del top-nav de 6
 * destinos del Norte). El top-nav colapsó a 6 destinos; las secciones que "viven
 * dentro" de un destino (Norte: Proveedores/Documentos dentro de Mis envíos;
 * Mensajes/Reclamos dentro de Soporte) se alcanzan por estas pestañas.
 *
 * Client (estado activo por `usePathname`). La forma vive en
 * `app/portal/claridad.css` (SDD-0603 · tramo 3, BD-037): un control con
 * partes, la activa rellena de tinta y anunciada con `aria-current="page"`
 * (son enlaces de navegación, no `tablist`). Envuelve en pantallas angostas en
 * vez de esconder pestañas con scroll. Sirve en claro y en oscuro.
 */
type SubTab = { href: string; label: string; match: (p: string) => boolean };

function SubTabs({ tabs, ariaLabel }: { tabs: SubTab[]; ariaLabel: string }) {
  const pathname = usePathname() ?? "";
  return (
    <nav
      aria-label={ariaLabel}
      className="portal-subtabs mb-7"
    >
      {tabs.map((t) => {
        const active = t.match(pathname);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className="portal-subtab"
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
/** Hub "Mis envíos": Envíos · Compras · Documentos (Norte: todo vive dentro de envíos). */
export function EnviosHubTabs() {
  return (
    <SubTabs
      ariaLabel="Secciones de Mis envíos"
      tabs={[
        {
          href: "/portal/envios",
          label: "Envíos",
          match: (p) => p.startsWith("/portal/envios"),
        },
        {
          href: "/portal/proveedores",
          label: "Compras",
          match: (p) =>
            p.startsWith("/portal/proveedores") ||
            p.startsWith("/portal/compras"),
        },
        {
          href: "/portal/documentos",
          label: "Documentos",
          match: (p) => p.startsWith("/portal/documentos"),
        },
      ]}
    />
  );
}
