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
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
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
  PARENTS,
  type Group,
  type ModuleDef,
  type ParentDef,
} from "@/lib/studio/modules";
import {
  canAccessModule,
  scopeAllowsModule,
  type RoleModuleOverrides,
} from "@/lib/studio/rbac";
import type { StudioUserRole, WarehouseScope } from "@/lib/studio/user-types";
import { BandejaBadge } from "./BandejaBadge";
import type { ConversacionNoLeida } from "@/lib/studio/chatwoot/conversations-queries";

const STORAGE_KEY = "studio_sidebar_collapsed";
const OPEN_GROUP_KEY = "studio_sidebar_opengroup";
const PARENTS_KEY = "studio_sidebar_parents";
const SB_WIDTH_KEY = "studio_sb_w";
// Rango del slider de ancho (px). Portado del Norte: el label más largo aún
// entra en 1 línea a 200px.
const SB_MIN = 200;
const SB_MAX = 280;

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
   * Conversaciones de Chatwoot abiertas con no leídos (SDD-0585, E2-D21): badge del
   * item "Bandeja", vivo por Realtime. Solo se pinta si el item se ve (rol + flag).
   */
  bandeja?: { tenantId: string | null; initial: ConversacionNoLeida[] };
  /**
   * Rol del user en su tenant. El sidebar esconde los módulos que el rol no
   * puede ver (matriz `ROLE_MODULE_ACCESS`, SDD-0085). El gate real lo hace la
   * page server-side; esto solo evita mostrar un link que daría redirect.
   */
  role?: StudioUserRole | null;
  /**
   * Scope de almacén del user (SDD-0139): esconde los módulos del lado que no
   * tiene asignado (cn/cola-qr/etiquetas vs ve). admin siempre ve todo.
   */
  warehouseScope?: WarehouseScope;
  /**
   * Desvíos de la matriz por rol (SDD-0252, migr 0357) — sin esto, un módulo
   * otorgado por la matriz editable no aparecería acá aunque `requireModuleView`
   * ya lo deje entrar (y viceversa con uno revocado).
   */
  overrides?: RoleModuleOverrides;
}

