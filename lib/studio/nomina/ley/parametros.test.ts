// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  PARAMETROS_LEY,
  GRUPOS_LEY,
  UNIDAD_CAMPO,
  NOTA_NO_VERIFICADO,
  compararParametro,
  compararConLey,
  resumenComparacion,
  estaVerificado,
  formatearValorLey,
  formatearFechaLey,
  type ParametroLey,
} from "./parametros";
import type { PayrollRules } from "../payroll-rules-types";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function reglas(over: Partial<PayrollRules> = {}): PayrollRules {
  return {
    id: "r1",
    tenant_id: "t1",
    version: 2,
    status: "vigente",
    pay_frequency: "mensual",
    day_method: "30",
    min_salary: 130,
    cestaticket: 40,
    bono_guerra: 90,
    sso_pct: 4,
    rpe_pct: 0.5,
    faov_pct: 1,
    sso_cap_sm: 5,
    rpe_cap_sm: 10,
    overtime_pct: 50,
    night_pct: 30,
    holiday_pct: 50,
    utilidades_days: 30,
    bono_vacacional_days: 15,
    vacaciones_days: 15,
    salarial_bonuses: [],
    notes: null,
    created_by: null,
    created_at: "2026-11-16T12:00:00Z",
    updated_at: "2026-11-16T12:00:00Z",
    deleted_at: null,
    ...over,
  };
}

const porId = (id: string): ParametroLey => {
  const p = PARAMETROS_LEY.find((x) => x.id === id);
  if (!p) throw new Error(`falta ${id}`);
  return p;
};

