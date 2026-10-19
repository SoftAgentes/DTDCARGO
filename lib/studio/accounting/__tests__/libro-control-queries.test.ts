/**
 * SDD-0557 · Lectores de los controles del libro, sobre un doble que APLICA los
 * filtros (`listados-double.ts`) y corta cada respuesta en 1.000 filas como
 * `db-max-rows`. Los fixtures son infelices a propósito: borradas, anuladas,
 * borradores, asientos fuera del rango, un crédito de referido con
 * `invoice_id`, un asiento a 4.6, un manual a la propia 4.5, un asiento
 * asentado y borrado, recibos y pagos anulados con su asiento vivo y lecturas
 * que no terminan.
 */
import { describe, expect, it } from "vitest";
import { dobleListados, type Fila } from "@/lib/studio/__tests__/listados-double";
import {
  cuadreDelLibro,
  ingresoDelPeriodo,
  leerDiarioCompleto,
  reportesDelLibro,
} from "../libro-control-queries";
import { describirIngreso, ESTADOS_DE_INGRESO } from "../ingreso-periodo";
import { countEntries } from "@/lib/studio/journal-queries";
import { accountBalances, listAccounts } from "@/lib/studio/account-queries";
import {
  ESPERADO,
  ESPERADO_EN_USD,
  FACTURAS_DEL_MES,
  FACTURAS_EN_USD,
  RANGO_MES,
  control,
} from "./ingreso-fixture";

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
const deFactura = (id: string, entry_date: string, status = "asentado", extra: Fila = {}): Fila =>
  entrada(id, entry_date, status, { source: "invoice", ...extra });
const linea = (id: string, entry_id: string, account_id: string, debit: number, credit: number): Fila => ({
  id, entry_id, account_id, debit, credit, line_memo: null,
});

describe("ingresoDelPeriodo", () => {
  it("la cifra oficial y el filtro que baja a SQL; con bolívares o yuanes, sin diferencia (E1)", async () => {
    const { client, filtros } = dobleListados({ invoices: FACTURAS_DEL_MES }, { serverCap: SERVER_CAP });
    const i = await ingresoDelPeriodo(client, RANGO_MES, { mayor: control(0) });
    expect(i.facturado.total).toBe(ESPERADO.total);
    expect(i.sinConvertir).toBe(ESPERADO.sinConvertir);
    expect(i.enOtraMoneda).toBe(ESPERADO.enOtraMoneda);
    expect(i.diferenciaUsd).toBeNull();
    expect(describirIngreso(i).estado).toBe("no_comparable");
    const deFacturas = filtros.filter((f) => f.table === "invoices");
    expect(deFacturas).toContainEqual({ table: "invoices", op: "is", col: "deleted_at", val: null });
    // Las anuladas también bajan: no suman, pero una en VES o CNY puede
    // conservar su asiento al nominal.
    expect(deFacturas).toContainEqual({ table: "invoices", op: "in", col: "status", val: [...ESTADOS_DE_INGRESO, "anulada"] });
    expect(deFacturas).toContainEqual({ table: "invoices", op: "gte", col: "issued_at", val: "2025-03-01" });
    expect(deFacturas).toContainEqual({ table: "invoices", op: "lte", col: "issued_at", val: "2025-03-18" });
  });

  it("una anulada en VES del período vuelve no comparable el control (llega desde SQL)", async () => {
    const anuladaVes = { ...FACTURAS_DEL_MES[0], id: "fv", currency: "VES", fx_rate: 36.5, status: "anulada" };
    const { client } = dobleListados({ invoices: [...FACTURAS_EN_USD, anuladaVes] }, { serverCap: SERVER_CAP });
    const i = await ingresoDelPeriodo(client, RANGO_MES, { mayor: control(1000) });
    expect(i.facturado.total).toBe(ESPERADO_EN_USD.total);
    expect(i.enOtraMoneda).toBe(1);
    expect(describirIngreso(i).estado).toBe("no_comparable");
  });

  it("sin mayor dado: contra la 4.5 de los asientos de FACTURA; el 4.6 y un manual a 4.5 van a otros ingresos", async () => {
    const { client, filtros } = dobleListados(
      {
        invoices: FACTURAS_EN_USD,
        accounts: PLAN,
        journal_entries: [
          deFactura("e1", "2025-03-05"),
          entrada("e2", "2025-03-07"), // manual a 4.6
          entrada("e5", "2025-03-09"), // manual a la propia 4.5
          deFactura("e3", "2025-02-20"), // fuera del rango
          deFactura("e4", "2025-03-08", "anulado"),
          deFactura("e6", "2025-03-10", "asentado", { deleted_at: "2025-03-11T00:00:00Z" }),
        ],
        journal_lines: [
          linea("l1", "e1", "cxc", 600, 0),
          linea("l2", "e1", "ventas", 0, 600),
          linea("l3", "e2", "banco", 200, 0),
          linea("l4", "e2", "forex", 0, 200),
          linea("l9", "e5", "banco", 300, 0),
          linea("l10", "e5", "ventas", 0, 300),
          linea("l5", "e3", "cxc", 900, 0),
          linea("l6", "e3", "ventas", 0, 900),
          linea("l7", "e4", "cxc", 400, 0),
          linea("l8", "e4", "ventas", 0, 400),
          linea("l11", "e6", "cxc", 50, 0),
          linea("l12", "e6", "ventas", 0, 50),
        ],
      },
      { serverCap: SERVER_CAP },
    );
    const i = await ingresoDelPeriodo(client, RANGO_MES);
    expect(i.mayor).toEqual({ ventas: 600, ventasConMovimiento: true, ingresos: 1100, otrosIngresos: 500 });
    // 1000 − 600. Contra toda la 4.5 (con el manual) daría 100; contra todas
    // las cuentas 4, −100.
    expect(i.diferenciaUsd).toBe(400);
    expect(describirIngreso(i).estado).toBe("mayor_menor");
    expect(filtros).toContainEqual({ table: "journal_entries", op: "eq", col: "source", val: "invoice" });
  });

  it("sin facturas ni asientos de factura: «sin movimiento», aunque haya un manual a 4.5", async () => {
    const { client } = dobleListados(
      {
        invoices: [],
        accounts: PLAN,
        journal_entries: [entrada("e5", "2025-03-09")],
        journal_lines: [linea("l9", "e5", "banco", 300, 0), linea("l10", "e5", "ventas", 0, 300)],
      },
      { serverCap: SERVER_CAP },
    );
    const i = await ingresoDelPeriodo(client, RANGO_MES);
    expect(i.mayor).toEqual({ ventas: 0, ventasConMovimiento: false, ingresos: 300, otrosIngresos: 300 });
    expect(describirIngreso(i).estado).toBe("sin_movimiento");
  });
});

