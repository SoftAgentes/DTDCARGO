"use client";

/**
 * StudioTopbar · DTD Studio Shell v1
 *
 * Topbar sticky con:
 * - Module label dinámico (pathname → label via pathToModuleLabel)
 * - Search button + atajo ⌘K → buscador global permission-aware (SDD-0135)
 * - Notifications icon (placeholder, 0 notifs)
 * - User menu dropdown: nombre y rol, Vista, Tema, opciones de cuenta y Cerrar sesión
 *
 * SDD-0714: la vista y el tema salieron de la barra y viven en el menú del
 * usuario, guardados en su cuenta (`AparienciaMenu`, `AparienciaUsuario`).
 * Para sumar una opción al menú (por ejemplo, el Modo de prueba de SDD-0713),
 * agrega una entrada en `opcionesDeCuenta`.
 *
 * Diseño (Norte): docs/design/studio/_norte/erp/shell.jsx (Topbar)
 */

import { useTransition, useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Icon } from "../../_components/icons";
import { Avatar } from "../../_components/ui/Avatar";
import { Badge } from "../../_components/ui/Badge";
import { pathToModuleLabel } from "./StudioSidebar";
import { signOut } from "../actions";
import { useDTDWiring } from "../../_components/wiring/WiringProvider";
import { useIsMac } from "../../_components/ui/usePlatformMod";
import { GlobalSearchModal } from "../../_components/wiring/GlobalSearchModal";
import { NotificationBell } from "./NotificationBell";
import { ConversationsIndicator } from "./ConversationsIndicator";
import { AparienciaMenu } from "./AparienciaMenu";
import type { BugNotification } from "@/lib/studio/bug-types";
import { useT, useLocale } from "@/lib/i18n";

interface StudioTopbarProps {
  userEmail: string;
  /** Nombre que se muestra en la pastilla y en el menú; sin él, lo de antes de la @. */
  displayName?: string | null;
  /** Rol del tenant, ya en palabras («Administrador»). Sin rol no se pinta. */
  roleLabel?: string | null;
  userId: string;
  initialNotifications: BugNotification[];
  /** Tenant del user, para el filtro Realtime del indicador de Conversaciones. */
  conversationsTenantId: string | null;
  /** Conversaciones con mensajes sin leer (badge del topbar · SDD-0148). */
  initialUnreadConversations: { id: string; unread_count: number }[];
  /**
   * ¿La persona ve el módulo Conversaciones? (SDD-0622: rol, desvío o acceso
   * adicional). Sin él no se pinta el indicador: era un atajo a una pantalla
   * que la iba a rebotar, con un conteo que la RLS (0540) ya no le da.
   */
  showConversations?: boolean;
}

