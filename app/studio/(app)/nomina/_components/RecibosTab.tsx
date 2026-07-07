"use client";

/**
 * RecibosTab — corte de nómina del período (SDD-0103 · Slice motor —
 * ESTRUCTURA). Lista de cortes con Badge de estado + el detalle del corte =
 * tabla de renglones (los recibos BORRADOR/ADVISORY: empleado, base, extras,
 * deducciones, neto). Transiciones de estado (confirmar/pagar/anular),
 * regenerar (si borrador) y eliminar.
 *
 * El cálculo es advisory/mecánico (no incluye bonos salariales ni asiento
 * contable) — lo dice la UI de forma explícita.
 */

import { useState, useTransition, useEffect } from "react";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import {
  payrollRunStatusLabel,
  payrollRunStatusTone,
  payFrequencyLabel,
  dayMethodLabel,
  canTransitionPayrollRun,
  type PayrollRun,
  type PayrollRunLine,
} from "@/lib/studio/nomina/payroll-run-types";
import {
  setPayrollRunStatusAction,
  regeneratePayrollRunLinesAction,
  softDeletePayrollRunAction,
  listPayrollRunLinesAction,
} from "../actions";

function fmtUsd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? iso + "T00:00:00" : iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-VE", { day: "2-digit", month: "short", year: "numeric" });
}

const RUN_COLS = "minmax(140px,1fr) minmax(150px,1.2fr) 110px 110px 110px 110px";

export function RecibosTab({
  runs,
  onNew,
}: {
  runs: PayrollRun[];
  onNew: () => void;
}) {
  const [selected, setSelected] = useState<PayrollRun | null>(null);

  if (selected) {
    return (
      <CorteDetalle
        run={selected}
        onBack={() => setSelected(null)}
      />
    );
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "var(--s-4)",
          gap: "var(--s-3)",
          flexWrap: "wrap",
        }}
      >
        <div style={{ font: "500 12.5px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
          {runs.length === 0
            ? "Sin cortes."
            : `${runs.length} ${runs.length === 1 ? "corte" : "cortes"}`}
        </div>
        <button type="button" className="studio-btn studio-btn-primary" onClick={onNew}>
          + Generar corte
        </button>
      </div>

      {runs.length === 0 ? (
        <EmptyState
          eyebrow="Sin cortes"
          title="Aún no generas la nómina del período."
          description="Genera el corte de un período: se congela las reglas vigentes y se computa el recibo borrador de cada empleado activo (cálculo mecánico, advisory). El asiento contable y el criterio salarial quedan para una pasada con el contador."
          action={
            <button type="button" className="studio-btn studio-btn-primary" onClick={onNew}>
              + Generar corte
            </button>
          }
        />
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
              display: "grid",
              gridTemplateColumns: RUN_COLS,
              gap: 12,
              padding: "10px 20px",
              font: "700 9.5px/1 var(--f-sans)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--ink-soft)",
              borderBottom: "1px solid var(--border)",
              background: "var(--bg-elevated)",
            }}
          >
            <span>Período</span>
            <span>Rango · frecuencia</span>
            <span style={{ textAlign: "right" }}>Bruto</span>
            <span style={{ textAlign: "right" }}>Neto</span>
            <span>Estado</span>
            <span style={{ textAlign: "right" }}>Acciones</span>
          </div>
          {runs.map((run, i) => (
            <CorteRow
              key={run.id}
              run={run}
              first={i === 0}
              onOpen={() => setSelected(run)}
            />
          ))}
        </div>
      )}
    </>
  );
}

