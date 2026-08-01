"use client";

/**
 * WiringProvider — context provider + host singleton para los modals
 * globales del DTD Studio (SDD-0034).
 *
 * Uso:
 *   1. <WiringProvider>{children}</WiringProvider> en el layout del Studio.
 *   2. const { openProfileModal, openShortcutsModal, openGenerateBLModal,
 *      openOAuthFlow, openBugReport, toggleBugFab, bugFabVisible, close }
 *      = useDTDWiring()
 *   3. Botón → onClick={() => openProfileModal({ tab: 'password' })}
 *
 * Singleton: 1 modal activo a la vez. Abrir uno cuando hay otro abierto
 * reemplaza al primero (no se stackean).
 *
 * Esc cierra el modal activo automáticamente.
 *
 * Bug Reporter (SDD-0036): este provider es el dueño global del
 * BugReportModal (lo abren el ítem de perfil y el FAB) y del estado de
 * visibilidad del FAB. El FAB queda OCULTO por defecto — se enciende/apaga
 * con Alt+B (visibilidad efímera por sesión, sessionStorage). La entrada
 * canónica para reportar es el ítem "Reportar un problema" del menú de perfil.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  ProfileModal,
  type ProfileModalInitialData,
  type ProfileTab,
} from "./ProfileModal";
import { ShortcutsModal } from "./ShortcutsModal";
import { GenerateBLModal } from "./GenerateBLModal";
import { OAuthFlowModal, type OAuthProvider } from "./OAuthFlowModal";
import { BugReportModal } from "../bug-reporter/BugReportModal";
import { useToast } from "../ui/ToastProvider";
import { useT } from "@/lib/i18n";

type ActiveModal =
  | { kind: "profile"; tab?: ProfileTab }
  | { kind: "shortcuts" }
  | { kind: "generate-bl" }
  | { kind: "oauth"; provider: OAuthProvider }
  | { kind: "bug-report" }
  | null;

/** sessionStorage: visibilidad del FAB de reportes · efímera por sesión. */
const BUG_FAB_KEY = "studio.bug-fab-on";

interface WiringContextValue {
  openProfileModal: (opts?: { tab?: ProfileTab }) => void;
  openShortcutsModal: () => void;
  openGenerateBLModal: () => void;
  openOAuthFlow: (provider: OAuthProvider) => void;
  /** Abre el modal de reportar un problema (SDD-0036). */
  openBugReport: () => void;
  /** Enciende/apaga el FAB flotante de reportes (atajo Alt+B). */
  toggleBugFab: () => void;
  /** Si el FAB flotante de reportes está visible ahora. */
  bugFabVisible: boolean;
  close: () => void;
}

const WiringContext = createContext<WiringContextValue | null>(null);

export function useDTDWiring(): WiringContextValue {
  const ctx = useContext(WiringContext);
  if (!ctx) {
    throw new Error(
      "useDTDWiring() debe llamarse dentro de <WiringProvider>. Envolvé tu árbol Studio con el provider en app/studio/(app)/layout.tsx.",
    );
  }
  return ctx;
}

/** ¿El foco está en un campo editable? Evita que Alt+B dispare mientras se escribe. */
function isEditableTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable
  );
}

export function WiringProvider({
  children,
  profileInitial,
  buildSha,
}: {
  children: ReactNode;
  profileInitial: ProfileModalInitialData;
  buildSha: string | null;
}) {
  const [active, setActive] = useState<ActiveModal>(null);
  // FAB oculto por defecto (SSR=false). Se hidrata de sessionStorage en el
  // primer effect para no romper hidratación.
  const [bugFabVisible, setBugFabVisible] = useState(false);
  const toast = useToast();
  const t = useT();

  const close = useCallback(() => setActive(null), []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        setBugFabVisible(window.sessionStorage.getItem(BUG_FAB_KEY) === "1");
      } catch {
        // sessionStorage bloqueado · queda oculto
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleBugFab = useCallback(() => {
    setBugFabVisible((prev) => {
      const next = !prev;
      try {
        window.sessionStorage.setItem(BUG_FAB_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      toast.info(next ? t("bug.fab.toggled_on") : t("bug.fab.toggled_off"));
      return next;
    });
  }, [toast, t]);

  const value = useMemo<WiringContextValue>(
    () => ({
      openProfileModal: (opts) => setActive({ kind: "profile", tab: opts?.tab }),
      openShortcutsModal: () => setActive({ kind: "shortcuts" }),
      openGenerateBLModal: () => setActive({ kind: "generate-bl" }),
      openOAuthFlow: (provider) => setActive({ kind: "oauth", provider }),
      openBugReport: () => setActive({ kind: "bug-report" }),
      toggleBugFab,
      bugFabVisible,
      close,
    }),
    [close, toggleBugFab, bugFabVisible],
  );

  // Esc cierra el modal activo.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active, close]);

  // Atajo global Alt+B → enciende/apaga el FAB de reportes. Modificador Alt
  // (exento de WCAG 2.1.4); ignoramos si el foco está en un campo editable.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.altKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        e.code === "KeyB" &&
        !isEditableTarget(e.target)
      ) {
        e.preventDefault();
        toggleBugFab();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [toggleBugFab]);

  return (
    <WiringContext.Provider value={value}>
      {children}
      {active?.kind === "profile" && (
        <ProfileModal
          initialTab={active.tab ?? "profile"}
          initialData={profileInitial}
          onClose={close}
        />
      )}
      {active?.kind === "shortcuts" && <ShortcutsModal onClose={close} />}
      {active?.kind === "generate-bl" && <GenerateBLModal onClose={close} />}
      {active?.kind === "oauth" && (
        <OAuthFlowModal provider={active.provider} onClose={close} />
      )}
      {active?.kind === "bug-report" && (
        <BugReportModal buildSha={buildSha} onClose={close} />
      )}
    </WiringContext.Provider>
  );
}
