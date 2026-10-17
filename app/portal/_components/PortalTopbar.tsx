"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalcIcon, ShipIcon, WarningIcon } from "@/components/Icon";
import type { PortalSailing } from "@/lib/portal/next-sailing-queries";
import type { PortalAviso } from "@/lib/portal/portal-avisos";
import { PortalNextSailingCard } from "../(app)/_components/PortalNextSailingCard";
import { PortalAccountMenu } from "./PortalAccountMenu";
import { PortalAvisosBell } from "./PortalAvisosBell";
import { PortalThemeToggle } from "./PortalThemeToggle";

/**
 * Barra superior del portal — diseño de Cloud Design (`_norte/portal/app.jsx` ·
 * `PortalTopbar`). Delgada, clara (`--color-white`), pegada arriba: título de la
 * vista a la izquierda y, a la derecha, la fila de herramientas del Norte:
 *
 *   [Falta completar datos] · [Próxima salida] · [Calculadora] · [Avisos] ·
 *   [Tema] · [Cliente ▾]
 *
 * Todo lo que muestra sale de datos reales del portal:
 *   · La píldora amarilla aparece solo si el perfil está incompleto
 *     (`getProfileCompleteness`) y lleva a Mi perfil.
 *   · "Próxima salida" usa el zarpe abierto (SDD-0133) y despliega la misma card
 *     de cuenta regresiva del Inicio — sin duplicar lógica.
 *   · Avisos (SDD-0526): la bandeja con los avisos que el sistema ya le envió
 *     al cliente y la respuesta del asesor (SDD-0148). Ver `PortalAvisosBell`.
 *   · El botón de la calculadora dispara `portal:open-calc` (la ventana flotante
 *     ya vive en `PortalCalcFab`); se pinta en vidrio (BD-031), que es
 *     justamente el caso permitido: control de una superficie flotante.
 */

/** Título de la vista según la ruta (Norte: `LABELS` del topbar). */
const TITLES: { match: (p: string) => boolean; label: string }[] = [
  { match: (p) => p === "/portal", label: "Inicio" },
  { match: (p) => p.startsWith("/portal/envios"), label: "Mis envíos" },
  {
    match: (p) =>
      p.startsWith("/portal/proveedores") || p.startsWith("/portal/compras"),
    label: "Mis compras",
  },
  { match: (p) => p.startsWith("/portal/finanzas"), label: "Finanzas" },
  { match: (p) => p.startsWith("/portal/facturas"), label: "Facturas" },
  { match: (p) => p.startsWith("/portal/estimados"), label: "Estimados" },
  { match: (p) => p.startsWith("/portal/cotizaciones"), label: "Cotizaciones" },
  { match: (p) => p.startsWith("/portal/documentos"), label: "Documentos" },
  { match: (p) => p.startsWith("/portal/referidos"), label: "Referidos" },
  { match: (p) => p.startsWith("/portal/club"), label: "Club DTD" },
  { match: (p) => p.startsWith("/portal/academia"), label: "Academia" },
  {
    match: (p) =>
      p.startsWith("/portal/soporte") ||
      p.startsWith("/portal/mensajes") ||
      p.startsWith("/portal/reclamos"),
    label: "Soporte",
  },
  { match: (p) => p.startsWith("/portal/perfil"), label: "Mi perfil" },
];

function titleFor(pathname: string): string {
  return TITLES.find((t) => t.match(pathname))?.label ?? "Portal";
}