function CorteRow({
  run,
  first,
  onOpen,
}: {
  run: PayrollRun;
  first: boolean;
  onOpen: () => void;
}) {
  const dimmed = run.status === "anulado";
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: RUN_COLS,
        gap: 12,
        padding: "12px 20px",
        alignItems: "center",
        borderTop: first ? 0 : "1px solid var(--border)",
        opacity: dimmed ? 0.6 : 1,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ font: "700 13px/1.2 var(--f-mono)", color: "var(--ink)" }}>
          {run.period_label}
        </div>
        <div style={{ font: "600 10.5px/1.3 var(--f-sans)", color: "var(--ink-soft)" }}>
          {payFrequencyLabel(run.pay_frequency)}
        </div>
      </div>
      <div style={{ font: "500 12px/1.4 var(--f-sans)", color: "var(--ink-soft)", minWidth: 0 }}>
        {fmtDate(run.period_start)} – {fmtDate(run.period_end)}
        <span style={{ color: "var(--ink-soft)" }}> · {dayMethodLabel(run.day_method)}</span>
      </div>
      <span style={{ font: "700 12.5px/1 var(--f-mono)", color: "var(--ink)", textAlign: "right" }}>
        {fmtUsd(run.total_gross_usd)}
      </span>
      <span style={{ font: "700 12.5px/1 var(--f-mono)", color: "var(--ink)", textAlign: "right" }}>
        {fmtUsd(run.total_net_usd)}
      </span>
      <Badge tone={payrollRunStatusTone(run.status)} size="sm">
        {payrollRunStatusLabel(run.status)}
      </Badge>
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
        <button
          type="button"
          onClick={onOpen}
          className="studio-btn studio-btn-ghost studio-btn-sm"
          style={{ padding: "6px 10px" }}
        >
          Ver recibos
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Detalle del corte = tabla de renglones (recibos)
// ─────────────────────────────────────────────────────────────
const LINE_COLS =
  "minmax(180px,1.4fr) 96px 96px 110px 110px 110px";

