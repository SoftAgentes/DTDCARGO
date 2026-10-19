/**
 * SDD-0557 · La regla de la cifra oficial de ingreso (`resumirIngreso`) y sus
 * piezas: período, control del mayor y textos.
 */
import { describe, expect, it } from "vitest";
import {
  CUENTA_VENTAS,
  ESTADOS_DE_INGRESO,
  ETIQUETA_ESTADO_INGRESO,
  controlDelMayor,
  describirIngreso,
  mesEnCurso,
  rangoDesdeParams,
  resumirIngreso,
} from "../ingreso-periodo";
import { SALE_STATUSES } from "@/lib/studio/fiscal/queries";
import { SALES_INCOME_CODE } from "../invoice-posting";
import { computeBalances } from "@/lib/studio/account-queries";
import type { Account } from "@/lib/studio/account-types";
import {
  ESPERADO,
  ESPERADO_EN_USD,
  FACTURAS_DEL_MES,
  FACTURAS_EN_USD,
  HOY,
  RANGO_MES,
  control,
} from "./ingreso-fixture";

const sinMayor = () => resumirIngreso(FACTURAS_DEL_MES, RANGO_MES, null);

describe("resumirIngreso · la cifra oficial", () => {
  it("con el fixture del mes: 2000 facturados, 2 facturas y 2 sin convertir", () => {
    const i = sinMayor();
    expect(i.facturado).toEqual({
      propio: ESPERADO.propio,
      terceros: ESPERADO.terceros,
      total: ESPERADO.total,
    });
    expect(i.facturas).toBe(ESPERADO.facturas);
    expect(i.sinConvertir).toBe(ESPERADO.sinConvertir);
    expect(i.enOtraMoneda).toBe(ESPERADO.enOtraMoneda);
    expect(i.rango).toEqual(RANGO_MES);
  });

  it("suma la base, no el total con IVA: F1 aporta 1000, no 1160", () => {
    const f1 = FACTURAS_DEL_MES.filter((f) => f.id === "f1");
    expect(resumirIngreso(f1, RANGO_MES, null).facturado.total).toBe(1000);
  });

  it("excluye borrador y anulada; incluye parcial y vencida", () => {
    const f = (status: string) => ({
      status,
      issued_at: "2025-03-05",
      currency: "USD",
      fx_rate: null,
      base_amount: 100,
    });
    const i = resumirIngreso(
      ["borrador", "anulada", "parcial", "vencida", "emitida", "pagada"].map(f),
      RANGO_MES,
      null,
    );
    expect(i.facturas).toBe(4);
    expect(i.facturado.total).toBe(400);
  });

  it("la fecha es issued_at: F5, creada en el mes y emitida en enero, no entra", () => {
    const f5 = FACTURAS_DEL_MES.filter((f) => f.id === "f5");
    expect(resumirIngreso(f5, RANGO_MES, null).facturas).toBe(0);
  });

  it("el rango es inclusivo en los dos extremos", () => {
    const en = (issued_at: string) => ({
      status: "emitida",
      issued_at,
      currency: "USD",
      fx_rate: null,
      base_amount: 10,
    });
    const i = resumirIngreso(
      [en("2025-02-28"), en("2025-03-01"), en("2025-03-18"), en("2025-03-19")],
      RANGO_MES,
      null,
    );
    expect(i.facturas).toBe(2);
    expect(i.facturado.total).toBe(20);
  });

  it("VES con tasa se convierte; VES sin tasa y CNY no suman y van a sin convertir", () => {
    const solo = (ids: string[]) =>
      resumirIngreso(FACTURAS_DEL_MES.filter((f) => ids.includes(f.id)), RANGO_MES, null);
    expect(solo(["f2"]).facturado.total).toBe(1000);
    expect(solo(["f6", "f7"])).toMatchObject({
      facturas: 0,
      sinConvertir: 2,
      facturado: { total: 0 },
    });
  });

  it("una factura con deleted_at no suma aunque el lector la traiga", () => {
    const f8 = FACTURAS_DEL_MES.filter((f) => f.id === "f8");
    expect(resumirIngreso(f8, RANGO_MES, null).facturado.total).toBe(0);
  });

  it("propio = local_revenue; cualquier otro fund_class es terceros (default 0122)", () => {
    const i = resumirIngreso(
      [
        { status: "emitida", issued_at: "2025-03-02", currency: "USD", fx_rate: null, base_amount: 5, fund_class: "local_revenue" },
        { status: "emitida", issued_at: "2025-03-02", currency: "USDT", fx_rate: null, base_amount: 7 },
      ],
      RANGO_MES,
      null,
    );
    expect(i.facturado).toEqual({ propio: 5, terceros: 7, total: 12 });
  });
});

