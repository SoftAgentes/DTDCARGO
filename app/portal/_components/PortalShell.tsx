"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { PortalSailing } from "@/lib/portal/next-sailing-queries";
import { PortalSidebar } from "./PortalSidebar";
import { PortalTopbar } from "./PortalTopbar";
import { PortalFooter } from "./PortalFooter";

/**
 * Armazón del Portal del Cliente — diseño de Cloud Design
 * (`_norte/portal/app.jsx`): **barra lateral navy fija + topbar delgada +
 * contenido + pie**. Reemplaza al header horizontal anterior.
 *
 * Vive del lado del cliente porque guarda dos estados de interfaz:
 *   · `collapsed` — la barra colapsada a solo iconos (persiste en localStorage).
 *   · `mobileOpen` — el cajón de navegación en teléfono.
 * El contenido (`children`) sigue siendo server components: entra como slot, no
 * se re-renderiza en el cliente.
 *
 * El desplazamiento del contenido lo hace la clase `.portal-main` de
 * `globals.css` leyendo `--portal-sb-now` (solo ≥1024px).
 */
const COLLAPSE_KEY = "dtd-portal-sidebar-collapsed";

export function PortalShell({
  name,
  markbox,
  themed,
  theme,
  showClub,
  soporteLastReplyAt,
  profileComplete,
  sailing,
  sailingDaysToCutoff,
  children,
}: {
  name: string;
  markbox: string;
  themed: boolean;
  theme: "dark" | "light";
  showClub: boolean;
  /** Último mensaje del equipo (SDD-0148 #4): alimenta el punto de "Soporte". */
  soporteLastReplyAt: string | null;
  profileComplete: boolean;
  sailing: PortalSailing | null;
  sailingDaysToCutoff: number | null;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Preferencia de barra colapsada (solo escritorio). Se lee tras montar para no
  // desincronizar el HTML del servidor.
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* sin localStorage — la barra queda expandida */
    }
  }, []);

  const toggleCollapse = () =>
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* sin localStorage — no se recuerda, no se rompe */
      }
      return next;
    });

  // El cajón se cierra al navegar y con Escape.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  // Punto de "Soporte" (SDD-0148 #4): al entrar a /portal/soporte marcamos
  // "visto" en localStorage; en el resto de las rutas comparamos ese visto con
  // el último mensaje del equipo. Misma lógica que tenía el nav anterior.
  const path = pathname ?? "";
  const onSoporte = path.startsWith("/portal/soporte");
  const [seenAt, setSeenAt] = useState<string | null>(null);
  useEffect(() => {
    try {
      if (onSoporte) {
        const now = new Date().toISOString();
        localStorage.setItem("dtd-portal-soporte-seen", now);
        setSeenAt(now);
      } else {
        setSeenAt(localStorage.getItem("dtd-portal-soporte-seen"));
      }
    } catch {
      /* sin localStorage — sin punto, sin ruido */
    }
  }, [onSoporte]);

  const soporteDot =
    !!soporteLastReplyAt &&
    !onSoporte &&
    (!seenAt ||
      new Date(soporteLastReplyAt).getTime() > new Date(seenAt).getTime());

  return (
    <>
      <PortalSidebar
        markbox={markbox}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        showClub={showClub}
        soporteDot={soporteDot}
        profileComplete={profileComplete}
      />

      <div
        className="portal-main flex min-h-screen flex-col"
        style={
          {
            "--portal-sb-now": collapsed
              ? "var(--portal-sb-collapsed)"
              : "var(--portal-sb-w)",
          } as React.CSSProperties
        }
      >
        <PortalTopbar
          name={name}
          markbox={markbox}
          themed={themed}
          theme={theme}
          profileComplete={profileComplete}
          sailing={sailing}
          sailingDaysToCutoff={sailingDaysToCutoff}
          soporteDot={soporteDot}
          onOpenMenu={() => setMobileOpen(true)}
        />

        <main className="wrap w-full flex-1 py-8 lg:py-12">{children}</main>

        <PortalFooter />
      </div>
    </>
  );
}
