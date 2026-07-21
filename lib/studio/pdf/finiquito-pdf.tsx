/**
 * SDD-0117 Slice B · Finiquito (liquidación LOTTT) en PDF server-side.
 * LEE de Settlement + SettlementLine (ya computados por SDD-0109) — NO recalcula.
 * Membrete legal del empleador. Solo lo genera admin/accounting (gate del route).
 */

import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { Settlement, SettlementLine } from "@/lib/studio/nomina/settlement-types";
import {
  settlementStatusLabel,
  terminationCauseLabel,
} from "@/lib/studio/nomina/settlement-types";
import { PDF, usd, Membrete } from "./pdf-doc";

const styles = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 48, paddingHorizontal: 44, fontSize: 10, color: PDF.INK },
  sectionTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: PDF.MUTE,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 14,
    marginBottom: 4,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4.5,
    borderBottomWidth: 0.5,
    borderBottomColor: PDF.BORDER,
  },
  label: { fontSize: 10.5 },
  days: { fontSize: 8.5, color: PDF.MUTE },
  amount: { fontSize: 10.5 },
  deduction: { color: PDF.DANGER },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 9,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: PDF.NAVY,
  },
  totalLabel: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  totalAmount: { fontSize: 13, fontFamily: "Helvetica-Bold", color: PDF.NAVY },
  subTotal: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  subLabel: { fontSize: 10 },
  note: { fontSize: 8.5, color: PDF.MUTE, marginTop: 20, lineHeight: 1.4 },
});

/** Filas de resumen (totales) — omite las que son 0 salvo prestaciones y neto. */
function summaryRows(s: Settlement): { label: string; amount: number; deduction?: boolean }[] {
  const rows: { label: string; amount: number; deduction?: boolean }[] = [
    { label: "Salario integral / mes", amount: s.salario_integral_usd },
    { label: "Prestaciones (Art. 142)", amount: s.total_prestaciones_usd },
  ];
  if (s.total_fracciones_usd) rows.push({ label: "Fracciones (vac. / bono vac. / utilidades)", amount: s.total_fracciones_usd });
  if (s.total_indemnizacion_usd) rows.push({ label: "Indemnización (Art. 92)", amount: s.total_indemnizacion_usd });
  if (s.total_intereses_usd) rows.push({ label: "Intereses sobre prestaciones", amount: s.total_intereses_usd });
  if (s.total_deductions_usd) rows.push({ label: "Deducciones (préstamos, etc.)", amount: -s.total_deductions_usd, deduction: true });
  return rows;
}

export function FiniquitoDocument({
  settlement,
  lines,
}: {
  settlement: Settlement;
  lines: SettlementLine[];
}) {
  const s = settlement;
  return (
    <Document title={`Finiquito ${s.settlement_code}`} author="DTD Cargo">
      <Page size="A4" style={styles.page}>
        <Membrete
          docTitle={`Finiquito · ${s.settlement_code}`}
          metaLines={[
            `${s.employee_name} · ${s.employee_code}`,
            `Causa de terminación: ${terminationCauseLabel(s.termination_cause)}`,
            `Ingreso: ${s.hire_date} · Egreso: ${s.termination_date}`,
            `Estado: ${settlementStatusLabel(s.status)}`,
          ]}
        />

        <Text style={styles.sectionTitle}>Desglose</Text>
        {lines.map((l, i) => {
          const isDed = l.amount_usd < 0;
          return (
            <View key={`${l.kind}-${i}`} style={styles.row}>
              <View>
                <Text style={[styles.label, ...(isDed ? [styles.deduction] : [])]}>{l.label}</Text>
                {l.days != null ? <Text style={styles.days}>{l.days} días</Text> : null}
              </View>
              <Text style={[styles.amount, ...(isDed ? [styles.deduction] : [])]}>
                {isDed ? "-" : ""}
                {usd(l.amount_usd)}
              </Text>
            </View>
          );
        })}

        <Text style={styles.sectionTitle}>Resumen</Text>
        {summaryRows(s).map((r, i) => (
          <View key={`${i}-${r.label}`} style={styles.subTotal}>
            <Text style={[styles.subLabel, ...(r.deduction ? [styles.deduction] : [])]}>{r.label}</Text>
            <Text style={[styles.subLabel, ...(r.deduction ? [styles.deduction] : [])]}>
              {r.deduction ? "-" : ""}
              {usd(r.amount)}
            </Text>
          </View>
        ))}

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Neto a pagar</Text>
          <Text style={styles.totalAmount}>{usd(s.total_net_usd)}</Text>
        </View>

        {/* Sin razón social ni RIF en texto visible (regla de marca, founder
            2026-07-20 · "por ahora"): si el finiquito necesita la identidad
            legal completa para trámites LOTTT, es una excepción a pedir
            explícitamente, no la regla por defecto. */}
        <Text style={styles.note}>
          Liquidación de prestaciones sociales conforme a la LOTTT. Montos en USD; el pago en Bs se
          calcula a la tasa BCV del día de pago. Documento emitido por DTD Cargo.
        </Text>
      </Page>
    </Document>
  );
}