describe("PARAMETROS_LEY · forma", () => {
  it("ids únicos y en kebab-case", () => {
    const ids = PARAMETROS_LEY.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("cada parámetro pertenece a un grupo declarado y cada grupo tiene parámetros", () => {
    const grupos = new Set(GRUPOS_LEY.map((g) => g.id));
    for (const p of PARAMETROS_LEY) expect(grupos.has(p.grupo)).toBe(true);
    for (const g of GRUPOS_LEY) expect(PARAMETROS_LEY.some((p) => p.grupo === g.id)).toBe(true);
  });

  it("toda entrada trae instrumento, texto y fechas ISO válidas", () => {
    for (const p of PARAMETROS_LEY) {
      expect(p.fuente.instrumento.trim().length).toBeGreaterThan(0);
      expect(p.texto.trim().length).toBeGreaterThan(10);
      if (p.vigenteDesde) expect(p.vigenteDesde).toMatch(ISO);
      if (p.fuente.fecha) expect(p.fuente.fecha).toMatch(ISO);
    }
  });

  it("un anuncio nunca dice tener Gaceta propia del anuncio, salvo referencia previa explícita", () => {
    for (const p of PARAMETROS_LEY.filter((x) => x.grado === "anuncio")) {
      // Si cita Gaceta, el detalle tiene que explicar que es otra (anterior).
      if (p.fuente.gaceta) expect(p.detalle ?? "").toMatch(/Gaceta|G\.O\./);
    }
  });

  it("lo marcado verificado dice dónde se comprobó", () => {
    for (const p of PARAMETROS_LEY.filter(estaVerificado)) {
      expect((p.comprobadoEn ?? "").trim().length, p.id).toBeGreaterThan(10);
    }
  });

  it("un anuncio o algo por confirmar nunca se presenta como comprobado en Gaceta", () => {
    for (const p of PARAMETROS_LEY.filter((x) => !estaVerificado(x))) {
      expect(p.comprobadoEn ?? "", p.id).not.toMatch(/^PDF de la Imprenta Nacional/);
    }
  });

  it("LOTTT, IVSS y RPE quedaron verificados; FAOV sigue por confirmar", () => {
    for (const id of ["hora-extra", "bono-nocturno", "dia-feriado", "utilidades", "vacaciones", "bono-vacacional", "sso-trabajador", "sso-tope", "sso-patrono", "rpe-trabajador", "rpe-tope", "rpe-patrono"]) {
      expect(porId(id).grado, id).toBe("verificado");
    }
    expect(porId("faov-trabajador").grado).toBe("por-confirmar");
    expect(porId("faov-patrono").grado).toBe("por-confirmar");
  });

  it("un campo de reglas aparece una sola vez", () => {
    const campos = PARAMETROS_LEY.map((p) => p.campo).filter(Boolean);
    expect(new Set(campos).size).toBe(campos.length);
    for (const c of campos) expect(UNIDAD_CAMPO).toHaveProperty(c as string);
  });

  it("la nota de no verificado pide consultar a un abogado", () => {
    expect(NOTA_NO_VERIFICADO).toMatch(/abogado/);
  });
});

describe("PARAMETROS_LEY · valores de la investigación del 2026-11-16", () => {
  it("salario mínimo Bs 130 verificado (G.O. 6.691 Ext.)", () => {
    const p = porId("salario-minimo");
    expect(p.valor).toBe(130);
    expect(p.unidad).toBe("VES");
    expect(p.grado).toBe("verificado");
    expect(p.fuente.gaceta).toContain("6.691");
  });

  it("ingreso mínimo integral y bono de guerra son anuncios en USD", () => {
    expect(porId("ingreso-minimo-integral")).toMatchObject({ valor: 240, unidad: "USD", grado: "anuncio" });
    expect(porId("bono-guerra")).toMatchObject({ valor: 200, unidad: "USD", grado: "anuncio" });
  });

  it("contribución de pensiones 9 % verificada (Decreto 4.952, G.O. 42.880)", () => {
    const p = porId("contribucion-pensiones");
    expect(p.valor).toBe(9);
    expect(p.grado).toBe("verificado");
    expect(p.fuente.gaceta).toContain("42.880");
  });
});

describe("compararParametro", () => {
  it("sin reglas, todo falta", () => {
    expect(compararParametro(porId("salario-minimo"), null).estado).toBe("falta");
  });

  it("sin campo en las reglas, falta", () => {
    expect(compararParametro(porId("contribucion-pensiones"), reglas()).estado).toBe("falta");
  });

  it("igual: coincide o difiere", () => {
    expect(compararParametro(porId("salario-minimo"), reglas()).estado).toBe("al-dia");
    expect(compararParametro(porId("salario-minimo"), reglas({ min_salary: 150 })).estado).toBe("difiere");
  });

  it("monto en Bs frente a ley en USD → otra moneda, no «al día»", () => {
    const c = compararParametro(porId("cestaticket"), reglas({ cestaticket: 40 }));
    expect(c.estado).toBe("unidad");
    expect(c.valorRegla).toBe(40);
    expect(c.unidadRegla).toBe("VES");
  });

  it("mínimo: por encima del piso está al día; por debajo difiere", () => {
    expect(compararParametro(porId("hora-extra"), reglas({ overtime_pct: 60 })).estado).toBe("al-dia");
    expect(compararParametro(porId("hora-extra"), reglas({ overtime_pct: 40 })).estado).toBe("difiere");
  });

  it("mínimo con tope: utilidades por encima de 120 difiere", () => {
    expect(compararParametro(porId("utilidades"), reglas({ utilidades_days: 120 })).estado).toBe("al-dia");
    expect(compararParametro(porId("utilidades"), reglas({ utilidades_days: 121 })).estado).toBe("difiere");
  });

  it("valor no numérico cuenta como falta", () => {
    const r = reglas({ min_salary: Number.NaN });
    expect(compararParametro(porId("salario-minimo"), r).estado).toBe("falta");
  });
});

describe("resumenComparacion", () => {
  it("cuenta estados y no verificados sobre todo el catálogo", () => {
    const items = compararConLey(reglas());
    const r = resumenComparacion(items);
    expect(r["al-dia"] + r.difiere + r.unidad + r.falta).toBe(PARAMETROS_LEY.length);
    expect(r.noVerificados).toBe(PARAMETROS_LEY.filter((p) => !estaVerificado(p)).length);
    // Siembra demo: cestaticket y bono en «Bs» frente a USD.
    expect(r.unidad).toBe(2);
  });
});

describe("formato", () => {
  it("formatea valores por unidad", () => {
    expect(formatearValorLey(130, "VES")).toBe("Bs 130,00");
    expect(formatearValorLey(240, "USD")).toBe("USD 240");
    expect(formatearValorLey(0.5, "pct")).toBe("0,5 %");
    expect(formatearValorLey(5, "sm")).toBe("5 SM");
    expect(formatearValorLey(30, "dias")).toBe("30 días");
  });

  it("formatea fechas sin correrse por zona horaria", () => {
    expect(formatearFechaLey("2022-03-15")).toBe("15 de marzo de 2022");
    expect(formatearFechaLey("2026-11-16T23:59:00Z")).toBe("16 de noviembre de 2026");
  });
});

describe("frontera: solo información pública", () => {
  it("no importa base de datos, Supabase ni consultas", () => {
    const src = readFileSync(fileURLToPath(new URL("./parametros.ts", import.meta.url)), "utf8");
    const imports = src.split("\n").filter((l) => /^\s*import\b/.test(l));
    for (const l of imports) {
      expect(l).not.toMatch(/@supabase|@\/lib\/db|queries|server-only/);
    }
  });
});
