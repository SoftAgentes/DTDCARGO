"use client";

/**
 * <SplitActionButton> · Botón con acción principal + menú lateral de
 * alternativas, con memoria de la última opción elegida (Regla 5 del
 * estándar de botones · ver app/studio/CLAUDE.md).
 *
 * Patrón: el operador hace varias cotizaciones seguidas. Cada cotización
 * puede terminar con "Crear y cerrar" (default), "Crear y dejar abierta"
 * (para revisar/imprimir), o "Crear y empezar otra" (para batch rápido).
 * El componente recuerda la última que usó y la convierte en default,
 * así no tiene que volver a elegirla cada vez.
 *
 * UX:
 *   ┌─────────────────────────────┬──┐
 *   │  ✉ Crear y cerrar           │ ▼│   ← click principal ejecuta default
 *   └─────────────────────────────┴──┘
 *   ↓ click en chevron:
 *   ┌──────────────────────────────────┐
 *   │  ● Crear y cerrar (actual)       │   ← punto wine = default actual
 *   │  ○ Crear y dejar abierta         │
 *   │  ○ Crear y empezar otra          │
 *   └──────────────────────────────────┘
 *
 * Click en una opción:
 *   1. Cierra el menú.
 *   2. Guarda esa key como nuevo default en localStorage.
 *   3. Ejecuta la acción inmediatamente.
 *   4. Próxima vez que el componente se monte, ESA opción es la default.
 *
 * Memoria:
 *   - localStorage key: `studio.split-button.<memoryKey>`
 *   - Valor: `{ lastKey: string }`
 *   - Si no existe o la key guardada ya no está en `actions`, usa la
 *     primera de la lista como fallback.
 *
 * Hereda el contrato de <ActionButton> para la acción que ejecuta:
 *   - anti-doble-submit (disabled durante loading + success).
 *   - flash verde 2.5s post-éxito.
 *   - aria-busy + aria-live.
 *   - onAction acepta `void` o `{ error }`.
 */

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";

const DEFAULT_SUCCESS_MS = 2500;

type Variant = "primary" | "dark" | "danger" | "ghost" | "warning";
type Size = "default" | "sm" | "xs";

export interface SplitAction {
  /** Identificador estable · usado para persistir la última elección. */
  key: string;
  /** Texto en estado idle. */
  idleLabel: string;
  /** Texto durante loading. Default: "Procesando…". */
  loadingLabel?: string;
  /** Texto post-éxito (flash verde). Pasar `null` para saltearse el flash. */
  successLabel?: string | null;
  /** Icono opcional en estado idle. */
  idleIcon?: ReactNode;
  /** Icono opcional en estado success. */
  successIcon?: ReactNode;
  /** Tooltip / aria-label adicional. Opcional. */
  description?: string;
  /**
   * La acción a ejecutar. THROWS o retorna `{ error }` en caso de error.
   * Si no throwea, el componente entra en flash de success.
   */
  onAction: () => Promise<void | { error?: string | null }>;
}

export interface SplitActionButtonProps {
  /**
   * Identificador único del split button para persistir la última opción.
   * Ejemplo: `"quote-drawer-create"`, `"client-drawer-create"`.
   * Cada uso del componente debe usar una key distinta.
   */
  memoryKey: string;
  /** Lista de acciones. La primera es el default si no hay memoria previa. */
  actions: SplitAction[];
  /** Variante del botón principal. Default: primary. */
  variant?: Variant;
  /** Tamaño. Default: default (para footer de drawer). */
  size?: Size;
  /** Disabled externo (form inválido, otra acción en curso). */
  disabled?: boolean;
  /** Duración del flash verde en ms. Default 2500. */
  successMs?: number;
  /** Callback de error · recibe el mensaje. */
  onError?: (message: string) => void;
  /** Callback cuando la acción terminó OK · recibe la key ejecutada. */
  onSuccess?: (actionKey: string) => void;
}

const STORAGE_PREFIX = "studio.split-button.";

function readStoredKey(memoryKey: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + memoryKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed?.lastKey === "string" ? parsed.lastKey : null;
  } catch {
    return null;
  }
}

