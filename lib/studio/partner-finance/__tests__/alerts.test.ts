/**
 * Tests de las alertas PP/CA del Socio China (SDD-0115 · Slice C3) — capa pura.
 *
 * Cubre el builder `buildPartnerBillAlerts`:
 *  - sólo `bill_kind in ('pp','ca')` (las 'full' nunca son alerta de socio).
 *  - sólo vencidas (due_date < today) con saldo > 0.
 *  - excluye anuladas y las ya pagadas (saldo 0).
 *  - orden por días de atraso desc, luego saldo desc.
 *  - normalización a USD (USD 1:1 · VES /fx · CNY → 0).
 */

import { describe, it, expect } from "vitest";
import { buildPartnerBillAlerts } from "../alerts-queries";
import type { SupplierBill } from "../../treasury/types";

const TODAY = "2026-06-28";

function bill(partial: Partial<SupplierBill> & { id: string }): SupplierBill {
  return {
    tenant_id: "t1",
    bill_code: "CXP-2026-0001",
    supplier_id: "s1",
    supplier_name: "Socio China",
    concept: "Adelanto embarque",
    expense_account_id: "acc-exp",
    currency: "USD",
    fx_rate: null,
    total_amount: 1000,
    paid_amount: 0,
    status: "pendiente",
    bill_kind: "pp",
    issue_date: "2026-04-01",
    due_date: "2026-05-01",
    reference: null,
    shipment_id: null,
    journal_entry_id: null,
    notes: null,
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
    deleted_at: null,
    ...partial,
  };
}

describe("buildPartnerBillAlerts", () => {
  it("incluye PP/CA vencidas con saldo, con días de atraso", () => {
    const alerts = buildPartnerBillAlerts(
      [bill({ id: "b1", bill_kind: "pp", due_date: "2026-05-01" })],
      TODAY,
    );
    expect(alerts).toHaveLength(1);
    expect(alerts[0].kind).toBe("pp");
    expect(alerts[0].daysOverdue).toBe(58); // 2026-05-01 → 2026-06-28
    expect(alerts[0].balance).toBe(1000);
    expect(alerts[0].balanceUsd).toBe(1000);
  });

  it("ignora las 'full' (no son tramo de socio)", () => {
    const alerts = buildPartnerBillAlerts(
      [bill({ id: "b1", bill_kind: "full", due_date: "2026-01-01" })],
      TODAY,
    );
    expect(alerts).toHaveLength(0);
  });

  it("ignora las que aún no vencen", () => {
    const alerts = buildPartnerBillAlerts(
      [bill({ id: "b1", bill_kind: "ca", due_date: "2026-12-01" })],
      TODAY,
    );
    expect(alerts).toHaveLength(0);
  });

  it("ignora vencidas sin saldo (pagadas)", () => {
    const alerts = buildPartnerBillAlerts(
      [bill({ id: "b1", total_amount: 1000, paid_amount: 1000 })],
      TODAY,
    );
    expect(alerts).toHaveLength(0);
  });

  it("ignora anuladas aunque estén vencidas con saldo", () => {
    const alerts = buildPartnerBillAlerts(
      [bill({ id: "b1", status: "anulada" })],
      TODAY,
    );
    expect(alerts).toHaveLength(0);
  });

  it("ordena por días de atraso desc", () => {
    const alerts = buildPartnerBillAlerts(
      [
        bill({ id: "reciente", due_date: "2026-06-20" }),
        bill({ id: "vieja", due_date: "2026-03-01" }),
      ],
      TODAY,
    );
    expect(alerts.map((a) => a.bill.id)).toEqual(["vieja", "reciente"]);
  });

  // SDD-0572 (decisión 1 de Sam; el Director, 2026-10-20): sin tasa no se convierte; nunca el monto tal cual. Antes CNY daba 0 aun con tasa.
  it("normaliza VES y CNY a USD con su tasa; sin tasa, null", () => {
    const alerts = buildPartnerBillAlerts(
      [
        bill({ id: "ves", currency: "VES", total_amount: 3600, fx_rate: 36, due_date: "2026-05-01" }),
        bill({ id: "cny", currency: "CNY", total_amount: 700, fx_rate: 7, due_date: "2026-05-01" }),
        bill({ id: "sin", currency: "VES", total_amount: 3600, fx_rate: null, due_date: "2026-05-01" }),
      ],
      TODAY,
    );
    const ves = alerts.find((a) => a.bill.id === "ves")!;
    const cny = alerts.find((a) => a.bill.id === "cny")!;
    const sin = alerts.find((a) => a.bill.id === "sin")!;
    expect(ves.balanceUsd).toBe(100); // 3600 / 36
    expect(cny.balanceUsd).toBe(100); // 700 / 7
    expect(sin.balanceUsd).toBeNull();
  });
});
