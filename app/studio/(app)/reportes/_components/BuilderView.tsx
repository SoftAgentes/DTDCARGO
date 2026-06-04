"use client";

/**
 * Constructor de reportes (SDD-0052 · Slice C) — vista interactiva.
 *
 * El usuario elige FUENTE → AGRUPAR POR (dim) → MÉTRICA → FILTRO y ve una tabla
 * agrupada con total + barras tokenizadas, exportable a CSV. Todo sobre datos
 * REALES (las filas llegan del server ya aplanadas a BuilderRow; la agregación
 * la hace `buildReport`, puro). NUNCA fabrica costos/márgenes (§3.2).
 *
 * - La FUENTE navega por URL (`?src=`) porque cambia las filas que trae el
 *   server. La dim/métrica/filtro son estado local (re-agregan in-memory).
 * - "Guardar reporte" persiste la combinación en localStorage (sin DB, como el
 *   Norte). Aplicar/eliminar guardados desde los chips.
 * - Export CSV con Blob client-side (mismo patrón que Costing · sin lib nueva).
 *
 * Solo primitivas del sistema + tokens var(--*). Mini-barras reusan <Progress>.
 */

import { useEffect, useMemo, useState } from "react";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import {
  REPORT_SOURCES,
  asSourceId,
  buildReport,
  buildReportCsv,
  reportCsvFilename,
  type BuilderRow,
  type ReportSourceId,
} from "@/lib/studio/reports/builder-types";
import { Progress, HeaderRow } from "./charts";

const STORAGE_KEY = "dtd_saved_reports_v1";

/** Una combinación guardada (sin datos; se re-aplica sobre las filas vivas). */
type SavedReport = {
  id: string;
  title: string;
  source: ReportSourceId;
  dimI: number;
  metI: number;
  filterFieldI: number;
  filterVal: string;
};

const fmtUsd = (n: number) =>
  `$${Math.round(n).toLocaleString("en-US")}`;

/** Lee los reportes guardados de localStorage (SSR-safe; [] si no hay window). */
function readSaved(): SavedReport[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedReport[]) : [];
  } catch {
    return [];
  }
}

/** Descarga un archivo de texto en el cliente (sin lib externa). */
function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const lblS: React.CSSProperties = {
  font: "700 9.5px/1 var(--f-sans)",
  color: "var(--ink-soft)",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
};
const selWrap: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 5,
};

/**
 * Botón `×` para quitar un reporte guardado. Touch target 28×28: < 32 del
 * estándar de botones del Studio a propósito (es un `×` en pill compacto, no
 * una acción de primer nivel), pero > 24 del mínimo WCAG 2.2 SC 2.5.8. Hover/
 * focus tokenizado sin tocar el CSS global: el hover vive en estado local
 * (idioma del módulo) porque inline styles no soportan pseudo-clases.
 */
function RemoveButton({ onClick }: { onClick: () => void }) {
  const [hot, setHot] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHot(true)}
      onMouseLeave={() => setHot(false)}
      onFocus={() => setHot(true)}
      onBlur={() => setHot(false)}
      title="Eliminar"
      aria-label="Eliminar reporte guardado"
      style={{
        appearance: "none",
        width: 28,
        height: 28,
        display: "grid",
        placeItems: "center",
        borderRadius: "var(--r-pill)",
        border: "none",
        cursor: "pointer",
        background: hot ? "var(--danger-bg)" : "transparent",
        color: hot ? "var(--danger)" : "var(--ink-mute)",
        font: "700 14px/1 var(--f-sans)",
        transition: "background 0.15s, color 0.15s",
      }}
    >
      ×
    </button>
  );
}

