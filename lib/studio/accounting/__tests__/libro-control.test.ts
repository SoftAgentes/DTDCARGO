/**
 * SDD-0557 · Controles puros del libro: comprobación, cruce documento ↔
 * asiento, subdiario contra mayor, diario y CSV.
 */
import { describe, expect, it } from "vitest";
import { computeBalances } from "@/lib/studio/account-queries";
import type { Account } from "@/lib/studio/account-types";
import {
  CUENTA_CLIENTES,
  CUENTA_PROVEEDORES,
  DIARIO_CSV_HEADERS,
  avisoDelDiario,
  balanceDeComprobacion,
  comprobacionCsv,
  cruzarDocumentosConAsientos,
  diarioCsv,
  enlaceDelDiario,
  enlaceDelDocumento,
  filasDelDiario,
  nombreDelDiario,
  origenDelAsiento,
  rangoDelDiario,
  sinAsientoCsv,
  subdiarioCsv,
  type AsientoDeDocumento,
  type DocumentoContable,
} from "../libro-control";
import { cuadreSubdiario, type SaldoDocumento } from "../subdiario";
import { SALES_AR_CODE } from "../invoice-posting";
import { PAYABLE_AP_CODE } from "../bill-posting";

const acc = (id: string, code: string, type: Account["type"], name = code): Account => ({
  id, code, type, name, tenant_id: "t", parent_id: null, qbo_type: null, subtype: null,
  is_postable: true, notes: null, created_at: "", updated_at: "",
});

// Plan con grupos (1, 1.1, 1.1.1…) y hojas, como el seed.
const PLAN = [
  acc("a", "1", "A", "Activo"),
  acc("a1", "1.1", "A", "Activo corriente"),
  acc("banco", "1.1.1", "A", "Banco"),
  acc("cxc", "1.1.2", "A", "Cuentas por cobrar"),
  acc("p", "2", "P", "Pasivo"),
  acc("p1", "2.1", "P", "Pasivo corriente"),
  acc("cxp", "2.1.1", "P", "Cuentas por pagar"),
  acc("iva", "2.1.5", "P", "IVA por pagar"),
  acc("pt", "3", "PT", "Patrimonio"),
  acc("cap", "3.1", "PT", "Capital"),
  acc("i", "4", "I", "Ingresos"),
  acc("ventas", "4.5", "I", "Otros ingresos por servicios"),
];

describe("balanceDeComprobacion", () => {
  it("toma los movimientos directos (no el rollup) y cuadra", () => {
    const saldos = computeBalances(PLAN, [
      { account_id: "banco", debit: 10000, credit: 0 },
      { account_id: "cap", debit: 0, credit: 10000 },
      { account_id: "cxc", debit: 1160, credit: 0 },
      { account_id: "ventas", debit: 0, credit: 1000 },
      { account_id: "iva", debit: 0, credit: 160 },
    ]);
    const b = balanceDeComprobacion(PLAN, saldos, "2025-03-18");
    // Solo hojas con movimiento; los grupos sumarían el doble.
    expect(b.filas.map((f) => f.code)).toEqual(["1.1.1", "1.1.2", "2.1.5", "3.1", "4.5"]);
    expect(b.totalDebe).toBe(11160);
    expect(b.totalHaber).toBe(11160);
    expect(b.totalDeudor).toBe(11160);
    expect(b.totalAcreedor).toBe(11160);
    expect(b.cuadra).toBe(true);
    expect(b.filas.find((f) => f.code === "4.5")).toMatchObject({ debe: 0, haber: 1000, saldoDeudor: 0, saldoAcreedor: 1000 });
  });

  it("una cuenta con hija y movimientos propios trae solo lo suyo", () => {
    const plan = [acc("x", "5", "G"), acc("x1", "5.1", "G")];
    const saldos = computeBalances(plan, [
      { account_id: "x", debit: 30, credit: 0 },
      { account_id: "x1", debit: 70, credit: 0 },
    ]);
    const b = balanceDeComprobacion(plan, saldos, "2025-03-18");
    expect(b.filas.map((f) => [f.code, f.debe])).toEqual([["5", 30], ["5.1", 70]]);
    expect(b.totalDebe).toBe(100);
  });

  it("descuadre: cuadra false y la diferencia", () => {
    const saldos = computeBalances(PLAN, [
      { account_id: "banco", debit: 100, credit: 0 },
      { account_id: "cap", debit: 0, credit: 90 },
    ]);
    const b = balanceDeComprobacion(PLAN, saldos, "2025-03-18");
    expect(b.cuadra).toBe(false);
    expect(b.diferencia).toBe(10);
  });

  it("CSV: cabecera exacta, una fila por cuenta y sin fila de totales; null si está vacío", () => {
    const saldos = computeBalances(PLAN, [
      { account_id: "banco", debit: 100, credit: 0 },
      { account_id: "cap", debit: 0, credit: 100 },
    ]);
    const csv = comprobacionCsv(balanceDeComprobacion(PLAN, saldos, "2025-03-18"), new Date("2025-03-18T12:00:00Z"))!;
    const lineas = csv.content.split("\r\n");
    expect(lineas[0]).toBe("Cuenta,Nombre,Tipo,Debe,Haber,Saldo deudor,Saldo acreedor");
    expect(lineas).toHaveLength(3);
    expect(lineas[1]).toBe("1.1.1,Banco,A,100,0,100,0");
    expect(csv.filename).toBe("reporte-contable-balance-comprobacion-2025-03-18-2025-03-18.csv");
    expect(comprobacionCsv(balanceDeComprobacion(PLAN, computeBalances(PLAN, []), "2025-03-18"))).toBeNull();
  });
});

