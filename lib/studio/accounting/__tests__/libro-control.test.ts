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
  notasDelSubdiario,
  origenDelAsiento,
  pedidoDeReportes,
  rangoDelDiario,
  ROTULO_DIARIO_CSV,
  sinAsientoCsv,
  subdiarioCsv,
  textoDelConteo,
  type AsientoDeDocumento,
  type DocumentoContable,
  reciboVuelveNoComparable,
  reclasificacionesPorRecibo,
} from "../libro-control";
import { cuadreSubdiario, type FacturaDelSubdiario } from "../subdiario";
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
    expect(r.conteo.cxp).toEqual({ revisados: 1, vivos: 1, anulados: 0, sinAsiento: 0, sinMonto: 0, anuladosConAsiento: 0 });
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
    expect(r.conteo.factura).toEqual({ revisados: 2, vivos: 1, anulados: 1, sinAsiento: 0, sinMonto: 1, anuladosConAsiento: 1 });
  });

  it("«X sin asiento de N vivas»: el denominador son los vivos; los anulados van aparte", () => {
    // 2 facturas vivas sin asiento y 3 anuladas: con los anulados en el
    // denominador diría «2 sin asiento de 5», que se lee como 40 %.
    const r = cruzarDocumentosConAsientos(
      [
        doc({ tipo: "factura", id: "f1" }),
        doc({ tipo: "factura", id: "f2" }),
        doc({ tipo: "factura", id: "f7", vivo: false }),
        doc({ tipo: "factura", id: "f8", vivo: false }),
        doc({ tipo: "factura", id: "f9", vivo: false }),
        doc({ tipo: "recibo", id: "r1", journal_entry_id: "e-r1" }),
        doc({ tipo: "pago_proveedor", id: "p9", vivo: false }),
        doc({ tipo: "cxp", id: "b0", monto: 0 }),
      ],
      [asiento({ id: "e-r1", source: "receipt", receipt_id: "r1" })],
    );
    expect(textoDelConteo("factura", r.conteo.factura)).toBe("Factura: 2 sin asiento de 2 vivas · 3 anuladas aparte");
    expect(textoDelConteo("recibo", r.conteo.recibo)).toBe("Recibo: 0 sin asiento de 1 vivo");
    expect(textoDelConteo("pago_proveedor", r.conteo.pago_proveedor)).toBe(
      "Pago a proveedor: 0 sin asiento de 0 vivos · 1 anulado aparte",
    );
    expect(textoDelConteo("cxp", r.conteo.cxp)).toBe("CxP: 0 sin asiento de 1 viva · 1 sin monto");
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

  it("orden en la disposición infeliz: la fecha manda sobre el código", () => {
    // F-1 es posterior a F-9: ordenar por código daría F-1 primero.
    const r = cruzarDocumentosConAsientos(
      [
        doc({ tipo: "factura", id: "f1", codigo: "F-1", fecha: "2025-03-09" }),
        doc({ tipo: "factura", id: "f9", codigo: "F-9", fecha: "2025-03-01" }),
      ],
      [],
    );
    expect(r.sinAsiento.map((h) => h.codigo)).toEqual(["F-9", "F-1"]);
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

/** Por defecto sin asiento vivo: solo cuenta para «no comparable» con `asientoVivo: true`. */
const saldo = (p: Partial<FacturaDelSubdiario>): FacturaDelSubdiario => ({
  status: "emitida",
  currency: "USD",
  fx_rate: null,
  total_amount: 0,
  paid_amount: 0,
  asientoVivo: false,
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

  it("clientes: con una factura no borrador en VES o CNY CON su asiento vivo no es comparable (B2, E1, decisión 7)", () => {
    const ves = saldo({ currency: "VES", fx_rate: 36.5, total_amount: 3650, paid_amount: 3650, status: "pagada", asientoVivo: true });
    const s = cuadreSubdiario({
      fecha: "2025-03-18",
      facturas: [...facturas, ves],
      cxp: [],
      recibosNoUsdConAsiento: 0,
      mayorClientes: mayor(350),
      mayorProveedores: null,
    });
    expect(s.clientes.estado).toBe("no_comparable");
    expect(s.clientes.diferenciaUsd).toBeNull();
    // Control: la misma VES SIN asiento no mete el nominal en 1.1.2 y no cuenta.
    const sinAsiento = cuadreSubdiario({
      fecha: "2025-03-18",
      facturas: [...facturas, { ...ves, asientoVivo: false }],
      cxp: [],
      recibosNoUsdConAsiento: 0,
      mayorClientes: mayor(350),
      mayorProveedores: null,
    });
    expect(sinAsiento.clientes).toMatchObject({ estado: "cuadra", diferenciaUsd: 0 });
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

  it("proveedores: una CxP en otra moneda SIN tasa suma su nominal y se cuenta aparte; la nota y el CSV lo dicen", () => {
    const s = cuadreSubdiario({
      fecha: "2025-03-18",
      facturas: [],
      cxp: [
        saldo({ status: "pendiente", total_amount: 200 }),
        saldo({ status: "pendiente", currency: "CNY", fx_rate: null, total_amount: 70000 }),
        saldo({ status: "pendiente", currency: "VES", fx_rate: 0, total_amount: 500 }),
        // Con tasa, sin saldo o anulada: no cuentan.
        saldo({ status: "pendiente", currency: "CNY", fx_rate: 7, total_amount: 700 }),
        saldo({ status: "pagada", currency: "CNY", fx_rate: null, total_amount: 90, paid_amount: 90 }),
        saldo({ status: "anulada", currency: "CNY", fx_rate: null, total_amount: 999 }),
        // USDT sin tasa tampoco: va 1:1, ya está en USD.
        saldo({ status: "pendiente", currency: "USDT", fx_rate: null, total_amount: 40 }),
      ],
      recibosNoUsdConAsiento: 0,
      mayorClientes: mayor(0),
      mayorProveedores: mayor(70840),
    });
    // 200 + 70000 (nominal) + 500 (nominal) + 100 + 40 (USDT) = 70840, como el asiento.
    expect(s.proveedores).toMatchObject({ subdiarioUsd: 70840, documentos: 5, sinTasa: 2, estado: "cuadra" });
    expect(s.clientes.sinTasa).toBe(0);
    expect(notasDelSubdiario(s)).toContain("2 CxP sin tasa van al nominal, como su asiento: el saldo no está en USD.");
    const una = cuadreSubdiario({
      fecha: "2025-03-18",
      facturas: [],
      cxp: [saldo({ status: "pendiente", currency: "CNY", fx_rate: null, total_amount: 10 })],
      recibosNoUsdConAsiento: 0,
      mayorClientes: mayor(0),
      mayorProveedores: mayor(10),
    });
    expect(notasDelSubdiario(una)).toEqual(["1 CxP sin tasa va al nominal, como su asiento: el saldo no está en USD."]);
    expect(subdiarioCsv(s).content.split("\r\n")[2]).toBe("2.1.1,Proveedores,70840,70840,0,5,0,2,Cuadra");
  });

  it("notas del subdiario: no comparable y facturas sin convertir de clientes", () => {
    const s = cuadreSubdiario({
      fecha: "2025-03-18",
      facturas: [saldo({ currency: "CNY", total_amount: 100, asientoVivo: true })],
      cxp: [],
      recibosNoUsdConAsiento: 0,
      mayorClientes: mayor(0),
      mayorProveedores: mayor(0),
    });
    expect(notasDelSubdiario(s)).toEqual([
      "Clientes no es comparable: hay facturas o recibos en bolívares o yuanes con su asiento vivo; hoy la factura se asienta por su monto nominal y el cobro la convierte.",
      "1 factura con saldo no suma: está en bolívares sin tasa o en yuanes.",
    ]);
  });

  /**
   * Decisión 6 del Director (2026-10-19, revisable por Sam): el mayor vacío
   * gana también en el subdiario. Con la cuenta de control sin debe ni haber
   * y documentos con saldo, no hay diferencia ni «no comparable»: esos
   * documentos no tienen asiento. Es el caso real de hoy.
   */
  describe("el mayor vacío gana (decisión 6)", () => {
    const VACIO = { saldo: 0, debe: 0, haber: 0 };
    const vesAbierta = saldo({ currency: "VES", fx_rate: 36.5, total_amount: 36500 });

    it("1.1.2 sin movimiento con una factura abierta en VES: «sin movimiento en el mayor», sin diferencia", () => {
      const s = cuadreSubdiario({
        fecha: "2025-03-18",
        facturas: [vesAbierta],
        cxp: [],
        recibosNoUsdConAsiento: 0,
        mayorClientes: VACIO,
        mayorProveedores: null,
      });
      expect(s.clientes).toMatchObject({
        subdiarioUsd: 1000,
        mayorUsd: 0,
        diferenciaUsd: null,
        documentos: 1,
        estado: "mayor_sin_movimiento",
      });
      expect(notasDelSubdiario(s)).toEqual([
        "Sin movimiento en el mayor (cuenta 1.1.2): las facturas abiertas no llegaron al mayor.",
      ]);
      // El CSV lleva el estado nuevo y la diferencia vacía.
      expect(subdiarioCsv(s).content.split("\r\n")[1]).toBe("1.1.2,Clientes,1000,0,,1,0,0,Sin movimiento en el mayor");
    });

    it("gana sobre «no comparable»: con la VES asentada o un recibo VES con asiento, igual dice «sin movimiento en el mayor»", () => {
      for (const [factura, recibos] of [
        [{ ...vesAbierta, asientoVivo: true }, 0],
        [vesAbierta, 1],
      ] as const) {
        const s = cuadreSubdiario({
          fecha: "2025-03-18",
          facturas: [factura],
          cxp: [],
          recibosNoUsdConAsiento: recibos,
          mayorClientes: VACIO,
          mayorProveedores: null,
        });
        expect(s.clientes).toMatchObject({ estado: "mayor_sin_movimiento", diferenciaUsd: null });
        expect(notasDelSubdiario(s).some((n) => n.includes("no es comparable"))).toBe(false);
      }
    });

    it("también con una abierta que no suma (VES sin tasa): hay documentos abiertos aunque el saldo en USD sea 0", () => {
      const s = cuadreSubdiario({
        fecha: "2025-03-18",
        facturas: [saldo({ currency: "VES", fx_rate: null, total_amount: 500 })],
        cxp: [],
        recibosNoUsdConAsiento: 0,
        mayorClientes: VACIO,
        mayorProveedores: null,
      });
      expect(s.clientes).toMatchObject({ subdiarioUsd: 0, sinConvertir: 1, estado: "mayor_sin_movimiento", diferenciaUsd: null });
    });

    it("proveedores, por simetría: 2.1.1 sin movimiento con una CxP abierta", () => {
      const s = cuadreSubdiario({
        fecha: "2025-03-18",
        facturas: [],
        cxp: [saldo({ status: "pendiente", total_amount: 300 })],
        recibosNoUsdConAsiento: 0,
        mayorClientes: mayor(0),
        mayorProveedores: VACIO,
      });
      expect(s.proveedores).toMatchObject({ subdiarioUsd: 300, diferenciaUsd: null, estado: "mayor_sin_movimiento" });
      expect(notasDelSubdiario(s)).toEqual([
        "Sin movimiento en el mayor (cuenta 2.1.1): las CxP abiertas no llegaron al mayor.",
      ]);
      expect(subdiarioCsv(s).content.split("\r\n")[2]).toBe("2.1.1,Proveedores,300,0,,1,0,0,Sin movimiento en el mayor");
    });

    it("controles: con movimiento en la cuenta vuelve la diferencia; sin documentos abiertos es «sin movimiento»", () => {
      const conMovimiento = cuadreSubdiario({
        fecha: "2025-03-18",
        facturas: [vesAbierta],
        cxp: [saldo({ status: "pendiente", total_amount: 300 })],
        recibosNoUsdConAsiento: 0,
        mayorClientes: { saldo: 0, debe: 500, haber: 500 },
        mayorProveedores: { saldo: 0, debe: 100, haber: 100 },
      });
      expect(conMovimiento.clientes).toMatchObject({ estado: "no_cuadra", diferenciaUsd: 1000 });
      expect(conMovimiento.proveedores).toMatchObject({ estado: "no_cuadra", diferenciaUsd: 300 });
      // Una pagada (sin saldo) no es un documento abierto.
      const sinAbiertas = cuadreSubdiario({
        fecha: "2025-03-18",
        facturas: [saldo({ total_amount: 100, paid_amount: 100, status: "pagada" })],
        cxp: [],
        recibosNoUsdConAsiento: 0,
        mayorClientes: VACIO,
        mayorProveedores: VACIO,
      });
      expect(sinAbiertas.clientes.estado).toBe("sin_movimiento");
      expect(sinAbiertas.proveedores.estado).toBe("sin_movimiento");
    });
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
      "Cuenta,Nombre,Subdiario USD,Mayor USD,Diferencia USD,Documentos,Sin convertir,Sin tasa (al nominal: no USD),Estado",
      "1.1.2,Clientes,10,10,0,1,0,0,Cuadra",
      "2.1.1,Proveedores,0,,,0,0,0,Cuenta no encontrada",
    ]);
    expect(csv.filename).toBe("reporte-contable-subdiario-contra-mayor-2025-03-18-2025-03-18.csv");
  });
});

describe("diario", () => {
  const cuentas = new Map([
    ["banco", { code: "1.1.1", name: "Banco" }],
    ["cxc", { code: "1.1.2", name: "Cuentas por cobrar" }],
    ["ventas", { code: "4.5", name: "Otros ingresos por servicios" }],
    ["gasto", { code: "6.1", name: "Gastos generales" }],
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

  it("orden en la disposición infeliz: la fecha manda sobre el código y el debe va primero aunque su cuenta sea mayor", () => {
    const filas = filasDelDiario(
      [
        // Código MENOR y fecha POSTERIOR: si se ordenara por código saldría primero.
        { id: "e1", entry_code: "A-2025-0001", entry_date: "2025-03-20", memo: "Cargado tarde", source: "manual", lines: [linea("l1", "banco", 5, 0), linea("l2", "ventas", 0, 5)] },
        // El debe va a 6.1 y el haber a 1.1.1: por código de cuenta, el haber iría antes.
        { id: "e9", entry_code: "A-2025-0009", entry_date: "2025-03-02", memo: "Gasto", source: "manual", lines: [linea("l3", "banco", 0, 40), linea("l4", "gasto", 40, 0)] },
      ],
      cuentas,
    );
    expect(filas.map((f) => [f.asiento, f.cuenta, f.debe, f.haber])).toEqual([
      ["A-2025-0009", "6.1", 40, 0],
      ["A-2025-0009", "1.1.1", 0, 40],
      ["A-2025-0001", "1.1.1", 5, 0],
      ["A-2025-0001", "4.5", 0, 5],
    ]);
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

  it("aviso de la pantalla: dice cuántos asentados trae el CSV", () => {
    expect(avisoDelDiario(500, 1234, 900)).toBe(
      "Mostrando 500 de 1.234 asientos (los más recientes). El CSV trae solo los 900 asentados.",
    );
    expect(avisoDelDiario(500, 501, 1)).toBe(
      "Mostrando 500 de 501 asientos (los más recientes). El CSV trae solo 1 asentado.",
    );
    expect(avisoDelDiario(10, 10, 10)).toBeNull();
    expect(ROTULO_DIARIO_CSV).toBe("Descargar el diario asentado (CSV)");
  });
});

describe("pedidoDeReportes (la decisión de la página, DAT-01)", () => {
  const HOY = "2025-03-18";

  it("sin fechas: el mes en curso, y se calcula", () => {
    expect(pedidoDeReportes(undefined, undefined, HOY)).toEqual({
      filtro: { desde: "2025-03-01", hasta: "2025-03-18", error: null },
      rango: { from: "2025-03-01", to: "2025-03-18" },
    });
  });

  it("rango al revés, fecha inválida o una sola fecha: el error y NADA que calcular", () => {
    for (const [d, h] of [
      ["2025-03-10", "2025-03-01"],
      ["2025-02-30", "2025-03-01"],
      ["2025-03-01", ""],
    ]) {
      const p = pedidoDeReportes(d, h, HOY);
      expect(p.rango).toBeNull();
      expect(p.filtro.error).not.toBeNull();
      expect(p.filtro.desde).toBe(d);
    }
  });

  it("fechas válidas: ese rango, sin error", () => {
    expect(pedidoDeReportes("2025-01-01", "2025-01-31", HOY)).toEqual({
      filtro: { desde: "2025-01-01", hasta: "2025-01-31", error: null },
      rango: { from: "2025-01-01", to: "2025-01-31" },
    });
  });
});

describe("anti-deriva", () => {
  it("las cuentas de control son las del posting", () => {
    expect(CUENTA_CLIENTES).toBe(SALES_AR_CODE);
    expect(CUENTA_PROVEEDORES).toBe(PAYABLE_AP_CODE);
  });
});

describe("SDD-0562 · el recibo que vuelve «no comparable» a clientes (definición de la radiografía)", () => {
  const base = { vivo: true, moneda: "VES", conFactura: true, identificado: false, asientosCobro: 1, reclasificaciones: 0 };

  it("cuenta el recibo vivo en VES o CNY, con factura y con su asiento de cobro vivo", () => {
    expect(reciboVuelveNoComparable(base)).toBe(true);
    expect(reciboVuelveNoComparable({ ...base, moneda: "CNY" })).toBe(true);
  });

  it("no cuenta: anulado, en USD o USDT, sin asiento, sin factura (pago sin referencia, va a 2.1.8)", () => {
    expect(reciboVuelveNoComparable({ ...base, vivo: false })).toBe(false);
    expect(reciboVuelveNoComparable({ ...base, moneda: "USD" })).toBe(false);
    expect(reciboVuelveNoComparable({ ...base, moneda: "USDT" })).toBe(false);
    expect(reciboVuelveNoComparable({ ...base, asientosCobro: 0 })).toBe(false);
    expect(reciboVuelveNoComparable({ ...base, conFactura: false })).toBe(false);
  });

  it("el identificado toca 1.1.2 solo con su reclasificación viva", () => {
    expect(reciboVuelveNoComparable({ ...base, identificado: true })).toBe(false);
    expect(reciboVuelveNoComparable({ ...base, identificado: true, reclasificaciones: 1 })).toBe(true);
  });

  it("reclasificacionesPorRecibo: vivas, por los dos lados y sin contar dos veces el mismo asiento", () => {
    const asiento = (id: string, status: string, extra: Partial<{ receipt_id: string; deleted_at: string; source: string }> = {}) => ({
      id, status, source: extra.source ?? "receipt_reclass", deleted_at: extra.deleted_at ?? null,
      invoice_id: null, receipt_id: extra.receipt_id ?? null, bill_id: null, supplier_payment_id: null,
    });
    const recibos = [
      { id: "r1", journal_entry_id: "x1" }, // unido por los dos lados al mismo asiento: cuenta una vez
      { id: "r2", journal_entry_id: "x2" }, // solo por el lado del documento
      { id: "r3", journal_entry_id: null }, // solo por el lado del asiento, más uno anulado y uno borrado
      { id: "r4", journal_entry_id: null }, // un asiento de cobro (no es reclasificación)
    ];
    const r = reclasificacionesPorRecibo(recibos, [
      asiento("x1", "asentado", { receipt_id: "r1" }),
      asiento("x2", "asentado"),
      asiento("x3", "asentado", { receipt_id: "r3" }),
      asiento("x4", "anulado", { receipt_id: "r3" }),
      asiento("x5", "asentado", { receipt_id: "r3", deleted_at: "2025-03-01T00:00:00Z" }),
      asiento("x6", "asentado", { receipt_id: "r4", source: "receipt" }),
    ]);
    expect(Object.fromEntries(r)).toEqual({ r1: 1, r2: 1, r3: 1, r4: 0 });
  });
});