describe("control contra el mayor (4.5 de los asientos de factura, no todas las cuentas 4)", () => {
  it("mayor en 0 → diferencia igual a lo facturado; sin mayor → null", () => {
    const conCero = resumirIngreso(FACTURAS_EN_USD, RANGO_MES, control(0));
    expect(conCero.diferenciaUsd).toBe(ESPERADO_EN_USD.total);
    expect(sinMayor().diferenciaUsd).toBeNull();
    expect(sinMayor().mayor).toBeNull();
  });

  it("los otros ingresos del mayor (4.6, manuales) van aparte y no son diferencia", () => {
    const i = resumirIngreso(FACTURAS_EN_USD, RANGO_MES, control(600, 800));
    expect(i.diferenciaUsd).toBe(400);
    expect(i.mayor).toEqual({ ventas: 600, ventasConMovimiento: true, ingresos: 800, otrosIngresos: 200 });
  });

  it("controlDelMayor: 4.5 con rollup SOLO de los asientos de factura; el total de ingresos, de todos", () => {
    const acc = (id: string, code: string, type: Account["type"]): Account => ({
      id, code, type, name: code, tenant_id: "t", parent_id: null, qbo_type: null,
      subtype: null, is_postable: true, notes: null, created_at: "", updated_at: "",
    });
    const accounts = [acc("i", "4", "I"), acc("v", "4.5", "I"), acc("v1", "4.5.1", "I"), acc("x", "4.6", "I")];
    // Asientos de factura: 1000 a 4.5 y 500 a su subcuenta.
    const deFacturas = computeBalances(accounts, [
      { account_id: "v", debit: 0, credit: 1000 },
      { account_id: "v1", debit: 0, credit: 500 },
    ]);
    // Todos los orígenes: lo de factura, un MANUAL de 300 a la propia 4.5 y 200 a 4.6.
    const todos = computeBalances(accounts, [
      { account_id: "v", debit: 0, credit: 1000 },
      { account_id: "v1", debit: 0, credit: 500 },
      { account_id: "v", debit: 0, credit: 300 },
      { account_id: "x", debit: 0, credit: 200 },
    ]);
    expect(controlDelMayor(accounts, todos, deFacturas)).toEqual({
      ventas: 1500,
      ventasConMovimiento: true,
      ingresos: 2000,
    });
    // El manual a 4.5 queda en otros ingresos, junto con el 4.6.
    const i = resumirIngreso(FACTURAS_EN_USD, RANGO_MES, controlDelMayor(accounts, todos, deFacturas));
    expect(i.mayor?.otrosIngresos).toBe(500);
    expect(controlDelMayor(accounts.filter((a) => a.code !== "4.5"), todos, deFacturas).ventas).toBeNull();
  });

  it("movimiento de 4.5: un debe y un haber que se anulan sí son movimiento", () => {
    const accounts = [{ id: "v", code: "4.5", type: "I" as const }];
    const ida = computeBalances(accounts as Account[], [
      { account_id: "v", debit: 100, credit: 0 },
      { account_id: "v", debit: 0, credit: 100 },
    ]);
    const vacio = computeBalances(accounts as Account[], []);
    expect(controlDelMayor(accounts, vacio, ida)).toMatchObject({ ventas: 0, ventasConMovimiento: true });
    expect(controlDelMayor(accounts, vacio, vacio)).toMatchObject({ ventas: 0, ventasConMovimiento: false });
  });
});

