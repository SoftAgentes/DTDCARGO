"use client";

/**
 * StudioSidebar · DTD Studio Shell v1
 *
 * Sidebar oscuro agrupado en 4 secciones (OPERACIÓN/COMERCIAL/FINANZAS/SISTEMA)
 * con 21 módulos. Active state via usePathname. Collapsed state persistido
 * en localStorage. Portado desde docs/design/v1-studio/source/erp/shell.jsx.
 *
 * Slugs definidos en SDD-0007 §4.1.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "../../_components/icons";
import { BrandMark } from "@/components/BrandMark";
import {
  FEATURE_FLAG_DEFAULTS,
  isModuleEnabled,
  type FeatureFlags,
} from "@/lib/studio/feature-flags-types";

type Group = "OPERACIÓN" | "COMERCIAL" | "FINANZAS" | "SISTEMA";

interface ModuleDef {
  id: string;
  group: Group;
  label: string;
  icon: IconName;
  slug: string; // ruta bajo /studio
  badge?: string; // Pendiente de cablear contra data real — ver SDD-0014/dashboard-queries
}

export const MODULES: ModuleDef[] = [
  // OPERACIÓN
  { id: "dashboard", group: "OPERACIÓN", label: "Dashboard", icon: "dashboard", slug: "/studio/dashboard" },
  { id: "shipments", group: "OPERACIÓN", label: "Embarques", icon: "box", slug: "/studio/embarques" },
  { id: "tracking", group: "OPERACIÓN", label: "Tracking", icon: "radar", slug: "/studio/tracking" },
  { id: "calendar", group: "OPERACIÓN", label: "Calendario", icon: "clock", slug: "/studio/calendario" },
  { id: "cn", group: "OPERACIÓN", label: "Almacén CN", icon: "warehouse", slug: "/studio/cn" },
  { id: "qrqueue", group: "OPERACIÓN", label: "Cola de QR", icon: "tag", slug: "/studio/cola-qr" },
  { id: "labels", group: "OPERACIÓN", label: "Etiquetas CN", icon: "tag", slug: "/studio/etiquetas" },
  { id: "ve", group: "OPERACIÓN", label: "Almacén VE", icon: "warehouse", slug: "/studio/ve" },
  { id: "seniat", group: "OPERACIÓN", label: "Aduana SENIAT", icon: "shield", slug: "/studio/seniat" },
  { id: "tms", group: "OPERACIÓN", label: "TMS · Transporte", icon: "truck", slug: "/studio/tms" },
  { id: "despacho", group: "OPERACIÓN", label: "Despacho", icon: "truck", slug: "/studio/despacho" },
  { id: "despacho-rules", group: "OPERACIÓN", label: "Reglas despacho", icon: "shield", slug: "/studio/despacho/reglas" },
  { id: "despacho-dashboard", group: "OPERACIÓN", label: "Dashboard despacho", icon: "chart", slug: "/studio/despacho/dashboard" },
  { id: "admin-rutas", group: "OPERACIÓN", label: "Rutas y ciudades", icon: "radar", slug: "/studio/admin/rutas" },

  // COMERCIAL
  { id: "quotes", group: "COMERCIAL", label: "Cotizador", icon: "calc", slug: "/studio/cotizador" },
  { id: "clients", group: "COMERCIAL", label: "Clientes", icon: "users", slug: "/studio/clientes" },
  { id: "leads", group: "COMERCIAL", label: "CRM · Leads", icon: "spark", slug: "/studio/leads" },
  { id: "suppliers", group: "COMERCIAL", label: "Proveedores CN", icon: "cn", slug: "/studio/proveedores" },
  { id: "rates", group: "COMERCIAL", label: "Tarifas", icon: "tag", slug: "/studio/tarifas" },

  // FINANZAS
  { id: "invoices", group: "FINANZAS", label: "Facturación", icon: "invoice", slug: "/studio/facturacion" },
  { id: "documents", group: "FINANZAS", label: "Documentos", icon: "doc", slug: "/studio/documentos" },
  { id: "reports", group: "FINANZAS", label: "Reportes", icon: "chart", slug: "/studio/reportes" },
  { id: "costing", group: "FINANZAS", label: "Costing & Margen", icon: "star", slug: "/studio/costing" },

  // SISTEMA
  { id: "mailing", group: "SISTEMA", label: "Mailing", icon: "mail", slug: "/studio/mailing" },
  { id: "no-olvidar", group: "SISTEMA", label: "No-Olvidar", icon: "lock", slug: "/studio/no-olvidar" },
  { id: "users", group: "SISTEMA", label: "Usuarios", icon: "shield", slug: "/studio/usuarios" },
  { id: "operarios", group: "SISTEMA", label: "Operarios PWA", icon: "users", slug: "/studio/operarios" },
  { id: "bugs", group: "SISTEMA", label: "Bug Tracker", icon: "shield", slug: "/studio/bugs" },
  { id: "mis-bugs", group: "SISTEMA", label: "Mis reportes", icon: "flag", slug: "/studio/mis-bugs" },
  { id: "admin", group: "SISTEMA", label: "Administración", icon: "cog", slug: "/studio/admin" },
];

const GROUP_ORDER: Group[] = ["OPERACIÓN", "COMERCIAL", "FINANZAS", "SISTEMA"];
const STORAGE_KEY = "studio_sidebar_collapsed";
const GROUPS_STORAGE_KEY = "studio_sidebar_groups";

/**
 * Estado de grupos: `false` = cerrado, `true` o undefined = abierto (default).
 * Persistido en localStorage key `studio_sidebar_groups`. Patrón portado de
 * `docs/design/studio/v1.7-claude-design/project/erp/shell.jsx` líneas 84-90.
 */
