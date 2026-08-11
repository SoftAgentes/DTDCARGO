"use client";

/**
 * ReciboTab · recibo del período (SDD-0113 Slice C/D). LEE de payroll_run_lines
 * (vía RPC get_my_payslip, solo confirmado/pagado) — NO recalcula.
 *   - "Enviar por WhatsApp": wa.me deep-link con resumen (100% client-side).
 *   - "Descargar PDF": link al route server-side `/m/emp/recibo/[period]/pdf`
 *     (@react-pdf/renderer, fail-closed · SDD-0117 Slice A) — PDF real, ya no
 *     window.print(). El bloque `@media print` de abajo queda como fallback de
 *     impresión del navegador (Ctrl+P · scopeado a #recibo-printable).
 */

import { useState, useTransition } from "react";
import { Icon } from "@/app/studio/_components/icons";
import type { MyEmployee, MyPayslip, MyPayslipPeriod } from "@/lib/studio/nomina/employee-self-queries";
import { fetchMyPayslipAction } from "../actions";
import { fmtUsd } from "@/lib/money";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";

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
  const [err, setErr] = useState<string | null>(null);

  function onPeriodChange(period: string) {
    setErr(null);
    startTransition(async () => {
      try {
        const next = await fetchMyPayslipAction(period);
        if (!next) {
          // Período de la lista (confirmado/pagado) que no cargó = error, no "sin recibo".
          // Mantenemos el recibo anterior visible y avisamos.
          setErr("No pudimos cargar ese período. Intenta de nuevo.");
          return;
        }
        setPayslip(next);
      } catch {
        setErr("No pudimos cargar ese período. Intenta de nuevo.");
      }
    });
  }

  if (!payslip) {
    return (
      <EmptyState
        eyebrow="Recibo"
        title="Aún no tienes un recibo confirmado"
        description="Cuando RRHH confirme tu corte de nómina, aparecerá aquí."
      />
    );
  }

  const lines = buildLines(payslip);
  const waText = buildWhatsAppText(me, payslip, lines);
  const waHref = `https://wa.me/?text=${encodeURIComponent(waText)}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Selector de período */}
      {periods.length > 1 && (
        <label data-print-hide style={{ display: "block" }}>
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

      {err && (
        <div data-print-hide style={{ font: "500 12px/1.3 var(--f-sans)", color: "var(--danger)" }}>
          {err}
        </div>
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
          <div style={{ font: "400 11.5px/1.4 var(--f-sans)", color: "var(--ink-soft)", marginTop: 1 }}>
            Estado: {payslip.run_status === "pagado" ? "Pagado" : "Confirmado"}
          </div>
        </div>

        {lines.map((l) => (
          <div
            key={l.label}
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

        <p style={{ font: "400 10.5px/1.4 var(--f-sans)", color: "var(--ink-soft)", marginTop: 10 }}>
          Montos en USD (sueldo indexado). El pago en Bs se calcula a la tasa BCV del día de pago.
          Documento informativo del recibo de nómina.
        </p>
      </div>

      {/* Acciones Slice D — NO van al papel (data-print-hide). */}
      <div data-print-hide style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
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
            padding: "14px 12px",
            font: "700 13px/1 var(--f-sans)",
            textDecoration: "none",
          }}
        >
          {Icon.external(16)} WhatsApp
        </a>
        <a
          href={`/m/emp/recibo/${encodeURIComponent(payslip.period_label)}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
            background: "var(--bg-surface)",
            color: "var(--ink)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md, 10px)",
            padding: "14px 12px",
            font: "700 13px/1 var(--f-sans)",
            textDecoration: "none",
            cursor: "pointer",
          }}
        >
          {Icon.doc(16)} Descargar PDF
        </a>
      </div>

      {/* Print scoped: deja SOLO el recibo en el papel y fuerza tokens de luz
          (la app emp puede estar en tema oscuro · no debe sangrar al PDF).
          Mismo patrón que cobranzas/recibo y rendiciones. */}
      <style>{`
        @media print {
          [data-print-hide] { display: none !important; }
          body * { visibility: hidden !important; }
          #recibo-printable, #recibo-printable * { visibility: visible !important; }
          #recibo-printable {
            --ink: #0F1E3D;
            --ink-soft: #6B6B6B;
            --ink-mute: #9A958C;
            --border: #E8E6E2;
            --bg-surface: #FFFFFF;
            --bg-base: #FBFAF7;
            --danger: #B0142B;
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            border: none;
            border-radius: 0;
            padding: 0;
          }
          * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
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
