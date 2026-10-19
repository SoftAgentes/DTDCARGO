/**
 * SDD-0557 · Lectores de los controles del libro, sobre un doble que APLICA los
 * filtros (`listados-double.ts`) y corta cada respuesta en 1.000 filas como
 * `db-max-rows`. Los fixtures son infelices a propósito: borradas, anuladas,
 * borradores, asientos fuera del rango, un crédito de referido con
 * `invoice_id` y un asiento a 4.6.
 */
import { describe, expect, it } from "vitest";
import { dobleListados, type Fila } from "@/lib/studio/__tests__/listados-double";
import {
  cuadreDelLibro,
  ingresoDelPeriodo,
  leerDiarioCompleto,
  reportesDelLibro,
} from "../libro-control-queries";
import { ESTADOS_DE_INGRESO } from "../ingreso-periodo";
import { countEntries } from "@/lib/studio/journal-queries";
import { accountBalances, listAccounts } from "@/lib/studio/account-queries";
import { ESPERADO, FACTURAS_DEL_MES, RANGO_MES } from "./ingreso-fixture";

const SERVER_CAP = 1000;

const cuenta = (id: string, code: string, type: string, name = code): Fila => ({
  id, tenant_id: "t", code, name, type, parent_id: null, qbo_type: null, subtype: null,
  is_postable: true, notes: null, created_at: "", updated_at: "",
});

const PLAN: Fila[] = [
  cuenta("a", "1", "A", "Activo"),
  cuenta("a1", "1.1", "A"),
  cuenta("banco", "1.1.1", "A", "Banco"),
  cuenta("cxc", "1.1.2", "A", "Cuentas por cobrar"),
  cuenta("p", "2", "P"),
  cuenta("p1", "2.1", "P"),
  cuenta("cxp", "2.1.1", "P", "Cuentas por pagar"),
  cuenta("i", "4", "I", "Ingresos"),
  cuenta("ventas", "4.5", "I", "Otros ingresos por servicios"),
  cuenta("forex", "4.6", "I", "Ingreso por cambio de moneda"),
  cuenta("g", "6", "G", "Gastos"),
  cuenta("g1", "6.1", "G", "Gastos generales"),
];

const entrada = (id: string, entry_date: string, status = "asentado", extra: Fila = {}): Fila => ({
  id,
  tenant_id: "t",
  entry_code: `A-${id}`,
  entry_date,
  memo: `Asiento ${id}`,
  status,
  source: "manual",
  invoice_id: null,
  receipt_id: null,
  bill_id: null,
  supplier_payment_id: null,
  deleted_at: null,
  ...extra,
});
const linea = (id: string, entry_id: string, account_id: string, debit: number, credit: number): Fila => ({
  id, entry_id, account_id, debit, credit, line_memo: null,
});

describe("ingresoDelPeriodo", () => {
  it("la cifra oficial y el filtro que baja a SQL", async () => {
    const { client, filtros } = dobleListados({ invoices: FACTURAS_DEL_MES }, { serverCap: SERVER_CAP });
    const i = await ingresoDelPeriodo(client, RANGO_MES, { mayor: { ventas: 0, ingresos: 0 } });
    expect(i.facturado.total).toBe(ESPERADO.total);
    expect(i.sinConvertir).toBe(ESPERADO.sinConvertir);
    expect(i.diferenciaUsd).toBe(2000);
    const deFacturas = filtros.filter((f) => f.table === "invoices");
    expect(deFacturas).toContainEqual({ table: "invoices", op: "is", col: "deleted_at", val: null });
    expect(deFacturas).toContainEqual({ table: "invoices", op: "in", col: "status", val: [...ESTADOS_DE_INGRESO] });
    expect(deFacturas).toContainEqual({ table: "invoices", op: "gte", col: "issued_at", val: "2025-03-01" });
    expect(deFacturas).toContainEqual({ table: "invoices", op: "lte", col: "issued_at", val: "2025-03-18" });
  });

  it("sin mayor dado, lo calcula del mismo rango contra 4.5; el 4.6 va aparte", async () => {
    const { client } = dobleListados(
      {
        invoices: FACTURAS_DEL_MES,
        accounts: PLAN,
        journal_entries: [
          entrada("e1", "2025-03-05"),
          entrada("e2", "2025-03-07"),
          entrada("e3", "2025-02-20"), // fuera del rango
          entrada("e4", "2025-03-08", "anulado"),
        ],
        journal_lines: [
          linea("l1", "e1", "cxc", 1500, 0),
          linea("l2", "e1", "ventas", 0, 1500),
          linea("l3", "e2", "banco", 200, 0),
          linea("l4", "e2", "forex", 0, 200),
          linea("l5", "e3", "cxc", 900, 0),
          linea("l6", "e3", "ventas", 0, 900),
          linea("l7", "e4", "cxc", 400, 0),
          linea("l8", "e4", "ventas", 0, 400),
        ],
      },
      { serverCap: SERVER_CAP },
    );
    const i = await ingresoDelPeriodo(client, RANGO_MES);
    expect(i.mayor).toEqual({ ventas: 1500, ingresos: 1700, otrosIngresos: 200 });
    // Contra 4.5: 2000 − 1500. Contra todas las cuentas 4 daría 300.
    expect(i.diferenciaUsd).toBe(500);
  });
});

