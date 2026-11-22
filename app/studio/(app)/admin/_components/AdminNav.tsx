"use client";

/**
 * Menú lateral de Administración (SDD-0708, opción B «el menú acompaña»).
 *
 * Lo pinta el layout de `/studio/admin` alrededor de todas sus pantallas. Cada
 * ítem va directo a la pantalla real: sin tarjeta puente. Lo que vive fuera de
 * `/studio/admin` lleva la flecha ↗ para que salir del panel no sorprenda.
 */
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Icon } from "@/app/studio/_components/icons";
import {
  activeAdminSectionId,
  adminSectionHref,
  groupedAdminSections,
} from "./admin-sections";

export function AdminNav({ isSuperadmin }: { isSuperadmin: boolean }) {
  const pathname = usePathname() ?? "/studio/admin";
  const searchParams = useSearchParams();
  const activeId = activeAdminSectionId(pathname, searchParams?.get("section") ?? null);
  const grouped = groupedAdminSections(isSuperadmin);

  return (
    <nav
      aria-label="Secciones de Administración"
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        overflow: "hidden",
        position: "sticky",
        top: 16,
      }}
    >
      {grouped.map(({ group, items }) => (
        <div key={group}>
          <div
            style={{
              padding: "12px 14px 6px",
              font: "700 9.5px/1 var(--f-sans)",
              color: "var(--ink-soft)",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
            }}
          >
            {group}
          </div>
          {items.map((s) => {
            const isActive = s.id === activeId;
            return (
              <Link
                key={s.id}
                href={adminSectionHref(s)}
                aria-current={isActive ? "page" : undefined}
                className="studio-adminnav-item"
                title={s.external ? `${s.label}: abre otro módulo del Studio` : undefined}
                aria-label={s.external ? `${s.label} (abre otro módulo del Studio)` : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  background: isActive ? "color-mix(in srgb, var(--ink) 8%, transparent)" : "transparent",
                  color: "var(--ink)",
                  font: `${isActive ? "700" : "500"} 13px/1.2 var(--f-sans)`,
                  textDecoration: "none",
                  position: "relative",
                }}
              >
                {isActive && (
                  <span
                    aria-hidden
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 8,
                      bottom: 8,
                      width: 3,
                      background: "var(--ink)",
                      borderRadius: 2,
                    }}
                  />
                )}
                <span
                  style={{
                    color: isActive ? "var(--ink)" : "var(--ink-soft)",
                    display: "inline-flex",
                    flexShrink: 0,
                  }}
                >
                  {Icon[s.icon]?.(15)}
                </span>
                <span style={{ flex: 1 }}>{s.label}</span>
                {s.external && (
                  <span aria-hidden style={{ color: "var(--ink-soft)", display: "inline-flex", flexShrink: 0 }}>
                    {Icon.external?.(13)}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
