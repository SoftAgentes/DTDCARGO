"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Sub-navegación de un hub del portal (segunda fila, debajo del top-nav de 6
 * destinos del Norte). El top-nav colapsó a 6 destinos; las secciones que "viven
 * dentro" de un destino (Norte: Proveedores/Documentos dentro de Mis envíos;
 * Mensajes/Reclamos dentro de Soporte) se alcanzan por estas pestañas.
 *
 * Client (estado activo por `usePathname`). Clases theme-aware (mismas que
 * `PortalNav`) → sirve en el portal claro y en el tema oscuro del Norte.
 */
type SubTab = { href: string; label: string; match: (p: string) => boolean };

function SubTabs({ tabs, ariaLabel }: { tabs: SubTab[]; ariaLabel: string }) {
  const pathname = usePathname() ?? "";
  return (
    <nav
      aria-label={ariaLabel}
      className="mb-7 flex items-center gap-1 border-b border-grey-200 overflow-x-auto no-scrollbar"
    >
      {tabs.map((t) => {
        const active = t.match(pathname);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`flex-shrink-0 whitespace-nowrap text-[13px] font-semibold px-3 py-2.5 border-b-2 -mb-px transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
              active
                ? "border-wine text-ink"
                : "border-transparent text-grey-500 hover:text-ink"
            }`}
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