describe("no comparable (E1 de la SDD-0559, B2)", () => {
  const ves = (extra: Record<string, unknown> = {}) => ({
    status: "emitida",
    issued_at: "2025-03-05",
    currency: "VES",
    fx_rate: 36.5,
    base_amount: 3650,
    ...extra,
  });

  it("con el fixture del mes (F2, F6 y F7 en bolívares o yuanes): sin diferencia, aunque el mayor cuadre en número", () => {
    const i = resumirIngreso(FACTURAS_DEL_MES, RANGO_MES, control(2000));
    expect(i.enOtraMoneda).toBe(3);
    expect(i.diferenciaUsd).toBeNull();
    const d = describirIngreso(i);
    expect(d.estado).toBe("no_comparable");
    expect(d.diferenciaTexto).toBe(
      "No comparable: 3 facturas del período están en bolívares o yuanes y hoy se asientan en la cuenta 4.5 por su nominal en esa moneda, no en USD. La comparación vuelve con la tarea 2.3 del plan contable (moneda funcional en el mayor).",
    );
  });

  it("una sola, aunque esté convertida: singular", () => {
    const d = describirIngreso(resumirIngreso([ves()], RANGO_MES, control(37500)));
    expect(d.estado).toBe("no_comparable");
    expect(d.diferenciaTexto).toMatch(/^No comparable: 1 factura del período está en bolívares o yuanes y hoy se asienta /);
  });

  it("cuenta las anuladas y las CNY sin convertir; no cuenta borrador, borrada ni fuera del período", () => {
    const n = (f: Record<string, unknown>) => resumirIngreso([ves(f)], RANGO_MES, control(0)).enOtraMoneda;
    expect(n({ status: "anulada" })).toBe(1);
    expect(n({ currency: "CNY", fx_rate: null })).toBe(1);
    expect(n({ status: "borrador" })).toBe(0);
    expect(n({ deleted_at: "2025-03-06T00:00:00Z" })).toBe(0);
    expect(n({ issued_at: "2025-02-28" })).toBe(0);
    expect(n({ currency: "USDT" })).toBe(0);
  });

  it("solo en USD vuelve a ser comparable", () => {
    expect(describirIngreso(resumirIngreso(FACTURAS_EN_USD, RANGO_MES, control(1000))).estado).toBe("cuadra");
  });
});

describe("período", () => {
  it("mesEnCurso", () => {
    expect(mesEnCurso(HOY)).toEqual({ from: "2025-03-01", to: "2025-03-18" });
  });

  it("sin fechas → el mes en curso, sin error", () => {
    expect(rangoDesdeParams(undefined, undefined, HOY)).toEqual({
      rango: RANGO_MES,
      error: null,
      valores: { desde: "2025-03-01", hasta: "2025-03-18" },
    });
  });

  it("fechas válidas → ese rango", () => {
    expect(rangoDesdeParams("2025-01-01", "2025-02-28", HOY).rango).toEqual({
      from: "2025-01-01",
      to: "2025-02-28",
    });
  });

  it("DAT-01 · rango inverso: error, conserva lo tecleado y NO cae al mes en curso", () => {
    const r = rangoDesdeParams("2025-03-10", "2025-03-01", HOY);
    expect(r.rango).toBeNull();
    expect(r.error).toMatch(/al revés/);
    expect(r.valores).toEqual({ desde: "2025-03-10", hasta: "2025-03-01" });
  });

  it("DAT-01 · fecha inválida: error que cita lo tecleado y explica el formato", () => {
    const r = rangoDesdeParams("2025-02-30", "2025-03-01", HOY);
    expect(r.rango).toBeNull();
    expect(r.error).toContain("«2025-02-30»");
    expect(r.error).toContain("AAAA-MM-DD");
    expect(r.valores.desde).toBe("2025-02-30");
  });

  it("DAT-01 · una sola fecha: borrar la otra no equivale a «hoy»", () => {
    const r = rangoDesdeParams("2025-03-01", "", HOY);
    expect(r.rango).toBeNull();
    expect(r.error).toMatch(/las dos fechas/);
  });
});