const doc = (p: Partial<DocumentoContable> & Pick<DocumentoContable, "tipo" | "id">): DocumentoContable => ({
  codigo: p.id.toUpperCase(),
  fecha: "2025-03-05",
  moneda: "USD",
  monto: 100,
  vivo: true,
  journal_entry_id: null,
  ...p,
});
const asiento = (p: Partial<AsientoDeDocumento> & Pick<AsientoDeDocumento, "id" | "source">): AsientoDeDocumento => ({
  status: "asentado",
  deleted_at: null,
  invoice_id: null,
  receipt_id: null,
  bill_id: null,
  supplier_payment_id: null,
  ...p,
});

describe("cruzarDocumentosConAsientos (definiciones canónicas de la SDD-0559)", () => {
  it("factura sin asiento; recibo con solo un asiento anulado; CxP y pago asentados no figuran", () => {
    const r = cruzarDocumentosConAsientos(
      [
        doc({ tipo: "factura", id: "f1" }),
        doc({ tipo: "recibo", id: "r1", journal_entry_id: "e-r1" }),
        doc({ tipo: "cxp", id: "b1" }),
        doc({ tipo: "pago_proveedor", id: "p1" }),
      ],
      [
        asiento({ id: "e-r1", source: "receipt", status: "anulado", receipt_id: "r1" }),
        asiento({ id: "e-b1", source: "supplier_bill", bill_id: "b1" }),
        asiento({ id: "e-p1", source: "supplier_payment", supplier_payment_id: "p1" }),
      ],
    );
    expect(r.sinAsiento.map((h) => [h.tipo, h.motivo])).toEqual([
      ["factura", "sin_asiento"],
      ["recibo", "asiento_anulado"],
    ]);
    expect(r.conteo.cxp).toEqual({ revisados: 1, sinAsiento: 0, sinMonto: 0, anuladosConAsiento: 0 });
  });

  it("el crédito de referido guarda invoice_id pero NO es el asiento de venta", () => {
    const r = cruzarDocumentosConAsientos(
      [doc({ tipo: "factura", id: "f1" })],
      [asiento({ id: "e1", source: "referral_credit", invoice_id: "f1" })],
    );
    expect(r.sinAsiento).toHaveLength(1);
    expect(r.sinAsiento[0].motivo).toBe("sin_asiento");
  });

  it("el vínculo vale en los dos sentidos: solo journal_entry_id del documento también cuenta", () => {
    const r = cruzarDocumentosConAsientos(
      [doc({ tipo: "cxp", id: "b1", journal_entry_id: "e-b1" })],
      [asiento({ id: "e-b1", source: "supplier_bill", bill_id: null })],
    );
    expect(r.sinAsiento).toEqual([]);
  });

  it("un asiento borrado (deleted_at) no es vivo", () => {
    const r = cruzarDocumentosConAsientos(
      [doc({ tipo: "factura", id: "f1" })],
      [asiento({ id: "e1", source: "invoice", invoice_id: "f1", deleted_at: "2025-03-06T00:00:00Z" })],
    );
    expect(r.sinAsiento).toHaveLength(1);
  });

  it("anulados con asiento vivo van aparte; un monto ≤ 0 lleva «sin monto»", () => {
    const r = cruzarDocumentosConAsientos(
      [
        doc({ tipo: "factura", id: "f9", vivo: false }),
        doc({ tipo: "recibo", id: "r9", vivo: false }),
        doc({ tipo: "factura", id: "f0", monto: 0 }),
        doc({ tipo: "cxp", id: "b0", monto: -5 }),
      ],
      [
        asiento({ id: "e1", source: "invoice", invoice_id: "f9" }),
        asiento({ id: "e2", source: "receipt", receipt_id: "r9" }),
      ],
    );
    expect(r.anuladosConAsiento.map((h) => [h.tipo, h.motivo])).toEqual([
      ["factura", "anulado_con_asiento_vivo"],
      ["recibo", "anulado_con_asiento_vivo"],
    ]);
    expect(r.sinAsiento.map((h) => [h.codigo, h.motivo])).toEqual([
      ["F0", "sin_monto"],
      ["B0", "sin_monto"],
    ]);
    expect(r.conteo.factura).toEqual({ revisados: 2, sinAsiento: 0, sinMonto: 1, anuladosConAsiento: 1 });
  });

  it("orden: tipo, fecha y código; enlaces al documento", () => {
    const r = cruzarDocumentosConAsientos(
      [
        doc({ tipo: "recibo", id: "r1", codigo: "R-2", fecha: "2025-03-02" }),
        doc({ tipo: "factura", id: "f2", codigo: "F-2", fecha: "2025-03-09" }),
        doc({ tipo: "factura", id: "f1", codigo: "F-1", fecha: "2025-03-01" }),
      ],
      [],
    );
    expect(r.sinAsiento.map((h) => h.codigo)).toEqual(["F-1", "F-2", "R-2"]);
    expect(r.sinAsiento[0].enlace).toBe("/studio/facturacion/F-1");
    expect(enlaceDelDocumento("recibo", "R 1")).toBe("/studio/cobranzas/recibo/R%201");
    expect(enlaceDelDocumento("cxp", "CXP-1")).toBe("/studio/tesoreria");
  });

  it("CSV de documentos: cabecera y las dos listas", () => {
    const r = cruzarDocumentosConAsientos(
      [doc({ tipo: "factura", id: "f1" }), doc({ tipo: "factura", id: "f9", vivo: false })],
      [asiento({ id: "e1", source: "invoice", invoice_id: "f9" })],
    );
    const csv = sinAsientoCsv(r, new Date("2025-03-18T12:00:00Z"))!;
    expect(csv.content.split("\r\n")).toEqual([
      "Tipo,Documento,Fecha,Moneda,Monto,Motivo",
      "Factura,F1,2025-03-05,USD,100,Sin asiento",
      "Factura,F9,2025-03-05,USD,100,Anulado con asiento vivo",
    ]);
    expect(csv.filename).toBe("reporte-contable-documentos-sin-asiento-2025-03-18.csv");
    expect(sinAsientoCsv(cruzarDocumentosConAsientos([], []))).toBeNull();
  });
});

