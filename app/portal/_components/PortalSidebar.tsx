"use client";

import { type ComponentType, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import {
  BoxIcon,
  CalcIcon,
  CartIcon,
  ChatIcon,
  ChevronDownIcon,
  CloseIcon,
  CrownIcon,
  DocIcon,
  GridIcon,
  PaymentIcon,
  QuoteIcon,
  ShieldIcon,
  ShipIcon,
  StarIcon,
} from "@/components/Icon";

/**
 * Barra lateral del Portal del Cliente — diseño de Cloud Design
 * (`_norte/portal/app.jsx` · `PortalSidebar`).
 *
 * Navy fija en los DOS temas (igual que el ERP): la tinta sale de los tokens
 * `--portal-nav-*` de `app/globals.css`, nunca de `rgba(255,255,255,X)` suelto.
 *
 * Estructura del Norte, 1:1:
 *   · Cabecera: isólogo + wordmark + "Portal" (clic → Inicio) y chevron de colapsar.
 *   · Botón **Crear**: todas las solicitudes del cliente en un solo lugar.
 *   · Navegación por grupos: INICIO · MI CARGA · FINANZAS · MÁS.
 *   · Shipping Mark del cliente al pie.
 *   · Colapsar / expandir abajo (y con doble clic en cualquier ítem del nav).
 *
 * En teléfono (<1024px) la barra es un **cajón** que entra desde la izquierda; lo
 * abre el botón de menú de la topbar y se cierra al navegar, con Escape o
 * tocando el velo.
 */
type IconCmp = ComponentType<{ size?: number; className?: string }>;

type NavItem = {
  key: string;
  label: string;
  /** Sub-rótulo mono en versalitas (Norte: "Alertas", "Proveedores"…). */
  sub?: string;
  icon: IconCmp;
  /** Destino real del repo. Si falta, el ítem dispara `action`. */
  href?: string;
  /** Ítems que no navegan: hoy solo la calculadora, que vive en el FAB flotante. */
  action?: "calc";
  match?: (pathname: string) => boolean;
};

type NavGroup = { name: string; items: NavItem[] };

/** Abre la calculadora flotante (`PortalCalcFab` escucha este evento). */
function openCalc() {
  window.dispatchEvent(new Event("portal:open-calc"));
}

function buildGroups(showClub: boolean): NavGroup[] {
  const mas: NavItem[] = [
    {
      key: "referidos",
      label: "Referidos",
      icon: StarIcon,
      href: "/portal/referidos",
      match: (p) => p.startsWith("/portal/referidos"),
    },
    {
      key: "academia",
      label: "Academia",
      icon: ShieldIcon,
      href: "/portal/academia",
      match: (p) => p.startsWith("/portal/academia"),
    },
    {
      key: "soporte",
      label: "Soporte",
      icon: ChatIcon,
      href: "/portal/soporte",
      // `/mensajes` y `/reclamos` redirigen a Soporte (SDD-0147); se matchean por
      // si entra un enlace viejo.
      match: (p) =>
        p.startsWith("/portal/soporte") ||
        p.startsWith("/portal/mensajes") ||
        p.startsWith("/portal/reclamos"),
    },
  ];
  // Club va junto a Referidos, pero solo si el cliente está habilitado (gated).
  if (showClub) {
    mas.splice(1, 0, {
      key: "club",
      label: "Club",
      icon: CrownIcon,
      href: "/portal/club",
      match: (p) => p.startsWith("/portal/club"),
    });
  }

  return [
    {
      name: "Inicio",
      items: [
        {
          key: "home",
          label: "Inicio",
          icon: GridIcon,
          href: "/portal",
          match: (p) => p === "/portal",
        },
      ],
    },
    {
      name: "Mi carga",
      items: [
        {
          key: "envios",
          label: "Mis envíos",
          sub: "Alertas",
          icon: BoxIcon,
          href: "/portal/envios",
          match: (p) => p.startsWith("/portal/envios"),
        },
        {
          key: "compras",
          label: "Mis compras",
          sub: "Proveedores",
          icon: CartIcon,
          href: "/portal/proveedores",
          match: (p) =>
            p.startsWith("/portal/proveedores") || p.startsWith("/portal/compras"),
        },
        {
          key: "calculadora",
          label: "Calculadora",
          sub: "Cotiza",
          icon: CalcIcon,
          action: "calc",
        },
      ],
    },
    {
      name: "Finanzas",
      items: [
        {
          key: "finanzas",
          label: "Finanzas",
          icon: PaymentIcon,
          href: "/portal/finanzas",
          match: (p) =>
            p.startsWith("/portal/finanzas") ||
            p.startsWith("/portal/facturas") ||
            p.startsWith("/portal/estimados") ||
            p.startsWith("/portal/cotizaciones"),
        },
        {
          key: "documentos",
          label: "Documentos",
          sub: "Adjuntos",
          icon: DocIcon,
          href: "/portal/documentos",
          match: (p) => p.startsWith("/portal/documentos"),
        },
      ],
    },
    { name: "Más", items: mas },
  ];
}

/** Menú "Crear": todas las solicitudes que el cliente puede iniciar. */
const CREATE_ITEMS: {
  key: string;
  label: string;
  sub: string;
  icon: IconCmp;
  href?: string;
  action?: "calc";
}[] = [
  {
    key: "nueva-compra",
    label: "Nueva compra",
    sub: "Pre-alerta · avisa tu carga",
    icon: CartIcon,
    href: "/portal/compras/nueva",
  },
  {
    key: "nueva-cotizacion",
    label: "Nueva cotización LCL / FCL",
    sub: "Consolidado o contenedor completo",
    icon: ShipIcon,
    href: "/portal/cotizaciones/nueva",
  },
  {
    key: "reportar-pago",
    label: "Reportar un pago",
    sub: "Sube tu comprobante",
    icon: QuoteIcon,
    href: "/portal/finanzas",
  },
  {
    key: "cotizar",
    label: "Cotizar un servicio",
    sub: "Calcula tu envío",
    icon: CalcIcon,
    action: "calc",
  },
];

export function PortalSidebar({
  markbox,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  showClub = false,
  soporteDot = false,
}: {
  markbox: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  showClub?: boolean;
  /** Punto en "Soporte": hay respuesta del equipo sin leer (SDD-0148 #4). */
  soporteDot?: boolean;
}) {
  const pathname = usePathname() ?? "";
  const [createOpen, setCreateOpen] = useState(false);
  const createRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);

  const groups = buildGroups(showClub);

  // El menú "Crear" se cierra al hacer clic afuera o con Escape.
  useEffect(() => {
    if (!createOpen) return;
    function onClick(e: MouseEvent) {
      if (createRef.current && !createRef.current.contains(e.target as Node))
        setCreateOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setCreateOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [createOpen]);

  // Doble clic en cualquier ítem del nav = colapsar/expandir (Norte). El clic
  // simple sigue navegando; así no tienes que subir hasta el chevron.
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const onDbl = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest("a, button")) onToggleCollapse();
    };
    el.addEventListener("dblclick", onDbl);
    return () => el.removeEventListener("dblclick", onDbl);
  }, [onToggleCollapse]);

  const showLabels = !collapsed || mobileOpen;

  return (
    <>
      {/* Velo del cajón (solo teléfono) */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Cerrar el menú"
          onClick={onCloseMobile}
          className="fixed inset-0 z-[59] lg:hidden"
          style={{ background: "color-mix(in srgb, var(--color-ink) 55%, transparent)" }}
        />
      )}

      <aside
        data-surface="navy"
        aria-label="Navegación del portal"
        className={`fixed inset-y-0 left-0 z-[60] flex flex-col transition-transform duration-200 motion-reduce:transition-none lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          width: mobileOpen
            ? "var(--portal-sb-w)"
            : collapsed
              ? "var(--portal-sb-collapsed)"
              : "var(--portal-sb-w)",
          background: "var(--portal-nav-bg)",
          borderRight: "1px solid var(--portal-nav-border)",
          color: "var(--portal-nav-ink)",
        }}
      >
        {/* ── Cabecera: logo → Inicio + colapsar ── */}
        <div
          className="flex items-center gap-2 flex-shrink-0"
          style={{
            height: "var(--portal-topbar-h)",
            padding: showLabels ? "0 10px 0 14px" : "0",
            justifyContent: showLabels ? "space-between" : "center",
            borderBottom: "1px solid var(--portal-nav-border)",
          }}
        >
          <Link
            href="/portal"
            onClick={onCloseMobile}
            title="Ir al inicio del portal"
            className="flex items-center gap-2.5 min-w-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ outlineColor: "var(--portal-nav-ink)" }}
          >
            <BrandMark variant="reverse" size={30} isologoOnly />
            {showLabels && (
              <span className="flex flex-col leading-none min-w-0">
                <span
                  className="text-[16px] font-black tracking-[-0.02em] truncate"
                  style={{
                    fontFamily: "var(--font-archivo-black)",
                    color: "var(--portal-nav-on-active)",
                  }}
                >
                  DTD<span className="inline-block w-[0.15em]" />Cargo
                </span>
                <span
                  className="mt-1 text-[9px] font-bold uppercase tracking-[0.16em]"
                  style={{ color: "var(--portal-nav-ink-soft)" }}
                >
                  Portal
                </span>
              </span>
            )}
          </Link>

          {showLabels && (
            <>
              {/* Escritorio: colapsar. Teléfono: cerrar el cajón. */}
              <button
                type="button"
                onClick={onToggleCollapse}
                title="Colapsar la barra"
                className="hidden lg:inline-flex flex-shrink-0 items-center justify-center rounded focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{
                  color: "var(--portal-nav-ink-soft)",
                  background: "var(--portal-nav-hover)",
                  outlineColor: "var(--portal-nav-ink)",
                  height: 26,
                  width: 26,
                }}
              >
                <ChevronDownIcon size={13} className="rotate-90" />
              </button>
              <button
                type="button"
                onClick={onCloseMobile}
                aria-label="Cerrar el menú"
                className="lg:hidden inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{
                  color: "var(--portal-nav-ink)",
                  outlineColor: "var(--portal-nav-ink)",
                }}
              >
                <CloseIcon size={16} />
              </button>
            </>
          )}
        </div>

        {/* ── Crear ── */}
        <div
          ref={createRef}
          className="relative z-[61]"
          style={{ padding: showLabels ? "14px 12px 4px" : "12px 0 4px" }}
        >
          <button
            type="button"
            onClick={() => setCreateOpen((o) => !o)}
            title={showLabels ? undefined : "Crear"}
            aria-expanded={createOpen}
            className="flex items-center gap-2.5 mx-auto transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{
              width: showLabels ? "100%" : 40,
              height: showLabels ? 46 : 40,
              padding: showLabels ? "0 14px" : 0,
              justifyContent: showLabels ? "flex-start" : "center",
              borderRadius: showLabels ? 10 : "50%",
              background: createOpen
                ? "color-mix(in srgb, var(--color-wine) 42%, transparent)"
                : "color-mix(in srgb, var(--color-wine) 26%, transparent)",
              color: "var(--portal-nav-on-active)",
              border: "1px solid color-mix(in srgb, var(--color-status-warning) 40%, transparent)",
              outlineColor: "var(--portal-nav-ink)",
            }}
          >
            <span className="text-[19px] font-extrabold leading-none -mt-px flex-shrink-0">
              +
            </span>
            {showLabels && (
              <>
                <span className="flex-1 text-left text-[14px] font-bold">Crear</span>
                <ChevronDownIcon
                  size={13}
                  className={`opacity-85 transition-transform ${createOpen ? "rotate-180" : ""}`}
                />
              </>
            )}
          </button>

          {createOpen && (
            <div
              className="absolute z-[62] overflow-hidden rounded-[12px] card-shadow"
              style={{
                top: showLabels ? "calc(100% - 2px)" : 6,
                left: showLabels ? 12 : "calc(100% + 8px)",
                right: showLabels ? 12 : "auto",
                minWidth: showLabels ? undefined : 236,
                background: "var(--color-white)",
                border: "1px solid var(--color-grey-200)",
              }}
            >
              {CREATE_ITEMS.map((it, i) => {
                const Icon = it.icon;
                const inner = (
                  <>
                    <span
                      className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-[8px]"
                      style={{
                        background: "color-mix(in srgb, var(--color-wine) 12%, transparent)",
                        color: "var(--color-wine-text)",
                      }}
                    >
                      <Icon size={16} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[12.5px] font-bold text-ink">
                        {it.label}
                      </span>
                      <span className="mt-0.5 block text-[10.5px] font-medium text-grey-500">
                        {it.sub}
                      </span>
                    </span>
                  </>
                );
                const cls =
                  "flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-grey-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink" +
                  (i ? " border-t border-grey-200" : "");
                return it.href ? (
                  <Link
                    key={it.key}
                    href={it.href}
                    className={cls}
                    onClick={() => {
                      setCreateOpen(false);
                      onCloseMobile();
                    }}
                  >
                    {inner}
                  </Link>
                ) : (
                  <button
                    key={it.key}
                    type="button"
                    className={cls}
                    onClick={() => {
                      setCreateOpen(false);
                      onCloseMobile();
                      openCalc();
                    }}
                  >
                    {inner}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Navegación por grupos ── */}
        <nav
          ref={navRef}
          className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col gap-0.5"
          style={{ padding: "4px 10px 14px" }}
        >
          {groups.map((g) => (
            <div key={g.name} className="mb-1.5">
              {showLabels ? (
                <div
                  className="px-3 pt-2.5 pb-1.5 text-[9.5px] font-bold uppercase tracking-[0.14em]"
                  style={{ color: "var(--portal-nav-ink-soft)" }}
                >
                  {g.name}
                </div>
              ) : (
                <div
                  aria-hidden
                  className="mx-3 my-2 h-px"
                  style={{ background: "var(--portal-nav-border)" }}
                />
              )}
              <div className="flex flex-col gap-0.5">
                {g.items.map((it) => (
                  <SidebarLeaf
                    key={it.key}
                    item={it}
                    active={it.match ? it.match(pathname) : false}
                    showLabels={showLabels}
                    dot={it.key === "soporte" && soporteDot}
                    onNavigate={onCloseMobile}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* ── Shipping Mark del cliente ── */}
        {showLabels && (
          <div
            className="flex-shrink-0"
            style={{
              padding: "12px 16px",
              borderTop: "1px solid var(--portal-nav-border)",
            }}
          >
            <div
              className="text-[9px] font-bold uppercase tracking-[0.16em]"
              style={{ color: "var(--portal-nav-ink-soft)" }}
            >
              Shipping Mark
            </div>
            <code
              className="mt-1.5 block text-[14px] font-bold tracking-[0.03em]"
              style={{
                fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
                color: "var(--portal-nav-on-active)",
              }}
            >
              {markbox}
            </code>
          </div>
        )}

        {/* ── Colapsar / expandir (solo escritorio) ── */}
        <div
          className="hidden lg:block flex-shrink-0"
          style={{
            padding: collapsed ? "10px 0" : "8px 12px 12px",
            borderTop: "1px solid var(--portal-nav-border)",
          }}
        >
          <button
            type="button"
            onClick={onToggleCollapse}
            title={collapsed ? "Expandir la barra" : "Colapsar la barra"}
            className="flex items-center gap-2.5 rounded-md text-[12.5px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{
              width: collapsed ? 40 : "100%",
              margin: collapsed ? "0 auto" : 0,
              padding: collapsed ? "8px 0" : "8px 12px",
              justifyContent: collapsed ? "center" : "flex-start",
              color: "var(--portal-nav-ink-soft)",
              outlineColor: "var(--portal-nav-ink)",
            }}
          >
            <ChevronDownIcon
              size={14}
              className={collapsed ? "-rotate-90" : "rotate-90"}
            />
            {!collapsed && <span>Colapsar</span>}
          </button>
        </div>
      </aside>
    </>
  );
}

/** Un ítem del nav (Norte `leaf`): activo = píldora wine con barra izquierda. */
function SidebarLeaf({
  item,
  active,
  showLabels,
  dot,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  showLabels: boolean;
  dot: boolean;
  onNavigate: () => void;
}) {
  const Icon = item.icon;
  const title = showLabels
    ? undefined
    : item.label + (item.sub ? ` · ${item.sub}` : "");

  const body = (
    <>
      {active && showLabels && (
        <span
          aria-hidden
          className="absolute left-0 top-2 bottom-2 w-[3px] rounded-sm"
          style={{ background: "var(--portal-nav-on-active)" }}
        />
      )}
      <span
        className="relative inline-flex flex-shrink-0"
        style={{
          color: active ? "var(--portal-nav-on-active)" : "var(--portal-nav-ink-soft)",
        }}
      >
        <Icon size={18} />
        {dot && !showLabels && (
          <span
            aria-hidden
            className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full"
            style={{
              background: "var(--color-status-danger)",
              border: "2px solid var(--portal-nav-solid)",
            }}
          />
        )}
      </span>
      {showLabels &&
        (item.sub ? (
          <span className="flex flex-1 flex-col gap-[3px] text-left leading-none">
            <span>{item.label}</span>
            <span
              className="text-[8.5px] font-bold uppercase tracking-[0.14em]"
              style={{
                fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
                color: active
                  ? "var(--portal-nav-ink)"
                  : "var(--portal-nav-ink-soft)",
              }}
            >
              {item.sub}
            </span>
          </span>
        ) : (
          <span className="flex-1 text-left">{item.label}</span>
        ))}
      {showLabels && dot && (
        <span
          aria-hidden
          className="h-2 w-2 flex-shrink-0 rounded-full"
          style={{ background: "var(--color-status-danger)" }}
        />
      )}
    </>
  );

  const cls =
    "relative flex w-full select-none items-center gap-3 rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-2";
  const style: React.CSSProperties = {
    padding: showLabels ? "9px 12px" : "10px 0",
    justifyContent: showLabels ? "flex-start" : "center",
    background: active ? "var(--portal-nav-active)" : "transparent",
    color: active ? "var(--portal-nav-on-active)" : "var(--portal-nav-ink)",
    fontSize: 13,
    fontWeight: active ? 600 : 500,
    lineHeight: 1,
    outlineColor: "var(--portal-nav-ink)",
  };

  if (item.href) {
    return (
      <Link
        href={item.href}
        title={title}
        aria-current={active ? "page" : undefined}
        onClick={onNavigate}
        className={`${cls} portal-nav-leaf`}
        style={style}
      >
        {body}
      </Link>
    );
  }

  return (
    <button
      type="button"
      title={title ?? "Abrir la calculadora"}
      onClick={() => {
        onNavigate();
        openCalc();
      }}
      className={`${cls} portal-nav-leaf`}
      style={style}
    >
      {body}
    </button>
  );
}
