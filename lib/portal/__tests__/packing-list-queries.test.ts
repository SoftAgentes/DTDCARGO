// @vitest-environment node
import { describe, expect, it } from "vitest";
import { cotejarConLoAnunciado } from "../packing-list-queries";

/**
 * SDD-0308 · Cotejo entre las cajas que el cliente anunció y las que el
 * proveedor declaró en su packing list.
 *
 * Lo que se protege acá es una decisión de producto, no una fórmula: **el
 * desajuste se muestra y el "no hay dato" no se disfraza de cero.** Los dos
 * errores que estas pruebas impiden son:
 *
 *   · devolver un cotejo "de-menos" cuando el proveedor simplemente no llenó la
 *     columna de cajas — le diría al cliente que le faltan cajas por un campo
 *     vacío;
 *   · redondear mal el total y reportar una diferencia que no existe.
 */
describe("cotejarConLoAnunciado", () => {
  it("cuadra cuando el packing list trae las mismas cajas que se anunciaron", () => {
    const r = cotejarConLoAnunciado(10, 10);
    expect(r).toEqual({
      anunciadas: 10,
      enPackingList: 10,
      diferencia: 0,
      estado: "cuadra",
    });
  });

  it("reporta el faltante con el número exacto, no sólo el total recibido", () => {
    const r = cotejarConLoAnunciado(10, 7);
    expect(r?.estado).toBe("de-menos");
    // El signo importa: la UI escribe "son 3 menos" con `Math.abs`, y un
    // diferencia positiva acá invertiría la frase.
    expect(r?.diferencia).toBe(-3);
  });

  it("reporta también el excedente — el proveedor pudo despachar de más", () => {
    const r = cotejarConLoAnunciado(5, 8);
    expect(r?.estado).toBe("de-mas");
    expect(r?.diferencia).toBe(3);
  });

  it("no coteja cuando el packing list no declara cajas (0 ≠ 'cero cajas')", () => {
    // Éste es el caso que motivó la función. `total_ctns` arranca en 0 por
    // default en la tabla (migr 0147:59): un proveedor que no llenó la columna
    // deja un 0 que NO significa "despaché cero cajas".
    expect(cotejarConLoAnunciado(10, 0)).toBeNull();
  });

  it("no coteja cuando no hay cajas anunciadas contra qué comparar", () => {
    expect(cotejarConLoAnunciado(0, 7)).toBeNull();
  });

  it("no coteja con números no finitos (NaN de un jsonb corrupto)", () => {
    expect(cotejarConLoAnunciado(10, Number.NaN)).toBeNull();
    expect(cotejarConLoAnunciado(Number.NaN, 7)).toBeNull();
    expect(cotejarConLoAnunciado(10, Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("redondea el total del packing list: la columna es numeric(14,3)", () => {
    // `total_ctns` es numeric(14,3) — puede llegar 7.000 o, si alguien sumó mal
    // arriba, 6.999. Las cajas son enteras; el cotejo no puede reportar una
    // diferencia de 0,001 caja.
    expect(cotejarConLoAnunciado(7, 6.999)?.estado).toBe("cuadra");
    expect(cotejarConLoAnunciado(7, 7.4)?.estado).toBe("cuadra");
    expect(cotejarConLoAnunciado(7, 7.5)?.estado).toBe("de-mas");
  });
});