const saldo = (p: Partial<SaldoDocumento>): SaldoDocumento => ({
  status: "emitida",
  currency: "USD",
  fx_rate: null,
  total_amount: 0,
  paid_amount: 0,
  ...p,
});
const mayor = (s: number) => ({ saldo: s, debe: Math.max(s, 0) + 1, haber: 1 });

describe("cuadreSubdiario", () => {
  const facturas = [
    saldo({ total_amount: 300 }),
    saldo({ total_amount: 1000, paid_amount: 1000, status: "pagada" }),
    saldo({ total_amount: 500, status: "borrador" }),
    saldo({ total_amount: 700, status: "anulada" }),
    saldo({ total_amount: 0, paid_amount: 50, status: "parcial" }),
    saldo({ total_amount: 100, currency: "USDT" }),
  ];

  it("clientes: abiertas suman (con signo); borrador, anulada y pagada no", () => {
    const s = cuadreSubdiario({
      fecha: "2025-03-18",
      facturas,
      cxp: [],
      recibosNoUsdConAsiento: 0,
      mayorClientes: mayor(0),
      mayorProveedores: null,
    });
    expect(s.clientes).toMatchObject({
      cuenta: "1.1.2",
      subdiarioUsd: 350,
      mayorUsd: 0,
      diferenciaUsd: 350,
      documentos: 3,
      estado: "no_cuadra",
    });
    expect(s.proveedores.estado).toBe("sin_cuenta");
    expect(s.proveedores.diferenciaUsd).toBeNull();
  });

  it("clientes: con una factura no borrador en VES o CNY no es comparable (B2, E1)", () => {
    const s = cuadreSubdiario({
      fecha: "2025-03-18",
      facturas: [...facturas, saldo({ currency: "VES", fx_rate: 36.5, total_amount: 3650, paid_amount: 3650, status: "pagada" })],
      cxp: [],
      recibosNoUsdConAsiento: 0,
      mayorClientes: mayor(350),
      mayorProveedores: null,
    });
    expect(s.clientes.estado).toBe("no_comparable");
    expect(s.clientes.diferenciaUsd).toBeNull();
    const conRecibo = cuadreSubdiario({
      fecha: "2025-03-18",
      facturas,
      cxp: [],
      recibosNoUsdConAsiento: 1,
      mayorClientes: mayor(350),
      mayorProveedores: null,
    });
    expect(conRecibo.clientes.estado).toBe("no_comparable");
  });

  it("proveedores: la regla del asiento (billAmountUsd); una CxP en CNY con tasa cuadra", () => {
    const s = cuadreSubdiario({
      fecha: "2025-03-18",
      facturas: [],
      cxp: [
        saldo({ status: "pendiente", total_amount: 200 }),
        saldo({ status: "anulada", total_amount: 999 }),
        saldo({ status: "pendiente", currency: "CNY", fx_rate: 7.2, total_amount: 720 }),
      ],
      recibosNoUsdConAsiento: 0,
      mayorClientes: mayor(0),
      mayorProveedores: mayor(300),
    });
    expect(s.proveedores).toMatchObject({ cuenta: "2.1.1", subdiarioUsd: 300, diferenciaUsd: 0, documentos: 2, estado: "cuadra" });
  });

  it("0 contra 0 sin movimiento en la cuenta no es «cuadra»", () => {
    const s = cuadreSubdiario({
      fecha: "2025-03-18",
      facturas: [],
      cxp: [],
      recibosNoUsdConAsiento: 0,
      mayorClientes: { saldo: 0, debe: 0, haber: 0 },
      mayorProveedores: { saldo: 0, debe: 50, haber: 50 },
    });
    expect(s.clientes.estado).toBe("sin_movimiento");
    expect(s.proveedores.estado).toBe("cuadra");
  });

  it("CSV del subdiario", () => {
    const s = cuadreSubdiario({
      fecha: "2025-03-18",
      facturas: [saldo({ total_amount: 10 })],
      cxp: [],
      recibosNoUsdConAsiento: 0,
      mayorClientes: mayor(10),
      mayorProveedores: null,
    });
    const csv = subdiarioCsv(s, new Date("2025-03-18T12:00:00Z"));
    expect(csv.content.split("\r\n")).toEqual([
      "Cuenta,Nombre,Subdiario USD,Mayor USD,Diferencia USD,Documentos,Sin convertir,Estado",
      "1.1.2,Clientes,10,10,0,1,0,Cuadra",
      "2.1.1,Proveedores,0,,,0,0,Cuenta no encontrada",
    ]);
    expect(csv.filename).toBe("reporte-contable-subdiario-contra-mayor-2025-03-18-2025-03-18.csv");
  });
});