export function PortalTopbar({
  name,
  markbox,
  themed,
  theme,
  profileComplete,
  sailing,
  sailingDaysToCutoff,
  soporteDot,
  avisos,
  onOpenMenu,
}: {
  name: string;
  markbox: string;
  themed: boolean;
  theme: "dark" | "light";
  profileComplete: boolean;
  sailing: PortalSailing | null;
  sailingDaysToCutoff: number | null;
  soporteDot: boolean;
  /** Avisos enviados al cliente (SDD-0526), del más nuevo al más viejo. */
  avisos: readonly PortalAviso[];
  onOpenMenu: () => void;
}) {
  const pathname = usePathname() ?? "";

  return (
    <header
      className="sticky top-0 z-40 flex items-center gap-3 px-4 sm:px-6"
      style={{
        height: "var(--portal-topbar-h)",
        background: "var(--color-white)",
        borderBottom: "1px solid var(--color-grey-200)",
      }}
    >
      {/* Menú (solo teléfono) */}
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Abrir el menú del portal"
        className="lg:hidden grid h-9 w-9 flex-shrink-0 place-items-center rounded-md text-ink transition-colors hover:bg-grey-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <MenuGlyph />
      </button>

      <h2
        className="min-w-0 truncate text-[16px] font-bold tracking-[-0.01em] text-ink"
        style={{ fontFamily: "var(--font-archivo-black)" }}
      >
        {titleFor(pathname)}
      </h2>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        {!profileComplete && <ProfilePill />}
        {sailing && (
          <SailingPill sailing={sailing} serverDays={sailingDaysToCutoff} />
        )}
        <CalcButton />
        <PortalAvisosBell avisos={avisos} soporteDot={soporteDot} />
        {themed && <PortalThemeToggle initialTheme={theme} />}
        <PortalAccountMenu name={name} markbox={markbox} />
      </div>
    </header>
  );
}

/** Tres rayas del botón de menú (no hay icono de hamburguesa en el set). */
function MenuGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M4 12h16M4 17h16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** "Falta completar datos" → Mi perfil (solo si el perfil está incompleto). */
function ProfilePill() {
  return (
    <Link
      href="/portal/perfil"
      title="Sube tu foto de cédula o RIF y completa la verificación"
      className="hidden sm:inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-bold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      style={{
        background: "color-mix(in srgb, var(--color-status-warning) 14%, transparent)",
        border: "1px solid var(--color-status-warning)",
        color: "var(--color-ink)",
      }}
    >
      <WarningIcon size={13} />
      <span>Falta completar datos</span>
    </Link>
  );
}

/** Píldora "Próxima salida · N días" que despliega la card de cuenta regresiva. */
function SailingPill({
  sailing,
  serverDays,
}: {
  sailing: PortalSailing;
  serverDays: number | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // <48h al cierre = urgencia en dorado (Norte). Sin dato → tono wine normal.
  const urgent = serverDays != null && serverDays <= 2;
  const accent = urgent
    ? "var(--color-status-warning)"
    : "var(--color-wine-text)";
  const days =
    serverDays == null
      ? "—"
      : serverDays <= 0
        ? "Hoy"
        : serverDays === 1
          ? "1 día"
          : `${serverDays} días`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title="Ver la próxima salida de contenedor"
        className="hidden md:inline-flex items-center gap-2 rounded-full px-3 py-1.5 whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        style={{
          background: `color-mix(in srgb, ${accent} 12%, transparent)`,
          border: `1px solid color-mix(in srgb, ${accent} 38%, transparent)`,
        }}
      >
        <span style={{ color: accent }} className="inline-flex">
          <ShipIcon size={14} />
        </span>
        <span className="text-[11px] font-semibold tracking-[0.03em] text-grey-700">
          Próxima salida
        </span>
        {/* Los días van en ink, no en el acento: sobre el tinte 12% el dorado
            de urgencia medía 2.91:1 en claro. La urgencia la llevan el ícono,
            el borde y el fondo — que sí cambian a dorado. SDD-0176. */}
        <span
          className="text-[12.5px] font-extrabold"
          style={{ color: "var(--color-ink)" }}
        >
          {days}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[340px] max-w-[calc(100vw-32px)]">
          <PortalNextSailingCard
            sailing={sailing}
            serverDaysToCutoff={serverDays}
          />
        </div>
      )}
    </div>
  );
}

/** Botón de la calculadora — vidrio (BD-031: control de superficie flotante). */
function CalcButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("portal:open-calc"))}
      aria-label="Abrir la calculadora"
      title="Abrir la calculadora"
      className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full transition-transform motion-safe:hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      style={{
        background: "var(--glass-bg)",
        border: "1px solid var(--glass-border)",
        color: "var(--glass-ink)",
        backdropFilter: "var(--glass-blur)",
        WebkitBackdropFilter: "var(--glass-blur)",
        // El borde de vidrio es casi blanco: sobre la topbar clara desaparecía.
        // El anillo gris lo hace visible en los dos temas sin romper el vidrio.
        boxShadow: "var(--glass-hi), 0 0 0 1px var(--color-grey-200)",
      }}
    >
      <CalcIcon size={17} />
    </button>
  );
}
