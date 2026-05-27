"use client";

/**
 * BugFABButton · botón flotante para reportar bug (SDD-0036 Fase 2).
 *
 * Visible en todo el Studio. Click abre BugReportModal. Solo se monta si el
 * user es uno de los roles internos (admin, commercial, operations,
 * accounting, warehouse, support). El check de rol lo hace el server (no se
 * monta en layout si no aplica) — este componente asume rol válido.
 *
 * Posición configurable por user. 4 esquinas posibles:
 *   - bottom-right (default)
 *   - bottom-left
 *   - top-right (debajo del topbar)
 *   - top-left
 *
 * Cómo cambiarla:
 *   - Right-click en el botón → menú flotante con las 4 opciones.
 *   - Selección se persiste en localStorage (clave 'studio.bug-fab-corner').
 *   - Cada user/browser tiene su preferencia.
 *
 * Brand: 56px circle wine. Hover: lift sutil + shadow. Sin emojis.
 */

import { useEffect, useRef, useState } from "react";
import { BugReportModal } from "./BugReportModal";

interface BugFABButtonProps {
  /** Build SHA del deploy actual · NEXT_PUBLIC_BUILD_SHA o VERCEL_GIT_COMMIT_SHA */
  buildSha?: string | null;
}

type Corner = "bottom-right" | "bottom-left" | "top-right" | "top-left";

const STORAGE_KEY = "studio.bug-fab-corner";
const DEFAULT_CORNER: Corner = "bottom-right";

/** Offset desde el topbar cuando está arriba. El topbar mide ~64px. */
const TOP_OFFSET = "84px";
const SIDE_OFFSET = "var(--s-6, 24px)";

const CORNER_STYLES: Record<Corner, React.CSSProperties> = {
  "bottom-right": { bottom: SIDE_OFFSET, right: SIDE_OFFSET },
  "bottom-left": { bottom: SIDE_OFFSET, left: SIDE_OFFSET },
  "top-right": { top: TOP_OFFSET, right: SIDE_OFFSET },
  "top-left": { top: TOP_OFFSET, left: SIDE_OFFSET },
};

const CORNER_LABELS: Record<Corner, string> = {
  "bottom-right": "Abajo derecha",
  "bottom-left": "Abajo izquierda",
  "top-right": "Arriba derecha",
  "top-left": "Arriba izquierda",
};

function readStoredCorner(): Corner {
  if (typeof window === "undefined") return DEFAULT_CORNER;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (
      stored === "bottom-right" ||
      stored === "bottom-left" ||
      stored === "top-right" ||
      stored === "top-left"
    ) {
      return stored;
    }
  } catch {
    // localStorage bloqueado · usar default
  }
  return DEFAULT_CORNER;
}

export function BugFABButton({ buildSha }: BugFABButtonProps) {
  const [open, setOpen] = useState(false);
  // Iniciamos en default y leemos localStorage solo client-side para evitar
  // hydration mismatch · el snap a la pref real ocurre en useEffect.
  const [corner, setCorner] = useState<Corner>(DEFAULT_CORNER);
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCorner(readStoredCorner());
  }, []);

  // Cerrar el menu con click afuera o Escape.
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

  const changeCorner = (next: Corner) => {
    setCorner(next);
    setMenuOpen(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  };

  return (
    <>
      <div
        ref={wrapRef}
        style={{
          position: "fixed",
          ...CORNER_STYLES[corner],
          zIndex: 100,
        }}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          onContextMenu={(e) => {
            e.preventDefault();
            setMenuOpen((v) => !v);
          }}
          aria-label="Reportar un bug, mejora o sugerencia. Click derecho para mover."
          title="Reportar un bug · click derecho para mover de esquina"
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "var(--wine)",
            color: "var(--ink-inv, #FBFAF7)",
            border: "none",
            cursor: "pointer",
            boxShadow:
              "0 4px 12px rgba(127, 15, 26, 0.25), 0 2px 4px rgba(0,0,0,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition:
              "transform var(--dur, 180ms) var(--ease, ease-out), box-shadow var(--dur, 180ms) var(--ease, ease-out)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.05)";
            e.currentTarget.style.boxShadow =
              "0 6px 16px rgba(127, 15, 26, 0.32), 0 3px 6px rgba(0,0,0,0.10)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow =
              "0 4px 12px rgba(127, 15, 26, 0.25), 0 2px 4px rgba(0,0,0,0.08)";
          }}
          onFocus={(e) => {
            e.currentTarget.style.outline = "2px solid var(--wine-soft, #C2747F)";
            e.currentTarget.style.outlineOffset = "2px";
          }}
          onBlur={(e) => {
            e.currentTarget.style.outline = "none";
          }}
        >
          <BugIcon size={26} />
        </button>

        {menuOpen && (
          <CornerMenu
            currentCorner={corner}
            onSelect={changeCorner}
            onClose={() => setMenuOpen(false)}
          />
        )}
      </div>

      {open && (
        <BugReportModal
          onClose={() => setOpen(false)}
          buildSha={buildSha ?? null}
        />
      )}
    </>
  );
}

