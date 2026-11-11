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
  resumirIngreso as resumirIngresoSinContexto,
  notaDelMayorMezclado,
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
  datosReversoGo1,
  lectorReversoGo1,
  controlReversoGo1,
  RANGOS_REVERSO_GO1,
  type DatosReversoGo1,
  resumirIngresoConContexto as resumirIngreso,
} from "./ingreso-fixture";
import { ingresoDelPeriodo } from "../libro-control-queries";
import { MAX_PAGES } from "@/lib/db/paginate";

const sinMayor = () => resumirIngreso(FACTURAS_DEL_MES, RANGO_MES, null);

describe("resumirIngreso · la cifra oficial", () => {
  it("con el fixture del mes: 3000 facturados, 3 facturas y 2 sin convertir", () => {
    const i = sinMayor();
    expect(i.facturado).toEqual({
      propio: ESPERADO.propio,
      terceros: ESPERADO.terceros,
      total: ESPERADO.total,
    });
    expect(i.facturas).toBe(ESPERADO.facturas);
    expect(i.sinConvertir).toBe(ESPERADO.sinConvertir);
    // Sin control no se leyeron los asientos: ninguna cuenta como asentada.
    expect(i.enOtraMoneda).toBe(0);
    expect(resumirIngreso(FACTURAS_DEL_MES, RANGO_MES, control(2000)).enOtraMoneda).toBe(ESPERADO.enOtraMoneda);
    expect(i.rango).toEqual(RANGO_MES);
  });

  it("suma la base, no el total con IVA: F1 aporta 1000, no 1160", () => {
    const f1 = FACTURAS_DEL_MES.filter((f) => f.id === "f1");
    expect(resumirIngreso(f1, RANGO_MES, null).facturado.total).toBe(1000);
  });

  it("excluye borrador y anulada; incluye parcial y vencida", () => {
    const f = (status: string) => ({
      id: status,
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
      id: issued_at,
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

  it("VES y CNY con tasa se convierten; sin tasa no suman y van a sin convertir (SDD-0572)", () => {
    const solo = (ids: string[]) =>
      resumirIngreso(FACTURAS_DEL_MES.filter((f) => ids.includes(f.id)), RANGO_MES, null);
    expect(solo(["f2"]).facturado.total).toBe(1000);
    expect(solo(["f6"]).facturado.total).toBe(1000);
    expect(solo(["f7", "f9"])).toMatchObject({
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
        { id: "p", status: "emitida", issued_at: "2025-03-02", currency: "USD", fx_rate: null, base_amount: 5, fund_class: "local_revenue" },
        { id: "t", status: "emitida", issued_at: "2025-03-02", currency: "USDT", fx_rate: null, base_amount: 7 },
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
    const asentadas = new Set(["f1"]);
    expect(controlDelMayor(accounts, todos, deFacturas, asentadas)).toEqual({
      ventas: 1500,
      ventasConMovimiento: true,
      ingresos: 2000,
      facturasConAsiento: asentadas,
    });
    // El manual a 4.5 queda en otros ingresos, junto con el 4.6.
    const i = resumirIngreso(FACTURAS_EN_USD, RANGO_MES, controlDelMayor(accounts, todos, deFacturas, asentadas));
    expect(i.mayor?.otrosIngresos).toBe(500);
    expect(controlDelMayor(accounts.filter((a) => a.code !== "4.5"), todos, deFacturas, asentadas).ventas).toBeNull();
  });

  it("movimiento de 4.5: un debe y un haber que se anulan sí son movimiento", () => {
    const accounts = [{ id: "v", code: "4.5", type: "I" as const }];
    const ida = computeBalances(accounts as Account[], [
      { account_id: "v", debit: 100, credit: 0 },
      { account_id: "v", debit: 0, credit: 100 },
    ]);
    const vacio = computeBalances(accounts as Account[], []);
    expect(controlDelMayor(accounts, vacio, ida, new Set())).toMatchObject({ ventas: 0, ventasConMovimiento: true });
    expect(controlDelMayor(accounts, vacio, vacio, new Set())).toMatchObject({ ventas: 0, ventasConMovimiento: false });
  });
});

describe("no comparable (E1 de la SDD-0559, B2)", () => {
  const ves = (extra: Record<string, unknown> = {}) => ({
    id: "v",
    status: "emitida",
    issued_at: "2025-03-05",
    currency: "VES",
    fx_rate: 36.5,
    base_amount: 3650,
    ...extra,
  });

  it("con el fixture del mes (F2, F6, F7 y F9 en bolívares o yuanes): sin diferencia, aunque el mayor cuadre en número", () => {
    const i = resumirIngreso(FACTURAS_DEL_MES, RANGO_MES, control(2000));
    expect(i.enOtraMoneda).toBe(4);
    expect(i.diferenciaUsd).toBeNull();
    const d = describirIngreso(i);
    expect(d.estado).toBe("no_comparable");
    expect(d.diferenciaTexto).toBe(
      "No comparable: 4 facturas del período están en bolívares o yuanes y hoy se asientan en la cuenta 4.5 por su nominal en esa moneda, no en USD. La comparación vuelve cuando el asiento de venta se registre en USD (fase 2 del plan de trabajo de contabilidad).",
    );
    // Sin números internos del plan: «la tarea 2.3» se leía como una cuenta.
    expect(d.diferenciaTexto).not.toMatch(/tarea|plan contable/);
  });

  // 4.5 con movimiento y la factura «v» con su asiento de factura vivo.
  const conV = control(37500, 37500, true, ["v"]);

  it("una sola, aunque esté convertida: singular", () => {
    const d = describirIngreso(resumirIngreso([ves()], RANGO_MES, conV));
    expect(d.estado).toBe("no_comparable");
    expect(d.diferenciaTexto).toMatch(/^No comparable: 1 factura del período está en bolívares o yuanes y hoy se asienta /);
  });

  it("cuenta las anuladas y las CNY sin convertir; no cuenta borrador, borrada ni fuera del período", () => {
    const n = (f: Record<string, unknown>) => resumirIngreso([ves(f)], RANGO_MES, conV).enOtraMoneda;
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

  /**
   * Decisión 7 del Director (2026-10-19, revisable por Sam): solo cuenta la
   * factura en VES o CNY que tiene su asiento de factura vivo, porque es la
   * que mete el nominal en 4.5. Una sin asiento ya está en «sin asiento».
   */
  describe("solo las que tienen su asiento de factura vivo (decisión 7)", () => {
    const usd = { id: "u1", status: "emitida", issued_at: "2025-03-04", currency: "USD", fx_rate: null, base_amount: 600 };
    const vesSola = { id: "v1", status: "emitida", issued_at: "2025-03-05", currency: "VES", fx_rate: 36.5, base_amount: 36500 };

    it("una USD asentada y una VES SIN asiento, con 4.5 en movimiento: la diferencia normal, no «no comparable»", () => {
      // 4.5 tiene los 600 del asiento de la USD; la VES (1000 USD) no tiene asiento.
      const i = resumirIngreso([usd, vesSola], RANGO_MES, control(600, 600, true, ["u1"]));
      expect(i.enOtraMoneda).toBe(0);
      expect(i.diferenciaUsd).toBe(1000);
      const d = describirIngreso(i);
      expect(d.estado).toBe("mayor_menor");
      expect(d.diferenciaTexto).toBe("El mayor (cuenta 4.5) tiene $1,000.00 menos que lo facturado.");
    });

    it("la misma VES CON su asiento vivo: «no comparable», sin diferencia", () => {
      const i = resumirIngreso([usd, vesSola], RANGO_MES, control(37100, 37100, true, ["u1", "v1"]));
      expect(i.enOtraMoneda).toBe(1);
      expect(i.diferenciaUsd).toBeNull();
      expect(describirIngreso(i).estado).toBe("no_comparable");
    });

    it("sin control (Dashboard) ninguna cuenta: no se leyeron los asientos", () => {
      expect(resumirIngreso([usd, vesSola], RANGO_MES, null).enOtraMoneda).toBe(0);
    });
  });
});

describe("el mayor vacío gana sobre «no comparable» (B3)", () => {
  // 36500 Bs a 36,5 = 1000 USD. Sin ningún asiento de factura en 4.5.
  const vesSinAsiento = { id: "vs", status: "emitida", issued_at: "2025-03-05", currency: "VES", fx_rate: 36.5, base_amount: 36500 };
  // La misma factura, con su asiento de factura vivo y 4.5 en movimiento.
  const vesAsentada = { ...vesSinAsiento, id: "va" };
  const conVa = control(36500, 36500, true, ["va"]);
  const vacio = control(0, 0, false);

  it("una factura en VES sin ningún asiento: el mayor tiene menos por todo lo facturado, con diferencia", () => {
    const i = resumirIngreso([vesSinAsiento], RANGO_MES, vacio);
    // Sin asiento no cuenta en «no comparable» (decisión 7).
    expect(i.enOtraMoneda).toBe(0);
    expect(i.diferenciaUsd).toBe(1000);
    const d = describirIngreso(i);
    expect(d.estado).toBe("mayor_menor");
    expect(d.diferenciaTexto).toBe(
      "El mayor (cuenta 4.5) tiene $1,000.00 menos que lo facturado: no tiene ningún asiento de factura en el período.",
    );
    expect(d.diferenciaTexto).not.toMatch(/No comparable|se asienta/);
  });

  it("una VES con cabecera huérfana no acredita movimiento nominal ni diferencia: requiere revisión", () => {
    // invoice-posting.ts inserta la cabecera y después las líneas, sin una
    // transacción: si las líneas fallan y el rollback manual del header también,
    // queda una cabecera viva sin líneas (B3). No acredita movimiento ni unidad:
    // el cero del saldo no convierte la evidencia incompleta en USD o Cuadra.
    const i = resumirIngreso([vesAsentada], RANGO_MES, control(0, 0, false, ["va"]));
    expect(i.enOtraMoneda).toBe(0);
    expect(i.facturado.total).toBe(1000);
    expect(i).toMatchObject({ ajusteAnulacionesUsd: null, baseComparacionUsd: null, diferenciaUsd: null,
      controlI2: { verificacion: "requiere_revision", unidadMayor: "sin_verificar", hayActividad: false,
        contribucionesAjuste: 0 } });
    expect(i.controlI2.incidencias).toContainEqual({ codigo: "lineas_invalidas", cantidad: 1 });
    expect(describirIngreso(i).estado).toBe("requiere_revision");
    expect(notaDelMayorMezclado(i)).toBeNull();
  });

  // I2: decisión expresa del Director, 2026-10-20. La ausencia de asientos se
  // conserva; un subtotal conocido no certifica la diferencia del conjunto.
  it("0572 · fixture mixto y 4.5 vacía: conserva B3 sin cuantificar diferencia incompleta", () => {
    const i = resumirIngreso(FACTURAS_DEL_MES, RANGO_MES, vacio);
    expect(i.facturado.total).toBe(ESPERADO.total);
    expect(i.sinConvertir).toBe(ESPERADO.sinConvertir);
    expect(i.diferenciaUsd).toBeNull();
    expect(describirIngreso(i).estado).toBe("mayor_menor");
    expect(describirIngreso(i).diferenciaTexto).toMatch(/no tiene ningún asiento de factura/);
    expect(describirIngreso(i).diferenciaTexto).not.toMatch(/\$[\d,.]+ menos/);
  });

  it("solo facturas sin convertir (CNY) y 4.5 vacía: el mayor tiene menos, no «sin movimiento»", () => {
    const cny = { ...vesSinAsiento, currency: "CNY", fx_rate: null, base_amount: 7200 };
    const i = resumirIngreso([cny], RANGO_MES, vacio);
    // Falta el asiento, pero sin facturado en USD el monto de la diferencia no
    // se conoce: va en null, no en 0 junto a «el mayor tiene menos».
    expect(i).toMatchObject({ facturas: 0, sinConvertir: 1, enOtraMoneda: 0, diferenciaUsd: null });
    const d = describirIngreso(i);
    expect(d.estado).toBe("mayor_menor");
    expect(d.diferenciaTexto).toBe(
      "El mayor (cuenta 4.5) no tiene ningún asiento de factura en el período; la factura del período (en bolívares o yuanes sin tasa) debería tenerlo.",
    );
    const dos = describirIngreso(resumirIngreso([cny, { ...cny }], RANGO_MES, vacio));
    expect(dos.diferenciaTexto).toBe(
      "El mayor (cuenta 4.5) no tiene ningún asiento de factura en el período; las 2 facturas del período (en bolívares o yuanes sin tasa) deberían tenerlo.",
    );
  });

  it("la nota del mayor mezclado sale solo con «no comparable»", () => {
    const mezclado = resumirIngreso([vesAsentada], RANGO_MES, conVa);
    expect(notaDelMayorMezclado(mezclado)).toBe(
      "Estas cifras salen del mayor y mezclan el nominal de facturas en bolívares o yuanes con montos en USD: no son todas USD. Vuelven a ser comparables cuando el asiento de venta se registre en USD (fase 2 del plan de trabajo de contabilidad).",
    );
    expect(notaDelMayorMezclado(resumirIngreso(FACTURAS_EN_USD, RANGO_MES, control(1000)))).toBeNull();
    expect(notaDelMayorMezclado(resumirIngreso([vesSinAsiento], RANGO_MES, vacio))).toBeNull();
  });

  it("controles: con asientos de factura en 4.5 vuelve «no comparable»; una anulada en VES sola, con 4.5 vacía, es «sin movimiento»", () => {
    const conAsiento = resumirIngreso([vesAsentada], RANGO_MES, conVa);
    expect(conAsiento.diferenciaUsd).toBeNull();
    expect(describirIngreso(conAsiento).estado).toBe("no_comparable");
    const anulada = resumirIngreso([{ ...vesSinAsiento, status: "anulada" }], RANGO_MES, vacio);
    expect(anulada.enOtraMoneda).toBe(0);
    expect(describirIngreso(anulada).estado).toBe("sin_movimiento");
  });
});

describe("0572 · subtotal conocido no concilia un conjunto incompleto", () => {
  const usd = { id: "u1", status: "emitida", issued_at: "2025-03-04", currency: "USD", fx_rate: null, base_amount: 1000 };
  const cny = { ...usd, id: "c1", currency: "CNY", base_amount: 700 };

  it("USD asentado más CNY sin tasa ni asiento: diferencia null y conversión incompleta", () => {
    const i = resumirIngreso([usd, cny], RANGO_MES, control(1000, 1000, true, ["u1"]));
    expect(i).toMatchObject({ facturado: { total: 1000 }, sinConvertir: 1, enOtraMoneda: 0, diferenciaUsd: null });
    const d = describirIngreso(i);
    expect(d.estado).toBe("conversion_incompleta");
    expect(d.diferenciaTexto).toMatch(/falta convertir/i);
    expect(d.diferenciaTexto).not.toMatch(/cuadra/i);
    expect(notaDelMayorMezclado(i)).toBeNull();
  });

  it("mayor vacío: faltan asientos sin afirmar una diferencia USD total", () => {
    const i = resumirIngreso([usd, cny], RANGO_MES, control(0, 0, false));
    expect(i.diferenciaUsd).toBeNull();
    const d = describirIngreso(i);
    expect(d.estado).toBe("mayor_menor");
    expect(d.diferenciaTexto).toMatch(/no tiene ningún asiento de factura/);
    expect(d.diferenciaTexto).not.toMatch(/\$[\d,.]+ menos/);
    expect(resumirIngreso([usd], RANGO_MES, control(0, 0, false)).diferenciaUsd).toBe(1000);
  });

  it("preserva ausencia de mayor/cuenta y nominal mixto como causas distintas", () => {
    expect(describirIngreso(resumirIngreso([usd, cny], RANGO_MES, null)).estado).toBe("sin_mayor");
    expect(describirIngreso(resumirIngreso([usd, cny], RANGO_MES, control(null))).estado).toBe("sin_cuenta");
    const mixed = resumirIngreso([usd, cny], RANGO_MES, control(1700, 1700, true, ["u1", "c1"]));
    expect(describirIngreso(mixed).estado).toBe("no_comparable");
    expect(notaDelMayorMezclado(mixed)).not.toBeNull();
  });

  it("cero USD válido es conocido y comparable", () => {
    const i = resumirIngreso([{ ...usd, base_amount: 0 }], RANGO_MES, control(0, 0, true, ["u1"]));
    expect(i).toMatchObject({ facturas: 1, sinConvertir: 0, diferenciaUsd: 0 });
    expect(describirIngreso(i).estado).toBe("cuadra");
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
    expect(d.avisoSinConvertir).toBe("2 facturas no suman: están en bolívares o yuanes sin tasa.");
    expect(d.avisoTerceros).toBe("Incluye $2,000.00 de fondos de terceros.");
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

/**
 * GO1 I2 · propuesta autoral NO EJECUTADA.
 * Se llama al lector público existente y se aplican sus filtros en el doble.
 * ajusteAnulacionesUsd/baseComparacionUsd son nombres propuestos de salida,
 * no imports de DTO futuros ni una implementación traída de 0572-a.
 */
async function leerReversoGo1(
  datos: DatosReversoGo1,
  rango: { from: string; to: string },
  opts: { errorTabla?: string; limiteServidor?: number } = {},
) {
  const lector = lectorReversoGo1(datos, opts);
  const ingreso = await ingresoDelPeriodo(lector.client, rango, {
    mayor: controlReversoGo1(datos, rango),
  });
  return { ingreso, consultas: lector.consultas };
}

describe("GO1 I2 · oficial, ajuste documental y base de comparación", () => {
  it.each([
    { nombre: "septiembre", rango: RANGOS_REVERSO_GO1.septiembre, ajuste: 100, mayor: 100 },
    { nombre: "octubre", rango: RANGOS_REVERSO_GO1.octubre, ajuste: -100, mayor: -100 },
    { nombre: "rango combinado", rango: RANGOS_REVERSO_GO1.combinado, ajuste: 0, mayor: 0 },
  ])("$nombre conserva oficial cero y muestra su puente documental", async ({ rango, ajuste, mayor }) => {
    const { ingreso } = await leerReversoGo1(datosReversoGo1(), rango);

    expect(ingreso.facturado).toEqual({ propio: 0, terceros: 0, total: 0 });
    expect(ingreso.mayor?.ventas).toBe(mayor);
    expect(ingreso).toMatchObject({
      ajusteAnulacionesUsd: ajuste,
      baseComparacionUsd: ajuste,
      diferenciaUsd: 0,
    });
    expect(describirIngreso(ingreso).estado).toBe("cuadra");
  });

  it("documento 100 frente a venta 90 conserva diferencia 10 en septiembre", async () => {
    const { ingreso } = await leerReversoGo1(
      datosReversoGo1({ base: 100, venta: 90 }), RANGOS_REVERSO_GO1.septiembre,
    );

    expect(ingreso.facturado.total).toBe(0);
    expect(ingreso.mayor?.ventas).toBe(90);
    expect(ingreso).toMatchObject({
      ajusteAnulacionesUsd: 100,
      baseComparacionUsd: 100,
      diferenciaUsd: 10,
    });
    expect(describirIngreso(ingreso).estado).not.toBe("cuadra");
  });

  it.each(["otra factura", "falta una línea financiera", "original no asentado"])(
    "neto cero con %s no es Cuadra ni vacío legítimo", async (corrupcion) => {
      const datos = datosReversoGo1();
      if (corrupcion === "otra factura") datos.journal_entries[1].invoice_id = "factura-ajena-go1";
      if (corrupcion === "falta una línea financiera") {
        // Sólo se quita 1.1.2: el ingreso todavía netea cero.
        datos.journal_lines = datos.journal_lines.filter((l) => l.id !== "reverso-ar-go1");
      }
      if (corrupcion === "original no asentado") {
        datos.journal_entries[0].status = "anulado";
        datos.journal_entries[1].status = "anulado";
      }
      const { ingreso } = await leerReversoGo1(datos, RANGOS_REVERSO_GO1.combinado);

      expect(ingreso.facturado.total).toBe(0);
      expect(ingreso.mayor?.ventas).toBe(0);
      expect(ingreso.diferenciaUsd).toBeNull();
      expect(describirIngreso(ingreso).estado).not.toBe("cuadra");
      expect(describirIngreso(ingreso).estado).not.toBe("sin_movimiento");
    },
  );

  it("octubre obtiene metadata de la factura emitida en septiembre", async () => {
    const datos = datosReversoGo1();
    const { ingreso, consultas } = await leerReversoGo1(datos, RANGOS_REVERSO_GO1.octubre);

    // La query inicial de emisión excluye correctamente esa factura; el lector
    // debe recuperarla por el vínculo del movimiento, no inventar un documento.
    expect(consultas.some((q) => q.tabla === "invoices")).toBe(true);
    expect(ingreso.facturado.total).toBe(0);
    expect(ingreso.mayor?.ventas).toBe(-100);
    expect(ingreso).toMatchObject({
      ajusteAnulacionesUsd: -100,
      baseComparacionUsd: -100,
      diferenciaUsd: 0,
    });
  });

  it.each([
    { moneda: "VES", base: 3650, tasa: 36.5 },
    { moneda: "CNY", base: 720, tasa: 7.2 },
  ])("sólo el reverso nominal $moneda en octubre sigue no comparable", async ({ moneda, base, tasa }) => {
    const { ingreso } = await leerReversoGo1(
      datosReversoGo1({ currency: moneda, base, fxRate: tasa }), RANGOS_REVERSO_GO1.octubre,
    );

    expect(ingreso.facturado.total).toBe(0);
    expect(ingreso.mayor?.ventas).toBe(-base);
    expect(ingreso.enOtraMoneda).toBeGreaterThan(0);
    expect(ingreso.diferenciaUsd).toBeNull();
    expect(describirIngreso(ingreso).estado).toBe("no_comparable");
    expect(notaDelMayorMezclado(ingreso)).toMatch(/nominal|bolívares|yuanes/i);
  });

  it("una tasa ausente no se convierte en ajuste conocido cero", async () => {
    const { ingreso } = await leerReversoGo1(
      datosReversoGo1({ currency: "VES", base: 3650, fxRate: null }),
      RANGOS_REVERSO_GO1.combinado,
    );

    expect(ingreso.facturado.total).toBe(0);
    expect(ingreso.diferenciaUsd).toBeNull();
    const texto = describirIngreso(ingreso);
    expect(texto.estado).not.toBe("cuadra");
    expect(texto.estado).not.toBe("sin_movimiento");
    expect(texto.diferenciaTexto).toMatch(/tasa|conver|nominal|bolívares/i);
  });

  it("un error de lectura rechaza; no devuelve cero ni un control exitoso", async () => {
    await expect(leerReversoGo1(
      datosReversoGo1(), RANGOS_REVERSO_GO1.septiembre, { errorTabla: "invoices" },
    )).rejects.toThrow("fallo-lectura-sintetico-go1");
  });

  it("una lectura sin página vacía antes del tope rechaza como incompleta", async () => {
    const datos = datosReversoGo1();
    const original = datos.invoices[0];
    datos.invoices = Array.from({ length: MAX_PAGES + 1 }, (_, n) => ({
      ...original, id: "go1-paginada-" + String(n).padStart(4, "0"),
    }));

    await expect(leerReversoGo1(
      datos, RANGOS_REVERSO_GO1.septiembre, { limiteServidor: 1 },
    )).rejects.toThrow(/lectura.*tope|completo/i);
    // Se usa el paginador real, sin mockear complete:false ni cambiar su tope.
  });

  it("un rango realmente vacío mantiene Sin movimiento, sin fabricar actividad", async () => {
    const datos = datosReversoGo1();
    datos.invoices = [];
    datos.journal_entries = [];
    datos.journal_lines = [];
    const { ingreso } = await leerReversoGo1(datos, RANGOS_REVERSO_GO1.combinado);

    expect(ingreso.facturado.total).toBe(0);
    expect(ingreso.mayor).toMatchObject({ ventas: 0, ventasConMovimiento: false });
    expect(describirIngreso(ingreso).estado).toBe("sin_movimiento");
  });

  it("cero neto conocido conserva actividad y explicación del ajuste", async () => {
    const { ingreso } = await leerReversoGo1(datosReversoGo1(), RANGOS_REVERSO_GO1.combinado);

    expect(ingreso.facturado.total).toBe(0);
    expect(ingreso.mayor).toMatchObject({ ventas: 0, ventasConMovimiento: true });
    expect(ingreso.diferenciaUsd).toBe(0);
    expect(describirIngreso(ingreso).estado).toBe("cuadra");
    expect(describirIngreso(ingreso).diferenciaTexto).toMatch(/ajuste|anulaci[oó]n|revers/i);
  });
});

describe("I2 · evidencia independiente del saldo", () => {
  const rango = RANGOS_REVERSO_GO1.combinado;
  function crudo(datos = datosReversoGo1()) {
    return { completo: true, documentos: datos.invoices, asientos: datos.journal_entries,
      lineas: datos.journal_lines, cuentas: datos.accounts };
  }
  it("un mayor sin contexto no certifica cero ni Cuadra, y no inventa moneda nominal", () => {
    const i = resumirIngresoSinContexto([], rango, control(0, 0, true));
    expect(i).toMatchObject({ ajusteAnulacionesUsd: null, baseComparacionUsd: null, diferenciaUsd: null,
      controlI2: { verificacion: "no_leida", unidadMayor: "sin_verificar" } });
    expect(describirIngreso(i).estado).toBe("requiere_revision");
    expect(notaDelMayorMezclado(i)).toBeNull();
  });
  it("sin mayor conserva el oficial y no exige evidencia contable al Dashboard", () => {
    const i = resumirIngresoSinContexto(FACTURAS_DEL_MES, RANGO_MES, null);
    expect(i.facturado.total).toBe(2000);
    expect(describirIngreso(i).estado).toBe("sin_mayor");
    expect(i.controlI2).toMatchObject({ verificacion: "no_leida", incidencias: [] });
  });
  it.each([
    "tenant cabecera", "tenant documento", "tenant cuenta", "origen", "borrado", "backlink",
    "cuenta oculta", "parent ausente", "ciclo de cuentas", "línea sin importe", "monto no finito",
    "documento oculto", "identidad incompatible", "multiplicidad distinta",
  ])("rechaza %s aunque el neto sea cero", (fallo) => {
    const d = datosReversoGo1();
    if (fallo === "tenant cabecera") d.journal_entries[1].tenant_id = "otro";
    if (fallo === "tenant documento") d.invoices[0].tenant_id = "otro";
    if (fallo === "tenant cuenta") d.accounts[0].tenant_id = "otro";
    if (fallo === "origen") d.journal_entries[1].source = "manual";
    if (fallo === "borrado") d.journal_entries[0].deleted_at = "2026-10-21";
    if (fallo === "backlink") d.journal_entries[1].reverses_entry_id = "no-visible";
    if (fallo === "cuenta oculta") d.accounts.pop();
    if (fallo === "parent ausente") d.accounts[1].parent_id = "no-visible";
    if (fallo === "ciclo de cuentas") d.accounts[1].parent_id = d.accounts[1].id;
    if (fallo === "línea sin importe") delete d.journal_lines[0].debit;
    if (fallo === "monto no finito") d.invoices[0].base_amount = "NaN";
    if (fallo === "documento oculto") d.invoices = [];
    if (fallo === "identidad incompatible") d.journal_entries.push({ ...d.journal_entries[0], status: "anulado" });
    if (fallo === "multiplicidad distinta") d.journal_lines.push({ ...d.journal_lines[0], id: "duplicada" });
    const i = resumirIngresoSinContexto([], rango, control(0, 0, true), crudo(d));
    expect(i.diferenciaUsd).toBeNull();
    expect(i.ajusteAnulacionesUsd).toBeNull();
    expect(i.controlI2.verificacion).toBe("requiere_revision");
    expect(i.controlI2.incidencias.length).toBeGreaterThan(0);
    expect(describirIngreso(i).estado).toBe("requiere_revision");
    expect(notaDelMayorMezclado(i)).toBeNull();
  });
  it("IVA, subcuentas, orden inverso e IDs nuevos conservan el espejo por multiplicidad", () => {
    const d = datosReversoGo1();
    d.accounts.push({ id: "iva", tenant_id: "tenant-go1", code: "2.1.5", type: "P", parent_id: null },
      { id: "subventa", tenant_id: "tenant-go1", code: "4.5.1", type: "I", parent_id: "ingreso-go1" });
    d.journal_lines[0].debit = 116;
    d.journal_lines[1].account_id = "subventa";
    d.journal_lines[2].credit = 116;
    d.journal_lines[3].account_id = "subventa";
    d.journal_lines.push({ id: "iva-o", entry_id: "original-go1", account_id: "iva", debit: 0, credit: 16 },
      { id: "iva-r", entry_id: "reverso-go1", account_id: "iva", debit: 16, credit: 0 });
    d.journal_lines = d.journal_lines.reverse().map((l, n) => ({ ...l, id: `otra-linea-${n}`, line_memo: "otro memo" }));
    const i = resumirIngresoSinContexto([], rango, control(0, 0, true), crudo(d));
    expect(i).toMatchObject({ ajusteAnulacionesUsd: 0, baseComparacionUsd: 0, diferenciaUsd: 0,
      controlI2: { verificacion: "completa", hayActividad: true, contribucionesAjuste: 2, incidencias: [] } });
    expect(describirIngreso(i).estado).toBe("cuadra");
  });
  it("redondea una vez la base documental y usa los mismos centavos al revertir", () => {
    const d = datosReversoGo1({ base: 100.015, venta: 100.02 });
    const sept = resumirIngresoSinContexto([], RANGOS_REVERSO_GO1.septiembre, control(100.02), crudo(d));
    const oct = resumirIngresoSinContexto([], RANGOS_REVERSO_GO1.octubre, control(-100.02), crudo(d));
    expect(sept.ajusteAnulacionesUsd).toBe(100.02);
    expect(oct.ajusteAnulacionesUsd).toBe(-100.02);
    expect(sept.diferenciaUsd).toBe(0);
    expect(oct.diferenciaUsd).toBe(0);
  });
  it("moneda desconocida no obtiene etiqueta USD ni advertencia inventada de VES/CNY", () => {
    const d = datosReversoGo1({ currency: "EUR" });
    const i = resumirIngresoSinContexto([], rango, control(0, 0, true), crudo(d));
    expect(i.controlI2.unidadMayor).toBe("sin_verificar");
    expect(i.baseComparacionUsd).toBeNull();
    expect(describirIngreso(i).estado).toBe("requiere_revision");
    expect(notaDelMayorMezclado(i)).toBeNull();
  });
  it("nominal acreditado e integridad rota conservan ambos ejes visibles", () => {
    const d = datosReversoGo1({ currency: "VES", base: 3650, fxRate: 36.5 });
    d.journal_lines = d.journal_lines.filter(l => l.id !== "reverso-ar-go1");
    const i = resumirIngresoSinContexto([], rango, control(0, 0, true), crudo(d));
    expect(i.controlI2).toMatchObject({ unidadMayor: "nominal_mixto", verificacion: "requiere_revision" });
    expect(describirIngreso(i).estado).toBe("no_comparable");
    expect(i.ajusteAnulacionesUsd).toBeNull();
    expect(i.enOtraMoneda).toBe(1);
  });
  it("complete false y desacuerdo con el mayor no se convierten en subtotal completo", () => {
    const d = datosReversoGo1();
    const incompleto = resumirIngresoSinContexto([], rango, control(0, 0, true), { ...crudo(d), completo: false });
    expect(incompleto.baseComparacionUsd).toBeNull();
    const desacuerdo = resumirIngresoSinContexto([], rango, control(1), crudo(d));
    expect(desacuerdo.controlI2.incidencias).toContainEqual({ codigo: "mayor_inconsistente", cantidad: 1 });
    expect(desacuerdo.diferenciaUsd).toBeNull();
  });
  it("anulada sin posting no inventa par roto ni actividad", () => {
    const d = datosReversoGo1(); d.journal_entries = []; d.journal_lines = [];
    const i = resumirIngresoSinContexto([], rango, control(0, 0, false), crudo(d));
    expect(i).toMatchObject({ ajusteAnulacionesUsd: 0, diferenciaUsd: 0,
      controlI2: { verificacion: "completa", hayActividad: false, incidencias: [] } });
    expect(describirIngreso(i).estado).toBe("sin_movimiento");
  });
  it("una versión documental distinta entre lectura oficial y contexto no obtiene Cuadra", () => {
    const d = datosReversoGo1();
    const facturas = [{ id: "invoice-go1", status: "anulada", issued_at: "2026-09-15", currency: "USD",
      fx_rate: null, base_amount: 90, fund_class: "local_revenue", deleted_at: null }];
    const i = resumirIngresoSinContexto(facturas, rango, control(0, 0, true), crudo(d));
    expect(i.controlI2.incidencias).toContainEqual({ codigo: "identidad_incompatible", cantidad: 1 });
    expect(i.baseComparacionUsd).toBeNull();
    expect(i.diferenciaUsd).toBeNull();
  });
  it("la anulada VES sin tasa no aumenta sinConvertir oficial ni presenta ajuste parcial", () => {
    const d = datosReversoGo1({ currency: "VES", base: 3650, fxRate: null });
    const i = resumirIngresoSinContexto([], rango, control(0, 0, true), crudo(d));
    expect(i.sinConvertir).toBe(0);
    expect(i).toMatchObject({ ajusteAnulacionesUsd: null, baseComparacionUsd: null, diferenciaUsd: null });
    expect(i.controlI2.incidencias).toContainEqual({ codigo: "importe_sin_convertir", cantidad: 1 });
    expect(i.controlI2.unidadMayor).toBe("nominal_mixto");
  });
  it("una VES acreditada y otra huérfana cuentan1, no2, y conservan la incidencia", async () => {
    const d = datosReversoGo1({ currency: "VES", base: 3650, fxRate: 36.5 });
    d.invoices.push({ ...d.invoices[0], id: "ves-huerfana", status: "emitida", issued_at: "2026-10-05" });
    d.journal_entries.push({ ...d.journal_entries[0], id: "header-huerfano", invoice_id: "ves-huerfana", entry_date: "2026-10-05" });
    const { ingreso: i } = await leerReversoGo1(d, rango);
    expect(i.enOtraMoneda).toBe(1);
    expect(i.controlI2).toMatchObject({ unidadMayor: "nominal_mixto", verificacion: "requiere_revision" });
    expect(i.controlI2.incidencias).toContainEqual({ codigo: "lineas_invalidas", cantidad: 1 });
    expect(i.diferenciaUsd).toBeNull();
    expect(describirIngreso(i).estado).toBe("no_comparable");
  });
});
