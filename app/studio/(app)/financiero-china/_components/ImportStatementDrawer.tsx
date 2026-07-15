"use client";

/**
 * Drawer de import de un estado de cuenta del Socio China (SDD-0059 · Slice B2
 * + SDD-0115 Slice C4: parser CSV).
 *
 * Dos caminos a las líneas: (1) subir un CSV del Administrador China → el parser
 * (statement-parser, puro) detecta header + sugiere el mapeo de columnas → el
 * operador confirma/corrige → carga las líneas; (2) alta manual línea por línea
 * (fallback de siempre). En ambos, al crear el server corre el match auto
 * (reconcileStatement) y persiste la sugerencia de cada línea.
 *
 * CSV-only por ahora (XLSX diferido, spec §9 D3-bis); el mapeo no se persiste
 * (per-upload, D3).
 */

import { useState, useTransition } from "react";
import {
  DrawerShell,
  DrawerFooter,
} from "@/app/studio/_components/ui/drawer/DrawerShell";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { Icon } from "@/app/studio/_components/icons";
import { PARTNER_CURRENCIES } from "@/lib/studio/partner-finance/types";
import {
  parseStatementCsv,
  buildLinesFromRows,
  type ParsedStatement,
  type StatementColumnMap,
} from "@/lib/studio/partner-finance/statement-parser";
import type { SupplierOption } from "./FinancieroChinaClient";
import { importStatement } from "../actions";

type DraftLine = {
  key: string;
  raw_description: string;
  raw_description_cn: string;
  amount: string;
  currency: string;
  line_date: string;
};

let lineSeq = 0;
function newLine(): DraftLine {
  lineSeq += 1;
  return {
    key: `l${lineSeq}`,
    raw_description: "",
    raw_description_cn: "",
    amount: "",
    currency: "USD",
    line_date: "",
  };
}

