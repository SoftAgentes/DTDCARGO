"use client";

/**
 * SettingsMenu · dropdown (…) en el header de las PWAs operario VE.
 *
 * Slots:
 *  - Tema (light/dark) — toggle local, persiste en localStorage por scope.
 *  - Cerrar sesión — server action `signOutAction`.
 *  - Cambiar modo (futuro Sprint D, oculto si `showSwitchMode={false}`).
 *
 * Por qué un dropdown y no botones sueltos en el header:
 *  - El header del bodeguero/camionero ya tiene marca + role + Realtime
 *    indicator. Sumar 2-3 botones más rompe la jerarquía.
 *  - Las acciones acá son "secundarias del día" — el operario las usa
 *    1-2 veces, no las quiere primary.
 *
 * Scope del tema:
 *  - `themeScope="camionero"` (default-dark) o `themeScope="bodeguero"` (default-light).
 *  - Persiste en `localStorage[dtd_op_theme_<scope>]`.
 *  - Aplica el atributo `data-theme` sobre el wrapper raíz del PWA via
 *    callback `onThemeChange` que el caller le pasa.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { Icon } from "@/app/studio/_components/icons";
import { PushOptIn } from "./PushOptIn";

export type ThemeMode = "light" | "dark";
export type ThemeScope = "bodeguero" | "camionero";

const THEME_STORAGE_PREFIX = "dtd_op_theme_";

function defaultForScope(scope: ThemeScope): ThemeMode {
  return scope === "camionero" ? "dark" : "light";
}

function readStoredTheme(scope: ThemeScope): ThemeMode {
  if (typeof window === "undefined") return defaultForScope(scope);
  try {
    const raw = localStorage.getItem(THEME_STORAGE_PREFIX + scope);
    if (raw === "dark" || raw === "light") return raw;
  } catch {
    /* ignore */
  }
  return defaultForScope(scope);
}

function persistThemeInternal(scope: ThemeScope, theme: ThemeMode): void {
  try {
    localStorage.setItem(THEME_STORAGE_PREFIX + scope, theme);
  } catch {
    /* ignore */
  }
}

/**
 * Hook que devuelve `[theme, toggle]` para un scope (bodeguero/camionero).
 *
 * Usa `useSyncExternalStore` en lugar de `useEffect+setState` para
 * evitar el cascading render warning + matchear el patrón recomendado
 * por React 19 para hidratación de stores externos (acá localStorage).
 *
 * SSR snapshot: usa el default del scope.
 * Client snapshot: lee localStorage. Listener notifica via `storage` event
 * (cambios desde otra tab) + via emitter interno cuando esta tab cambia.
 */
const themeListeners = new Set<() => void>();
function subscribeTheme(cb: () => void): () => void {
  themeListeners.add(cb);
  const onStorage = () => cb();
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  return () => {
    themeListeners.delete(cb);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

export function useThemeMode(scope: ThemeScope): {
  theme: ThemeMode;
  toggle: () => void;
} {
  const theme = useSyncExternalStore(
    subscribeTheme,
    () => readStoredTheme(scope),
    () => defaultForScope(scope),
  );
  const toggle = useCallback(() => {
    const next: ThemeMode = readStoredTheme(scope) === "dark" ? "light" : "dark";
    persistThemeInternal(scope, next);
    // Notificar a todos los suscriptores (incluye este mismo componente)
    themeListeners.forEach((cb) => cb());
  }, [scope]);
  return { theme, toggle };
}

interface Props {
  theme: ThemeMode;
  onToggleTheme: () => void;
  /** Form action server-side. Se renderiza como <form action={signOut}>. */
  signOutAction: () => void | Promise<void>;
  /** Opcional · oculto en Sprint G, se activa en Sprint D. */
  onSwitchMode?: () => void;
  /** Color del trigger button. Default: `var(--ink-soft)`. */
  triggerColor?: string;
}

export function SettingsMenu({
  theme,
  onToggleTheme,
  signOutAction,
  onSwitchMode,
  triggerColor,
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Cerrar al click afuera
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Más opciones"
        aria-expanded={open}
        aria-haspopup="menu"
        style={{
          width: 32,
          height: 32,
          padding: 0,
          background: "transparent",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-sm)",
          color: triggerColor ?? "var(--ink-soft)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
        }}
      >
        {/* Three dots vertical */}
        <svg viewBox="0 0 24 24" width={16} height={16} fill="none">
          <circle cx="12" cy="6" r="1.4" fill="currentColor" />
          <circle cx="12" cy="12" r="1.4" fill="currentColor" />
          <circle cx="12" cy="18" r="1.4" fill="currentColor" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            zIndex: 50,
            minWidth: 200,
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            boxShadow: "var(--shadow-md)",
            padding: 6,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <MenuItem
            icon={theme === "dark" ? Icon.sun(14) : Icon.moon(14)}
            label={theme === "dark" ? "Modo claro" : "Modo oscuro"}
            onClick={() => {
              onToggleTheme();
              setOpen(false);
            }}
          />

          {onSwitchMode && (
            <MenuItem
              icon={Icon.menu(14)}
              label="Cambiar modo"
              onClick={() => {
                onSwitchMode();
                setOpen(false);
              }}
            />
          )}

          {/* Sprint 4 · push opt-in (se auto-oculta si no soportado) */}
          <PushOptIn />

          <div
            style={{
              height: 1,
              background: "var(--border)",
              margin: "4px 0",
            }}
          />

          <form action={signOutAction}>
            <button
              type="submit"
              role="menuitem"
              style={menuItemStyle}
              onClick={() => setOpen(false)}
            >
              <span style={menuItemIconStyle}>
                <svg viewBox="0 0 24 24" width={14} height={14} fill="none">
                  <path
                    d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.6}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span>Cerrar sesión</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

const menuItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: "100%",
  padding: "8px 10px",
  background: "transparent",
  border: "none",
  borderRadius: "var(--r-sm)",
  color: "var(--ink)",
  font: "600 12.5px/1 var(--f-sans)",
  textAlign: "left",
  cursor: "pointer",
};

const menuItemIconStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 14,
  height: 14,
  color: "var(--ink-soft)",
  flexShrink: 0,
};

function MenuItem({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      style={menuItemStyle}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--bg-elevated)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <span style={menuItemIconStyle}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}
