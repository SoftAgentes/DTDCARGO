/**
 * SDD-0631 · CA7/CA8 de punta a punta, con montos inventados:
 *
 *   CxP del aliado de espacio ligada al contenedor (Tesorería)
 *     → asiento de causación
 *     → orden de pago + asiento del pago
 *     → Costing: el margen del contenedor y de sus embarques refleja el costo
 *       UNA vez (el pago no suma, y la CxP reemplaza el flete estimado a mano).
 *
 * Corre las funciones reales de Tesorería (`createBillFor`, `registerPaymentFor`)
 * y de Costing (`costingData`) sobre una base en memoria que aplica los
 * filtros de PostgREST que usan. Lo que se dobla, y por qué:
 *  - el posteo contable (`bill-posting`, `supplier-payment-posting`): usa el
 *    cliente admin y el plan de cuentas; acá se registra lo que recibe, que es
 *    lo que esta SDD tiene que garantizar (monto y moneda de la CxP);
 *  - la RPC `register_supplier_payment_order` (0468): se emula su efecto sobre
 *    la CxP (paid_amount y status) y la orden.
 * El trigger de la 0536 se prueba aparte, en PGlite.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;
const asientos: { origen: string; amount: unknown; currency: unknown }[] = [];

vi.mock("@/lib/studio/accounting/bill-posting", () => ({
  postBillJournalEntry: vi.fn(async (i: { amount: number; currency: string }) => {
    asientos.push({ origen: "supplier_bill", amount: i.amount, currency: i.currency });
    return { ok: true, entryId: `je-${asientos.length}` };
  }),
  voidBillJournalEntry: vi.fn(),
}));
vi.mock("@/lib/studio/accounting/supplier-payment-posting", () => ({
  postSupplierPaymentJournalEntry: vi.fn(async (i: { amount: number; currency: string }) => {
    asientos.push({ origen: "supplier_payment", amount: i.amount, currency: i.currency });
    return { ok: true, entryId: `je-${asientos.length}` };
  }),
  voidSupplierPaymentJournalEntry: vi.fn(),
}));

const { createBillFor, registerPaymentFor } = await import("@/lib/studio/treasury/treasury-actions");
const { costingData } = await import("../queries");

// ── Base en memoria ────────────────────────────────────────────
let db: Record<string, Row[]>;
let failSelect: { table: string; message: string } | null;
let seq = 0;

function memoryClient(): SupabaseClient {
  return {
    async rpc(name: string, args: Row) {
      if (name === "next_bill_code") return { data: `CXP-2026-${String(++seq).padStart(4, "0")}`, error: null };
      if (name === "register_supplier_payment_order") {
        const bill = db.supplier_bills.find((b) => b.id === args.p_bill_id)!;
        const paid = Number(bill.paid_amount) + Number(args.p_amount);
        bill.paid_amount = paid;
        bill.status = paid >= Number(bill.total_amount) ? "pagada" : "parcial";
        const payment = { id: `pay-${++seq}`, payment_code: `OP-2026-${seq}`, bill_id: bill.id, amount: args.p_amount };
        db.supplier_payments.push(payment);
        return {
          data: {
            payment_id: payment.id, payment_code: payment.payment_code, tenant_id: "t1", bill_id: bill.id,
            currency: bill.currency, fx_rate: bill.fx_rate, paid_amount: paid, status: bill.status,
            fully_paid: bill.status === "pagada",
          },
          error: null,
        };
      }
      return { data: null, error: null };
    },
    from(table: string) {
      const filters: ((r: Row) => boolean)[] = [];
      let op: { kind: "select" } | { kind: "insert"; row: Row } | { kind: "update"; values: Row } = { kind: "select" };
      const rows = () => (db[table] ??= []).filter((r) => filters.every((f) => f(r)));
      const result = () => {
        if (op.kind === "insert") return { data: [op.row], error: null };
        if (op.kind === "update") {
          const hit = rows();
          for (const r of hit) Object.assign(r, (op as { values: Row }).values);
          return { data: hit, error: null };
        }
        if (failSelect?.table === table) return { data: null, error: { message: failSelect.message } };
        return { data: rows(), error: null };
      };
      const chain: Record<string, unknown> = {
        select: () => chain,
        order: () => chain,
        eq(col: string, v: unknown) { filters.push((r) => r[col] === v); return chain; },
        is(col: string, v: unknown) { filters.push((r) => (v === null ? r[col] == null : r[col] === v)); return chain; },
        not(col: string, _op: string, v: unknown) { filters.push((r) => (v === null ? r[col] != null : r[col] !== v)); return chain; },
        insert(row: Row) {
          const full = { id: `${table}-${++seq}`, paid_amount: 0, deleted_at: null, ...row };
          db[table] = [...(db[table] ?? []), full];
          op = { kind: "insert", row: full };
          return chain;
        },
        update(values: Row) { op = { kind: "update", values }; return chain; },
        range: async (from: number, to: number) => {
          const r = result();
          return r.error ? r : { data: (r.data as Row[]).slice(from, to + 1), error: null };
        },
        limit: async (n: number) => {
          const r = result();
          return r.error ? r : { data: (r.data as Row[]).slice(0, n), error: null };
        },
        maybeSingle: async () => {
          const r = result();
          return { data: (r.data as Row[] | null)?.[0] ?? null, error: r.error };
        },
        single: async () => {
          const r = result();
          return { data: (r.data as Row[] | null)?.[0] ?? null, error: r.error };
        },
        then: (resolve: (v: unknown) => void) => resolve(result()),
      };
      return chain;
    },
  } as unknown as SupabaseClient;
}

function seed() {
  db = {
    user_tenants: [{ tenant_id: "t1" }],
    suppliers: [{ id: "sup-1", name: "Aliado de espacio (prueba)", type: "aliado_espacio" }],
    supplier_bills: [],
    supplier_payments: [],
    shipments: [
      { id: "S1", code: "DTDU-T-1", origin: "Yiwu", destination: "Valencia", volume_m3: 10, deleted_at: null },
      { id: "S2", code: "DTDU-T-2", origin: "Yiwu", destination: "Valencia", volume_m3: 30, deleted_at: null },
    ],
    invoices: [
      { id: "i1", shipment_id: "S1", shipment_code: "DTDU-T-1", currency: "USD", total_amount: 1500, fx_rate: null, status: "emitida", issued_at: "2026-11-01", created_at: "2026-11-01", deleted_at: null },
      { id: "i2", shipment_id: "S2", shipment_code: "DTDU-T-2", currency: "USD", total_amount: 4500, fx_rate: null, status: "emitida", issued_at: "2026-11-01", created_at: "2026-11-01", deleted_at: null },
    ],
    // Flete ESTIMADO a mano en S1: la CxP lo tiene que reemplazar, no sumarse.
    shipment_costs: [
      { id: "sc1", shipment_id: "S1", freight: 200, customs: 50, transport: 0, handling: 0, insurance: 0, commission: 0, other: 0, deleted_at: null },
    ],
    consolidations: [{ id: "C1", ref: "DTD-CONSOL-9001", status: "zarpado", container_type: "40HC", deleted_at: null }],
    consolidation_items: [
      { id: "ci1", consolidation_id: "C1", shipment_id: "S1", cbm: 10 },
      { id: "ci2", consolidation_id: "C1", shipment_id: "S2", cbm: 30 },
    ],
  };
}

beforeEach(() => {
  seed();
  failSelect = null;
  seq = 0;
  asientos.length = 0;
});

describe("SDD-0631 · CxP ligada → pago → asiento → margen del contenedor", () => {
  it("el costo del aliado entra una vez al contenedor y a sus embarques", async () => {
    const sb = memoryClient();
    const antes = await costingData(sb);
    expect(antes.containers[0]).toMatchObject({ revenue: 6000, cost: 250, margin: 5750, cxpCost: 0 });

    // 1. CxP del espacio, ligada al contenedor entero (se reparte por CBM).
    const creada = await createBillFor(sb, {
      supplierId: "sup-1",
      expenseAccountId: "acc-costo-flete",
      currency: "USD",
      fxRate: null,
      totalAmount: 2000,
      issueDate: "2026-11-10",
      dueDate: "2026-12-10",
      concept: "Espacio en contenedor (prueba)",
      reference: null,
      shipmentId: null,
      consolidationId: "C1",
      costCategory: "freight",
      notes: null,
    });
    expect(creada).toMatchObject({ ok: true });
    const bill = db.supplier_bills[0];
    expect(bill).toMatchObject({ consolidation_id: "C1", cost_category: "freight", status: "pendiente" });
    expect(asientos).toEqual([{ origen: "supplier_bill", amount: 2000, currency: "USD" }]);

    const causada = await costingData(sb);
    const s1 = causada.rows.find((r) => r.shipment.id === "S1")!;
    const s2 = causada.rows.find((r) => r.shipment.id === "S2")!;
    expect(s1.eco.freight).toBe(500); // 2000 × 10/40, reemplaza los 200 estimados
    expect(s1.eco.customs).toBe(50); // la categoría que la CxP no cubre sigue
    expect(s1.eco.totalCost).toBe(550);
    expect(s2.eco.totalCost).toBe(1500);
    expect(causada.containers[0]).toMatchObject({ revenue: 6000, cost: 2050, margin: 3950, cxpCost: 2000 });

    // 2. Orden de pago por el total y su asiento.
    const pago = await registerPaymentFor(sb, bill.id as string, {
      amount: 2000,
      cashAccountId: "acc-banco",
      method: "transferencia",
      paidAt: "2026-11-12",
      reference: null,
      notes: null,
    });
    expect(pago).toMatchObject({ ok: true, fullyPaid: true });
    expect(bill.status).toBe("pagada");
    expect(asientos.map((a) => a.origen)).toEqual(["supplier_bill", "supplier_payment"]);

    // 3. El pago no suma costo: el margen es el mismo que con la CxP causada.
    const pagada = await costingData(sb);
    expect(pagada.containers[0]).toMatchObject({ cost: 2050, margin: 3950, cxpCost: 2000 });
    expect(pagada.rows.find((r) => r.shipment.id === "S1")!.eco.totalCost).toBe(550);
  });

  it("CxP con contenedor y embarque cuenta una sola vez", async () => {
    const sb = memoryClient();
    await createBillFor(sb, {
      supplierId: "sup-1", expenseAccountId: "acc", currency: "USD", fxRate: null, totalAmount: 300,
      issueDate: "2026-11-10", dueDate: "2026-12-10", concept: null, reference: null, notes: null,
      consolidationId: "C1", shipmentId: "S2", costCategory: "handling",
    });
    const d = await costingData(sb);
    expect(d.rows.find((r) => r.shipment.id === "S2")!.eco.handling).toBe(300);
    expect(d.rows.find((r) => r.shipment.id === "S1")!.eco.handling).toBe(0);
    expect(d.containers[0].cost).toBe(250 + 300);
  });

  it("CA8 · base sin la 0536: el costeo no rompe y sale sin CxP", async () => {
    db.supplier_bills.push({ id: "b-x", consolidation_id: "C1", cost_category: "freight", currency: "USD", total_amount: 999, status: "pendiente", deleted_at: null });
    failSelect = { table: "supplier_bills", message: "column supplier_bills.consolidation_id does not exist" };
    const d = await costingData(memoryClient());
    expect(d.linksAvailable).toBe(false);
    expect(d.containers[0]).toMatchObject({ revenue: 6000, cost: 250 });
  });

  it("otro error leyendo CxP no se traga: el margen no se inventa", async () => {
    failSelect = { table: "supplier_bills", message: "permission denied for table supplier_bills" };
    await expect(costingData(memoryClient())).rejects.toThrow(/permission denied/);
  });
});
