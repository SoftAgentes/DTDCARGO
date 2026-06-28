/**
 * SDD-0117 Slice A · Recibo de pago en PDF server-side (@react-pdf/renderer).
 * LEE de MyPayslip (RPC get_my_payslip, ya fail-closed) — NO recalcula. El
 * desglose replica buildLines de ReciboTab. Colores hardcodeados (react-pdf no
 * lee CSS vars) a valores de luz: el PDF es un documento formal, no la app.
 * Fuente = Helvetica (built-in de react-pdf) en V1.
 */

import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { MyPayslip } from "@/lib/studio/nomina/employee-self-queries";

type PayslipLine = {
  label: string;
  amount: number;
  kind: "earning" | "deduction" | "total";
};

/** Mismo desglose que ReciboTab.buildLines (fuente única de la lógica). */
export function buildPayslipLines(p: MyPayslip): PayslipLine[] {
  const lines: PayslipLine[] = [];
  if (Array.isArray(p.breakdown) && p.breakdown.length > 0) {
    for (const b of p.breakdown) {
      if (typeof b?.amount !== "number") continue;
      lines.push({
        label: b.label ?? "Concepto",
        amount: b.amount,
        kind: b.amount < 0 ? "deduction" : "earning",
      });
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

function usd(n: number): string {
  return (
    "$" +
    Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

const NAVY = "#0F1E3D";
const INK = "#1A2433";
const MUTE = "#6B7280";
const DANGER = "#B42318";
const BORDER = "#E5E7EB";

const styles = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 48, paddingHorizontal: 44, fontSize: 10, color: INK },
  header: { borderBottomWidth: 2, borderBottomColor: NAVY, paddingBottom: 12, marginBottom: 16 },
  brand: { fontSize: 16, fontFamily: "Helvetica-Bold", color: NAVY, letterSpacing: 1 },
  docTitle: { fontSize: 13, fontFamily: "Helvetica-Bold", color: INK, marginTop: 6 },
  meta: { fontSize: 9.5, color: MUTE, marginTop: 3 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 9,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: NAVY,
  },
  label: { fontSize: 10.5 },
  totalLabel: { fontSize: 11.5, fontFamily: "Helvetica-Bold" },
  amount: { fontSize: 10.5 },
  totalAmount: { fontSize: 12, fontFamily: "Helvetica-Bold", color: NAVY },
  deduction: { color: DANGER },
  note: { fontSize: 8.5, color: MUTE, marginTop: 20, lineHeight: 1.4 },
});

export function ReciboDocument({ payslip }: { payslip: MyPayslip }) {
  const lines = buildPayslipLines(payslip);
  const estado = payslip.run_status === "pagado" ? "Pagado" : "Confirmado";

  return (
    <Document title={`Recibo ${payslip.period_label}`} author="DTD Cargo">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>DTD CARGO</Text>
          <Text style={styles.docTitle}>Recibo de pago · {payslip.period_label}</Text>
          <Text style={styles.meta}>
            {payslip.employee_name ?? "Empleado"}
            {payslip.employee_code ? ` · ${payslip.employee_code}` : ""}
          </Text>
          <Text style={styles.meta}>Estado: {estado}</Text>
        </View>

        {lines.map((l, i) =>
          l.kind === "total" ? (
            <View key={`${l.label}-${i}`} style={styles.totalRow}>
              <Text style={styles.totalLabel}>{l.label}</Text>
              <Text style={styles.totalAmount}>{usd(l.amount)}</Text>
            </View>
          ) : (
            <View key={`${l.label}-${i}`} style={styles.row}>
              <Text style={[styles.label, ...(l.kind === "deduction" ? [styles.deduction] : [])]}>
                {l.label}
              </Text>
              <Text style={[styles.amount, ...(l.kind === "deduction" ? [styles.deduction] : [])]}>
                {l.kind === "deduction" ? "-" : ""}
                {usd(l.amount)}
              </Text>
            </View>
          ),
        )}

        <Text style={styles.note}>
          Montos en USD (sueldo indexado). El pago en Bs se calcula a la tasa BCV del día de pago.
          Documento informativo del recibo de nómina generado por DTD Cargo.
        </Text>
      </Page>
    </Document>
  );
}
