"use client";

/**
 * Editor del dashboard (SDD-0114 · Slice B) — sobre DrawerShell.
 *
 * Dos tabs: KPIs (drag-to-reorder + agregar/quitar, agrupados por categoría) y
 * Widgets (switches por columna). "Restaurar defaults" con confirmación INLINE
 * (sin window.confirm — deuda técnica del Studio). Todo cambio sube al
 * orquestador vía callbacks → estado optimista + autosave a DB.
 *
 * Solo el catálogo ACCESIBLE (RBAC) se ofrece: un usuario que no ve Nómina no
 * encuentra sus KPIs/widget acá.
 */

import { useState } from "react";
import { Aviso } from "@/app/studio/_components/ui/Aviso";
import { DrawerShell } from "@/app/studio/_components/ui/drawer/DrawerShell";
import { Icon } from "@/app/studio/_components/icons";
import {
  MAX_KPIS,
  kpiById,
  type KpiCatalogEntry,
  type WidgetCatalogEntry,
} from "@/lib/studio/dashboard/dashboard-catalog";
import type { DashboardConfig } from "@/lib/studio/dashboard/dashboard-types";

function DragHandle() {
  return (
    <svg width="12" height="14" viewBox="0 0 12 14" fill="none" aria-hidden>
      {[3, 7, 11].map((cy) =>
        [3, 9].map((cx) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.2" fill="currentColor" />),
      )}
    </svg>
  );
}

export function DashboardEditorDrawer({
  open,
  onClose,
  config,
  accessibleKpis,
  accessibleWidgets,
  onToggleKpi,
  onMoveKpi,
  onToggleWidget,
  onReset,
}: {
  open: boolean;
  onClose: () => void;
  config: DashboardConfig;
  accessibleKpis: KpiCatalogEntry[];
  accessibleWidgets: WidgetCatalogEntry[];
  onToggleKpi: (id: string) => void;
  onMoveKpi: (from: number, to: number) => void;
  onToggleWidget: (id: string) => void;
  onReset: () => void;
}) {
  const [tab, setTab] = useState<"kpis" | "widgets">("kpis");
  const [confirmingReset, setConfirmingReset] = useState(false);

  if (!open) return null;

  return (
    <DrawerShell
      title="Configurar dashboard"
      subtitle={`${config.kpis.length} KPI(s) · ${config.widgets.length} widget(s)`}
      onClose={onClose}
      pending={false}
      width={520}
    >
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        {/* Tabs */}
        <div
          role="group"
          aria-label="Secciones del editor"
          className="studio-tabs"
          style={{ margin: "14px 22px 0" }}
        >
          {(
            [
              { value: "kpis", label: "KPIs", count: config.kpis.length },
              { value: "widgets", label: "Widgets", count: config.widgets.length },
            ] as const
          ).map((t) => {
            const active = tab === t.value;
            return (
              <button
                key={t.value}
                type="button"
                aria-pressed={active}
                data-activa={active ? "true" : undefined}
                onClick={() => setTab(t.value)}
                className="studio-tab"
              >
                {t.label} <span className="studio-tab-n">· {t.count}</span>
              </button>
            );
          })}
        </div>

        {/* Body scroll */}
        <div style={{ flex: 1, overflowY: "auto", padding: 22 }}>
          {tab === "kpis" ? (
            <KpiEditor
              config={config}
              accessibleKpis={accessibleKpis}
              onToggleKpi={onToggleKpi}
              onMoveKpi={onMoveKpi}
            />
          ) : (
            <WidgetEditor config={config} accessibleWidgets={accessibleWidgets} onToggleWidget={onToggleWidget} />
          )}
        </div>

        {/* Footer */}
        <footer
          style={{
            padding: "14px 22px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
            background: "var(--bg-surface)",
            flexShrink: 0,
          }}
        >
          {confirmingReset ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ font: "500 12px/1.3 var(--f-sans)", color: "var(--ink-soft)" }}>¿Restaurar?</span>
              <button
                type="button"
                className="studio-btn studio-btn-ghost studio-btn-sm"
                onClick={() => setConfirmingReset(false)}
              >
                No
              </button>
              <button
                type="button"
                className="studio-btn studio-btn-danger studio-btn-sm"
                onClick={() => {
                  onReset();
                  setConfirmingReset(false);
                }}
              >
                Sí, restaurar
              </button>
            </div>
          ) : (
            <button type="button" className="studio-btn studio-btn-ghost" onClick={() => setConfirmingReset(true)}>
              Restaurar defaults
            </button>
          )}
          <button type="button" className="studio-btn studio-btn-primary" onClick={onClose}>
            Listo
          </button>
        </footer>
      </div>
    </DrawerShell>
  );
}