export function BuilderView({
  source,
  rows,
  onSource,
}: {
  source: ReportSourceId;
  rows: BuilderRow[];
  onSource: (src: ReportSourceId) => void;
}) {
  const src = REPORT_SOURCES[source];

  // Estado local de la combinación (la fuente vive en la URL; al cambiarla el
  // componente se remonta vía key={source} → estos vuelven a 0/all sin efecto).
  const [dimI, setDimI] = useState(0);
  const [metI, setMetI] = useState(0);
  const [filterFieldI, setFilterFieldI] = useState(0);
  const [filterVal, setFilterVal] = useState("all");

  // Guardados (localStorage). Inicial [] (determinístico, = SSR → sin mismatch de
  // hidratación); el efecto los rellena tras montar (localStorage es externo a
  // React, este es el caso legítimo de sincronizar con un sistema externo).
  const [saved, setSaved] = useState<SavedReport[]>([]);
  useEffect(() => {
    setSaved(readSaved());
  }, []);
  const persist = (next: SavedReport[]) => {
    setSaved(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* localStorage no disponible → no persiste (sin romper) */
    }
  };

  const dim = src.dims[dimI] ?? src.dims[0];
  const metric = src.metrics[metI] ?? src.metrics[0];
  const filterField = src.filters[filterFieldI] ?? src.filters[0];

  // Valores posibles del filtro activo (de las filas reales, ordenados).
  const filterOpts = useMemo(() => {
    if (!filterField) return ["all"];
    const set = new Set<string>();
    for (const r of rows) {
      const v = r.filters[filterField.key];
      if (v) set.add(v);
    }
    return ["all", ...[...set].sort((a, b) => a.localeCompare(b))];
  }, [rows, filterField]);

  // Agregación PURA sobre las filas (re-agrega al cambiar dim/métrica/filtro).
  const result = useMemo(
    () =>
      buildReport(rows, {
        dim,
        metric,
        filter: filterField ? { key: filterField.key, value: filterVal } : null,
      }),
    [rows, dim, metric, filterField, filterVal],
  );

  const maxV = Math.max(...result.rows.map((r) => r.value), 1);
  const fmtV = (v: number) =>
    result.money
      ? fmtUsd(v)
      : result.agg === "avg"
        ? v.toFixed(1)
        : Math.round(v).toLocaleString("en-US");

  const aggLabel =
    metric.agg === "count" ? "Conteo" : metric.agg === "avg" ? "Promedio" : "Suma";
  const title = `${metric.label} por ${dim.label} · ${src.label}`;

  const exportCsv = () =>
    downloadTextFile(
      reportCsvFilename(source, `${metric.label}-${dim.label}`),
      buildReportCsv(result, { dim: dim.label, metric: metric.label }),
      "text/csv;charset=utf-8",
    );

  const saveReport = () => {
    const rep: SavedReport = {
      id: `R-${Date.now().toString(36)}`,
      title,
      source,
      dimI,
      metI,
      filterFieldI,
      filterVal,
    };
    persist([rep, ...saved].slice(0, 8));
  };
  const applySaved = (r: SavedReport) => {
    if (r.source !== source) {
      onSource(r.source); // recarga del server; los índices se setean al volver
      return;
    }
    setDimI(r.dimI);
    setMetI(r.metI);
    setFilterFieldI(r.filterFieldI);
    setFilterVal(r.filterVal);
  };
  const delSaved = (id: string) => persist(saved.filter((s) => s.id !== id));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Constructor */}
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          padding: "18px 20px",
        }}
      >
        <div
          style={{
            font: "700 10px/1 var(--f-sans)",
            color: "var(--wine)",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            marginBottom: 14,
          }}
        >
          Armá tu reporte
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 12,
            alignItems: "end",
          }}
        >
          <label style={selWrap}>
            <span style={lblS}>1 · Fuente</span>
            <select
              className="studio-input"
              value={source}
              onChange={(e) => onSource(asSourceId(e.target.value))}
            >
              {Object.values(REPORT_SOURCES).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>

          <label style={selWrap}>
            <span style={lblS}>2 · Agrupar por</span>
            <select
              className="studio-input"
              value={String(dimI)}
              onChange={(e) => setDimI(Number(e.target.value))}
            >
              {src.dims.map((d, i) => (
                <option key={d.key} value={String(i)}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>

          <label style={selWrap}>
            <span style={lblS}>3 · Métrica</span>
            <select
              className="studio-input"
              value={String(metI)}
              onChange={(e) => setMetI(Number(e.target.value))}
            >
              {src.metrics.map((m, i) => (
                <option key={`${m.key}-${m.agg}`} value={String(i)}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>

          {src.filters.length > 0 && (
            <label style={selWrap}>
              <span style={lblS}>4 · Filtro</span>
              <select
                className="studio-input"
                value={String(filterFieldI)}
                onChange={(e) => {
                  setFilterFieldI(Number(e.target.value));
                  setFilterVal("all");
                }}
              >
                {src.filters.map((f, i) => (
                  <option key={f.key} value={String(i)}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          {filterField && (
            <label style={selWrap}>
              <span style={lblS}>{filterField.label} =</span>
              <select
                className="studio-input"
                value={filterVal}
                onChange={(e) => setFilterVal(e.target.value)}
              >
                {filterOpts.map((o) => (
                  <option key={o} value={o}>
                    {o === "all" ? "Todos" : o}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 16,
            justifyContent: "flex-end",
            flexWrap: "wrap",
          }}
        >
          <ActionButton
            variant="ghost"
            idleLabel="Exportar CSV"
            successLabel="Descargado"
            disabled={result.rows.length === 0}
            onAction={async () => {
              exportCsv();
            }}
          />
          <ActionButton
            variant="primary"
            idleLabel="Guardar reporte"
            successLabel="Guardado"
            onAction={async () => {
              saveReport();
            }}
          />
        </div>
      </div>

      {/* Resultado — EmptyState honesto (fuente vacía vs filtro sin grupos) o tabla */}
      {result.rows.length === 0 ? (
        rows.length === 0 ? (
          <EmptyState
            eyebrow={src.label}
            title="Sin datos en el período"
            description="No hay registros de esta fuente en el rango seleccionado. Cambiá el período en el header o cargá datos para construir el reporte."
          />
        ) : filterField && filterVal !== "all" ? (
          <EmptyState
            eyebrow="Filtro sin resultados"
            title="El filtro no dejó grupos"
            description={
              <>
                Ningún registro cumple{" "}
                <strong>
                  {filterField.label} = {filterVal}
                </strong>
                . Ajustá o quitá el filtro para ver datos.
              </>
            }
          />
        ) : (
          <EmptyState
            eyebrow={src.label}
            title="Sin grupos para esta combinación"
            description="La fuente tiene registros, pero ninguno aporta a esta agrupación/métrica en el período."
          />
        )
      ) : (
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "16px 20px 14px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ font: "900 15px/1.1 var(--f-display)", color: "var(--ink)" }}>
                {title}
              </div>
              <div
                style={{
                  font: "500 11.5px/1 var(--f-sans)",
                  color: "var(--ink-mute)",
                  marginTop: 4,
                }}
              >
                {result.rows.length}{" "}
                {result.rows.length === 1 ? "grupo" : "grupos"} · total {fmtV(result.total)}
              </div>
            </div>
            <Badge tone="wine" size="md">
              {aggLabel}
            </Badge>
          </div>

          <HeaderRow
            cols="minmax(120px, 200px) 1fr 70px 110px"
            labels={[dim.label, "", "Conteo", metric.label]}
            rightFrom={2}
            rightTo={3}
          />

          {result.rows.slice(0, 20).map((r, i) => (
            <div
              key={`${r.label}-${i}`}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(120px, 200px) 1fr 70px 110px",
                gap: 14,
                padding: "12px 18px",
                alignItems: "center",
                borderTop: i === 0 ? "none" : "1px solid var(--border)",
              }}
            >
              <span
                title={r.label}
                style={{
                  font: "600 12.5px/1.3 var(--f-sans)",
                  color: "var(--ink)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {r.label}
              </span>
              <Progress
                value={(r.value / maxV) * 100}
                tone={i === 0 ? "var(--wine)" : "var(--wine-soft)"}
                height={18}
              />
              <span
                style={{
                  font: "500 11px/1 var(--f-mono)",
                  color: "var(--ink-soft)",
                  textAlign: "right",
                }}
              >
                {r.count}
              </span>
              <span
                style={{
                  font: "800 12.5px/1 var(--f-mono)",
                  color: "var(--ink)",
                  textAlign: "right",
                }}
              >
                {fmtV(r.value)}
              </span>
            </div>
          ))}
          {result.rows.length > 20 && (
            <div
              style={{
                padding: "12px 18px",
                borderTop: "1px solid var(--border)",
                font: "500 11px/1 var(--f-sans)",
                color: "var(--ink-mute)",
              }}
            >
              Mostrando los 20 grupos de mayor valor · el CSV exporta los{" "}
              {result.rows.length}.
            </div>
          )}
        </div>
      )}

      {/* Reportes guardados */}
      {saved.length > 0 && (
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            padding: "18px 20px",
          }}
        >
          <div
            style={{
              font: "700 10px/1 var(--f-sans)",
              color: "var(--wine)",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            Reportes guardados
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {saved.map((r) => (
              <span
                key={r.id}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "3px 4px 3px 12px",
                  background: "var(--bg-elevated)",
                  borderRadius: "var(--r-pill)",
                  border: "1px solid var(--border)",
                }}
              >
                <button
                  type="button"
                  onClick={() => applySaved(r)}
                  style={{
                    appearance: "none",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    font: "600 12px/1 var(--f-sans)",
                    color: "var(--ink)",
                  }}
                >
                  {r.title}
                </button>
                <RemoveButton onClick={() => delSaved(r.id)} />
              </span>
            ))}
          </div>
        </div>
      )}

      <p style={{ font: "500 11.5px/1.5 var(--f-sans)", color: "var(--ink-mute)", margin: 0 }}>
        Todo sobre datos reales del período. Revenue de embarques y montos de
        facturas se normalizan a USD (VES por fx; CNY → 0). Los reportes guardados
        viven en este navegador (no se comparten ni se sincronizan).
      </p>
    </div>
  );
}
