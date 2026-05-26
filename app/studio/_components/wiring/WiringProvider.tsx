"use client";

/**
 * WiringProvider — context provider + host singleton para los modals
 * globales del DTD Studio (SDD-0034).
 *
 * Uso:
 *   1. <WiringProvider>{children}</WiringProvider> en el layout del Studio.
 *   2. const { openProfileModal, openShortcutsModal, openGenerateBLModal,
 *      openOAuthFlow, close } = useDTDWiring()
 *   3. Botón → onClick={() => openProfileModal({ tab: 'password' })}
 *
 * Singleton: 1 modal activo a la vez. Abrir uno cuando hay otro abierto
 * reemplaza al primero (no se stackean).
 *
 * Esc cierra el modal activo automáticamente.
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
import { ProfileModal, type ProfileTab } from "./ProfileModal";
import { ShortcutsModal } from "./ShortcutsModal";
import { GenerateBLModal } from "./GenerateBLModal";
import { OAuthFlowModal, type OAuthProvider } from "./OAuthFlowModal";

type ActiveModal =
  | { kind: "profile"; tab?: ProfileTab }
  | { kind: "shortcuts" }
  | { kind: "generate-bl" }
  | { kind: "oauth"; provider: OAuthProvider }
  | null;

interface WiringContextValue {
  openProfileModal: (opts?: { tab?: ProfileTab }) => void;
  openShortcutsModal: () => void;
  openGenerateBLModal: () => void;
  openOAuthFlow: (provider: OAuthProvider) => void;
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

export function WiringProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<ActiveModal>(null);

  const close = useCallback(() => setActive(null), []);

  const value = useMemo<WiringContextValue>(
    () => ({
      openProfileModal: (opts) => setActive({ kind: "profile", tab: opts?.tab }),
      openShortcutsModal: () => setActive({ kind: "shortcuts" }),
      openGenerateBLModal: () => setActive({ kind: "generate-bl" }),
      openOAuthFlow: (provider) => setActive({ kind: "oauth", provider }),
      close,
    }),
    [close],
  );

  // Esc cierra
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active, close]);

  return (
    <WiringContext.Provider value={value}>
      {children}
      {active?.kind === "profile" && (
        <ProfileModal initialTab={active.tab ?? "profile"} onClose={close} />
      )}
      {active?.kind === "shortcuts" && <ShortcutsModal onClose={close} />}
      {active?.kind === "generate-bl" && <GenerateBLModal onClose={close} />}
      {active?.kind === "oauth" && (
        <OAuthFlowModal provider={active.provider} onClose={close} />
      )}
    </WiringContext.Provider>
  );
}
