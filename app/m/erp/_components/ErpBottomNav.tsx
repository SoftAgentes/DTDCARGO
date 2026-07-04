"use client";

/**
 * ErpBottomNav · bottom-nav ÚNICO del Mobile ERP (/m/erp/*) — SDD-0146.
 *
 * Extraído de MobileErpClient para que las rutas reales nuevas (p. ej.
 * /m/erp/bitacora) compartan EXACTAMENTE la misma barra sin duplicarla
 * (fix de review adversarial: cero copias del nav).
 *
 * Dos modos por ítem:
 *   - Tabs in-page de MobileErpClient → `onSelect` (botón, cambia el tab).
 *   - Sin `onSelect` (páginas de ruta propia) → <Link> a /m/erp?tab=….
 *   - `bitacora` SIEMPRE es <Link> a su ruta real (no es tab in-page).
 *
 * `badges` pinta un contador (p. ej. tareas abiertas del user en Bitácora).
 */

import Link from "next/link";
import { Icon } from "@/app/studio/_components/icons";

export type ErpNavKey =
  | "home"
  | "bitacora"
  | "tracking"
  | "clients"
  | "expenses"
  | "more";

/** Tabs in-page de MobileErpClient (todo menos bitácora, que es ruta real). */
export type ErpNavTabKey = Exclude<ErpNavKey, "bitacora">;

type NavRole =
  | "admin"
  | "commercial"
  | "operations"
  | "warehouse"
  | "accounting"
  | "support"
  | "marketing";

/**
 * `roles` opcional · si undefined, todos los roles ven el ítem (Hick's Law:
 * cada rol ve solo lo que usa — plan v2 Sprint B, se preserva tal cual).
 * Bitácora es transversal (RBAC SDD-0146: los 7 roles).
 */
const NAV_ITEMS: {
  k: ErpNavKey;
  label: string;
  icon: (s?: number) => React.ReactNode;
  roles?: NavRole[];
}[] = [
  { k: "home", label: "Inicio", icon: Icon.dashboard },
  { k: "bitacora", label: "Bitácora", icon: Icon.clipboard },
  {
    k: "tracking",
    label: "Tracking",
    icon: Icon.radar,
    roles: ["admin", "commercial", "operations"],
  },
  { k: "clients", label: "Clientes", icon: Icon.users, roles: ["admin"] },
  {
    k: "expenses",
    label: "Gastos",
    icon: Icon.invoice,
    roles: ["admin", "commercial"],
  },
  { k: "more", label: "Más", icon: Icon.more },
];

function visibleNavItems(role: string) {
  return NAV_ITEMS.filter((it) => !it.roles || it.roles.includes(role as NavRole));
}

interface Props {
  active: ErpNavKey;
  role: string;
  /** Contadores por ítem (0/undefined = sin badge). */
  badges?: Partial<Record<ErpNavKey, number>>;
  /** Cambio de tab in-page (MobileErpClient). Sin él, los ítems son links. */
  onSelect?: (k: ErpNavTabKey) => void;
}

export function ErpBottomNav({ active, role, badges, onSelect }: Props) {
  const items = visibleNavItems(role);

  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        maxWidth: 480,
        margin: "0 auto",
        display: "grid",
        gridTemplateColumns: `repeat(${items.length}, 1fr)`,
        background: "var(--bg-surface)",
        borderTop: "1px solid var(--border)",
        padding: "8px 8px",
        paddingBottom: "max(8px, env(safe-area-inset-bottom))",
        zIndex: 30,
      }}
    >
      {items.map((it) => {
        const isActive = active === it.k;
        const count = badges?.[it.k] ?? 0;
        const inner = (
          <>
            <span style={{ position: "relative", display: "inline-flex" }}>
              {it.icon(20)}
              {count > 0 && (
                <span
                  aria-label={`${count} pendiente${count === 1 ? "" : "s"}`}
                  style={{
                    position: "absolute",
                    top: -5,
                    right: -9,
                    minWidth: 15,
                    height: 15,
                    padding: "0 4px",
                    borderRadius: "var(--r-pill)",
                    background: "var(--wine)",
                    color: "#fff",
                    font: "800 9px/15px var(--f-sans)",
                    textAlign: "center",
                  }}
                >
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </span>
            {it.label}
          </>
        );

        const style: React.CSSProperties = {
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
          padding: "6px 4px",
          borderRadius: "var(--r-md)",
          color: isActive ? "var(--wine)" : "var(--ink-mute)",
          font: `${isActive ? "700" : "500"} 10px/1 var(--f-sans)`,
          border: 0,
          background: "transparent",
          cursor: "pointer",
          transition: "color 160ms ease",
          textDecoration: "none",
        };

        // Bitácora = ruta real siempre; el resto es tab in-page (onSelect) o
        // link de vuelta a /m/erp con el tab pedido.
        if (it.k === "bitacora") {
          return (
            <Link
              key={it.k}
              href="/m/erp/bitacora"
              aria-current={isActive ? "page" : undefined}
              style={style}
            >
              {inner}
            </Link>
          );
        }

        if (onSelect) {
          return (
            <button
              key={it.k}
              type="button"
              onClick={() => onSelect(it.k as ErpNavTabKey)}
              aria-current={isActive ? "page" : undefined}
              style={style}
            >
              {inner}
            </button>
          );
        }

        return (
          <Link
            key={it.k}
            href={it.k === "home" ? "/m/erp" : `/m/erp?tab=${it.k}`}
            aria-current={isActive ? "page" : undefined}
            style={style}
          >
            {inner}
          </Link>
        );
      })}
    </nav>
  );
}