describe("reportesDelLibro", () => {
  it("P&L del rango; balance y comprobación al corte; ingreso con el control del período", async () => {
    const { client, filtros } = dobleListados(
      {
        invoices: FACTURAS_DEL_MES,
        accounts: PLAN,
        journal_entries: [entrada("e1", "2025-03-05"), entrada("e0", "2025-02-10")],
        journal_lines: [
          linea("l1", "e1", "cxc", 1000, 0),
          linea("l2", "e1", "ventas", 0, 1000),
          linea("l3", "e0", "g1", 300, 0),
          linea("l4", "e0", "banco", 0, 300),
        ],
      },
      { serverCap: SERVER_CAP },
    );
    const r = await reportesDelLibro(client, RANGO_MES);
    expect(r.pnl.income).toBe(1000);
    expect(r.pnl.expenses).toBe(0); // el gasto de febrero no es del período
    expect(r.comprobacion.totalDebe).toBe(1300); // al corte sí entra
    expect(r.comprobacion.cuadra).toBe(true);
    expect(r.balance.netIncome).toBe(700); // acumulado, sin cierre a 3.4
    expect(r.ingreso.mayor?.ventas).toBe(1000);
    expect(r.ingreso.diferenciaUsd).toBe(1000);
    const fechas = filtros.filter((f) => f.table === "journal_entries" && f.col === "entry_date");
    expect(fechas).toContainEqual({ table: "journal_entries", op: "gte", col: "entry_date", val: "2025-03-01" });
    expect(fechas.filter((f) => f.op === "lte").every((f) => f.val === "2025-03-18")).toBe(true);
  });
});

/** 1.200 asentados de dos líneas, 50 anulados y 1 borrador, del 1 al 18 de marzo. */
function diarioGrande(): Record<string, Fila[]> {
  const entries: Fila[] = [];
  const lines: Fila[] = [];
  const dia = (n: number) => `2025-03-${String((n % 18) + 1).padStart(2, "0")}`;
  for (let n = 0; n < 1200; n++) {
    const id = `e${String(n).padStart(5, "0")}`;
    entries.push(entrada(id, dia(n)));
    lines.push(linea(`${id}-d`, id, "banco", 10, 0), linea(`${id}-h`, id, "ventas", 0, 10));
  }
  for (let n = 0; n < 50; n++) {
    const id = `x${String(n).padStart(5, "0")}`;
    entries.push(entrada(id, dia(n), "anulado"));
    lines.push(linea(`${id}-d`, id, "cxc", 999, 0), linea(`${id}-h`, id, "ventas", 0, 999));
  }
  entries.push(entrada("b00001", "2025-03-05", "borrador"));
  lines.push(linea("b-d", "b00001", "cxc", 7, 0), linea("b-h", "b00001", "ventas", 0, 7));
  return { accounts: PLAN, journal_entries: entries, journal_lines: lines };
}

describe("leerDiarioCompleto", () => {
  it("baja TODO: 1.200 asentados × 2 líneas, sin anulados ni borradores, con el tope de 1.000 por respuesta", async () => {
    const { client } = dobleListados(diarioGrande(), { serverCap: SERVER_CAP });
    const filas = await leerDiarioCompleto(client, {});
    expect(filas).toHaveLength(2400);
    expect(filas.some((f) => f.asiento.startsWith("A-x") || f.asiento.startsWith("A-b"))).toBe(false);
    expect(filas[0]).toMatchObject({ fecha: "2025-03-01", cuenta: "1.1.1", debe: 10, origen: "Manual" });
  });

  it("aplica desde y hasta sobre entry_date", async () => {
    const { client } = dobleListados(diarioGrande(), { serverCap: SERVER_CAP });
    const filas = await leerDiarioCompleto(client, { from: "2025-03-10", to: "2025-03-12" });
    const asientos = diarioGrande().journal_entries.filter(
      (e) => e.status === "asentado" && (e.entry_date as string) >= "2025-03-10" && (e.entry_date as string) <= "2025-03-12",
    );
    expect(filas).toHaveLength(asientos.length * 2);
    expect(filas.every((f) => f.fecha >= "2025-03-10" && f.fecha <= "2025-03-12")).toBe(true);
  });

  it("invariante: Σ debe del diario hasta el corte = total debe de la comprobación al corte", async () => {
    const { client } = dobleListados(
      { ...diarioGrande(), invoices: [] },
      { serverCap: SERVER_CAP },
    );
    const corte = "2025-03-15";
    const [filas, reportes] = await Promise.all([
      leerDiarioCompleto(client, { to: corte }),
      reportesDelLibro(client, { from: "2025-03-01", to: corte }),
    ]);
    const debe = Math.round(filas.reduce((s, f) => s + f.debe, 0) * 100) / 100;
    expect(debe).toBeGreaterThan(0);
    expect(debe).toBe(reportes.comprobacion.totalDebe);
  });
});