export function StudioTopbar({
  userEmail,
  displayName,
  roleLabel,
  userId,
  initialNotifications,
  conversationsTenantId,
  initialUnreadConversations,
  showConversations = true,
}: StudioTopbarProps) {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useT();
  const moduleLabel = pathToModuleLabel(pathname, locale);
  const [searchOpen, setSearchOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  // Modifier según OS: ⌘ en Mac, Ctrl en Windows/Linux (hook compartido).
  const modKey = useIsMac() ? "⌘" : "Ctrl";
  const userMenuRef = useRef<HTMLDivElement>(null);
  const userButtonRef = useRef<HTMLButtonElement>(null);
  const userMenuId = useId();
  const nombre = displayName?.trim() || userEmail.split("@")[0];

  // Atajo ⌘K / Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setUserMenuOpen((abierto) => {
          // Al cerrar con Escape, el foco vuelve a la pastilla.
          if (abierto) userButtonRef.current?.focus();
          return false;
        });
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

  const initials = userEmail.slice(0, 2).toUpperCase();

  return (
    <>
      <header
        className="studio-topbar"
        style={{
          position: "sticky",
          top: 0,
          background: "var(--bg-surface)",
          borderBottom: "1px solid var(--border)",
          zIndex: 40,
        }}
      >
        {/* Module label */}
        <div className="studio-topbar__module">
          <span
            className="studio-topbar__module-kicker"
            style={{
              font: "700 11px/1 var(--f-sans)",
              color: "var(--ink-soft)",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            {t("chrome.topbar.module")}
          </span>
          <span
            className="studio-topbar__module-name"
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
        <div className="studio-topbar__search">
          <button
            onClick={() => setSearchOpen(true)}
            aria-label={t("chrome.topbar.search_aria", { key: modKey })}
            style={{
              width: "100%",
              height: 36,
              padding: "0 12px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "var(--bg-surface)",
              border: "1px solid var(--ink-soft)",
              borderRadius: "var(--r-md)",
              color: "var(--ink)",
              font: "500 14px/1 var(--f-sans)",
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
              {t("chrome.topbar.search_placeholder")}
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
          className="studio-topbar__actions"
        >
          {/* Conversaciones · badge de mensajes del cliente sin leer (SDD-0148),
              al lado de la campana → siempre visible en cada pantalla. */}
          {showConversations && (
            <ConversationsIndicator
              tenantId={conversationsTenantId}
              initial={initialUnreadConversations}
            />
          )}

          {/* Notifications · campanita in-app (SDD-0036 Fase 5) */}
          <NotificationBell userId={userId} initial={initialNotifications} />

          {/* User menu */}
          <div ref={userMenuRef} className="studio-topbar__user" style={{ position: "relative" }}>
            <button
              ref={userButtonRef}
              type="button"
              className="studio-topbar__user-button"
              onClick={() => setUserMenuOpen((v) => !v)}
              aria-label={t("chrome.topbar.user_menu")}
              aria-expanded={userMenuOpen}
              aria-controls={userMenuOpen ? userMenuId : undefined}
              style={{
                borderRadius: "var(--r-pill)",
                background: "var(--bg-surface)",
                border: "1px solid var(--ink-soft)",
                cursor: "pointer",
              }}
            >
              <Avatar initials={initials} size={28} />
              <span
                className="studio-topbar__user-name"
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
                {nombre}
              </span>
              <span
                className="studio-topbar__user-chevron"
                style={{ color: "var(--ink-soft)" }}
              >
                {Icon.chevD(12)}
              </span>
            </button>
            {userMenuOpen && (
              <UserMenuDropdown
                id={userMenuId}
                email={userEmail}
                nombre={nombre}
                roleLabel={roleLabel ?? null}
                onClose={() => setUserMenuOpen(false)}
              />
            )}
          </div>
        </div>
      </header>

      {searchOpen && <GlobalSearchModal onClose={() => setSearchOpen(false)} />}
    </>
  );
}

// ── Subcomponentes ──────────────────────────────────────────────

function UserMenuDropdown({
  id,
  email,
  nombre,
  roleLabel,
  onClose,
}: {
  id: string;
  email: string;
  nombre: string;
  roleLabel: string | null;
  onClose: () => void;
}) {
  const t = useT();
  const [isPending, startTransition] = useTransition();
  const primerFocoRef = useRef<HTMLButtonElement>(null);
  // Al abrir, el foco entra a la vista marcada (SDD-0714 §4).
  useEffect(() => {
    primerFocoRef.current?.focus();
  }, []);
  const handleSignOut = () => {
    startTransition(() => {
      onClose();
      signOut();
    });
  };

  return (
    <div
      id={id}
      role="dialog"
      aria-label={t("chrome.topbar.user_menu")}
      onBlur={(e) => {
        // Si el foco sale del menú con Tab, el menú se cierra.
        const destino = e.relatedTarget as Node | null;
        if (destino && !e.currentTarget.parentElement?.contains(destino)) onClose();
      }}
      style={{
        position: "absolute",
        top: "calc(100% + 8px)",
        right: 0,
        width: 320,
        maxWidth: "calc(100vw - 16px)",
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
          {nombre}
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
        {roleLabel && (
          <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Badge tone="neutral" size="sm">
              {roleLabel}
            </Badge>
          </div>
        )}
      </div>
      <AparienciaMenu primerFocoRef={primerFocoRef} />
      <UserMenuItems onClose={onClose} />
      <div
        style={{
          padding: "6px 8px",
          borderTop: "1px solid var(--border)",
        }}
      >
        <button
          type="button"
          onClick={handleSignOut}
          disabled={isPending}
          style={{
            width: "100%",
            minHeight: 32,
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
          {isPending ? t("chrome.topbar.logging_out") : t("chrome.topbar.menu_logout")}
        </button>
      </div>
    </div>
  );
}

/** Una opción del menú: un texto y lo que hace. Cambiar de `grupo` pinta una raya. */
interface OpcionDeCuenta {
  key: string;
  label: string;
  onSelect: () => void;
  grupo: "cuenta" | "soporte";
}

function UserMenuItems({ onClose }: { onClose: () => void }) {
  const t = useT();
  const { openProfileModal, openShortcutsModal, openBugReport } = useDTDWiring();
  // Para sumar una opción (p. ej. el Modo de prueba de SDD-0713), una entrada más aquí.
  const opcionesDeCuenta: OpcionDeCuenta[] = [
    { key: "perfil", grupo: "cuenta", label: t("chrome.topbar.menu_profile"), onSelect: () => openProfileModal({ tab: "profile" }) },
    { key: "clave", grupo: "cuenta", label: t("chrome.topbar.menu_password"), onSelect: () => openProfileModal({ tab: "password" }) },
    { key: "atajos", grupo: "cuenta", label: t("chrome.topbar.menu_shortcuts"), onSelect: () => openShortcutsModal() },
    { key: "preferencias", grupo: "cuenta", label: t("chrome.topbar.menu_preferences"), onSelect: () => openProfileModal({ tab: "prefs" }) },
    // Soporte · separado de las opciones de cuenta y de «Cerrar sesión».
    { key: "problema", grupo: "soporte", label: t("chrome.topbar.menu_report_bug"), onSelect: () => openBugReport() },
  ];
  return (
    <div style={{ padding: 6 }}>
      {opcionesDeCuenta.map((o, i) => (
        <div key={o.key}>
          {i > 0 && opcionesDeCuenta[i - 1].grupo !== o.grupo && (
            <div style={{ margin: "6px 4px", borderTop: "1px solid var(--border)" }} />
          )}
          <MenuItem
            label={o.label}
            onClick={() => {
              onClose();
              o.onSelect();
            }}
          />
        </div>
      ))}
    </div>
  );
}

function MenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        // SDD-0603 · tramo 5e: nada que se oprima baja de 32 px (medía 29).
        minHeight: 32,
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
