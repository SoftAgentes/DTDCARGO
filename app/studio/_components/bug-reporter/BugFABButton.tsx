"use client";

/**
 * BugFABButton · botón flotante para reportar un problema (SDD-0036).
 *
 * OCULTO por defecto. Se enciende/apaga con Alt+B (visibilidad efímera por
 * sesión, la maneja WiringProvider · `bugFabVisible`). La entrada canónica
 * para reportar es el ítem "Reportar un problema" del menú de perfil; este
 * FAB es un acelerador para cuando el usuario está cazando un problema.
 *
 * UX:
 *   - Click rápido (sin arrastrar) → abre el modal de reporte (global, en
 *     WiringProvider).
 *   - Mantener pulsado y arrastrar → modo drag con ghost targets en las 4
 *     esquinas. Al soltar, snappea a la más cercana. La esquina persiste en
 *     localStorage 'studio.bug-fab-corner'.
 *   - Right-click → menú explícito con las 4 opciones (fallback).
 *
 * Visual (tono "Fantasma", SDD-0036 refinamiento): utilitario de menor
 * jerarquía — contorno + ícono navy suave sobre fondo transparente, sin
 * pulso; en hover se rellena y eleva. El wine sigue siendo el único color de
 * acción. Ver `.bug-fab-*` en studio.css.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useT, type I18nKey } from "@/lib/i18n";
import { useDTDWiring } from "../wiring/WiringProvider";

type Corner = "bottom-right" | "bottom-left" | "top-right" | "top-left";

const STORAGE_KEY = "studio.bug-fab-corner";
const DEFAULT_CORNER: Corner = "bottom-right";

/** Offset desde el topbar cuando está arriba. El topbar mide ~64px. */
const TOP_OFFSET_PX = 84;
const SIDE_OFFSET_PX = 24;
/** Caja de toque (hit-area). El disco visible es más chico (ver .bug-fab-disc). */
const FAB_SIZE = 44;
const DRAG_THRESHOLD_PX = 8;

const CORNER_STYLES: Record<Corner, React.CSSProperties> = {
  "bottom-right": { bottom: SIDE_OFFSET_PX, right: SIDE_OFFSET_PX },
  "bottom-left": { bottom: SIDE_OFFSET_PX, left: SIDE_OFFSET_PX },
  "top-right": { top: TOP_OFFSET_PX, right: SIDE_OFFSET_PX },
  "top-left": { top: TOP_OFFSET_PX, left: SIDE_OFFSET_PX },
};

const CORNER_LABEL_KEYS: Record<Corner, I18nKey> = {
  "bottom-right": "bug.fab.corner_label_bottom_right",
  "bottom-left": "bug.fab.corner_label_bottom_left",
  "top-right": "bug.fab.corner_label_top_right",
  "top-left": "bug.fab.corner_label_top_left",
};

/** Punto en viewport donde se ancla el centro del FAB para cada esquina. */
function cornerAnchorPx(corner: Corner): { x: number; y: number } {
  if (typeof window === "undefined") return { x: 0, y: 0 };
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const half = FAB_SIZE / 2;
  switch (corner) {
    case "top-left":
      return { x: SIDE_OFFSET_PX + half, y: TOP_OFFSET_PX + half };
    case "top-right":
      return { x: vw - SIDE_OFFSET_PX - half, y: TOP_OFFSET_PX + half };
    case "bottom-left":
      return { x: SIDE_OFFSET_PX + half, y: vh - SIDE_OFFSET_PX - half };
    case "bottom-right":
      return { x: vw - SIDE_OFFSET_PX - half, y: vh - SIDE_OFFSET_PX - half };
  }
}