type OpenGroups = Partial<Record<Group, boolean>>;

interface Props {
  /** Feature flags del tenant · sidebar oculta módulos cuyo flag esté OFF. */
  featureFlags?: FeatureFlags;
}

export function StudioSidebar({ featureFlags }: Props = {}) {
  const pathname = usePathname();
  // Fallback a defaults del handoff si el layout no pasó flags (SSR / tests).
  const flags = featureFlags ?? FEATURE_FLAG_DEFAULTS;
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [openGroups, setOpenGroups] = useState<OpenGroups>({});

  // Hidratar estado collapsed + openGroups desde localStorage
  useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === "1") setCollapsed(true);
    } catch {
      // ignore (SSR / disabled storage)
    }
    try {
      const raw = localStorage.getItem(GROUPS_STORAGE_KEY);
      if (raw) setOpenGroups(JSON.parse(raw) as OpenGroups);
    } catch {
      // ignore (parse error / disabled storage)
    }
    setHydrated(true);
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // ignore
    }
  };

  const toggleGroup = (group: Group) => {
    // Default abierto · si nunca se tocó, primera click = cerrar (false)
    const currentlyOpen = openGroups[group] !== false;
    const next: OpenGroups = { ...openGroups, [group]: !currentlyOpen };
    setOpenGroups(next);
    try {
      localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  // Match active: exacto o prefijo + "/"
  const isActive = (slug: string) =>
    pathname === slug || pathname.startsWith(slug + "/");

  // Filtrar módulos por feature flags ANTES de agrupar (esconder lo
  // desactivado del tenant). Módulos sin entry en MODULE_FLAG_MAP =
  // siempre visibles (core).
  const visibleModules = MODULES.filter((m) => isModuleEnabled(m.id, flags));

  const grouped = GROUP_ORDER.map((g) => ({
    group: g,
    items: visibleModules.filter((m) => m.group === g),
    isOpen: openGroups[g] !== false, // default abierto
  })).filter((g) => g.items.length > 0); // ocultar grupos vacíos

  return (
    <aside
      style={{
        position: "sticky",
        top: 0,
        height: "100vh",
        width: collapsed ? "var(--sb-collapsed)" : "var(--sb-expanded)",
        background: "var(--bg-sidebar)",
        borderRight: "1px solid var(--border-side)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        transition: hydrated ? "width var(--dur) var(--ease)" : "none",
        overflow: "hidden",
        zIndex: 50,
      }}
    >
      {/* Logo + collapse trigger */}
      <div
        style={{
          height: "var(--topbar-h)",
          padding: collapsed ? "0" : "0 12px 0 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          gap: 8,
          borderBottom: "1px solid var(--border-side)",
          cursor: collapsed ? "pointer" : "default",
          flexShrink: 0,
        }}
        onClick={collapsed ? toggleCollapsed : undefined}
        title={collapsed ? "Expandir sidebar" : undefined}
      >
        <Logo collapsed={collapsed} />
        {!collapsed && (
          <button
            onClick={toggleCollapsed}
            title="Colapsar sidebar"
            aria-label="Colapsar sidebar"
            style={{
              width: 26,
              height: 26,
              flexShrink: 0,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "var(--r-sm)",
              color: "var(--ink-side-soft)",
              background: "var(--bg-side-btn)",
              transition:
                "background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--bg-side-btn-hover)";
              e.currentTarget.style.color = "var(--ink-side-strong)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--bg-side-btn)";
              e.currentTarget.style.color = "var(--ink-side-soft)";
            }}
          >
            <span style={{ transform: "rotate(180deg)", display: "inline-flex" }}>
              {Icon.chevR(13)}
            </span>
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "14px 10px",
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        {grouped.map(({ group, items, isOpen }) => {
          // Cuando sidebar colapsado: ignorar isOpen, mostrar todos los iconos.
          // Cuando expandido: respetar estado por grupo (default abierto).
          const showItems = collapsed || isOpen;
          return (
          <div key={group} style={{ marginBottom: 6 }}>
            {!collapsed && (
              <button
                type="button"
                onClick={() => toggleGroup(group)}
                aria-expanded={isOpen}
                aria-controls={`sidebar-group-${group}`}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  padding: "8px 10px 6px",
                  font: "700 9.5px/1 var(--f-sans)",
                  color: "var(--ink-side-soft)",
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  transition: "color var(--dur-fast) var(--ease)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "var(--ink-side-strong)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "var(--ink-side-soft)";
                }}
              >
                <span>{group}</span>
                <span
                  aria-hidden
                  style={{
                    display: "inline-flex",
                    transform: `rotate(${isOpen ? 0 : -90}deg)`,
                    transition: "transform var(--dur-fast) var(--ease)",
                  }}
                >
                  {Icon.chevD(11)}
                </span>
              </button>
            )}
            <div id={`sidebar-group-${group}`} hidden={!showItems}>
            {showItems && items.map((m) => {
              const active = isActive(m.slug);
              return (
                <Link
                  key={m.id}
                  href={m.slug}
                  title={collapsed ? m.label : undefined}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: collapsed ? "10px 0" : "9px 12px",
                    justifyContent: collapsed ? "center" : "flex-start",
                    background: active ? "var(--bg-sidebar-active)" : "transparent",
                    color: active ? "var(--ink-side-strong)" : "var(--ink-side)",
                    borderRadius: "var(--r-md)",
                    font: "500 13px/1 var(--f-sans)",
                    textDecoration: "none",
                    boxShadow:
                      active && !collapsed
                        ? "inset 3px 0 0 var(--wine-soft)"
                        : "none",
                    transition:
                      "background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease)",
                  }}
                  onMouseEnter={(e) => {
                    if (!active)
                      e.currentTarget.style.background = "var(--bg-sidebar-hover)";
                  }}
                  onMouseLeave={(e) => {
                    if (!active)
                      e.currentTarget.style.background = "transparent";
                  }}
                >
                  <span
                    style={{
                      color: active ? "var(--wine-soft)" : "var(--ink-side-soft)",
                      flexShrink: 0,
                      display: "inline-flex",
                    }}
                  >
                    {Icon[m.icon]?.(18)}
                  </span>
                  {!collapsed && (
                    <span
                      style={{
                        flex: 1,
                        textAlign: "left",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {m.label}
                    </span>
                  )}
                </Link>
              );
            })}
            </div>
          </div>
          );
        })}
      </nav>

      {/* Footer: collapse toggle */}
      <div
        style={{
          padding: collapsed ? "12px 8px" : "12px 14px",
          borderTop: "1px solid var(--border-side)",
          flexShrink: 0,
        }}
      >
        <button
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expandir sidebar" : "Colapsar sidebar"}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "8px",
            borderRadius: "var(--r-md)",
            color: "var(--ink-side-soft)",
            background: "var(--bg-side-btn)",
            font: "500 12px/1 var(--f-sans)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--bg-side-btn-hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--bg-side-btn)";
          }}
        >
          <span
            style={{
              transform: collapsed ? "rotate(0deg)" : "rotate(180deg)",
              display: "inline-flex",
              transition: "transform var(--dur) var(--ease)",
            }}
          >
            {Icon.chevR(14)}
          </span>
          {!collapsed && <span>Colapsar</span>}
        </button>
      </div>
    </aside>
  );
}

