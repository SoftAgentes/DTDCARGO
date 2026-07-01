"use client";

/**
 * StudioSidebar · DTD Studio Shell v1
 *
 * Sidebar oscuro agrupado en 5 secciones (OPERACIÓN/COMERCIAL/FINANZAS/
 * MARKETING/SISTEMA). Active state via usePathname. Collapsed state persistido
 * en localStorage. Diseño (Norte): docs/design/studio/_norte/erp/shell.jsx
 *
 * El registro de módulos vive en `lib/studio/modules.ts` (data pura, compartida
 * con la matriz RBAC). El sidebar solo ESCONDE los módulos que el rol no puede
 * ver (UX); el gate real de seguridad está en cada page.tsx vía
 * `requireModuleView` (SDD-0085). Slugs definidos en SDD-0007 §4.1.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "../../_components/icons";
import { BrandMark } from "@/components/BrandMark";
import {
  FEATURE_FLAG_DEFAULTS,
  isModuleEnabled,
  type FeatureFlags,
} from "@/lib/studio/feature-flags-types";
import { useT, t as tBase, type Locale } from "@/lib/i18n";
import {
  MODULES,
  GROUP_ORDER,
  GROUP_LABEL_KEYS,
  type Group,
} from "@/lib/studio/modules";
import { canAccessModule } from "@/lib/studio/rbac";
import type { StudioUserRole } from "@/lib/studio/user-types";

const STORAGE_KEY = "studio_sidebar_collapsed";
const OPEN_GROUP_KEY = "studio_sidebar_opengroup";

/**
 * Acordeón de secciones: UN solo grupo abierto a la vez (no todos). Al navegar
 * a un módulo se abre su grupo y se colapsan los demás; `null` = todas cerradas.
 * Persistido en localStorage key `studio_sidebar_opengroup`. Patrón portado del
 * Norte vigente (`docs/design/studio/_norte/erp/shell.jsx`, estado `openGroup`).
 */

interface Props {
  /** Feature flags del tenant · sidebar oculta módulos cuyo flag esté OFF. */
  featureFlags?: FeatureFlags;
  /** Alertas de gastos activas (badge en el item "Gastos"). */
  expenseAlertCount?: number;
  /**
   * Rol del user en su tenant. El sidebar esconde los módulos que el rol no
   * puede ver (matriz `ROLE_MODULE_ACCESS`, SDD-0085). El gate real lo hace la
   * page server-side; esto solo evita mostrar un link que daría redirect.
   */
  role?: StudioUserRole | null;
}