function CornerMenu({
  currentCorner,
  onSelect,
  onClose,
}: {
  currentCorner: Corner;
  onSelect: (c: Corner) => void;
  onClose: () => void;
}) {
  // El menú se ancla al opuesto del FAB para no quedar fuera de viewport.
  // Si el FAB está en bottom-right, el menú sale hacia top-left.
  const menuAnchor: React.CSSProperties = currentCorner.startsWith("bottom")
    ? { bottom: 68 }
    : { top: 68 };
  const menuHorizontal: React.CSSProperties = currentCorner.endsWith("right")
    ? { right: 0 }
    : { left: 0 };

  const corners: Corner[] = [
    "top-left",
    "top-right",
    "bottom-left",
    "bottom-right",
  ];

  return (
    <div
      role="menu"
      aria-label="Mover botón de bugs a otra esquina"
      style={{
        position: "absolute",
        ...menuAnchor,
        ...menuHorizontal,
        background: "var(--bg-surface)",
        border: "1px solid var(--border-strong)",
        borderRadius: "var(--r-md, 8px)",
        boxShadow: "var(--shadow-md, 0 8px 24px rgba(0,0,0,0.15))",
        padding: 8,
        minWidth: 180,
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
        Mover botón a
      </div>
      {corners.map((c) => {
        const isActive = c === currentCorner;
        return (
          <button
            key={c}
            type="button"
            role="menuitem"
            onClick={() => onSelect(c)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 10px",
              border: 0,
              background: isActive ? "var(--bg-elevated)" : "transparent",
              color: "var(--ink)",
              font: "500 12.5px/1.2 var(--f-sans)",
              cursor: "pointer",
              borderRadius: "var(--r-sm, 6px)",
              textAlign: "left",
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
            <CornerGlyph corner={c} />
            <span style={{ flex: 1 }}>{CORNER_LABELS[c]}</span>
            {isActive && (
              <span style={{ color: "var(--wine)", font: "700 10px/1 var(--f-sans)" }}>
                ✓
              </span>
            )}
          </button>
        );
      })}
      <div
        style={{
          marginTop: 4,
          paddingTop: 6,
          borderTop: "1px solid var(--border)",
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          style={{
            font: "500 11px/1 var(--f-sans)",
            color: "var(--ink-soft)",
            background: "transparent",
            border: 0,
            cursor: "pointer",
            padding: "4px 8px",
          }}
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}

/** Mini glifo 16x16 que representa la esquina elegida · cuadradito con punto. */
function CornerGlyph({ corner }: { corner: Corner }) {
  const dot: React.CSSProperties = {
    position: "absolute",
    width: 5,
    height: 5,
    borderRadius: 1,
    background: "var(--wine)",
  };
  const dotPos: React.CSSProperties =
    corner === "top-left"
      ? { top: 2, left: 2 }
      : corner === "top-right"
        ? { top: 2, right: 2 }
        : corner === "bottom-left"
          ? { bottom: 2, left: 2 }
          : { bottom: 2, right: 2 };
  return (
    <span
      aria-hidden="true"
      style={{
        position: "relative",
        width: 16,
        height: 16,
        border: "1px solid var(--ink-mute)",
        borderRadius: 2,
        flexShrink: 0,
      }}
    >
      <span style={{ ...dot, ...dotPos }} />
    </span>
  );
}

/** Outline bug icon · 24×24 · matches Icon set stroke style (1.6) */
function BugIcon({ size = 24 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Body */}
      <rect x="8" y="8" width="8" height="11" rx="4" />
      {/* Head antennae */}
      <path d="M9 5l1.5 3M15 5l-1.5 3" />
      {/* Legs */}
      <path d="M8 13H4M16 13h4M8 18l-3 2M16 18l3 2M8 8l-3-2M16 8l3-2" />
    </svg>
  );
}