describe("cuadreDelLibro", () => {
  it("documentos sin asiento, anulados con asiento vivo y subdiario contra 1.1.2", async () => {
    const tablas: Record<string, Fila[]> = {
      accounts: PLAN,
      invoices: [
        { id: "f1", invoice_code: "F-1", status: "emitida", issued_at: "2025-03-05", currency: "USD", fx_rate: null, total_amount: 500, paid_amount: 0, deleted_at: null },
        { id: "f2", invoice_code: "F-2", status: "emitida", issued_at: "2025-03-06", currency: "USD", fx_rate: null, total_amount: 300, paid_amount: 0, deleted_at: null },
        { id: "f3", invoice_code: "F-3", status: "anulada", issued_at: "2025-03-07", currency: "USD", fx_rate: null, total_amount: 200, paid_amount: 0, deleted_at: null },
        { id: "f4", invoice_code: "F-4", status: "borrador", issued_at: null, currency: "USD", fx_rate: null, total_amount: 90, paid_amount: 0, deleted_at: null },
        { id: "f5", invoice_code: "F-5", status: "emitida", issued_at: "2025-03-08", currency: "USD", fx_rate: null, total_amount: 80, paid_amount: 0, deleted_at: "2025-03-09T00:00:00Z" },
      ],
      payment_receipts: [
        { id: "r1", receipt_code: "R-1", received_at: "2025-03-10", currency: "USD", amount: 100, journal_entry_id: "e-r1", deleted_at: null },
      ],
      supplier_bills: [],
      supplier_payments: [],
      journal_entries: [
        entrada("e-f1", "2025-03-05", "asentado", { source: "invoice", invoice_id: "f1" }),
        // F-2 solo tiene el crédito de referido: no es su asiento de venta.
        entrada("e-ref", "2025-03-06", "asentado", { source: "referral_credit", invoice_id: "f2" }),
        entrada("e-f3", "2025-03-07", "asentado", { source: "invoice", invoice_id: "f3" }),
        entrada("e-r1", "2025-03-10", "anulado", { source: "receipt", receipt_id: "r1" }),
      ],
      journal_lines: [],
    };
    const { client, filtros } = dobleListados(tablas, { serverCap: SERVER_CAP });
    const saldos = await accountBalances(client);
    const accounts = await listAccounts(client);
    // El saldo del mayor que se le pasa: 1.1.2 con 500 al debe.
    saldos.cxc = { debit: 500, credit: 0, balance: 500 };
    const c = await cuadreDelLibro(client, { accounts, saldos, hoy: "2025-03-18" });

    expect(c.documentos.sinAsiento.map((h) => [h.codigo, h.motivo])).toEqual([
      ["F-2", "sin_asiento"],
      ["R-1", "asiento_anulado"],
    ]);
    expect(c.documentos.anuladosConAsiento.map((h) => h.codigo)).toEqual(["F-3"]);
    // El borrador no se revisa y la borrada no se lee.
    expect(c.documentos.conteo.factura.revisados).toBe(3);
    expect(c.subdiario.clientes).toMatchObject({ subdiarioUsd: 800, mayorUsd: 500, diferenciaUsd: 300, estado: "no_cuadra" });
    expect(c.subdiario.proveedores).toMatchObject({ mayorUsd: 0, estado: "sin_movimiento" });
    // Solo los orígenes documentales bajan a SQL (el cruce lo repite en memoria).
    expect(filtros).toContainEqual({
      table: "journal_entries",
      op: "in",
      col: "source",
      val: ["invoice", "receipt", "supplier_bill", "supplier_payment"],
    });
    expect(filtros).toContainEqual({ table: "invoices", op: "is", col: "deleted_at", val: null });
  });
});

describe("countEntries", () => {
  it("cuenta el diario entero, no los 500 de la pantalla", async () => {
    const entries: Fila[] = [];
    for (let n = 0; n < 600; n++) entries.push(entrada(`e${n}`, "2025-03-01"));
    entries.push(entrada("b1", "2025-03-01", "borrador"));
    entries.push(entrada("d1", "2025-03-01", "asentado", { deleted_at: "2025-03-02T00:00:00Z" }));
    const { client } = dobleListados({ journal_entries: entries }, { serverCap: SERVER_CAP });
    expect(await countEntries(client)).toEqual({ total: 601, asentados: 600 });
  });
});