describe("describirIngreso · textos en tuteo", () => {
  const con = (ventas: number | null, ingresos = ventas ?? 0) =>
    describirIngreso(resumirIngreso(FACTURAS_EN_USD, RANGO_MES, control(ventas, ingresos)));

  it("cuadra, mayor menor y mayor mayor", () => {
    expect(con(1000)).toMatchObject({ estado: "cuadra" });
    expect(con(1000).diferenciaTexto).toMatch(/^Cuadra con el mayor/);
    expect(con(500).estado).toBe("mayor_menor");
    expect(con(500).diferenciaTexto).toContain("$500.00 menos");
    expect(con(1600).estado).toBe("mayor_mayor");
    expect(con(1600).diferenciaTexto).toContain("$600.00 más");
  });

  it("sin cuenta 4.5 y sin mayor", () => {
    expect(con(null, 300).estado).toBe("sin_cuenta");
    expect(describirIngreso(sinMayor())).toMatchObject({ estado: "sin_mayor", diferenciaTexto: null });
  });

  it("sin movimiento: sin facturas ni asientos de factura en 4.5 no es «cuadra»", () => {
    const d = describirIngreso(resumirIngreso([], RANGO_MES, control(0, 0, false)));
    expect(d.estado).toBe("sin_movimiento");
    expect(d.diferenciaTexto).toBe(
      "Sin movimiento: no hay facturas del período ni asientos de factura en la cuenta 4.5. No hay nada que comparar.",
    );
    expect(d.diferenciaTexto).not.toMatch(/Cuadra/);
    // Control: con debe y haber que se anulan en 4.5 SÍ hay movimiento.
    expect(describirIngreso(resumirIngreso([], RANGO_MES, control(0, 0, true))).estado).toBe("cuadra");
    // Control: una factura anulada con su asiento vivo en 4.5 no es «sin movimiento».
    expect(describirIngreso(resumirIngreso([], RANGO_MES, control(700))).estado).toBe("mayor_mayor");
    // Control: con facturado y 4.5 en cero, el mayor tiene menos.
    expect(describirIngreso(resumirIngreso(FACTURAS_EN_USD, RANGO_MES, control(0, 0, false))).estado).toBe("mayor_menor");
  });

  it("avisos: sin convertir, terceros y otros ingresos solo cuando hay", () => {
    const d = describirIngreso(resumirIngreso(FACTURAS_DEL_MES, RANGO_MES, control(1500, 1700)));
    expect(d.avisoSinConvertir).toBe("2 facturas no suman: están en bolívares sin tasa o en yuanes.");
    expect(d.avisoTerceros).toBe("Incluye $1,000.00 de fondos de terceros.");
    expect(d.otrosIngresosTexto).toBe(
      "Otros ingresos del mayor que no salen del asiento de una factura (4.6 y asientos manuales, también a 4.5): $200.00. No cuentan como diferencia.",
    );
    const limpio = describirIngreso(
      resumirIngreso(FACTURAS_DEL_MES.filter((f) => f.id === "f1"), RANGO_MES, control(1000)),
    );
    expect(limpio).toMatchObject({ avisoSinConvertir: null, avisoTerceros: null, otrosIngresosTexto: null });
  });

  it("cada estado tiene su rótulo corto", () => {
    expect(ETIQUETA_ESTADO_INGRESO.no_comparable).toBe("No comparable");
    expect(ETIQUETA_ESTADO_INGRESO.sin_movimiento).toBe("Sin movimiento");
  });
});

describe("anti-deriva", () => {
  it("ESTADOS_DE_INGRESO es SALE_STATUSES del libro fiscal", () => {
    expect([...ESTADOS_DE_INGRESO]).toEqual([...SALE_STATUSES]);
  });

  it("CUENTA_VENTAS es la cuenta que acredita el asiento de venta", () => {
    expect(CUENTA_VENTAS).toBe(SALES_INCOME_CODE);
  });
});