describe("diario", () => {
  const cuentas = new Map([
    ["banco", { code: "1.1.1", name: "Banco" }],
    ["cxc", { code: "1.1.2", name: "Cuentas por cobrar" }],
    ["ventas", { code: "4.5", name: "Otros ingresos por servicios" }],
  ]);
  const linea = (id: string, account_id: string, debit: number, credit: number, line_memo: string | null = null) => ({
    id, account_id, debit, credit, line_memo,
  });

  it("una fila por línea, en orden de fecha, asiento y debe antes que haber", () => {
    const filas = filasDelDiario(
      [
        { id: "e2", entry_code: "A-2025-0002", entry_date: "2025-03-09", memo: "Cobro R-1", source: "receipt", lines: [linea("l3", "cxc", 0, 50), linea("l4", "banco", 50, 0)] },
        { id: "e1", entry_code: "A-2025-0001", entry_date: "2025-03-05", memo: "Factura F-1", source: "invoice", lines: [linea("l2", "ventas", 0, 100), linea("l1", "cxc", 100, 0)] },
      ],
      cuentas,
    );
    expect(filas.map((f) => [f.asiento, f.cuenta, f.debe, f.haber])).toEqual([
      ["A-2025-0001", "1.1.2", 100, 0],
      ["A-2025-0001", "4.5", 0, 100],
      ["A-2025-0002", "1.1.1", 50, 0],
      ["A-2025-0002", "1.1.2", 0, 50],
    ]);
    expect(filas[0]).toMatchObject({ origen: "Factura", concepto: "Factura F-1", nombreCuenta: "Cuentas por cobrar" });
  });

  it("origenDelAsiento no colapsa a «Manual» lo que no es manual", () => {
    expect(origenDelAsiento("invoice")).toBe("Factura");
    expect(origenDelAsiento("manual")).toBe("Manual");
    expect(origenDelAsiento("claim")).toBe("claim");
    expect(origenDelAsiento("referral_credit")).toBe("referral_credit");
  });

  it("CSV: BOM, cabecera exacta, CRLF y fórmulas neutralizadas", () => {
    const csv = diarioCsv(
      filasDelDiario(
        [{ id: "e1", entry_code: "A-1", entry_date: "2025-03-05", memo: '=HYPERLINK("http://x","y")', source: "manual", lines: [linea("l1", "banco", 10, 0, "+1+1")] }],
        cuentas,
      ),
    );
    expect(csv.startsWith("﻿")).toBe(true);
    const lineas = csv.slice(1).split("\r\n");
    expect(lineas[0]).toBe(DIARIO_CSV_HEADERS.join(","));
    expect(lineas[1]).toBe('2025-03-05,A-1,Manual,"\'=HYPERLINK(""http://x"",""y"")",1.1.1,Banco,10,0,\'+1+1');
  });

  it("rango del diario: opcionales, validados igual que en la ruta", () => {
    expect(rangoDelDiario(null, null)).toEqual({ rango: {}, error: null });
    expect(rangoDelDiario("", "2025-03-18")).toEqual({ rango: { to: "2025-03-18" }, error: null });
    expect(rangoDelDiario("2025-13-01", null).error).toContain("«2025-13-01»");
    expect(rangoDelDiario("2025-03-10", "2025-03-01").error).toMatch(/al revés/);
    expect(enlaceDelDiario()).toBe("/api/studio/contabilidad/export?tipo=diario");
    expect(enlaceDelDiario({ to: "2025-03-18" })).toBe("/api/studio/contabilidad/export?tipo=diario&hasta=2025-03-18");
    expect(nombreDelDiario({}, "2025-03-18")).toBe("diario-inicio-a-2025-03-18.csv");
    expect(nombreDelDiario({ from: "2025-03-01", to: "2025-03-10" }, "2025-03-18")).toBe("diario-2025-03-01-a-2025-03-10.csv");
  });

  it("aviso de la pantalla", () => {
    expect(avisoDelDiario(500, 1234)).toBe("Mostrando 500 de 1.234 asientos (los más recientes).");
    expect(avisoDelDiario(10, 10)).toBeNull();
  });
});

describe("anti-deriva", () => {
  it("las cuentas de control son las del posting", () => {
    expect(CUENTA_CLIENTES).toBe(SALES_AR_CODE);
    expect(CUENTA_PROVEEDORES).toBe(PAYABLE_AP_CODE);
  });
});
