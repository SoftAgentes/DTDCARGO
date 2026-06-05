"use client";

/**
 * Drawer de import de un estado de cuenta del Socio China (SDD-0059 · Slice B2).
 *
 * V1: alta manual de líneas (descripción + monto + moneda + fecha). El parser
 * de archivo (CSV/XLSX) es Slice C — // TODO: upload CSV/XLSX. Al crear, el
 * server corre el match auto (reconcileStatement) y persiste la sugerencia de
 * cada línea, así el operador entra directo a confirmar.
 */

import { useState, useTransition } from "react";
import {
  DrawerShell,
  DrawerFooter,
} from "@/app/studio/_components/ui/drawer/DrawerShell";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { Icon } from "@/app/studio/_components/icons";
import { PARTNER_CURRENCIES } from "@/lib/studio/partner-finance/types";
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
      subtitle="Alta manual de líneas · el sistema sugiere los matches"
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

        {/* TODO: upload CSV/XLSX — Slice C. V1 = alta manual de líneas. */}
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
                  padding: "12px 12px 12px",
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
