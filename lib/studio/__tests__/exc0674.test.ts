/** SDD-0674 · EXC-0674: roles, monto tecleado y mensajes de la RPC. Datos inventados. */
import { describe, expect, it } from "vitest";
import { mensajeErrorExc0674, parsearMontoUsd, rolFacturaExc0674 } from "../exc0674";

describe("rolFacturaExc0674", () => {
  it.each(["accounting", "admin"] as const)("%s factura", (rol) => {
    expect(rolFacturaExc0674(rol)).toBe(true);
  });
  it.each(["operations", "commercial", "warehouse", "support", "marketing"] as const)("%s no factura ni ve montos", (rol) => {
    expect(rolFacturaExc0674(rol)).toBe(false);
  });
  it("sin rol no factura", () => {
    expect(rolFacturaExc0674(null)).toBe(false);
    expect(rolFacturaExc0674(undefined)).toBe(false);
  });
});

describe("parsearMontoUsd (total con IVA, en dólares)", () => {
  it.each([
    ["116", 11600],
    ["116.5", 11650],
    ["116,50", 11650],
    ["1.234,56", 123456],
    ["1,234.56", 123456],
    ["12.345.678,9", 1234567890],
    [" $ 406 ", 40600],
    ["0.01", 1],
    ["1.234", 123400],
    ["10.005", 1000500],
  ])("%s → %i centavos", (texto, centavos) => {
    expect(parsearMontoUsd(texto)).toEqual({ ok: true, centavos });
  });

  it.each(["", "0", "0,00", "-5", "10.0051", "10,005.5.5", "1,234,5", "1.234.5", "abc", "1e3", "1.23.45", "1,234,567.891"])(
    "rechaza «%s»",
    (texto) => {
      expect(parsearMontoUsd(texto).ok).toBe(false);
    },
  );

  it("rechaza un monto que no cabe en numeric(14,2)", () => {
    expect(parsearMontoUsd("1000000000000").ok).toBe(false);
    expect(parsearMontoUsd("999999999999,99")).toEqual({ ok: true, centavos: 99999999999999 });
  });
});

describe("mensajeErrorExc0674", () => {
  it("traduce cada motivo de la RPC y nombra al cliente", () => {
    expect(mensajeErrorExc0674("exc0674:ya_facturado:DTD-T001")).toContain("ya está facturado");
    expect(mensajeErrorExc0674("exc0674:ya_facturado:DTD-T001")).toContain("DTD-T001");
    expect(mensajeErrorExc0674("exc0674:rol")).toContain("Tu rol no puede");
    expect(mensajeErrorExc0674("exc0674:contenedor_fuera_de_lista")).toContain("lista");
    expect(mensajeErrorExc0674("exc0674:asiento:sin_cuentas")).toContain("asiento");
    expect(mensajeErrorExc0674("exc0674:monto:AR-1")).toContain("AR-1");
    expect(mensajeErrorExc0674("exc0674:cliente_ambiguo:DTD-T001")).toContain("más de una ficha de cliente con ese Shipping Mark (DTD-T001)");
    expect(mensajeErrorExc0674("exc0674:aliado_ciclo:DTD-T001")).toContain("cadena de aliados de ese cliente está mal armada (DTD-T001)");
  });
  it("SDD-0690: traduce los errores de la 0569 y la guarda del camino tecleado", () => {
    expect(mensajeErrorExc0674("exc0674:tiene_preorden:DTD-T001")).toContain("tiene una pre-orden en este contenedor (DTD-T001)");
    expect(mensajeErrorExc0674("exc0674:no_borrador:F-T1")).toContain("ya no está pendiente (F-T1)");
    expect(mensajeErrorExc0674("exc0674:moneda:F-T1")).toContain("no está en dólares (F-T1)");
    expect(mensajeErrorExc0674("exc0674:borrador_alterado:F-T1")).toContain("cambió mientras se emitía (F-T1)");
    expect(mensajeErrorExc0674("exc0674:factura_inexistente:x")).toContain("No se encontró la pre-orden");
    expect(mensajeErrorExc0674("exc0674:envio_fuera_del_contenedor:F-T1")).toContain("no son de este contenedor");
    for (const m of ["tiene_preorden", "no_borrador", "moneda", "borrador_alterado"]) {
      expect(mensajeErrorExc0674(`exc0674:${m}:X`)).toMatch(/no se emitió ninguna factura/i);
      expect(mensajeErrorExc0674(`exc0674:${m}:X`)).not.toMatch(/borrador/i);
    }
  });
  it("un error desconocido dice que no se emitió nada", () => {
    expect(mensajeErrorExc0674("boom")).toContain("No se emitió ninguna factura");
    expect(mensajeErrorExc0674(undefined)).toContain("No se emitió ninguna factura");
  });
});
