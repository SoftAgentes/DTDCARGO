/**
 * Sidebar nav del Studio con estado activo (Big Win combinado audit técnico + gráfico).
 *
 * - Active state usa wine-soft (#C2747F) — accent identitario.
 * - Iconos SVG inline monocromos (currentColor) — reemplazan emojis nativos.
 * - aria-current="page" para a11y.
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  sub: string;
  icon: React.ReactNode;
};

const ICON_HOME = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const ICON_TRACKING = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const ICON_SETTINGS = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const ITEMS: NavItem[] = [
  { href: "/studio/resumen", label: "Resumen", sub: "KPIs en vivo", icon: ICON_HOME },
  { href: "/studio/tracking", label: "Tracking", sub: "Envíos · CRUD", icon: ICON_TRACKING },
  { href: "/studio/ajustes", label: "Ajustes", sub: "Tarifas · integraciones", icon: ICON_SETTINGS },
];

function isActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  // Active también si estamos en una sub-ruta (ej. /studio/tracking/nuevo activa Tracking)
  return pathname.startsWith(href + "/");
}

export function SidebarNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav
      aria-label="Navegación principal Studio"
      style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}
    >
      {ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            style={{
              position: "relative",
              display: "grid",
              gridTemplateColumns: "20px 1fr",
              gap: 12,
              alignItems: "center",
              padding: "10px 12px",
              borderRadius: 6,
              color: active ? "#FFFFFF" : "rgba(255, 255, 255, 0.72)",
              background: active ? "rgba(194, 116, 127, 0.14)" : "transparent",
              textDecoration: "none",
              transition: "background 0.15s, color 0.15s",
            }}
          >
            {/* Indicador izquierdo wine-soft cuando activo */}
            {active && (
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: 0,
                  top: 8,
                  bottom: 8,
                  width: 3,
                  background: "#C2747F",
                  borderRadius: 2,
                }}
              />
            )}
            <span
              style={{
                display: "grid",
                placeItems: "center",
                color: active ? "#C2747F" : "rgba(255, 255, 255, 0.55)",
                transition: "color 0.15s",
              }}
            >
              {item.icon}
            </span>
            <div>
              <div style={{ font: "700 12.5px/1.1 Archivo, sans-serif" }}>
                {item.label}
              </div>
              <div
                style={{
                  font: "400 10.5px/1.2 Archivo, sans-serif",
                  color: active
                    ? "rgba(255, 255, 255, 0.65)"
                    : "rgba(255, 255, 255, 0.45)",
                  marginTop: 3,
                  letterSpacing: "0.02em",
                }}
              >
                {item.sub}
              </div>
            </div>
          </Link>
        );
      })}
    </nav>
  );
}
