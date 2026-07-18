"use client";

/**
 * Columnas configurables (orden + visibilidad) · primitiva transversal del
 * Studio. Port del handoff del Norte "Almacén CN → columnas configurables"
 * (2026-07-03, `erp/modules/cn.jsx` · `CNColumnManager`).
 *
 * Contrato (§3 del handoff):
 *  - El array maestro de columnas (label + render) vive en cada módulo y NO se
 *    persiste; lo persistido es `{ key, visible }[]` (orden de aparición +
 *    visibilidad) bajo una clave localStorage propia del módulo.
 *  - Carga reconciliada: descarta keys muertos, agrega AL FINAL los keys
 *    nuevos del default (una columna nueva llega sola a usuarios con config
 *    vieja) y cae al default ante parse inválido.
 *  - Reordenar = swap con el adyacente (▲▼ por fila) — NO drag-and-drop.
 *  - `visibleColumns` derivado SIEMPRE con `.filter(Boolean)` (red de
 *    seguridad ante keys sin entrada en el mapa).
 *
 * En producción queda pendiente evaluar persistir además en preferencias de
 * usuario vía API (nota §7 del handoff); hoy es por navegador.
 */

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/app/studio/_components/icons";

export type ColumnVisibility = { key: string; visible: boolean };

/** Etiquetas del gestor: label visible + hint opcional bajo el nombre. */
export type ColumnLabels = Record<string, { label: string; hint?: string }>;

export function reconcileColumnCfg(
  raw: string | null,
  defaults: ColumnVisibility[],
): ColumnVisibility[] {
  try {
    if (!raw) return defaults.map((c) => ({ ...c }));
    const saved = JSON.parse(raw) as ColumnVisibility[];
    if (!Array.isArray(saved)) return defaults.map((c) => ({ ...c }));
    const merged = saved
      .filter(
        (c) =>
          c &&
          typeof c.key === "string" &&
          defaults.some((d) => d.key === c.key),
      )
      .map((c) => ({ key: c.key, visible: !!c.visible }));
    const savedKeys = new Set(merged.map((c) => c.key));
    for (const d of defaults) {
      if (!savedKeys.has(d.key)) merged.push({ ...d });
    }
    return merged;
  } catch {
    return defaults.map((c) => ({ ...c }));
  }
}

/**
 * Config de columnas persistida en localStorage. SSR-safe: primer render con
 * el default (el server no tiene localStorage) e hidrata en el mount; recién
 * después empieza a persistir (no pisa lo guardado con el default).
 */
export function useColumnConfig(
  storageKey: string,
  defaults: ColumnVisibility[],
): [ColumnVisibility[], (next: ColumnVisibility[]) => void] {
  const [cfg, setCfg] = useState<ColumnVisibility[]>(() =>
    defaults.map((c) => ({ ...c })),
  );
  const hydrated = useRef(false);

  useEffect(() => {
    try {
      setCfg(reconcileColumnCfg(localStorage.getItem(storageKey), defaults));
    } catch {
      /* default ya seteado */
    }
    hydrated.current = true;
    // defaults es constante por módulo; storageKey identifica la config.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(cfg));
    } catch {
      /* storage lleno/bloqueado: la config vive en memoria esta sesión */
    }
  }, [storageKey, cfg]);

  return [cfg, setCfg];
}

/**
 * Botón "Columnas N" + popover del gestor (§4 del handoff): ▲▼ reordena
 * (swap), checkbox muestra/oculta (accent wine), Restablecer al default.
 */
