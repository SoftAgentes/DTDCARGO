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
  saldosDeFacturas,
} from "../libro-control-queries";
import { describirIngreso, ESTADOS_DE_INGRESO } from "../ingreso-periodo";
import { countEntries } from "@/lib/studio/journal-queries";
import { accountBalances, listAccounts } from "@/lib/studio/account-queries";
import type { Account } from "@/lib/studio/account-types";
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
  it("la cifra oficial y el filtro que baja a SQL; con bolívares o yuanes y asientos de factura en 4.5, sin diferencia (E1)", async () => {
    const { client, filtros } = dobleListados({ invoices: FACTURAS_DEL_MES }, { serverCap: SERVER_CAP });
    const i = await ingresoDelPeriodo(client, RANGO_MES, { mayor: control(1500) });
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

  it("una anulada en VES del período, con su asiento vivo, vuelve no comparable el control (llega desde SQL)", async () => {
    const anuladaVes = { ...FACTURAS_DEL_MES[0], id: "fv", currency: "VES", fx_rate: 36.5, status: "anulada" };
    const { client } = dobleListados({ invoices: [...FACTURAS_EN_USD, anuladaVes] }, { serverCap: SERVER_CAP });
    const i = await ingresoDelPeriodo(client, RANGO_MES, { mayor: control(1000, 1000, true, ["f1", "fv"]) });
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
          deFactura("e3", "2025-02-20"), // antes del rango
          deFactura("e7", "2025-03-25"), // después del rango: el tope «hasta»
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
          linea("l13", "e7", "cxc", 250, 0),
          linea("l14", "e7", "ventas", 0, 250),
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
    // SDD-0573: con su contra-asiento, que resta en la fecha en que se anuló.
    expect(filtros).toContainEqual({ table: "journal_entries", op: "in", col: "source", val: ["invoice", "invoice_reversal"] });
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

  it("una factura en VES sin ningún asiento: el mayor vacío gana sobre «no comparable» (B3)", async () => {
    // 36500 Bs a 36,5 = 1000 USD, como hoy: facturas emitidas sin asiento.
    const ves = { ...FACTURAS_DEL_MES[1], id: "fv", status: "emitida" };
    const { client } = dobleListados(
      { invoices: [ves], accounts: PLAN, journal_entries: [], journal_lines: [] },
      { serverCap: SERVER_CAP },
    );
    const i = await ingresoDelPeriodo(client, RANGO_MES);
    // Sin asiento no cuenta en «no comparable» (decisión 7): ya falta en 4.5.
    expect(i.enOtraMoneda).toBe(0);
    expect(i.mayor).toMatchObject({ ventas: 0, ventasConMovimiento: false });
    expect(i.diferenciaUsd).toBe(1000);
    expect(describirIngreso(i).estado).toBe("mayor_menor");
  });

  /**
   * Decisión 7 del Director (2026-10-19, revisable por Sam), por el lector: la
   * factura en VES cuenta en «no comparable» solo si tiene su asiento
   * `invoice` vivo, y eso sale de la MISMA lectura de asientos de factura que
   * arma 4.5 (`journal_entries.invoice_id`).
   */
  function conVes(asientoVes: "ninguno" | "vivo" | "anulado" | "referido") {
    const usd = { ...FACTURAS_DEL_MES[0], id: "fu", base_amount: 600 };
    const ves = { ...FACTURAS_DEL_MES[1], id: "fv", status: "emitida" };
    const entries: Fila[] = [deFactura("e-u", "2025-03-05", "asentado", { invoice_id: "fu" })];
    const lines: Fila[] = [linea("l-u1", "e-u", "cxc", 600, 0), linea("l-u2", "e-u", "ventas", 0, 600)];
    if (asientoVes === "vivo") entries.push(deFactura("e-v", "2025-03-10", "asentado", { invoice_id: "fv" }));
    if (asientoVes === "anulado") entries.push(deFactura("e-v", "2025-03-10", "anulado", { invoice_id: "fv" }));
    if (asientoVes === "referido") {
      entries.push(entrada("e-v", "2025-03-10", "asentado", { source: "referral_credit", invoice_id: "fv" }));
    }
    if (asientoVes !== "ninguno") {
      lines.push(linea("l-v1", "e-v", "cxc", 36500, 0), linea("l-v2", "e-v", "ventas", 0, 36500));
    }
    // `proyectar`: si el lector deja de pedir `invoice_id` en el select, el
    // asiento de la VES no se puede cruzar y la decisión 7 deja de cumplirse.
    return dobleListados(
      { invoices: [usd, ves], accounts: PLAN, journal_entries: entries, journal_lines: lines },
      { serverCap: SERVER_CAP, proyectar: true },
    ).client;
  }

  it("decisión 7 · una USD asentada y una VES SIN asiento, con 4.5 en movimiento: la diferencia normal", async () => {
    const i = await ingresoDelPeriodo(conVes("ninguno"), RANGO_MES);
    expect(i.enOtraMoneda).toBe(0);
    // 600 + 1000 facturados contra los 600 de la USD en 4.5.
    expect(i.diferenciaUsd).toBe(1000);
    expect(describirIngreso(i).estado).toBe("mayor_menor");
  });

  it("decisión 7 · la misma VES CON su asiento `invoice` vivo: «no comparable»", async () => {
    const i = await ingresoDelPeriodo(conVes("vivo"), RANGO_MES);
    expect(i.enOtraMoneda).toBe(1);
    expect(i.diferenciaUsd).toBeNull();
    expect(describirIngreso(i).estado).toBe("no_comparable");
  });

  it("decisión 7 · controles: un asiento anulado o un crédito de referido de la VES no cuentan", async () => {
    for (const caso of ["anulado", "referido"] as const) {
      const i = await ingresoDelPeriodo(conVes(caso), RANGO_MES);
      expect(i.enOtraMoneda, caso).toBe(0);
      expect(describirIngreso(i).estado, caso).not.toBe("no_comparable");
    }
  });
});

describe("saldosDeFacturas", () => {
  it("el rango baja a SQL sobre entry_date, con sus dos topes", async () => {
    const { client, filtros } = dobleListados(
      { accounts: PLAN, journal_entries: [deFactura("e1", "2025-03-05")], journal_lines: [] },
      { serverCap: SERVER_CAP },
    );
    await saldosDeFacturas(client, RANGO_MES, PLAN as unknown as Account[]);
    // Cada página (la de datos y la vacía del final) lleva los dos topes.
    const fechas = filtros.filter((f) => f.table === "journal_entries" && f.col === "entry_date");
    const gte = { table: "journal_entries", op: "gte", col: "entry_date", val: "2025-03-01" };
    const lte = { table: "journal_entries", op: "lte", col: "entry_date", val: "2025-03-18" };
    expect(fechas.length).toBeGreaterThan(0);
    expect(fechas.filter((f) => f.op === "gte")).toEqual(Array(fechas.length / 2).fill(gte));
    expect(fechas.filter((f) => f.op === "lte")).toEqual(Array(fechas.length / 2).fill(lte));
  });

  it("las facturas con asiento salen de la misma lectura: solo asientos `invoice` vivos del rango (decisión 7)", async () => {
    const { client } = dobleListados(
      {
        accounts: PLAN,
        journal_entries: [
          deFactura("e1", "2025-03-05", "asentado", { invoice_id: "f-viva" }),
          deFactura("e2", "2025-03-06", "anulado", { invoice_id: "f-anulado" }),
          deFactura("e3", "2025-03-07", "asentado", { invoice_id: "f-borrado", deleted_at: "2025-03-08T00:00:00Z" }),
          deFactura("e4", "2025-03-25", "asentado", { invoice_id: "f-despues" }),
          entrada("e5", "2025-03-09", "asentado", { source: "referral_credit", invoice_id: "f-referido" }),
        ],
        journal_lines: [linea("l1", "e1", "cxc", 10, 0), linea("l2", "e1", "ventas", 0, 10)],
      },
      { serverCap: SERVER_CAP },
    );
    const r = await saldosDeFacturas(client, RANGO_MES, PLAN as unknown as Account[]);
    expect([...r.facturas]).toEqual(["f-viva"]);
    expect(r.saldos.ventas).toMatchObject({ credit: 10 });
  });

  it("ERR-01 · más de 60 asientos de factura en el rango con 1 fila por respuesta: rechaza con su nombre", async () => {
    const entries: Fila[] = [];
    for (let n = 0; n < 61; n++) entries.push(deFactura(`v${String(n).padStart(3, "0")}`, "2025-03-05"));
    const { client } = dobleListados({ accounts: PLAN, journal_entries: entries, journal_lines: [] }, { serverCap: 1 });
    await expect(saldosDeFacturas(client, RANGO_MES, PLAN as unknown as Account[])).rejects.toThrow(
      /^Control del mayor · asientos de factura: la lectura supera el tope; el control no se puede calcular completo\.$/,
    );
  });

  it("ERR-01 · 30 asientos de factura con 60 líneas y 1 fila por respuesta: rechaza con su nombre", async () => {
    const entries: Fila[] = [];
    const lines: Fila[] = [];
    for (let n = 0; n < 30; n++) {
      const id = `w${String(n).padStart(3, "0")}`;
      entries.push(deFactura(id, "2025-03-05"));
      lines.push(linea(`${id}-d`, id, "cxc", 1, 0), linea(`${id}-h`, id, "ventas", 0, 1));
    }
    const { client } = dobleListados({ accounts: PLAN, journal_entries: entries, journal_lines: lines }, { serverCap: 1 });
    await expect(saldosDeFacturas(client, RANGO_MES, PLAN as unknown as Account[])).rejects.toThrow(
      /^Control del mayor · líneas de factura: la lectura supera el tope; el control no se puede calcular completo\.$/,
    );
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
    // Bajan a SQL los orígenes documentales y la reclasificación (SDD-0562); el
    // cruce de «sin asiento» repite el filtro de origen en memoria.
    expect(filtros).toContainEqual({
      table: "journal_entries",
      op: "in",
      col: "source",
      // SDD-0562: más receipt_reclass, para saber si un recibo identificado ya toca 1.1.2.
      // SDD-0573: más invoice_reversal, para saber qué asiento de venta tiene su contra-asiento.
      val: ["invoice", "receipt", "supplier_bill", "supplier_payment", "receipt_reclass", "invoice_reversal"],
    });
    expect(filtros).toContainEqual({ table: "invoices", op: "is", col: "deleted_at", val: null });
  });

  /**
   * E1 por el recibo: una factura en USD cobrada con un recibo en bolívares
   * cuyo asiento `receipt` está vivo. La factura se asienta en USD, pero el
   * recibo convierte: 1.1.2 deja de ser comparable. Con un recibo en USD o
   * USDT, el caso normal, sigue siendo comparable.
   */
  function conReciboVes(recibo: {
    asiento: string;
    borrado?: boolean;
    moneda?: string;
    /** SDD-0562: sin factura es un pago sin referencia (asentado a 2.1.8). */
    sinFactura?: boolean;
    identificado?: boolean;
    /** Estado de su `receipt_reclass`, unido por receipt_id; sin él, no hay reclasificación. */
    reclasificacion?: string;
  }) {
    const moneda = recibo.moneda ?? "VES";
    const tablas: Record<string, Fila[]> = {
      accounts: PLAN,
      invoices: [
        { id: "f1", invoice_code: "F-1", status: "pagada", issued_at: "2025-03-05", currency: "USD", fx_rate: null, total_amount: 1160, paid_amount: 1160, deleted_at: null },
      ],
      payment_receipts: [
        {
          id: "r1", receipt_code: "R-1", received_at: "2025-03-10", currency: moneda,
          amount: moneda === "VES" ? 42340 : 1160,
          journal_entry_id: "e-r1", deleted_at: recibo.borrado ? "2025-03-11T00:00:00Z" : null,
          invoice_id: recibo.sinFactura ? null : "f1",
          identified_at: recibo.identificado ? "2025-03-12T00:00:00Z" : null,
        },
      ],
      supplier_bills: [],
      supplier_payments: [],
      journal_entries: [
        entrada("e-f1", "2025-03-05", "asentado", { source: "invoice", invoice_id: "f1" }),
        entrada("e-r1", "2025-03-10", recibo.asiento, { source: "receipt", receipt_id: "r1" }),
        ...(recibo.reclasificacion
          ? [entrada("e-r1x", "2025-03-12", recibo.reclasificacion, { source: "receipt_reclass", receipt_id: "r1" })]
          : []),
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

  /** SDD-0562 · el estado de clientes con el recibo del caso, 1.1.2 en movimiento y cuadrado. */
  async function estadoClientes(recibo: Parameters<typeof conReciboVes>[0]) {
    const client = conReciboVes(recibo);
    const accounts = await listAccounts(client);
    const saldos = await accountBalances(client);
    saldos.cxc = { debit: 1160, credit: 1160, balance: 0 };
    const c = await cuadreDelLibro(client, { accounts, saldos, hoy: "2025-03-18" });
    return c.subdiario.clientes.estado;
  }

  it("SDD-0562 · el pago sin referencia en VES (asentado a 2.1.8) no toca 1.1.2: clientes cuadra", async () => {
    expect(await estadoClientes({ asiento: "asentado", sinFactura: true })).toBe("cuadra");
  });

  it("SDD-0562 · el identificado sin reclasificar no toca 1.1.2; con la reclasificación viva, sí", async () => {
    expect(await estadoClientes({ asiento: "asentado", identificado: true })).toBe("cuadra");
    expect(await estadoClientes({ asiento: "asentado", identificado: true, reclasificacion: "anulado" })).toBe("cuadra");
    expect(await estadoClientes({ asiento: "asentado", identificado: true, reclasificacion: "asentado" })).toBe("no_comparable");
  });

  it("E1 por el recibo · en positivo: un recibo vivo en USD, o en USDT, con asiento `receipt` asentado deja clientes en «cuadra»", async () => {
    for (const moneda of ["USD", "USDT"]) {
      const client = conReciboVes({ asiento: "asentado", moneda });
      const accounts = await listAccounts(client);
      const saldos = await accountBalances(client);
      saldos.cxc = { debit: 1160, credit: 1160, balance: 0 };
      const c = await cuadreDelLibro(client, { accounts, saldos, hoy: "2025-03-18" });
      expect(c.subdiario.clientes, moneda).toMatchObject({ estado: "cuadra", diferenciaUsd: 0 });
    }
  });

  /**
   * Decisiones 6 y 7 del Director (2026-10-19, revisables por Sam) por el
   * lector: una factura en VES (36500 Bs a 36,5 = 1000 USD), abierta o pagada,
   * con o sin su asiento `invoice` vivo, contra 1.1.2 con o sin movimiento. El
   * asiento vivo sale del mismo cruce de «documentos sin asiento». Desde la
   * SDD-0563 (enmienda de la decisión 7), la abierta es «no comparable» con
   * asiento o sin él; el asiento vivo decide en la que ya no está abierta.
   */
  async function cuadreConVes(o: {
    asiento: boolean | "anulado" | "referido";
    cxc: { debit: number; credit: number; balance: number };
    pagada?: boolean;
  }) {
    const tablas: Record<string, Fila[]> = {
      accounts: PLAN,
      invoices: [
        {
          id: "fv", invoice_code: "F-V", status: o.pagada ? "pagada" : "emitida", issued_at: "2025-03-05", currency: "VES",
          fx_rate: 36.5, total_amount: 36500, paid_amount: o.pagada ? 36500 : 0, deleted_at: null,
        },
      ],
      payment_receipts: [],
      supplier_bills: [],
      supplier_payments: [],
      journal_entries:
        o.asiento === true
          ? [entrada("e-fv", "2025-03-05", "asentado", { source: "invoice", invoice_id: "fv" })]
          : o.asiento === "anulado"
            ? [entrada("e-fv", "2025-03-05", "anulado", { source: "invoice", invoice_id: "fv" })]
            : o.asiento === "referido"
              ? [entrada("e-fv", "2025-03-05", "asentado", { source: "referral_credit", invoice_id: "fv" })]
              : [],
      journal_lines: [],
    };
    const { client } = dobleListados(tablas, { serverCap: SERVER_CAP });
    const accounts = await listAccounts(client);
    const saldos = await accountBalances(client);
    saldos.cxc = o.cxc;
    return cuadreDelLibro(client, { accounts, saldos, hoy: "2025-03-18" });
  }

  it("decisión 7 · con movimiento en 1.1.2 y la VES con su asiento vivo: «no comparable»", async () => {
    const c = await cuadreConVes({ asiento: true, cxc: { debit: 36500, credit: 0, balance: 36500 } });
    expect(c.subdiario.clientes).toMatchObject({ estado: "no_comparable", diferenciaUsd: null });
  });

  it("enmienda de la decisión 7 (SDD-0563) · con movimiento en 1.1.2 y la VES abierta SIN asiento: «no comparable», y la misma factura sigue en «sin asiento»", async () => {
    const c = await cuadreConVes({ asiento: false, cxc: { debit: 500, credit: 0, balance: 500 } });
    // No se convierte: no suma y vuelve no comparable la cuenta.
    expect(c.subdiario.clientes).toMatchObject({ subdiarioUsd: 0, mayorUsd: 500, diferenciaUsd: null, sinConvertir: 1, estado: "no_comparable" });
    // «Sin asiento» habla del documento; «no comparable», de la cuenta: la factura está en los dos.
    expect(c.documentos.sinAsiento.map((h) => h.codigo)).toEqual(["F-V"]);
  });

  it("decisión 7 · la VES pagada con su asiento vivo: «no comparable»", async () => {
    const c = await cuadreConVes({ asiento: true, pagada: true, cxc: { debit: 500, credit: 0, balance: 500 } });
    expect(c.subdiario.clientes).toMatchObject({ estado: "no_comparable", diferenciaUsd: null });
  });

  it.each([false, "anulado", "referido"] as const)(
    "decisión 7 · la VES pagada con asiento %s: no es vivo, da la diferencia (como en Reportes)",
    async (asiento) => {
      const c = await cuadreConVes({ asiento, pagada: true, cxc: { debit: 500, credit: 0, balance: 500 } });
      expect(c.subdiario.clientes).toMatchObject({ subdiarioUsd: 0, sinConvertir: 0, diferenciaUsd: -500, estado: "no_cuadra" });
    },
  );

  it("decisión 6 · 1.1.2 sin movimiento y la VES abierta: «sin movimiento en el mayor», sin diferencia", async () => {
    const c = await cuadreConVes({ asiento: false, cxc: { debit: 0, credit: 0, balance: 0 } });
    expect(c.subdiario.clientes).toMatchObject({ subdiarioUsd: 0, sinConvertir: 1, mayorUsd: 0, diferenciaUsd: null, estado: "mayor_sin_movimiento" });
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
