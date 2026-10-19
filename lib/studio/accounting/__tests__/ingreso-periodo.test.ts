/**
 * SDD-0557 · La regla de la cifra oficial de ingreso (`resumirIngreso`) y sus
 * piezas: período, control del mayor y textos.
 */
import { describe, expect, it } from "vitest";
import {
  CUENTA_VENTAS,
  ESTADOS_DE_INGRESO,
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
import { ESPERADO, FACTURAS_DEL_MES, HOY, RANGO_MES } from "./ingreso-fixture";

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

describe("control contra el mayor (4.5, no todas las cuentas 4)", () => {
  it("mayor en 0 → diferencia igual a lo facturado; sin mayor → null", () => {
    const conCero = resumirIngreso(FACTURAS_DEL_MES, RANGO_MES, { ventas: 0, ingresos: 0 });
    expect(conCero.diferenciaUsd).toBe(2000);
    expect(sinMayor().diferenciaUsd).toBeNull();
    expect(sinMayor().mayor).toBeNull();
  });

  it("los otros ingresos del mayor (4.6, manuales) van aparte y no son diferencia", () => {
    const i = resumirIngreso(FACTURAS_DEL_MES, RANGO_MES, { ventas: 1500, ingresos: 1700 });
    expect(i.diferenciaUsd).toBe(500);
    expect(i.mayor).toEqual({ ventas: 1500, ingresos: 1700, otrosIngresos: 200 });
  });

  it("controlDelMayor toma el saldo de 4.5 con rollup y el total de ingresos del P&L", () => {
    const acc = (id: string, code: string, type: Account["type"]): Account => ({
      id, code, type, name: code, tenant_id: "t", parent_id: null, qbo_type: null,
      subtype: null, is_postable: true, notes: null, created_at: "", updated_at: "",
    });
    const accounts = [acc("i", "4", "I"), acc("v", "4.5", "I"), acc("v1", "4.5.1", "I"), acc("x", "4.6", "I")];
    const saldos = computeBalances(accounts, [
      { account_id: "v", debit: 0, credit: 1000 },
      { account_id: "v1", debit: 0, credit: 500 },
      { account_id: "x", debit: 0, credit: 200 },
    ]);
    expect(controlDelMayor(accounts, saldos)).toEqual({ ventas: 1500, ingresos: 1700 });
    expect(controlDelMayor(accounts.filter((a) => a.code !== "4.5"), saldos).ventas).toBeNull();
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
    describirIngreso(resumirIngreso(FACTURAS_DEL_MES, RANGO_MES, { ventas, ingresos }));

  it("cuadra, mayor menor y mayor mayor", () => {
    expect(con(2000)).toMatchObject({ estado: "cuadra" });
    expect(con(2000).diferenciaTexto).toMatch(/^Cuadra con el mayor/);
    expect(con(1500).estado).toBe("mayor_menor");
    expect(con(1500).diferenciaTexto).toContain("$500.00 menos");
    expect(con(2600).estado).toBe("mayor_mayor");
    expect(con(2600).diferenciaTexto).toContain("$600.00 más");
  });

  it("sin cuenta 4.5 y sin mayor", () => {
    expect(con(null, 300).estado).toBe("sin_cuenta");
    expect(describirIngreso(sinMayor())).toMatchObject({ estado: "sin_mayor", diferenciaTexto: null });
  });

  it("avisos: sin convertir, terceros y otros ingresos solo cuando hay", () => {
    const d = con(1500, 1700);
    expect(d.avisoSinConvertir).toBe("2 facturas no suman: están en bolívares sin tasa o en yuanes.");
    expect(d.avisoTerceros).toBe("Incluye $1,000.00 de fondos de terceros.");
    expect(d.otrosIngresosTexto).toContain("$200.00");
    const limpio = describirIngreso(
      resumirIngreso(FACTURAS_DEL_MES.filter((f) => f.id === "f1"), RANGO_MES, { ventas: 1000, ingresos: 1000 }),
    );
    expect(limpio).toMatchObject({ avisoSinConvertir: null, avisoTerceros: null, otrosIngresosTexto: null });
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
