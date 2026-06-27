"use client";

/**
 * ReciboTab · recibo del período (SDD-0113 Slice C/D). LEE de payroll_run_lines
 * (vía RPC get_my_payslip, solo confirmado/pagado) — NO recalcula. Slice D:
 *   - "Enviar por WhatsApp": wa.me deep-link con resumen (100% client-side).
 *   - "Imprimir / PDF": window.print() de una vista imprimible (NO hay lib de PDF
 *     en el repo; el binario PDF dedicado queda diferido — ver impl doc).
 */

import { useState, useTransition } from "react";
import { Icon } from "@/app/studio/_components/icons";
import type { MyEmployee, MyPayslip, MyPayslipPeriod } from "@/lib/studio/nomina/employee-self-queries";
import { fetchMyPayslipAction } from "../actions";
import { fmtUsd } from "./EmpClient";

export function ReciboTab({
  me,
  initialPayslip,
  periods,
}: {
  me: MyEmployee;
  initialPayslip: MyPayslip | null;
  periods: MyPayslipPeriod[];
}) {
  const [payslip, setPayslip] = useState<MyPayslip | null>(initialPayslip);
  const [pending, startTransition] = useTransition();

  function onPeriodChange(period: string) {
    startTransition(async () => {
      const next = await fetchMyPayslipAction(period);
      setPayslip(next);
    });
  }

  if (!payslip) {
    return (
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          padding: "20px 18px",
          font: "400 13px/1.5 var(--f-sans)",
          color: "var(--ink-soft)",
        }}
      >
        Aún no tienes un recibo confirmado. Cuando RRHH confirme tu corte de nómina, aparecerá aquí.
      </div>
    );
  }

  const lines = buildLines(payslip);
  const waText = buildWhatsAppText(me, payslip, lines);
  const waHref = `https://wa.me/?text=${encodeURIComponent(waText)}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Selector de período */}
      {periods.length > 1 && (
        <label style={{ display: "block" }}>
          <span className="studio-label" style={{ display: "block", marginBottom: 4 }}>Período</span>
          <select
            className="studio-input"
            style={{ width: "100%" }}
            defaultValue={payslip.period_label}
            disabled={pending}
            onChange={(e) => onPeriodChange(e.target.value)}
          >
            {periods.map((p) => (
              <option key={p.period_label} value={p.period_label}>
                {p.period_label} · {p.run_status === "pagado" ? "Pagado" : "Confirmado"}
              </option>
            ))}
          </select>
        </label>
      )}

      {/* Vista imprimible del recibo (id printable para window.print scoped CSS) */}
      <div
        id="recibo-printable"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          padding: "16px 16px",
        }}
      >
        <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: 10, marginBottom: 10 }}>
          <div style={{ font: "800 15px/1.2 var(--f-display)", color: "var(--ink)" }}>
            Recibo de pago · {payslip.period_label}
          </div>
          <div style={{ font: "400 12px/1.4 var(--f-sans)", color: "var(--ink-soft)", marginTop: 3 }}>
            {me.full_name} · {me.employee_code}
            {me.national_id ? ` · ${me.national_id}` : ""}
          </div>
          <div style={{ font: "400 11.5px/1.4 var(--f-sans)", color: "var(--ink-mute)", marginTop: 1 }}>
            Estado: {payslip.run_status === "pagado" ? "Pagado" : "Confirmado"}
          </div>
        </div>

        {lines.map((l, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              padding: "5px 0",
              borderTop: l.kind === "total" ? "1px solid var(--border)" : undefined,
              marginTop: l.kind === "total" ? 6 : undefined,
              paddingTop: l.kind === "total" ? 9 : undefined,
            }}
          >
            <span
              style={{
                font: l.kind === "total" ? "700 13px/1.3 var(--f-sans)" : "400 12.5px/1.3 var(--f-sans)",
                color: l.kind === "deduction" ? "var(--danger)" : "var(--ink)",
              }}
            >
              {l.label}
            </span>
            <span
              style={{
                font: l.kind === "total" ? "800 13px/1.3 var(--f-sans)" : "600 12.5px/1.3 var(--f-sans)",
                color: l.kind === "deduction" ? "var(--danger)" : "var(--ink)",
              }}
            >
              {l.kind === "deduction" ? "-" : ""}
              {fmtUsd(Math.abs(l.amount))}
            </span>
          </div>
        ))}

        <p style={{ font: "400 10.5px/1.4 var(--f-sans)", color: "var(--ink-mute)", marginTop: 10 }}>
          Montos en USD (sueldo indexado). El pago en Bs se calcula a la tasa BCV del día de pago.
          Documento informativo del recibo de nómina.
        </p>
      </div>

      {/* Acciones Slice D */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
            background: "var(--ink)",
            color: "var(--ink-inv)",
            borderRadius: "var(--r-md, 10px)",
            padding: "11px 12px",
            font: "700 13px/1 var(--f-sans)",
            textDecoration: "none",
          }}
        >
          {Icon.external(16)} WhatsApp
        </a>
        <button
          type="button"
          onClick={() => window.print()}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
            background: "var(--bg-surface)",
            color: "var(--ink)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md, 10px)",
            padding: "11px 12px",
            font: "700 13px/1 var(--f-sans)",
            cursor: "pointer",
          }}
        >
          {Icon.doc(16)} Imprimir / PDF
        </button>
      </div>
    </div>
  );
}

type ReciboLine = { label: string; amount: number; kind: "earning" | "deduction" | "total" };

/**
 * Arma los renglones del recibo a partir del payslip (NO recalcula montos: los
 * toma tal cual del run_line). Si breakdown viene poblado, lo prefiere; si no,
 * usa los campos agregados del renglón.
 */
function buildLines(p: MyPayslip): ReciboLine[] {
  const lines: ReciboLine[] = [];

  if (Array.isArray(p.breakdown) && p.breakdown.length > 0) {
    for (const b of p.breakdown) {
      if (typeof b?.amount !== "number") continue;
      const kind: ReciboLine["kind"] = b.amount < 0 ? "deduction" : "earning";
      lines.push({ label: b.label ?? "Concepto", amount: b.amount, kind });
    }
  } else {
    lines.push({ label: "Sueldo base", amount: p.base_salary_usd, kind: "earning" });
    if (p.overtime_pay_usd) lines.push({ label: "Horas extra", amount: p.overtime_pay_usd, kind: "earning" });
    if (p.night_pay_usd) lines.push({ label: "Bono nocturno", amount: p.night_pay_usd, kind: "earning" });
    if (p.statutory_deductions_usd)
      lines.push({ label: "Deducciones de ley (SSO/RPE/FAOV)", amount: -p.statutory_deductions_usd, kind: "deduction" });
    if (p.loan_deduction_usd)
      lines.push({ label: "Cuota de préstamo", amount: -p.loan_deduction_usd, kind: "deduction" });
  }

  lines.push({ label: "Neto a cobrar", amount: p.net_usd, kind: "total" });
  return lines;
}

function buildWhatsAppText(me: MyEmployee, p: MyPayslip, lines: ReciboLine[]): string {
  const parts = [
    `*Recibo de pago · ${p.period_label}*`,
    `${me.full_name} (${me.employee_code})`,
    "",
    ...lines
      .filter((l) => l.kind !== "total")
      .map((l) => `${l.kind === "deduction" ? "-" : ""}${l.label}: ${fmtUsd(Math.abs(l.amount))}`),
    "",
    `*Neto a cobrar: ${fmtUsd(p.net_usd)}*`,
    "",
    "Montos en USD · pago en Bs a tasa BCV. DTD Cargo.",
  ];
  return parts.join("\n");
}