function writeStoredKey(memoryKey: string, lastKey: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_PREFIX + memoryKey,
      JSON.stringify({ lastKey, at: Date.now() }),
    );
  } catch {
    // ignore
  }
}

/** Alto estimado del menú · usado para decidir si abrir hacia arriba o
 *  hacia abajo según el espacio disponible en viewport. */
const ESTIMATED_MENU_HEIGHT = 220;

type MenuDirection = "down" | "up";

export function SplitActionButton({
  memoryKey,
  actions,
  variant = "primary",
  size = "default",
  disabled = false,
  successMs = DEFAULT_SUCCESS_MS,
  onError,
  onSuccess,
}: SplitActionButtonProps) {
  // Estado de UI
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuDirection, setMenuDirection] = useState<MenuDirection>("down");
  const [activeKey, setActiveKey] = useState<string>(actions[0]?.key ?? "");
  const [isPending, startTransition] = useTransition();
  const [successKey, setSuccessKey] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Cargar la última opción guardada (solo client-side · evita hydration mismatch).
  useEffect(() => {
    const stored = readStoredKey(memoryKey);
    if (stored && actions.some((a) => a.key === stored)) {
      setActiveKey(stored);
    }
  }, [memoryKey, actions]);

  /**
   * Decide si el menú abre hacia arriba o abajo según espacio disponible.
   * Importante para drawers donde el botón vive en el footer (al borde
   * inferior) · si abriera hacia abajo quedaría fuera del viewport o
   * tapado por la barra de tareas / safe area.
   */
  const toggleMenu = () => {
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }
    const el = wrapRef.current;
    if (el && typeof window !== "undefined") {
      const rect = el.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      // Si no hay espacio suficiente debajo, abrimos hacia arriba.
      if (spaceBelow < ESTIMATED_MENU_HEIGHT && spaceAbove > spaceBelow) {
        setMenuDirection("up");
      } else {
        setMenuDirection("down");
      }
    }
    setMenuOpen(true);
  };

  // Cerrar el menú con click afuera o Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [menuOpen]);

  const active = actions.find((a) => a.key === activeKey) ?? actions[0];
  if (!active) return null;

  const isSuccess = successKey === active.key;
  const inFlight = isPending || isSuccess;

  const runAction = (action: SplitAction) => {
    if (inFlight || disabled) return;
    setMenuOpen(false);
    setActiveKey(action.key);
    writeStoredKey(memoryKey, action.key);

    startTransition(async () => {
      try {
        const result = await action.onAction();
        if (result && typeof result === "object" && result.error) {
          onError?.(result.error);
          return;
        }
        onSuccess?.(action.key);
        if (action.successLabel != null) {
          setSuccessKey(action.key);
          setTimeout(() => setSuccessKey(null), successMs);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        onError?.(msg);
      }
    });
  };

  // Class del botón principal según variant + estado success.
  const variantClass = isSuccess
    ? "studio-btn-success"
    : variant === "primary"
      ? "studio-btn-primary"
      : variant === "dark"
        ? "studio-btn-dark"
        : variant === "danger"
          ? "studio-btn-danger"
          : variant === "warning"
            ? "studio-btn-warning"
            : "studio-btn-ghost";
  const sizeClass = size === "default" ? "" : `studio-btn-${size}`;

  // El botón principal y el chevron comparten la misma variant + size,
  // pero con borders ajustados para verse como UN solo control.
  const sharedBtnClass = ["studio-btn", variantClass, sizeClass]
    .filter(Boolean)
    .join(" ");

  const label = isSuccess
    ? active.successLabel
    : isPending
      ? (active.loadingLabel ?? "Procesando…")
      : active.idleLabel;

  const icon = isSuccess ? active.successIcon : isPending ? null : active.idleIcon;

  return (
    <div
      ref={wrapRef}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "stretch",
      }}
    >
      {/* Botón principal · ejecuta `active` directamente. */}
      <button
        type="button"
        className={sharedBtnClass}
        onClick={() => runAction(active)}
        disabled={disabled || inFlight}
        aria-busy={isPending}
        title={active.description}
        style={{
          borderTopRightRadius: 0,
          borderBottomRightRadius: 0,
          minWidth: "max-content",
        }}
      >
        {icon && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 14,
              height: 14,
              flexShrink: 0,
            }}
          >
            {icon}
          </span>
        )}
        {isPending && (
          <span
            className="studio-spin"
            style={{
              display: "inline-flex",
              alignItems: "center",
              width: 14,
              height: 14,
              flexShrink: 0,
            }}
          >
            <DefaultSpinner />
          </span>
        )}
        {label}
      </button>

      {/* Separador visual sutil entre el principal y el chevron. */}
      <span
        aria-hidden="true"
        style={{
          width: 1,
          alignSelf: "stretch",
          background: "rgba(255,255,255,0.20)",
        }}
      />

      {/* Chevron · abre menú de opciones alternativas. */}
      <button
        type="button"
        className={sharedBtnClass}
        onClick={toggleMenu}
        disabled={disabled || inFlight}
        aria-label="Más opciones de la acción"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        style={{
          borderTopLeftRadius: 0,
          borderBottomLeftRadius: 0,
          paddingLeft: 8,
          paddingRight: 8,
          minWidth: 0,
        }}
      >
        <ChevronDownIcon />
      </button>

      {/* Menú de opciones · abre hacia abajo o arriba según el espacio. */}
      {menuOpen && (
        <SplitActionMenu
          actions={actions}
          activeKey={active.key}
          direction={menuDirection}
          onSelect={runAction}
        />
      )}
    </div>
  );
}