export function ImportStatementDrawer({
  suppliers,
  defaultSupplierId,
  onClose,
}: {
  suppliers: SupplierOption[];
  defaultSupplierId: string | null;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const [supplierId, setSupplierId] = useState(
    defaultSupplierId ?? suppliers[0]?.id ?? "",
  );
  const [periodLabel, setPeriodLabel] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([newLine()]);

  // Estado del parser CSV (Slice C4): el archivo parseado + el mapeo editable.
  const [parsed, setParsed] = useState<ParsedStatement | null>(null);
  const [map, setMap] = useState<StatementColumnMap | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");

  const onFile = async (file: File | null) => {
    setParseError(null);
    if (!file) return;
    setFileName(file.name);
    try {
      const text = await file.text();
      const result = parseStatementCsv(text);
      if (result.rows.length === 0) {
        setParseError("No se encontraron filas con datos en el archivo.");
        setParsed(null);
        setMap(null);
        return;
      }
      setParsed(result);
      setMap(result.suggestedMap);
    } catch {
      setParseError("No pudimos leer el archivo. Verifica que sea un CSV válido.");
      setParsed(null);
      setMap(null);
    }
  };

  const setMapField = (field: keyof StatementColumnMap, value: number | null) =>
    setMap((m) => (m ? { ...m, [field]: value } : m));

  const applyParsedLines = () => {
    if (!parsed || !map) return;
    const built = buildLinesFromRows(parsed.rows, map);
    if (built.length === 0) {
      setParseError("Con este mapeo no se armó ninguna línea. Revisa las columnas.");
      return;
    }
    setLines(
      built.map((b) => {
        lineSeq += 1;
        return {
          key: `l${lineSeq}`,
          raw_description: b.raw_description,
          raw_description_cn: b.raw_description_cn ?? "",
          amount: String(b.amount),
          currency: b.currency,
          line_date: b.line_date ?? "",
        };
      }),
    );
    setParsed(null);
    setMap(null);
    toast.success(`${built.length} línea${built.length === 1 ? "" : "s"} cargada${built.length === 1 ? "" : "s"} desde el CSV`);
  };

  const updateLine = (key: string, patch: Partial<DraftLine>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const removeLine = (key: string) =>
    setLines((ls) => (ls.length > 1 ? ls.filter((l) => l.key !== key) : ls));

  const validLines = lines.filter(
    (l) => l.raw_description.trim() !== "" && l.amount.trim() !== "",
  );
  const canSubmit =
    supplierId !== "" && periodLabel.trim() !== "" && validLines.length > 0;

  // Totales derivados (informativos) para la cabecera.
  const totalUsd = validLines
    .filter((l) => l.currency !== "RMB")
    .reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const totalRmb = validLines
    .filter((l) => l.currency === "RMB")
    .reduce((s, l) => s + (Number(l.amount) || 0), 0);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await importStatement({
        supplier_id: supplierId,
        period_label: periodLabel,
        total_usd: totalUsd,
        total_rmb: totalRmb,
        lines: validLines.map((l) => ({
          raw_description: l.raw_description,
          raw_description_cn: l.raw_description_cn || null,
          amount: Number(l.amount),
          currency: l.currency,
          line_date: l.line_date || null,
        })),
      });
      if (res.error) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success("Estado importado");
      onClose();
    });
  };

  return (
    <DrawerShell
      title="Importar estado de cuenta"
      subtitle="Sube un CSV o carga las líneas a mano · el sistema sugiere los matches"
      onClose={onClose}
      pending={pending}
      width={720}
    >
      <form
        id="fc-import-form"
        onSubmit={onSubmit}
        style={{
          flex: 1,
          overflow: "auto",
          padding: "20px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {error && (
          <div
            style={{
              padding: "10px 12px",
              borderRadius: "var(--r-md)",
              background: "var(--danger-bg)",
              color: "var(--danger)",
              font: "600 12px/1.4 var(--f-sans)",
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 12 }}>
          <div>
            <label className="studio-label" htmlFor="fc-import-supplier">
              Socio
            </label>
            <select
              id="fc-import-supplier"
              className="studio-input"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              required
            >
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} · {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="studio-label" htmlFor="fc-import-period">
              Período
            </label>
            <input
              id="fc-import-period"
              className="studio-input"
              value={periodLabel}
              onChange={(e) => setPeriodLabel(e.target.value)}
              placeholder="Marzo 2026 · Q1…"
              required
            />
          </div>
        </div>

        {/* Upload CSV (Slice C4) · el parser sugiere el mapeo; el operador confirma. */}
        <div
          style={{
            border: "1px dashed var(--border)",
            borderRadius: "var(--r-md)",
            padding: "12px 14px",
            background: "var(--bg-elevated)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div className="studio-eyebrow">Importar desde CSV</div>
              <p style={{ margin: "3px 0 0", font: "400 11.5px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
                Sube el estado de cuenta del socio en CSV. Detectamos las columnas;
                tú confirmas el mapeo. {fileName && <strong>{fileName}</strong>}
              </p>
            </div>
            <label className="studio-btn studio-btn-ghost studio-btn-sm" style={{ cursor: "pointer", flexShrink: 0 }}>
              {Icon.upload(13)} Subir CSV
              <input
                type="file"
                accept=".csv,text/csv"
                style={{ display: "none" }}
                onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          {parseError && (
            <p style={{ margin: "var(--s-2) 0 0", font: "600 11.5px/1.4 var(--f-sans)", color: "var(--danger)" }}>
              {parseError}
            </p>
          )}

          {parsed && map && (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ font: "600 11.5px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
                {parsed.rows.length} fila{parsed.rows.length === 1 ? "" : "s"} ·{" "}
                {parsed.hasHeader ? "encabezado detectado" : "sin encabezado (columnas genéricas)"}. Asigna cada columna:
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
                <MapSelect label="Descripción" field="description" headers={parsed.headers} map={map} onChange={setMapField} />
                <MapSelect label="Descripción 中文" field="descriptionCn" headers={parsed.headers} map={map} onChange={setMapField} />
                <MapSelect label="Monto" field="amount" headers={parsed.headers} map={map} onChange={setMapField} />
                <MapSelect label="Moneda" field="currency" headers={parsed.headers} map={map} onChange={setMapField} />
                <MapSelect label="Fecha" field="date" headers={parsed.headers} map={map} onChange={setMapField} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-start" }}>
                <button
                  type="button"
                  className="studio-btn studio-btn-dark studio-btn-sm"
                  disabled={map.description == null && map.amount == null}
                  onClick={applyParsedLines}
                >
                  {Icon.check(13)} Cargar líneas
                </button>
                <span style={{ font: "400 11px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
                  {map.description == null && map.amount == null
                    ? "Asigna al menos descripción o monto para cargar."
                    : "Reemplaza las líneas actuales del formulario."}
                </span>
              </div>
            </div>
          )}
        </div>

        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <span className="studio-eyebrow">Líneas del estado</span>
            <button
              type="button"
              className="studio-btn studio-btn-ghost studio-btn-xs"
              onClick={() => setLines((ls) => [...ls, newLine()])}
            >
              {Icon.plus(12)} Agregar línea
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {lines.map((l) => (
              <div
                key={l.key}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-md)",
                  padding: "var(--s-3) var(--s-3) var(--s-3)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                  <input
                    className="studio-input"
                    value={l.raw_description}
                    onChange={(e) =>
                      updateLine(l.key, { raw_description: e.target.value })
                    }
                    placeholder="Descripción de la línea"
                  />
                  <button
                    type="button"
                    aria-label="Quitar línea"
                    onClick={() => removeLine(l.key)}
                    disabled={lines.length === 1}
                    className="studio-btn studio-btn-ghost studio-btn-xs"
                  >
                    {Icon.trash(13)}
                  </button>
                </div>
                <input
                  className="studio-input"
                  value={l.raw_description_cn}
                  onChange={(e) =>
                    updateLine(l.key, { raw_description_cn: e.target.value })
                  }
                  placeholder="描述 (opcional · chino)"
                />
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.2fr 0.8fr 1fr",
                    gap: 8,
                  }}
                >
                  <input
                    className="studio-input"
                    type="number"
                    step="0.01"
                    value={l.amount}
                    onChange={(e) => updateLine(l.key, { amount: e.target.value })}
                    placeholder="Monto"
                  />
                  <select
                    className="studio-input"
                    value={l.currency}
                    onChange={(e) => updateLine(l.key, { currency: e.target.value })}
                  >
                    {PARTNER_CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <input
                    className="studio-input"
                    type="date"
                    value={l.line_date}
                    onChange={(e) => updateLine(l.key, { line_date: e.target.value })}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Resumen de totales */}
        <div
          style={{
            display: "flex",
            gap: 20,
            padding: "12px 14px",
            background: "var(--bg-elevated)",
            borderRadius: "var(--r-md)",
          }}
        >
          <Total label="Líneas válidas" value={String(validLines.length)} />
          <Total
            label="Total USD"
            value={`$${totalUsd.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
          />
          <Total
            label="Total RMB"
            value={`¥${totalRmb.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
          />
        </div>
      </form>

      <DrawerFooter
        formId="fc-import-form"
        onClose={onClose}
        isPending={pending}
        canSubmit={canSubmit}
        submitLabel="Importar y reconciliar"
      />
    </DrawerShell>
  );
}

function MapSelect({
  label,
  field,
  headers,
  map,
  onChange,
}: {
  label: string;
  field: keyof StatementColumnMap;
  headers: string[];
  map: StatementColumnMap;
  onChange: (field: keyof StatementColumnMap, value: number | null) => void;
}) {
  const value = map[field];
  return (
    <label style={{ display: "block" }}>
      <span className="studio-label" style={{ display: "block", marginBottom: 3 }}>{label}</span>
      <select
        className="studio-input"
        value={value == null ? "" : String(value)}
        onChange={(e) => onChange(field, e.target.value === "" ? null : Number(e.target.value))}
      >
        <option value="">— ninguna —</option>
        {headers.map((h, i) => (
          <option key={i} value={i}>
            {h}
          </option>
        ))}
      </select>
    </label>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        style={{
          font: "700 9.5px/1 var(--f-sans)",
          color: "var(--ink-soft)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: 5,
        }}
      >
        {label}
      </div>
      <div style={{ font: "800 14px/1 var(--f-mono)", color: "var(--ink)" }}>
        {value}
      </div>
    </div>
  );
}