/**
 * Logo del Studio sidebar — alineado a Brand Book v3.0 (mayo 2026).
 *
 * Reusa el componente `<BrandMark>` con variant "reverse" (cream sobre
 * navy oscuro). El sub-tag "Studio · ERP" queda como caption secundario
 * después del lockup oficial — preserva la pista visual de "esto es el
 * ERP interno" sin violar la spec del wordmark v3.0 ("DTD Cargo" es el
 * único wordmark aprobado).
 *
 * Cambios vs versión legacy:
 *  - `dtdcargo-icon-navy.png` (raster viejo) → 4 variantes PNG nuevas via BrandMark
 *  - Filtro `brightness(0) invert(1)` removido (parche CSS prohibido por v3.0)
 *  - `wine-soft` en "DTD" → wine sólido (var v3.0 explícita)
 *  - "DTDSTUDIO" mashup → "DTD Cargo" + caption "Studio · ERP"
 */
function Logo({ collapsed }: { collapsed: boolean }) {
  const size = collapsed ? 28 : 30;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        minWidth: 0,
      }}
    >
      <BrandMark
        variant="reverse"
        size={size}
        isologoOnly={collapsed}
      />
      {!collapsed && (
        <span
          style={{
            font: "600 9.5px/1 var(--f-sans)",
            color: "var(--ink-side-soft)",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            paddingLeft: 8,
            borderLeft: "1px solid var(--border-side)",
          }}
        >
          Studio · ERP
        </span>
      )}
    </div>
  );
}

/** Helper: pathname → module label (para topbar y otros). */
export function pathToModuleLabel(pathname: string): string {
  const match = MODULES.find(
    (m) => pathname === m.slug || pathname.startsWith(m.slug + "/")
  );
  if (match) return match.label;
  if (pathname.startsWith("/studio/ajustes")) return "Ajustes";
  return "DTD Studio";
}