// ── Tab KPIs ──────────────────────────────────────────────────
function KpiEditor({
  config,
  accessibleKpis,
  onToggleKpi,
  onMoveKpi,
}: {
  config: DashboardConfig;
  accessibleKpis: KpiCatalogEntry[];
  onToggleKpi: (id: string) => void;
  onMoveKpi: (from: number, to: number) => void;
}) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const selected = new Set(config.kpis);
  const available = accessibleKpis.filter((k) => !selected.has(k.id));
  const atMax = config.kpis.length >= MAX_KPIS;

  const byCat = available.reduce<Record<string, KpiCatalogEntry[]>>((acc, k) => {
    (acc[k.cat] = acc[k.cat] || []).push(k);
    return acc;
  }, {});

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <section>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span className="studio-eyebrow" style={{ color: "var(--wine-text)" }}>
            EN EL DASHBOARD · {config.kpis.length}/{MAX_KPIS}
          </span>
          <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
          {config.kpis.length > 1 && (
            <span style={{ font: "500 11px/1 var(--f-sans)", color: "var(--ink-mute)" }}>Arrastra para reordenar</span>
          )}
        </div>
        {config.kpis.length === 0 ? (
          <div
            style={{
              padding: "20px 16px",
              textAlign: "center",
              border: "1px dashed var(--border-strong)",
              borderRadius: "var(--r-md)",
              font: "500 12px/1.4 var(--f-sans)",
              color: "var(--ink-mute)",
            }}
          >
            No hay KPIs seleccionados. Agrega alguno de la lista de abajo.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {config.kpis.map((id, idx) => {
              const meta = kpiById(id);
              if (!meta) return null;
              const isOver = overIdx === idx && dragIdx !== idx;
              return (
                <div
                  key={id}
                  draggable
                  onDragStart={(e) => {
                    setDragIdx(idx);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setOverIdx(idx);
                  }}
                  onDragLeave={() => setOverIdx(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragIdx != null && dragIdx !== idx) onMoveKpi(dragIdx, idx);
                    setDragIdx(null);
                    setOverIdx(null);
                  }}
                  onDragEnd={() => {
                    setDragIdx(null);
                    setOverIdx(null);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    background: isOver ? "var(--wine-tint)" : "var(--bg-surface)",
                    border: `1px solid ${isOver ? "var(--wine)" : "var(--border)"}`,
                    borderRadius: "var(--r-md)",
                    cursor: "grab",
                    opacity: dragIdx === idx ? 0.4 : 1,
                  }}
                >
                  <span style={{ color: "var(--ink-mute)", display: "flex" }} aria-hidden>
                    <DragHandle />
                  </span>
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "var(--r-sm)",
                      background: `var(--${meta.tone}-bg)`,
                      color: `var(--${meta.tone})`,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {(Icon as Record<string, ((n?: number) => React.ReactNode) | undefined>)[meta.icon]?.(14)}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: "600 13px/1.2 var(--f-sans)", color: "var(--ink)" }}>{meta.label}</div>
                    <div style={{ font: "500 10.5px/1 var(--f-sans)", color: "var(--ink-mute)", marginTop: 3, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      {meta.cat}
                      {meta.status === "wip" && " · próximamente"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onMoveKpi(idx, idx - 1)}
                    disabled={idx === 0}
                    aria-label={`Subir ${meta.label}`}
                    className="studio-btn studio-btn-ghost studio-btn-sm"
                    style={{ padding: 6, minWidth: 0 }}
                  >
                    <span aria-hidden style={{ font: "600 13px/1 var(--f-sans)" }}>
                      ↑
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onMoveKpi(idx, idx + 1)}
                    disabled={idx === config.kpis.length - 1}
                    aria-label={`Bajar ${meta.label}`}
                    className="studio-btn studio-btn-ghost studio-btn-sm"
                    style={{ padding: 6, minWidth: 0 }}
                  >
                    <span aria-hidden style={{ font: "600 13px/1 var(--f-sans)" }}>
                      ↓
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleKpi(id)}
                    aria-label={`Quitar ${meta.label}`}
                    className="studio-btn studio-btn-ghost studio-btn-sm"
                    style={{ padding: 6 }}
                  >
                    {Icon.close(12)}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {available.length > 0 && (
        <section>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span className="studio-eyebrow">DISPONIBLES · {available.length}</span>
            <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
          </div>
          {atMax && (
            <div style={{ marginBottom: 12 }}>
              <Aviso tono="info" compacto>
                Llegaste al tope de {MAX_KPIS} KPIs. Quita alguno para agregar otro.
              </Aviso>
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {Object.entries(byCat).map(([cat, items]) => (
              <div key={cat}>
                <div style={{ font: "700 10.5px/1 var(--f-sans)", color: "var(--ink-mute)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
                  {cat}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {items.map((meta) => (
                    <button
                      key={meta.id}
                      type="button"
                      disabled={atMax}
                      onClick={() => onToggleKpi(meta.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: "var(--r-md)",
                        border: "1px solid transparent",
                        background: "transparent",
                        textAlign: "left",
                        cursor: atMax ? "not-allowed" : "pointer",
                        opacity: atMax ? 0.5 : 1,
                      }}
                    >
                      <span
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: "var(--r-sm)",
                          background: `var(--${meta.tone}-bg)`,
                          color: `var(--${meta.tone})`,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {(Icon as Record<string, ((n?: number) => React.ReactNode) | undefined>)[meta.icon]?.(13)}
                      </span>
                      <span style={{ flex: 1, font: "500 12.5px/1 var(--f-sans)", color: "var(--ink-soft)" }}>{meta.label}</span>
                      <span style={{ color: "var(--wine-text)", display: "inline-flex" }}>{Icon.plus(13)}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ── Tab Widgets ───────────────────────────────────────────────
function WidgetEditor({
  config,
  accessibleWidgets,
  onToggleWidget,
}: {
  config: DashboardConfig;
  accessibleWidgets: WidgetCatalogEntry[];
  onToggleWidget: (id: string) => void;
}) {
  const enabled = new Set(config.widgets);
  const left = accessibleWidgets.filter((w) => w.side === "left");
  const right = accessibleWidgets.filter((w) => w.side === "right");

  const Row = ({ w }: { w: WidgetCatalogEntry }) => {
    const on = enabled.has(w.id);
    return (
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => onToggleWidget(w.id)}
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          padding: "12px 14px",
          width: "100%",
          textAlign: "left",
          background: on ? "var(--bg-surface)" : "transparent",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-md)",
          cursor: "pointer",
        }}
      >
        <span
          style={{
            width: 34,
            height: 20,
            borderRadius: 999,
            background: on ? "var(--wine)" : "var(--border-strong)",
            position: "relative",
            flexShrink: 0,
            marginTop: 1,
            transition: "background var(--dur-fast) var(--ease)",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 2,
              left: on ? 16 : 2,
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: "var(--bg-surface)",
              boxShadow: "var(--shadow-sm)",
              transition: "left var(--dur-fast) var(--ease)",
            }}
          />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: "600 13px/1.2 var(--f-sans)", color: "var(--ink)" }}>{w.label}</div>
          <div style={{ font: "500 11.5px/1.4 var(--f-sans)", color: "var(--ink-mute)", marginTop: 3 }}>{w.desc}</div>
        </div>
      </button>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {left.length > 0 && (
        <section>
          <div className="studio-eyebrow" style={{ color: "var(--wine-text)", marginBottom: 10 }}>
            COLUMNA PRINCIPAL · 2/3
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {left.map((w) => (
              <Row key={w.id} w={w} />
            ))}
          </div>
        </section>
      )}
      {right.length > 0 && (
        <section>
          <div className="studio-eyebrow" style={{ color: "var(--wine-text)", marginBottom: 10 }}>
            COLUMNA LATERAL · 1/3
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {right.map((w) => (
              <Row key={w.id} w={w} />
            ))}
          </div>
        </section>
      )}
      <Aviso tono="info" compacto>
        Si dejas una columna vacía, la otra ocupa todo el ancho.
      </Aviso>
    </div>
  );
}