function SplitActionMenu({
  actions,
  activeKey,
  direction,
  onSelect,
}: {
  actions: SplitAction[];
  activeKey: string;
  direction: MenuDirection;
  onSelect: (a: SplitAction) => void;
}) {
  // Posicionamiento según dirección · evita que el menú quede fuera del
  // viewport cuando el botón vive en el footer de un drawer.
  const verticalAnchor: React.CSSProperties =
    direction === "up"
      ? { bottom: "calc(100% + 6px)" }
      : { top: "calc(100% + 6px)" };

  return (
    <div
      role="menu"
      aria-label="Opciones alternativas de la acción"
      style={{
        position: "absolute",
        ...verticalAnchor,
        right: 0,
        minWidth: "max(220px, 100%)",
        background: "var(--bg-surface)",
        border: "1px solid var(--border-strong)",
        borderRadius: "var(--r-md, 8px)",
        boxShadow: "var(--shadow-md, 0 8px 24px rgba(0,0,0,0.15))",
        padding: 6,
        zIndex: 200,
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <div
        style={{
          padding: "4px 10px 6px",
          font: "700 9.5px/1 var(--f-sans)",
          color: "var(--ink-mute)",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
        }}
      >
        Variantes de la acción
      </div>
      {actions.map((a) => {
        const isActive = a.key === activeKey;
        return (
          <button
            key={a.key}
            type="button"
            role="menuitem"
            onClick={() => onSelect(a)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "9px 10px",
              border: 0,
              background: isActive ? "var(--bg-elevated)" : "transparent",
              color: "var(--ink)",
              font: "500 12.5px/1.3 var(--f-sans)",
              cursor: "pointer",
              borderRadius: "var(--r-sm, 6px)",
              textAlign: "left",
              width: "100%",
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = "var(--bg-elevated)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = "transparent";
              }
            }}
          >
            <RadioDot active={isActive} />
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              <span style={{ color: "var(--ink)" }}>{a.idleLabel}</span>
              {a.description && (
                <span
                  style={{
                    font: "500 11px/1.3 var(--f-sans)",
                    color: "var(--ink-soft)",
                  }}
                >
                  {a.description}
                </span>
              )}
            </div>
            {isActive && (
              <span
                style={{
                  font: "700 9px/1 var(--f-sans)",
                  color: "var(--wine)",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                }}
              >
                Default
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function RadioDot({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: 12,
        height: 12,
        borderRadius: "50%",
        border: `1.5px solid ${active ? "var(--wine)" : "var(--ink-mute)"}`,
        position: "relative",
        flexShrink: 0,
      }}
    >
      {active && (
        <span
          style={{
            position: "absolute",
            top: 2,
            left: 2,
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "var(--wine)",
          }}
        />
      )}
    </span>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={14}
      height={14}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function DefaultSpinner() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none">
      <path
        d="M20 11.5A8 8 0 1 1 12 4"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </svg>
  );
}