export function StudioSidebar({
  featureFlags,
  expenseAlertCount = 0,
  role = null,
}: Props = {}) {
  const pathname = usePathname();
  const t = useT();
  // Fallback a defaults del handoff si el layout no pasó flags (SSR / tests).
  const flags = featureFlags ?? FEATURE_FLAG_DEFAULTS;
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Grupo del módulo activo (según la ruta) → sección que arranca abierta.
  const activeGroup =
    MODULES.find(
      (m) => pathname === m.slug || pathname.startsWith(m.slug + "/"),
    )?.group ?? null;

  // Acordeón: arranca en el grupo activo (o el primero). Se hidrata desde
  // localStorage solo cuando no hay grupo activo (si lo hay, manda la navegación).
  const [openGroup, setOpenGroup] = useState<Group | null>(
    activeGroup ?? GROUP_ORDER[0],
  );

  // Hidratar estado collapsed + restaurar la última sección abierta.
  useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === "1") setCollapsed(true);
    } catch {
      // ignore (SSR / disabled storage)
    }
    try {
      const saved = localStorage.getItem(OPEN_GROUP_KEY);
      if (saved && !activeGroup && GROUP_ORDER.includes(saved as Group)) {
        setOpenGroup(saved as Group);
      }
    } catch {
      // ignore (disabled storage)
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Al navegar a otro módulo, abrir su grupo y colapsar los demás (acordeón).
  useEffect(() => {
    if (activeGroup) setOpenGroup(activeGroup);
  }, [activeGroup]);

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
    // Acordeón: abre este grupo y colapsa el resto; si ya estaba abierto, cierra.
    setOpenGroup((prev) => {
      const next = prev === group ? null : group;
      try {
        localStorage.setItem(OPEN_GROUP_KEY, next ?? "");
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Match active: exacto o prefijo + "/"
  const isActive = (slug: string) =>
    pathname === slug || pathname.startsWith(slug + "/");

  // Filtrar módulos por feature flags + RBAC ANTES de agrupar. Módulos sin
  // entry en MODULE_FLAG_MAP = siempre visibles (core); el filtro de rol usa la
  // matriz ROLE_MODULE_ACCESS (admin ve todo, fail-closed para roles nulos).
  const visibleModules = MODULES.filter(
    (m) => isModuleEnabled(m.id, flags) && canAccessModule(role, m.id),
  );

  const grouped = GROUP_ORDER.map((g) => ({
    group: g,
    items: visibleModules.filter((m) => m.group === g),
    isOpen: openGroup === g, // acordeón: solo una sección abierta a la vez
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
        title={collapsed ? t("chrome.sidebar.expand") : undefined}
      >
        <Logo collapsed={collapsed} />
        {!collapsed && (
          <button
            onClick={toggleCollapsed}
            title={t("chrome.sidebar.collapse")}
            aria-label={t("chrome.sidebar.collapse")}
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
          // Cuando expandido: respetar el acordeón (solo el grupo abierto).
          const showItems = collapsed || isOpen;
          // Rastro de "dónde estás" cuando la sección activa está cerrada: sin
          // esto, cerrar el grupo activo borra toda pista del módulo actual.
          const isActiveClosed = !collapsed && group === activeGroup && !isOpen;
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
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    color: isActiveClosed ? "var(--ink-side-strong)" : undefined,
                  }}
                >
                  {GROUP_LABEL_KEYS[group] ? t(GROUP_LABEL_KEYS[group]) : group}
                  {isActiveClosed && (
                    <span
                      aria-hidden
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: "var(--r-pill)",
                        background: "var(--wine-soft)",
                        flexShrink: 0,
                      }}
                    />
                  )}
                </span>
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
              const moduleLabel = m.labelKey ? t(m.labelKey) : m.label;
              return (
                <Link
                  key={m.id}
                  href={m.slug}
                  title={collapsed ? moduleLabel : undefined}
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
                      {moduleLabel}
                    </span>
                  )}
                  {!collapsed && m.id === "expenses" && expenseAlertCount > 0 && (
                    <span
                      aria-label={`${expenseAlertCount}`}
                      style={{
                        minWidth: 18,
                        height: 18,
                        padding: "0 5px",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 9,
                        background: "var(--warning)",
                        color: "var(--ink)",
                        font: "800 10px/1 var(--f-mono)",
                        flexShrink: 0,
                      }}
                    >
                      {expenseAlertCount}
                    </span>
                  )}
                </Link>
              );
            })}
            </div>
          </div>
          );
        })}
        {grouped.length === 0 && !collapsed && (
          <div
            style={{
              padding: "16px 12px",
              font: "500 12px/1.5 var(--f-sans)",
              color: "var(--ink-side-soft)",
            }}
          >
            Tu cuenta todavía no tiene módulos asignados. Escríbele a un
            administrador.
          </div>
        )}
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
          aria-label={collapsed ? t("chrome.sidebar.expand") : t("chrome.sidebar.collapse")}
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
          {!collapsed && <span>{t("chrome.sidebar.collapse_short")}</span>}
        </button>
      </div>
    </aside>
  );
}

/**
 * Logo del Studio sidebar — alineado al Brand Book vigente (Norte).
 *
 * Reusa el componente `<BrandMark>` con variant "reverse" (cream sobre
 * navy oscuro). Solo lockup oficial — el contexto "estás en el ERP" ya
 * está cubierto por URL (/studio/*), topbar (MÓDULO · X), avatar
 * (hailuway.com) y el chrome navy distintivo del Studio.
 */
function Logo({ collapsed }: { collapsed: boolean }) {
  const size = collapsed ? 28 : 30;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        minWidth: 0,
      }}
    >
      <BrandMark
        variant="reverse"
        size={size}
        isologoOnly={collapsed}
      />
    </div>
  );
}

/**
 * Helper: pathname → module label (para topbar y otros).
 *
 * Si se pasa `locale`, devuelve el label traducido vía catálogo i18n;
 * si no, devuelve el label es-VE hardcoded (compat con callers viejos).
 *
 * Server components: pasar `locale` resuelto via resolveLocale().
 * Client components: usar el wrapper hook `useModuleLabel(pathname)` que
 * inyecta el locale activo del LocaleProvider.
 */
export function pathToModuleLabel(pathname: string, locale?: Locale): string {
  const match = MODULES.find(
    (m) => pathname === m.slug || pathname.startsWith(m.slug + "/"),
  );
  if (match) {
    if (locale && match.labelKey) return tBase(locale, match.labelKey);
    return match.label;
  }
  if (pathname.startsWith("/studio/ajustes")) {
    return locale ? tBase(locale, "chrome.module.settings") : "Ajustes";
  }
  return locale ? tBase(locale, "chrome.module.studio") : "DTD Studio";
}
