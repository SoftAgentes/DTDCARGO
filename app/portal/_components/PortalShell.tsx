"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
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
const SUPPORT_SEEN_KEY = "dtd-portal-soporte-seen";
const PORTAL_STORAGE_EVENT = "dtd-portal-storage";

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function subscribeStorage(onStoreChange: () => void): () => void {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(PORTAL_STORAGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(PORTAL_STORAGE_EVENT, onStoreChange);
  };
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
    window.dispatchEvent(new Event(PORTAL_STORAGE_EVENT));
  } catch {
    /* sin localStorage — la interfaz sigue siendo funcional */
  }
}

function useStorageValue(key: string): string | null {
  return useSyncExternalStore(
    subscribeStorage,
    () => readStorage(key),
    () => null,
  );
}

export function hasUnreadSupportReply(
  lastReplyAt: string | null,
  seenAt: string | null,
  onSupportRoute: boolean,
): boolean {
  return (
    !!lastReplyAt &&
    !onSupportRoute &&
    (!seenAt || new Date(lastReplyAt).getTime() > new Date(seenAt).getTime())
  );
}

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
  const pathname = usePathname();
  const path = pathname ?? "";
  const collapsed = useStorageValue(COLLAPSE_KEY) === "1";
  const [mobileState, setMobileState] = useState({ path, open: false });
  const mobileOpen = mobileState.path === path && mobileState.open;

  const toggleCollapse = () =>
    writeStorage(COLLAPSE_KEY, collapsed ? "0" : "1");

  // El cajón se deriva de la ruta que lo abrió y también se cierra con Escape.
  useEffect(() => {
    if (!mobileOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileState({ path, open: false });
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen, path]);

  // Punto de "Soporte" (SDD-0148 #4): al entrar a /portal/soporte marcamos
  // "visto" en localStorage; en el resto de las rutas comparamos ese visto con
  // el último mensaje del equipo. Misma lógica que tenía el nav anterior.
  const onSoporte = path.startsWith("/portal/soporte");
  const seenAt = useStorageValue(SUPPORT_SEEN_KEY);
  useEffect(() => {
    if (onSoporte) writeStorage(SUPPORT_SEEN_KEY, new Date().toISOString());
  }, [onSoporte]);

  const soporteDot = hasUnreadSupportReply(
    soporteLastReplyAt,
    seenAt,
    onSoporte,
  );

  return (
    <>
      <PortalSidebar
        markbox={markbox}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileState({ path, open: false })}
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
          onOpenMenu={() => setMobileState({ path, open: true })}
        />

        <main className="wrap w-full flex-1 py-8 lg:py-12">{children}</main>

        <PortalFooter />
      </div>
    </>
  );
}