describe("reportesDelLibro", () => {
  it("P&L del rango; balance y comprobación al corte; ingreso con el control del período", async () => {
    const { client, filtros } = dobleListados(
      {
        invoices: FACTURAS_EN_USD,
        accounts: PLAN,
        journal_entries: [deFactura("e1", "2025-03-05"), entrada("e0", "2025-02-10")],
        journal_lines: [
          linea("l1", "e1", "cxc", 600, 0),
          linea("l2", "e1", "ventas", 0, 600),
          linea("l3", "e0", "g1", 300, 0),
          linea("l4", "e0", "banco", 0, 300),
        ],
      },
      { serverCap: SERVER_CAP },
    );
    const r = await reportesDelLibro(client, RANGO_MES);
    expect(r.pnl.income).toBe(600);
    expect(r.pnl.expenses).toBe(0); // el gasto de febrero no es del período
    expect(r.comprobacion.totalDebe).toBe(900); // al corte sí entra
    expect(r.comprobacion.cuadra).toBe(true);
    expect(r.balance.netIncome).toBe(300); // acumulado, sin cierre a 3.4
    expect(r.ingreso.mayor?.ventas).toBe(600);
    expect(r.ingreso.diferenciaUsd).toBe(400);
    const fechas = filtros.filter((f) => f.table === "journal_entries" && f.col === "entry_date");
    expect(fechas).toContainEqual({ table: "journal_entries", op: "gte", col: "entry_date", val: "2025-03-01" });
    expect(fechas.filter((f) => f.op === "lte").every((f) => f.val === "2025-03-18")).toBe(true);
  });
});

/**
 * 1.200 asentados de dos líneas, 50 anulados, 1 borrador y 1 asentado BORRADO
 * (con su propio monto, 777), del 1 al 18 de marzo.
 */
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
  entries.push(entrada("d00001", "2025-03-05", "asentado", { deleted_at: "2025-03-06T00:00:00Z" }));
  lines.push(linea("d-d", "d00001", "cxc", 777, 0), linea("d-h", "d00001", "ventas", 0, 777));
  return { accounts: PLAN, journal_entries: entries, journal_lines: lines };
}