function CorteDetalle({ run, onBack }: { run: PayrollRun; onBack: () => void }) {
  const [lines, setLines] = useState<PayrollRunLine[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let alive = true;
    listPayrollRunLinesAction(run.id).then((res) => {
      if (!alive) return;
      if (res.error) setLoadError(res.error);
      else setLines(res.lines ?? []);
    });
    return () => {
      alive = false;
    };
  }, [run.id]);

  const transition = (to: Parameters<typeof setPayrollRunStatusAction>[1]) => {
    setActionError(null);
    startTransition(async () => {
      const res = await setPayrollRunStatusAction(run.id, to);
      if (res.error) setActionError(res.error);
      else onBack();
    });
  };

  const regenerate = () => {
    setActionError(null);
    startTransition(async () => {
      const res = await regeneratePayrollRunLinesAction(run.id);
      if (res.error) setActionError(res.error);
      else onBack();
    });
  };

  const remove = () => {
    setActionError(null);
    startTransition(async () => {
      const res = await softDeletePayrollRunAction(run.id);
      if (res.error) setActionError(res.error);
      else onBack();
    });
  };

  const canConfirm = canTransitionPayrollRun(run.status, "confirmado");
  const canPay = canTransitionPayrollRun(run.status, "pagado");
  const canAnular = canTransitionPayrollRun(run.status, "anulado");
  const isDraft = run.status === "borrador";

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="studio-btn studio-btn-ghost studio-btn-sm"
        style={{ marginBottom: "var(--s-4)" }}
      >
        ← Volver a los cortes
      </button>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "var(--s-3)",
          flexWrap: "wrap",
          marginBottom: "var(--s-4)",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--s-3)", marginBottom: 4 }}>
            <h2 className="studio-display" style={{ fontSize: 18, margin: 0, color: "var(--ink)" }}>
              Corte {run.period_label}
            </h2>
            <Badge tone={payrollRunStatusTone(run.status)} size="sm">
              {payrollRunStatusLabel(run.status)}
            </Badge>
          </div>
          <div style={{ font: "500 12px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
            {fmtDate(run.period_start)} – {fmtDate(run.period_end)} ·{" "}
            {payFrequencyLabel(run.pay_frequency)} · {dayMethodLabel(run.day_method)}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {isDraft && (
            <button
              type="button"
              onClick={regenerate}
              disabled={isPending}
              className="studio-btn studio-btn-ghost studio-btn-sm"
            >
              Regenerar recibos
            </button>
          )}
          {canConfirm && (
            <button
              type="button"
              onClick={() => transition("confirmado")}
              disabled={isPending}
              className="studio-btn studio-btn-dark studio-btn-sm"
            >
              Confirmar corte
            </button>
          )}
          {canPay && (
            <button
              type="button"
              onClick={() => transition("pagado")}
              disabled={isPending}
              className="studio-btn studio-btn-primary studio-btn-sm"
            >
              Marcar pagado
            </button>
          )}
          {canAnular && (
            <button
              type="button"
              onClick={() => transition("anulado")}
              disabled={isPending}
              className="studio-btn studio-btn-danger studio-btn-sm"
            >
              Anular
            </button>
          )}
          {run.status === "anulado" && (
            <button
              type="button"
              onClick={remove}
              disabled={isPending}
              className="studio-btn studio-btn-ghost studio-btn-sm"
            >
              Eliminar
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <p
          role="alert"
          style={{
            font: "500 12px/1.4 var(--f-sans)",
            color: "var(--danger)",
            padding: "10px 12px",
            background: "var(--danger-bg)",
            border: "1px solid var(--danger)",
            borderRadius: "var(--r-sm)",
            margin: "0 0 var(--s-4)",
          }}
        >
          {actionError}
        </p>
      )}

      {/* Totales del corte */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "var(--s-3)",
          marginBottom: "var(--s-5)",
        }}
      >
        <TotalCard label="Bruto" value={fmtUsd(run.total_gross_usd)} />
        <TotalCard label="Deducciones" value={fmtUsd(run.total_deductions_usd)} />
        <TotalCard label="Neto a pagar" value={fmtUsd(run.total_net_usd)} />
      </div>

      <p
        style={{
          font: "400 11.5px/1.5 var(--f-sans)",
          color: "var(--ink-soft)",
          margin: "0 0 var(--s-4)",
          maxWidth: "70ch",
        }}
      >
        Recibos en <strong>borrador / advisory</strong>: cálculo mecánico (prorrateo, horas
        extra/nocturnas y deducciones sobre el sueldo base con sus topes; cuota de préstamo capada al
        saldo). No incluye bonos salariales (criterio del contador) ni genera asiento contable.
      </p>

      {loadError ? (
        <p style={{ font: "500 12.5px/1.4 var(--f-sans)", color: "var(--danger)" }}>{loadError}</p>
      ) : lines === null ? (
        <p style={{ font: "500 12.5px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
          Cargando recibos…
        </p>
      ) : lines.length === 0 ? (
        <EmptyState
          eyebrow="Sin recibos"
          title="El corte no tiene renglones."
          description="No había empleados activos al generar el corte. Regenera tras registrar empleados."
        />
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
              display: "grid",
              gridTemplateColumns: LINE_COLS,
              gap: 12,
              padding: "10px 20px",
              font: "700 9.5px/1 var(--f-sans)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--ink-soft)",
              borderBottom: "1px solid var(--border)",
              background: "var(--bg-elevated)",
            }}
          >
            <span>Empleado</span>
            <span style={{ textAlign: "right" }}>Base</span>
            <span style={{ textAlign: "right" }}>Extras</span>
            <span style={{ textAlign: "right" }}>Deducciones</span>
            <span style={{ textAlign: "right" }}>Cuota</span>
            <span style={{ textAlign: "right", color: "var(--ink-soft)" }}>Neto</span>
          </div>
          {lines.map((l, i) => (
            <ReciboRow key={l.id} l={l} first={i === 0} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReciboRow({ l, first }: { l: PayrollRunLine; first: boolean }) {
  const extras = l.overtime_pay_usd + l.night_pay_usd;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: LINE_COLS,
        gap: 12,
        padding: "12px 20px",
        alignItems: "center",
        borderTop: first ? 0 : "1px solid var(--border)",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            font: "700 13px/1.2 var(--f-sans)",
            color: "var(--ink)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {l.employee_name ?? "Empleado"}
        </div>
        <div style={{ font: "600 11px/1.3 var(--f-mono)", color: "var(--ink-soft)" }}>
          {l.employee_code ?? "—"} · {l.worked_days} día(s)
        </div>
      </div>
      <span style={{ font: "600 12.5px/1 var(--f-mono)", color: "var(--ink-soft)", textAlign: "right" }}>
        {fmtUsd(l.base_salary_usd)}
      </span>
      <span style={{ font: "600 12.5px/1 var(--f-mono)", color: "var(--ink-soft)", textAlign: "right" }}>
        {fmtUsd(extras)}
      </span>
      <span style={{ font: "600 12.5px/1 var(--f-mono)", color: "var(--ink-soft)", textAlign: "right" }}>
        {fmtUsd(l.statutory_deductions_usd)}
      </span>
      <span style={{ font: "600 12.5px/1 var(--f-mono)", color: "var(--ink-soft)", textAlign: "right" }}>
        {fmtUsd(l.loan_deduction_usd)}
      </span>
      <span style={{ font: "800 15px/1 var(--f-mono)", color: "var(--ink)", textAlign: "right" }}>
        {fmtUsd(l.net_usd)}
      </span>
    </div>
  );
}

function TotalCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: "14px 16px",
      }}
    >
      <div
        style={{
          font: "700 9.5px/1 var(--f-sans)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--ink-soft)",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div style={{ font: "800 18px/1 var(--f-mono)", color: "var(--ink)" }}>{value}</div>
    </div>
  );
}
