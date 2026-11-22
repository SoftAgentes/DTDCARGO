// @vitest-environment node
/** SDD-0704 F1-A · Números, cifras y mensajes de la pantalla «IA». */
import { describe, expect, it } from "vitest";

import { AVISOS_IA, cifra, codigoDeError, costoEfectivoOficina, leerNumero, tonoDelAviso, type PantallaIa } from "../pantalla";

describe("leerNumero", () => {
  it("acepta la coma decimal, el punto de miles y el punto decimal", () => {
    expect(leerNumero("2,5")).toBe(2.5);
    expect(leerNumero("1.234,50")).toBe(1234.5);
    expect(leerNumero("2.5")).toBe(2.5);
    expect(leerNumero(" 15 ")).toBe(15);
    expect(leerNumero("0.125")).toBe(0.125);
    expect(leerNumero("1.000,00")).toBe(1000);
  });
  it("sin coma, un punto de miles es ambiguo y se rechaza (nunca «1.000» → 1)", () => {
    for (const ambiguo of ["1.000", "12.500", "1.234.567"]) {
      expect(leerNumero(ambiguo), ambiguo).toBeNull();
    }
  });
  it("rechaza lo que no es un número", () => {
    for (const malo of ["", "dos", "-1", "1e3", "1,2,3", "Infinity", null, undefined]) {
      expect(leerNumero(malo), String(malo)).toBeNull();
    }
  });
});

describe("cifra", () => {
  it("usa la coma decimal y el punto de miles", () => {
    expect(cifra(1234.5)).toBe("1.234,50");
    expect(cifra(0)).toBe("0,00");
  });
});

describe("codigoDeError", () => {
  it("traduce los errores de la 0570 a un código y nunca devuelve el texto", () => {
    expect(codigoDeError(null)).toBe("ok");
    expect(codigoDeError({ code: "42501", message: "ia:requiere_aal2" })).toBe("requiere_aal2");
    expect(codigoDeError({ code: "23505", message: 'duplicate key value violates unique constraint "ia_cuentas_una_oficina"' })).toBe("una_oficina");
    expect(codigoDeError({ code: "23514", message: 'violates check constraint "ia_cuentas_oficina_no_china"' })).toBe("oficina_china");
    expect(codigoDeError({ code: "PGRST205", message: "relation not found" })).toBe("sin_migracion");
    expect(codigoDeError({ code: "XX000", message: "algo raro con datos 0414-555-1234" })).toBe("error");
  });
  it("cada código tiene su aviso", () => {
    for (const c of ["requiere_aal2", "una_oficina", "oficina_china", "sin_migracion", "error", "fuera_del_catalogo", "sobre_el_techo"]) {
      expect(AVISOS_IA[c], c).toBeTruthy();
    }
    expect(tonoDelAviso("ok_tope")).toBe("exito");
    expect(tonoDelAviso("requiere_aal2")).toBe("atencion");
    expect(tonoDelAviso("oficina_china")).toBe("error");
  });
});

describe("costoEfectivoOficina", () => {
  const ENTORNO = { topeMensualUsd: 6, precios: { entradaPorMTok: 7, salidaPorMTok: 29 }, techoUsd: 15 };
  const datos: PantallaIa = {
    cuentas: [{ id: "c1", alias: "Oficina", proveedor: "anthropic", uso: "oficina", tipoCobro: "por_token", topeLlamadasMes: null }],
    modelos: [{ id: "m1", cuentaId: "c1", proveedor: "anthropic", modelo: "claude-haiku-5-5", entrada: 1, salida: 5 }],
    catalogo: [],
    topeOficinaUsd: 3,
    gasto: [],
  };
  it("es el mismo cálculo que hace el despachador", () => {
    const c = costoEfectivoOficina(datos, ENTORNO);
    expect(c.topeMensualUsd).toBe(3);
    expect(c.origenTope).toBe("pantalla");
    expect(c.precioDe("claude-haiku-5-5")).toEqual({ entradaPorMTok: 1, salidaPorMTok: 5 });
  });
  it("sin tope en la pantalla, el del entorno", () => {
    expect(costoEfectivoOficina({ ...datos, topeOficinaUsd: null }, ENTORNO)).toMatchObject({ topeMensualUsd: 6, origenTope: "entorno" });
  });
});