function closestCorner(x: number, y: number): Corner {
  const corners: Corner[] = [
    "top-left",
    "top-right",
    "bottom-left",
    "bottom-right",
  ];
  let best: Corner = "bottom-right";
  let bestDist = Infinity;
  for (const c of corners) {
    const a = cornerAnchorPx(c);
    const d = Math.hypot(a.x - x, a.y - y);
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

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

export function BugFABButton() {
  const t = useT();
  const { bugFabVisible, openBugReport } = useDTDWiring();
  // Iniciamos en default y leemos localStorage solo client-side para evitar
  // hydration mismatch · el snap a la pref real ocurre en useEffect.
  const [corner, setCorner] = useState<Corner>(DEFAULT_CORNER);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pointerStartRef = useRef<{ x: number; y: number; id: number } | null>(
    null,
  );
  const movedRef = useRef(false);

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

  const persistCorner = useCallback((next: Corner) => {
    setCorner(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  const changeCorner = (next: Corner) => {
    persistCorner(next);
    setMenuOpen(false);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    // Solo botón principal · ignoramos right-click (lo maneja onContextMenu)
    if (e.button !== 0) return;
    pointerStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      id: e.pointerId,
    };
    movedRef.current = false;
    try {
      buttonRef.current?.setPointerCapture(e.pointerId);
    } catch {
      // setPointerCapture puede tirar si el pointer ya se liberó · ignoramos
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const start = pointerStartRef.current;
    if (!start || start.id !== e.pointerId) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const dist = Math.hypot(dx, dy);
    if (!movedRef.current && dist > DRAG_THRESHOLD_PX) {
      movedRef.current = true;
      setDragging(true);
      setMenuOpen(false);
    }
    if (movedRef.current) {
      setDragPos({ x: e.clientX, y: e.clientY });
    }
  };

  const finishPointer = (e: React.PointerEvent<HTMLButtonElement>) => {
    const start = pointerStartRef.current;
    if (!start || start.id !== e.pointerId) return;
    try {
      buttonRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    if (movedRef.current) {
      const next = closestCorner(e.clientX, e.clientY);
      persistCorner(next);
    } else {
      // Click puro sin arrastre · abrir el modal global (WiringProvider)
      openBugReport();
    }
    pointerStartRef.current = null;
    movedRef.current = false;
    setDragging(false);
    setDragPos(null);
  };

  // Esquina hacia la que snappearía si soltáramos ahora · sirve para
  // resaltar el ghost target activo durante el drag.
  const activeTarget: Corner | null = useMemo(() => {
    if (!dragging || !dragPos) return null;
    return closestCorner(dragPos.x, dragPos.y);
  }, [dragging, dragPos]);

  // Posición fixed del wrapper · durante drag sigue al puntero, idle queda
  // en la esquina elegida.
  const wrapperStyle: React.CSSProperties = dragging && dragPos
    ? {
        position: "fixed",
        left: dragPos.x - FAB_SIZE / 2,
        top: dragPos.y - FAB_SIZE / 2,
        zIndex: 100,
      }
    : {
        position: "fixed",
        ...CORNER_STYLES[corner],
        zIndex: 100,
      };

  // Oculto por defecto · WiringProvider decide la visibilidad (Alt+B).
  if (!bugFabVisible) return null;

  return (
    <>
      {/* Ghost targets · solo visibles durante drag */}
      {dragging && (
        <>
          {(
            ["top-left", "top-right", "bottom-left", "bottom-right"] as Corner[]
          ).map((c) => {
            const a = cornerAnchorPx(c);
            return (
              <div
                key={c}
                className="bug-fab-ghost"
                data-active={activeTarget === c ? "true" : "false"}
                style={{
                  left: a.x - 32,
                  top: a.y - 32,
                }}
                aria-hidden="true"
              >
                {activeTarget === c ? t("bug.fab.drag_target_here") : ""}
              </div>
            );
          })}
        </>
      )}

      <div ref={wrapRef} style={wrapperStyle}>
        <button
          ref={buttonRef}
          type="button"
          className="bug-fab-button"
          data-dragging={dragging ? "true" : "false"}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finishPointer}
          onPointerCancel={finishPointer}
          onContextMenu={(e) => {
            e.preventDefault();
            setMenuOpen((v) => !v);
          }}
          aria-label={t("bug.fab.aria")}
          title={t("bug.fab.title")}
        >
          <span className="bug-fab-disc">
            <BugIcon size={16} />
          </span>
        </button>

        {menuOpen && !dragging && (
          <CornerMenu
            currentCorner={corner}
            onSelect={changeCorner}
            onClose={() => setMenuOpen(false)}
          />
        )}
      </div>
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
  const t = useT();
  // El menú se ancla al opuesto del FAB para no quedar fuera de viewport.
  // Si el FAB está en bottom-right, el menú sale hacia top-left.
  const menuAnchor: React.CSSProperties = currentCorner.startsWith("bottom")
    ? { bottom: 60 }
    : { top: 60 };
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
      aria-label={t("bug.fab.corner_menu_aria")}
      style={{
        position: "absolute",
        ...menuAnchor,
        ...menuHorizontal,
        background: "var(--bg-surface)",
        border: "1px solid var(--border-strong)",
        borderRadius: "var(--r-md)",
        boxShadow: "var(--shadow-md)",
        padding: 8,
        minWidth: 200,
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <div
        style={{
          padding: "4px 10px 6px",
          font: "700 9.5px/1 var(--f-sans)",
          color: "var(--ink-soft)",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
        }}
      >
        {t("bug.fab.corner_menu_heading")}
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
              borderRadius: "var(--r-sm)",
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
            <span style={{ flex: 1 }}>{t(CORNER_LABEL_KEYS[c])}</span>
            {isActive && (
              <span
                style={{
                  color: "var(--wine)",
                  font: "700 10px/1 var(--f-sans)",
                }}
              >
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
          alignItems: "center",
          gap: 8,
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            font: "500 10.5px/1.35 var(--f-sans)",
            color: "var(--ink-soft)",
            padding: "0 4px",
          }}
        >
          {t("bug.fab.corner_menu_tip")}
        </span>
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
          {t("bug.fab.corner_menu_close")}
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
      strokeWidth={1.7}
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
