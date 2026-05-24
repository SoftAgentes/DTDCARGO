"use client";

/**
 * StudioTopbar · DTD Studio Shell v1
 *
 * Topbar sticky con:
 * - Module label dinámico (pathname → label via pathToModuleLabel)
 * - Search button + atajo ⌘K (placeholder, abre modal — Sprint 6.4)
 * - Theme toggle (sun/moon) persistido en localStorage
 * - Notifications icon (placeholder, 0 notifs)
 * - User menu dropdown con avatar + email + role + Cerrar sesión
 *
 * Portado desde docs/design/v1-studio/source/erp/shell.jsx (Topbar function).
 */

import { useTransition, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Icon } from "../../_components/icons";
import { Avatar } from "../../_components/ui/Avatar";
import { Badge } from "../../_components/ui/Badge";
import { pathToModuleLabel } from "./StudioSidebar";
import { signOut } from "../actions";

const THEME_KEY = "studio_theme";

interface StudioTopbarProps {
  userEmail: string;
}

export function StudioTopbar({ userEmail }: StudioTopbarProps) {
  const pathname = usePathname();
  const moduleLabel = pathToModuleLabel(pathname);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [searchOpen, setSearchOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  // Default "Ctrl" para que en SSR + Windows/Linux no flashee.
  // Mac se detecta client-side via navigator.platform → "⌘".
  const [modKey, setModKey] = useState<"Ctrl" | "⌘">("Ctrl");
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Hidratar theme desde localStorage
  useEffect(() => {
    try {
      const t = localStorage.getItem(THEME_KEY);
      if (t === "dark") setTheme("dark");
    } catch {
      // ignore
    }
  }, []);

  // Detectar OS para mostrar el modifier correcto (⌘ Mac vs Ctrl Win/Linux).
  // navigator.platform sigue siendo el método más confiable cross-browser
  // (userAgentData.platform aún no es universal).
  useEffect(() => {
    if (typeof navigator !== "undefined") {
      const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      if (isMac) setModKey("⌘");
    }
  }, []);

  // Atajo ⌘K / Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Click outside del user menu
  useEffect(() => {
    if (!userMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [userMenuOpen]);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    try {
      document.documentElement.dataset.theme = next === "dark" ? "dark" : "";
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // ignore
    }
  };

  const initials = userEmail.slice(0, 2).toUpperCase();

  return (
    <>
      <header
        style={{
          position: "sticky",
          top: 0,
          height: "var(--topbar-h)",
          background: "var(--bg-surface)",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "0 var(--s-6)",
          zIndex: 40,
        }}
      >
        {/* Module label */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span
            style={{
              font: "700 11px/1 var(--f-sans)",
              color: "var(--ink-soft)",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            Módulo
          </span>
          <span
            style={{
              font: "900 16px/1 var(--f-display)",
              color: "var(--ink)",
              letterSpacing: "-0.01em",
            }}
          >
            {moduleLabel}
          </span>
        </div>

        {/* Search button */}
        <div style={{ flex: 1, maxWidth: 520, marginLeft: 24 }}>
          <button
            onClick={() => setSearchOpen(true)}
            aria-label={`Buscar en el Studio (atajo: ${modKey}+K)`}
            style={{
              width: "100%",
              height: 36,
              padding: "0 12px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-md)",
              color: "var(--ink-soft)",
              font: "500 13px/1 var(--f-sans)",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            <span style={{ display: "inline-flex", flexShrink: 0 }}>{Icon.search(14)}</span>
            <span
              style={{
                flex: 1,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              Buscar embarques, clientes, MARKBOX…
            </span>
            <kbd
              style={{
                padding: "2px 6px",
                borderRadius: 4,
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                font: "600 10px/1.3 var(--f-mono)",
                color: "var(--ink-soft)",
              }}
            >
              {modKey} K
            </kbd>
          </button>
        </div>

        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          {/* Theme toggle */}
          <IconButton
            onClick={toggleTheme}
            title={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            ariaLabel="Cambiar tema"
          >
            {theme === "dark" ? Icon.sun(16) : Icon.moon(16)}
          </IconButton>

          {/* Notifications (placeholder) */}
          <IconButton
            onClick={() => {
              /* Sprint futuro */
            }}
            title="Notificaciones"
            ariaLabel="Notificaciones"
          >
            {Icon.bell(16)}
          </IconButton>

          {/* User menu */}
          <div ref={userMenuRef} style={{ position: "relative", marginLeft: 6 }}>
            <button
              onClick={() => setUserMenuOpen((v) => !v)}
              aria-label="Menú de usuario"
              aria-expanded={userMenuOpen}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "4px 10px 4px 4px",
                borderRadius: "var(--r-pill)",
                background: "var(--bg-elevated)",
                cursor: "pointer",
              }}
            >
              <Avatar initials={initials} size={28} />
              <span
                style={{
                  font: "600 12.5px/1 var(--f-sans)",
                  color: "var(--ink)",
                  maxWidth: 140,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={userEmail}
              >
                {userEmail.split("@")[0]}
              </span>
              <span style={{ color: "var(--ink-mute)", display: "inline-flex" }}>
                {Icon.chevD(12)}
              </span>
            </button>
            {userMenuOpen && (
              <UserMenuDropdown
                email={userEmail}
                onClose={() => setUserMenuOpen(false)}
              />
            )}
          </div>
        </div>
      </header>

      {searchOpen && <SearchPlaceholderModal onClose={() => setSearchOpen(false)} />}
    </>
  );
}

// ── Subcomponentes ──────────────────────────────────────────────

function IconButton({
  onClick,
  title,
  ariaLabel,
  children,
}: {
  onClick: () => void;
  title: string;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      style={{
        width: 36,
        height: 36,
        borderRadius: "var(--r-md)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--ink-soft)",
        background: "transparent",
        cursor: "pointer",
        transition: "background var(--dur-fast) var(--ease)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--bg-elevated)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      {children}
    </button>
  );
}

function UserMenuDropdown({
  email,
  onClose,
}: {
  email: string;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const handleSignOut = () => {
    startTransition(() => {
      onClose();
      signOut();
    });
  };

  return (
    <div
      style={{
        position: "absolute",
        top: "calc(100% + 8px)",
        right: 0,
        width: 280,
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        boxShadow: "var(--shadow-lg)",
        zIndex: 70,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "14px 16px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            font: "800 13px/1.2 var(--f-display)",
            color: "var(--ink)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {email.split("@")[0]}
        </div>
        <div
          style={{
            font: "500 11px/1.3 var(--f-sans)",
            color: "var(--ink-soft)",
            marginTop: 3,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {email}
        </div>
        <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Badge tone="wine" size="sm">
            Admin
          </Badge>
          <Badge tone="neutral" size="sm">
            DTD
          </Badge>
        </div>
      </div>
      <div style={{ padding: 6 }}>
        <MenuItem
          label="Preferencias"
          onClick={() => {
            onClose();
            window.location.href = "/studio/ajustes";
          }}
        />
      </div>
      <div
        style={{
          padding: "6px 8px",
          borderTop: "1px solid var(--border)",
        }}
      >
        <button
          onClick={handleSignOut}
          disabled={isPending}
          style={{
            width: "100%",
            textAlign: "left",
            padding: "8px 10px",
            borderRadius: "var(--r-sm)",
            font: "600 13px/1 var(--f-sans)",
            color: "var(--danger)",
            cursor: isPending ? "wait" : "pointer",
            background: "transparent",
            transition: "background var(--dur-fast) var(--ease)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--danger-bg)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          {isPending ? "Cerrando sesión…" : "Cerrar sesión"}
        </button>
      </div>
    </div>
  );
}

function MenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        padding: "8px 10px",
        borderRadius: "var(--r-sm)",
        font: "500 13px/1 var(--f-sans)",
        color: "var(--ink)",
        background: "transparent",
        cursor: "pointer",
        transition: "background var(--dur-fast) var(--ease)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--bg-elevated)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      {label}
    </button>
  );
}

function SearchPlaceholderModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,30,61,0.4)",
        zIndex: 100,
        display: "grid",
        placeItems: "start center",
        paddingTop: "12vh",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(560px, 92vw)",
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          boxShadow: "var(--shadow-pop)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span style={{ color: "var(--ink-mute)", display: "inline-flex" }}>
            {Icon.search(16)}
          </span>
          <input
            disabled
            placeholder="Búsqueda global (próximamente)"
            style={{
              flex: 1,
              border: 0,
              outline: 0,
              background: "transparent",
              font: "500 14px/1 var(--f-sans)",
              color: "var(--ink-mute)",
            }}
          />
          <kbd
            style={{
              padding: "2px 6px",
              borderRadius: 4,
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              font: "600 10px/1.3 var(--f-mono)",
              color: "var(--ink-soft)",
            }}
          >
            ESC
          </kbd>
        </div>
        <div
          style={{
            padding: "20px 18px",
            font: "500 13px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
          }}
        >
          <strong style={{ color: "var(--ink)", font: "800 13px/1 var(--f-display)" }}>
            Búsqueda global llegará en Sprint 6.4.
          </strong>
          <div style={{ marginTop: 8 }}>
            Mientras tanto, navegá desde el sidebar para encontrar embarques,
            clientes, MARKBOX y demás.
          </div>
        </div>
      </div>
    </div>
  );
}