describe("leerDiarioCompleto", () => {
  it("baja TODO: 1.200 asentados × 2 líneas, sin anulados, borradores ni borrados, con el tope de 1.000 por respuesta", async () => {
    const { client } = dobleListados(diarioGrande(), { serverCap: SERVER_CAP });
    const filas = await leerDiarioCompleto(client, {});
    expect(filas).toHaveLength(2400);
    expect(filas.some((f) => f.asiento.startsWith("A-x") || f.asiento.startsWith("A-b"))).toBe(false);
    expect(filas[0]).toMatchObject({ fecha: "2025-03-01", cuenta: "1.1.1", debe: 10, origen: "Manual" });
  });

  it("un asiento asentado con deleted_at no aparece en el CSV", async () => {
    const { client } = dobleListados(diarioGrande(), { serverCap: SERVER_CAP });
    const filas = await leerDiarioCompleto(client, {});
    expect(filas.some((f) => f.asiento === "A-d00001")).toBe(false);
    expect(filas.some((f) => f.debe === 777 || f.haber === 777)).toBe(false);
  });

  it("aplica desde y hasta sobre entry_date", async () => {
    const { client } = dobleListados(diarioGrande(), { serverCap: SERVER_CAP });
    const filas = await leerDiarioCompleto(client, { from: "2025-03-10", to: "2025-03-12" });
    const asientos = diarioGrande().journal_entries.filter(
      (e) =>
        e.status === "asentado" &&
        e.deleted_at == null &&
        (e.entry_date as string) >= "2025-03-10" &&
        (e.entry_date as string) <= "2025-03-12",
    );
    expect(filas).toHaveLength(asientos.length * 2);
    expect(filas.every((f) => f.fecha >= "2025-03-10" && f.fecha <= "2025-03-12")).toBe(true);
  });

  it("invariante: Σ debe del diario hasta el corte = total debe de la comprobación al corte (con el borrado en la base)", async () => {
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

  it("ERR-01 · si los asientos no terminan de leerse, rechaza con su nombre (no devuelve un diario corto)", async () => {
    // Con un tope de 1 fila por respuesta, 61 asientos superan MAX_PAGES (60).
    const entries: Fila[] = [];
    for (let n = 0; n < 61; n++) entries.push(entrada(`h${String(n).padStart(3, "0")}`, "2025-03-01"));
    const { client } = dobleListados({ accounts: PLAN, journal_entries: entries, journal_lines: [] }, { serverCap: 1 });
    await expect(leerDiarioCompleto(client, {})).rejects.toThrow(
      /^Diario · asientos: la lectura supera el tope; el control no se puede calcular completo\.$/,
    );
  });

  it("ERR-01 · si las líneas no terminan de leerse, rechaza con su nombre", async () => {
    // 30 asientos se leen en 31 respuestas; sus 60 líneas, no.
    const entries: Fila[] = [];
    const lines: Fila[] = [];
    for (let n = 0; n < 30; n++) {
      const id = `k${String(n).padStart(3, "0")}`;
      entries.push(entrada(id, "2025-03-01"));
      lines.push(linea(`${id}-d`, id, "banco", 1, 0), linea(`${id}-h`, id, "ventas", 0, 1));
    }
    const { client } = dobleListados({ accounts: PLAN, journal_entries: entries, journal_lines: lines }, { serverCap: 1 });
    await expect(leerDiarioCompleto(client, {})).rejects.toThrow(
      /^Diario · líneas: la lectura supera el tope; el diario saldría incompleto\.$/,
    );
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
    // El borrador no se revisa y la borrada no se lee. La anulada va aparte
    // del denominador de «sin asiento».
    expect(c.documentos.conteo.factura).toMatchObject({ revisados: 3, vivos: 2, anulados: 1 });
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

  /**
   * E1 por el recibo: una factura en USD cobrada con un recibo en bolívares
   * cuyo asiento `receipt` está vivo. La factura se asienta en USD, pero el
   * recibo convierte: 1.1.2 deja de ser comparable.
   */
  function conReciboVes(recibo: { asiento: string; borrado?: boolean }) {
    const tablas: Record<string, Fila[]> = {
      accounts: PLAN,
      invoices: [
        { id: "f1", invoice_code: "F-1", status: "pagada", issued_at: "2025-03-05", currency: "USD", fx_rate: null, total_amount: 1160, paid_amount: 1160, deleted_at: null },
      ],
      payment_receipts: [
        {
          id: "r1", receipt_code: "R-1", received_at: "2025-03-10", currency: "VES", amount: 42340,
          journal_entry_id: "e-r1", deleted_at: recibo.borrado ? "2025-03-11T00:00:00Z" : null,
        },
      ],
      supplier_bills: [],
      supplier_payments: [],
      journal_entries: [
        entrada("e-f1", "2025-03-05", "asentado", { source: "invoice", invoice_id: "f1" }),
        entrada("e-r1", "2025-03-10", recibo.asiento, { source: "receipt", receipt_id: "r1" }),
      ],
      journal_lines: [],
    };
    return dobleListados(tablas, { serverCap: SERVER_CAP }).client;
  }

  it("E1 por el recibo: un recibo vivo en VES con asiento `receipt` asentado vuelve no comparable a clientes", async () => {
    const client = conReciboVes({ asiento: "asentado" });
    const accounts = await listAccounts(client);
    const saldos = await accountBalances(client);
    saldos.cxc = { debit: 1160, credit: 1160, balance: 0 };
    const c = await cuadreDelLibro(client, { accounts, saldos, hoy: "2025-03-18" });
    expect(c.subdiario.clientes).toMatchObject({ estado: "no_comparable", diferenciaUsd: null });
  });

  it("E1 por el recibo · controles: con el asiento anulado, o con el recibo anulado, no cuenta", async () => {
    for (const recibo of [{ asiento: "anulado" }, { asiento: "asentado", borrado: true }]) {
      const client = conReciboVes(recibo);
      const accounts = await listAccounts(client);
      const saldos = await accountBalances(client);
      saldos.cxc = { debit: 1160, credit: 1160, balance: 0 };
      const c = await cuadreDelLibro(client, { accounts, saldos, hoy: "2025-03-18" });
      expect(c.subdiario.clientes).toMatchObject({ estado: "cuadra", diferenciaUsd: 0 });
    }
  });

  it("recibos y pagos anulados (deleted_at) con asiento vivo, CxP viva sin asiento y CxP abierta en el subdiario", async () => {
    const tablas: Record<string, Fila[]> = {
      accounts: PLAN,
      invoices: [],
      payment_receipts: [
        { id: "r9", receipt_code: "R-9", received_at: "2025-03-10", currency: "USD", amount: 100, journal_entry_id: "e-r9", deleted_at: "2025-03-11T00:00:00Z" },
      ],
      supplier_bills: [
        { id: "b1", bill_code: "CXP-1", issue_date: "2025-03-02", currency: "USD", fx_rate: null, total_amount: 300, paid_amount: 0, status: "pendiente", journal_entry_id: null, deleted_at: null },
        { id: "b2", bill_code: "CXP-2", issue_date: "2025-03-03", currency: "USD", fx_rate: null, total_amount: 700, paid_amount: 200, status: "parcial", journal_entry_id: "e-b2", deleted_at: null },
      ],
      supplier_payments: [
        { id: "p9", payment_code: "PP-9", paid_at: "2025-03-12", currency: "USD", amount: 80, journal_entry_id: "e-p9", deleted_at: "2025-03-13T00:00:00Z" },
      ],
      journal_entries: [
        entrada("e-r9", "2025-03-10", "asentado", { source: "receipt", receipt_id: "r9" }),
        entrada("e-b2", "2025-03-03", "asentado", { source: "supplier_bill", bill_id: "b2" }),
        entrada("e-p9", "2025-03-12", "asentado", { source: "supplier_payment", supplier_payment_id: "p9" }),
      ],
      journal_lines: [],
    };
    const { client } = dobleListados(tablas, { serverCap: SERVER_CAP });
    const accounts = await listAccounts(client);
    const saldos = await accountBalances(client);
    saldos.cxp = { debit: 0, credit: 800, balance: 800 };
    const c = await cuadreDelLibro(client, { accounts, saldos, hoy: "2025-03-18" });

    expect(c.documentos.anuladosConAsiento.map((h) => [h.tipo, h.codigo])).toEqual([
      ["recibo", "R-9"],
      ["pago_proveedor", "PP-9"],
    ]);
    expect(c.documentos.sinAsiento.map((h) => [h.codigo, h.motivo])).toEqual([["CXP-1", "sin_asiento"]]);
    expect(c.documentos.conteo.recibo).toMatchObject({ vivos: 0, anulados: 1, anuladosConAsiento: 1 });
    expect(c.documentos.conteo.pago_proveedor).toMatchObject({ vivos: 0, anulados: 1, anuladosConAsiento: 1 });
    expect(c.documentos.conteo.cxp).toMatchObject({ vivos: 2, sinAsiento: 1 });
    // Saldo abierto: 300 + (700 − 200) = 800, contra 800 en 2.1.1.
    expect(c.subdiario.proveedores).toMatchObject({ subdiarioUsd: 800, mayorUsd: 800, documentos: 2, estado: "cuadra" });
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