export function StudioSidebar({
  featureFlags,
  expenseAlertCount = 0,
  bandeja,
  role = null,
  warehouseScope = "all",
  overrides,
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
  const [openParents, setOpenParents] = useState<Record<string, boolean>>({});

  // Hidratar estado collapsed + restaurar la última sección abierta.
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
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
      try {
        const rawParents = localStorage.getItem(PARENTS_KEY);
        if (rawParents) {
          setOpenParents(JSON.parse(rawParents) as Record<string, boolean>);
        }
      } catch {
        // ignore (parse error / disabled storage)
      }
      // Restaurar ancho del sidebar (slider) escribiendo la var CSS.
      try {
        const w = parseInt(localStorage.getItem(SB_WIDTH_KEY) || "", 10);
        if (w >= SB_MIN && w <= SB_MAX) {
          document.documentElement.style.setProperty("--sb-expanded", w + "px");
        }
      } catch {
        // ignore
      }
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Al navegar a otro módulo, abrir su grupo y colapsar los demás (acordeón).
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled && activeGroup) setOpenGroup(activeGroup);
    });
    return () => {
      cancelled = true;
    };
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

  // ── Sub-grupos anidados (clusters): estado de expansión por parent ──
  const toggleParent = (pid: string) => {
    setOpenParents((prev) => {
      const next = { ...prev, [pid]: !prev[pid] };
      try {
        localStorage.setItem(PARENTS_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // ── Slider de ancho: arrastrar el borde derecho ajusta --sb-expanded ──
  // (patrón Norte). Escribe la var CSS en vivo; persiste al soltar. Usa el DELTA
  // desde donde arrancó el arrastre (robusto si el sidebar no pega en x=0) y
  // captura el pointer (no se pierde el `up` si el cursor sale del viewport).
  const asideRef = useRef<HTMLElement | null>(null);
  const [resizeHover, setResizeHover] = useState(false);
  const startResize = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const handle = e.currentTarget;
    const aside = asideRef.current;
    const startX = e.clientX;
    const startW = aside?.getBoundingClientRect().width ?? SB_MIN;
    try {
      handle.setPointerCapture(e.pointerId);
    } catch {
      // ignore (navegador viejo)
    }
    if (aside) aside.style.transition = "none"; // sin lag durante el arrastre
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
    const move = (ev: PointerEvent) => {
      const w = Math.max(
        SB_MIN,
        Math.min(SB_MAX, Math.round(startW + (ev.clientX - startX))),
      );
      document.documentElement.style.setProperty("--sb-expanded", w + "px");
    };
    const up = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      handle.removeEventListener("pointercancel", up);
      try {
        handle.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      if (aside) aside.style.transition = "";
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      try {
        const w = parseInt(
          getComputedStyle(document.documentElement).getPropertyValue(
            "--sb-expanded",
          ),
          10,
        );
        if (w) localStorage.setItem(SB_WIDTH_KEY, String(w));
      } catch {
        // ignore
      }
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", up);
  };

  // Doble-click en el handle: resetea el ancho al default del stylesheet.
  const resetWidth = () => {
    document.documentElement.style.removeProperty("--sb-expanded");
    try {
      localStorage.removeItem(SB_WIDTH_KEY);
    } catch {
      // ignore
    }
  };

  // Match active: exacto o prefijo + "/"
  const isActive = (slug: string) =>
    pathname === slug || pathname.startsWith(slug + "/");

  // ── Unidades de una sección: hoja (módulo suelto) o cluster (parent + hijos) ──
  // El cluster se emite en la posición del PRIMER hijo, juntando a todos sus
  // hermanos. No toca routing ni RBAC: los hijos ya vienen filtrados.
  type Unit =
    | { type: "leaf"; mod: ModuleDef }
    | { type: "parent"; parent: ParentDef; children: ModuleDef[] };
  const buildUnits = (items: ModuleDef[]): Unit[] => {
    const units: Unit[] = [];
    const emitted = new Set<string>();
    for (const m of items) {
      const p = m.parent ? PARENTS[m.parent] : undefined;
      if (p) {
        if (!emitted.has(p.id)) {
          emitted.add(p.id);
          units.push({
            type: "parent",
            parent: p,
            children: items.filter((x) => x.parent === m.parent),
          });
        }
      } else {
        units.push({ type: "leaf", mod: m });
      }
    }
    return units;
  };

  // Render de un ítem-hoja (módulo). `indent` = sangría px para hijos anidados.
  const renderLeaf = (m: ModuleDef, indent = 0) => {
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
          padding: collapsed ? "10px 0" : `9px 12px 9px ${12 + indent}px`,
          justifyContent: collapsed ? "center" : "flex-start",
          background: active ? "var(--bg-sidebar-active)" : "transparent",
          color: active ? "var(--ink-side-strong)" : "var(--ink-side)",
          borderRadius: "var(--r-md)",
          font: `500 ${indent && !collapsed ? "12.5" : "13"}px/1 var(--f-sans)`,
          textDecoration: "none",
          boxShadow:
            active && !collapsed ? "inset 3px 0 0 var(--wine-soft)" : "none",
          transition:
            "background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease)",
        }}
        onMouseEnter={(e) => {
          if (!active)
            e.currentTarget.style.background = "var(--bg-sidebar-hover)";
        }}
        onMouseLeave={(e) => {
          if (!active) e.currentTarget.style.background = "transparent";
        }}
      >
        <span
          style={{
            color: active ? "var(--wine-soft)" : "var(--ink-side-soft)",
            flexShrink: 0,
            display: "inline-flex",
          }}
        >
          {Icon[m.icon]?.(indent && !collapsed ? 16 : 18)}
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
        {!collapsed && m.id === "bandeja" && bandeja?.tenantId ? (
          <BandejaBadge tenantId={bandeja.tenantId} initial={bandeja.initial} />
        ) : null}
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
              color: "var(--on-warning)",
              font: "800 10px/1 var(--f-mono)",
              flexShrink: 0,
            }}
          >
            {expenseAlertCount}
          </span>
        )}
      </Link>
    );
  };

  // Render de un sub-grupo (cluster): header toggle no-navegable + hijos
  // indentados. Si un hijo está activo, el cluster se fuerza abierto.
  const renderParent = (parent: ParentDef, children: ModuleDef[]) => {
    if (collapsed) return children.map((c) => renderLeaf(c, 0));
    const pid = parent.id;
    const childActive = children.some((c) => isActive(c.slug));
    const pOpen = childActive || openParents[pid] === true;
    const parentLabel = parent.labelKey ? t(parent.labelKey) : parent.label;
    return (
      <div key={pid}>
        <button
          type="button"
          onClick={() => toggleParent(pid)}
          aria-expanded={pOpen}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "9px 12px",
            borderRadius: "var(--r-md)",
            background: childActive ? "var(--bg-sidebar-hover)" : "transparent",
            color: childActive ? "var(--ink-side-strong)" : "var(--ink-side)",
            border: "none",
            cursor: "pointer",
            font: "600 13px/1 var(--f-sans)",
            transition:
              "background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease)",
          }}
          onMouseEnter={(e) => {
            if (!childActive)
              e.currentTarget.style.background = "var(--bg-sidebar-hover)";
          }}
          onMouseLeave={(e) => {
            if (!childActive) e.currentTarget.style.background = "transparent";
          }}
        >
          <span
            style={{
              color: childActive ? "var(--wine-soft)" : "var(--ink-side-soft)",
              flexShrink: 0,
              display: "inline-flex",
            }}
          >
            {Icon[parent.icon]?.(18)}
          </span>
          <span
            style={{
              flex: 1,
              textAlign: "left",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {parentLabel}
          </span>
          <span
            aria-hidden
            style={{
              display: "inline-flex",
              color: "var(--ink-side-soft)",
              transform: `rotate(${pOpen ? 0 : -90}deg)`,
              transition: "transform var(--dur-fast) var(--ease)",
            }}
          >
            {Icon.chevD(11)}
          </span>
        </button>
        {pOpen && children.map((c) => renderLeaf(c, 16))}
      </div>
    );
  };

  // Filtrar módulos por feature flags + RBAC + scope de almacén ANTES de
  // agrupar. Módulos sin entry en MODULE_FLAG_MAP = siempre visibles (core);
  // el filtro de rol usa la matriz ROLE_MODULE_ACCESS (admin ve todo,
  // fail-closed para roles nulos); el scope esconde el lado no asignado
  // (SDD-0139; admin no se filtra por scope).
  const visibleModules = MODULES.filter(
    (m) =>
      !m.hidden &&
      isModuleEnabled(m.id, flags) &&
      canAccessModule(role, m.id, overrides) &&
      (role === "admin" || scopeAllowsModule(warehouseScope, m.id)),
  );

  const grouped = GROUP_ORDER.map((g) => ({
    group: g,
    items: visibleModules.filter((m) => m.group === g),
    isOpen: openGroup === g, // acordeón: solo una sección abierta a la vez
  })).filter((g) => g.items.length > 0); // ocultar grupos vacíos

  return (
    <aside
      ref={asideRef}
      style={{
        position: "sticky",
        top: 0,
        height: "100vh",
        width: collapsed ? "var(--sb-collapsed)" : "var(--sb-expanded)",
        // Fondo de marca (BD-034): degradado navy tonal en vez de plano.
        background: "var(--grad-navy)",
        borderRight: "1px solid var(--border-side)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        transition: hydrated ? "width var(--dur) var(--ease)" : "none",
        overflow: "hidden",
        zIndex: 50,
      }}
    >
      {/* Fondo de marca (BD-034): glow wine en la esquina superior + marca de agua
          "D" (isotipo mono-light, wallpaper .03) recortada por overflow:hidden.
          Decorativa y detrás del contenido (z-index:-1 dentro del stacking del aside)
          → no toca los items del nav, no captura clicks. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          zIndex: -1,
          pointerEvents: "none",
          background:
            "radial-gradient(55% 40% at 100% 0%, rgba(168,50,62,0.28), transparent 58%)",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "-6%",
            bottom: "-6%",
            width: "78%",
            height: "52%",
            background:
              "url('/brand/dtdcargo-isologo-mono-light.png') left bottom / contain no-repeat",
            opacity: 0.07,
          }}
        />
      </div>

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
            {showItems &&
              buildUnits(items).map((u) =>
                u.type === "leaf"
                  ? renderLeaf(u.mod, 0)
                  : renderParent(u.parent, u.children),
              )}
            </div>
          </div>
          );
        })}
        {grouped.length === 0 && !collapsed && (
          <div
            style={{
              padding: "var(--s-4) var(--s-3)",
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
            padding: "var(--s-2)",
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

      {/* Slider de ancho: arrastrá el borde derecho para ajustar el menú.
          Hit-area de 8px con un hairline visible en reposo (descubribilidad);
          doble-click resetea al ancho default. */}
      {!collapsed && (
        <div
          onPointerDown={startResize}
          onDoubleClick={resetWidth}
          onMouseEnter={() => setResizeHover(true)}
          onMouseLeave={() => setResizeHover(false)}
          title={t("chrome.sidebar.resize")}
          aria-hidden
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            width: 8,
            cursor: "ew-resize",
            zIndex: 60,
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          {/* Línea visible: hairline en reposo → wine-soft en hover/drag */}
          <span
            aria-hidden
            style={{
              width: resizeHover ? 2 : 1,
              height: "100%",
              background: resizeHover
                ? "var(--wine-soft)"
                : "var(--border-side)",
              transition:
                "background var(--dur-fast) var(--ease), width var(--dur-fast) var(--ease)",
            }}
          />
        </div>
      )}
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