export function ColumnManager({
  cfg,
  setCfg,
  defaults,
  labels,
}: {
  cfg: ColumnVisibility[];
  setCfg: (next: ColumnVisibility[]) => void;
  defaults: ColumnVisibility[];
  labels: ColumnLabels;
}) {
  const [open, setOpen] = useState(false);
  const visibleCount = cfg.filter((c) => c.visible).length;

  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= cfg.length) return;
    const next = cfg.slice();
    const t = next[idx];
    next[idx] = next[j];
    next[j] = t;
    setCfg(next);
  };
  const toggle = (idx: number) =>
    setCfg(cfg.map((c, i) => (i === idx ? { ...c, visible: !c.visible } : c)));
  const reset = () => setCfg(defaults.map((c) => ({ ...c })));

  return (
    <div
      style={{ position: "relative", display: "inline-flex" }}
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          height: 32,
          padding: "0 11px",
          background: open ? "var(--wine-tint)" : "var(--bg-surface)",
          border: `1px solid ${open ? "var(--wine)" : "var(--border)"}`,
          borderRadius: "var(--r-md)",
          font: "600 12px/1 var(--f-sans)",
          color: open ? "var(--wine)" : "var(--ink-soft)",
          cursor: "pointer",
        }}
      >
        {Icon.cog(13)} Columnas
        <span style={{ font: "700 10px/1 var(--f-mono)", color: "var(--ink-soft)" }}>
          {visibleCount}
        </span>
      </button>

      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 200 }}
          />
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              right: 0,
              zIndex: 201,
              width: 300,
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-md)",
              boxShadow: "var(--shadow-lg)",
              padding: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 10,
              }}
            >
              <span
                style={{
                  font: "700 10px/1 var(--f-sans)",
                  color: "var(--ink-soft)",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                Columnas de la tabla
              </span>
              <button
                type="button"
                onClick={reset}
                style={{
                  font: "600 11px/1 var(--f-sans)",
                  color: "var(--wine-text)",
                  padding: "3px 6px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Restablecer
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {cfg.map((c, idx) => {
                const def = labels[c.key];
                if (!def) return null;
                return (
                  <div
                    key={c.key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 8px",
                      borderRadius: "var(--r-sm)",
                      background: c.visible ? "var(--bg-elevated)" : "transparent",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                      <button
                        type="button"
                        onClick={() => move(idx, -1)}
                        disabled={idx === 0}
                        aria-label={`Subir ${def.label}`}
                        style={{
                          font: "9px/1 var(--f-sans)",
                          color: "var(--ink-soft)",
                          cursor: idx === 0 ? "default" : "pointer",
                          padding: 0,
                          background: "transparent",
                          border: "none",
                          opacity: idx === 0 ? 0.4 : 1,
                        }}
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        onClick={() => move(idx, 1)}
                        disabled={idx === cfg.length - 1}
                        aria-label={`Bajar ${def.label}`}
                        style={{
                          font: "9px/1 var(--f-sans)",
                          color: "var(--ink-soft)",
                          cursor: idx === cfg.length - 1 ? "default" : "pointer",
                          padding: 0,
                          background: "transparent",
                          border: "none",
                          opacity: idx === cfg.length - 1 ? 0.4 : 1,
                        }}
                      >
                        ▼
                      </button>
                    </div>
                    <label
                      style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        cursor: "pointer",
                        minWidth: 0,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={c.visible}
                        onChange={() => toggle(idx)}
                        // La última visible no se puede ocultar (tabla vacía).
                        disabled={c.visible && visibleCount === 1}
                        style={{ accentColor: "var(--wine)", flexShrink: 0 }}
                      />
                      <span style={{ minWidth: 0 }}>
                        <span
                          style={{
                            display: "block",
                            font: "600 12px/1.2 var(--f-sans)",
                            color: c.visible ? "var(--ink)" : "var(--ink-mute)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {def.label}
                        </span>
                        {def.hint && (
                          <span
                            style={{
                              display: "block",
                              font: "500 9.5px/1.2 var(--f-sans)",
                              color: "var(--ink-soft)",
                              marginTop: 1,
                            }}
                          >
                            {def.hint}
                          </span>
                        )}
                      </span>
                    </label>
                  </div>
                );
              })}
            </div>
            <div
              style={{
                marginTop: 10,
                paddingTop: 10,
                borderTop: "1px solid var(--border)",
                font: "500 10.5px/1.4 var(--f-sans)",
                color: "var(--ink-soft)",
              }}
            >
              ▲▼ reordena · ✓ muestra/oculta. Tu configuración se guarda en este
              navegador.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
