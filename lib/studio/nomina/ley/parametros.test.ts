// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  PARAMETROS_LEY,
  GRUPOS_LEY,
  UNIDAD_CAMPO,
  unidadDelCampo,
  NOTA_NO_VERIFICADO,
  compararParametro,
  compararConLey,
  cuentaComoObligacion,
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

/** Una versión guardada con la migración 0556: trae todos los campos nuevos, en los valores de la ley. */
function reglas0556(over: Partial<PayrollRules> = {}): PayrollRules {
  return reglas({
    vigente_desde: "2026-11-17",
    fuente_legal: "Decreto de prueba",
    ingreso_minimo_integral_usd: 240,
    cestaticket_moneda: "USD",
    bono_guerra_moneda: "USD",
    sso_patronal_pct: 9,
    rpe_patronal_pct: 2,
    faov_patronal_pct: 2,
    inces_patronal_pct: 2,
    inces_utilidades_pct: 0.5,
    pension_contrib_pct: 9,
    vacaciones_extra_max: 15,
    bono_vacacional_max_days: 30,
    ...over,
  });
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

  it("toda entrada trae instrumento, texto, dónde se comprobó y fechas ISO válidas", () => {
    for (const p of PARAMETROS_LEY) {
      expect(p.fuente.instrumento.trim().length, p.id).toBeGreaterThan(0);
      expect(p.texto.trim().length, p.id).toBeGreaterThan(10);
      expect(p.comprobadoEn.trim().length, p.id).toBeGreaterThan(10);
      if (p.vigenteDesde) expect(p.vigenteDesde, p.id).toMatch(ISO);
      if (p.fuente.fecha) expect(p.fuente.fecha, p.id).toMatch(ISO);
    }
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

describe("PARAMETROS_LEY · qué significa cada grado", () => {
  it("verificado exige número y fecha de Gaceta, fecha de vigencia y lectura en la Gaceta", () => {
    const verificados = PARAMETROS_LEY.filter(estaVerificado);
    expect(verificados.length).toBeGreaterThan(0);
    for (const p of verificados) {
      expect(p.fuente.gaceta, p.id).toMatch(/^G\.O\. N° [\d.]+/);
      expect(p.fuente.fecha, p.id).toMatch(ISO);
      expect(p.vigenteDesde, p.id).toMatch(ISO);
      expect(p.comprobadoEn, p.id).toMatch(/Imprenta Nacional|Facsímil de la G\.O\./);
    }
  });

  it("nada leído en una reproducción, una sentencia, una página sin cita o la prensa es verificado", () => {
    for (const p of PARAMETROS_LEY) {
      if (/Reproducción|Sentencia|Fuentes secundarias|Página informativa|Prensa/.test(p.comprobadoEn)) {
        expect(p.grado, p.id).not.toBe("verificado");
      }
    }
  });

  it("un anuncio no cita Gaceta propia ni se presenta como leído en la Imprenta Nacional", () => {
    const anuncios = PARAMETROS_LEY.filter((p) => p.grado === "anuncio");
    expect(anuncios.map((p) => p.id).sort()).toEqual(["bono-guerra", "cestaticket", "ingreso-minimo-integral"]);
    for (const p of anuncios) {
      expect(p.fuente.gaceta, p.id).toBeNull();
      expect(p.fuente.instrumento, p.id).toMatch(/^Anuncio/);
      expect(p.comprobadoEn, p.id).not.toMatch(/^PDF de la Imprenta Nacional/);
    }
  });

  it("sin fecha de vigencia conocida, la entrada no es verificada", () => {
    for (const p of PARAMETROS_LEY.filter((x) => x.vigenteDesde === null)) {
      expect(p.grado, p.id).not.toBe("verificado");
    }
  });

  it("grados de la investigación del 2026-11-17", () => {
    const verificados = [
      "salario-minimo", "hora-extra", "bono-nocturno", "dia-feriado",
      "utilidades", "vacaciones", "bono-vacacional", "contribucion-pensiones",
      "vacaciones-adicionales", "bono-vacacional-maximo",
    ];
    const porConfirmar = [
      "sso-trabajador", "sso-tope", "sso-patrono", "rpe-trabajador", "rpe-tope", "rpe-patrono",
      "faov-trabajador", "faov-patrono", "inces-trabajador", "inces-patrono",
    ];
    for (const id of verificados) expect(porId(id).grado, id).toBe("verificado");
    for (const id of porConfirmar) expect(porId(id).grado, id).toBe("por-confirmar");
    expect(verificados.length + porConfirmar.length + 3).toBe(PARAMETROS_LEY.length);
  });
});

describe("PARAMETROS_LEY · valores", () => {
  it("salario mínimo Bs 130 (Decreto 4.653, G.O. 6.691 Ext., Art. 1)", () => {
    const p = porId("salario-minimo");
    expect(p).toMatchObject({ valor: 130, unidad: "VES", vigenteDesde: "2022-03-15" });
    expect(p.fuente.gaceta).toContain("6.691");
    expect(p.fuente.articulo).toBe("Art. 1");
  });

  it("el cestaticket de USD 40 es un anuncio: no se atribuye a la Gaceta de 2023 ni tiene vigencia", () => {
    const p = porId("cestaticket");
    expect(p).toMatchObject({ valor: 40, unidad: "USD", grado: "anuncio", vigenteDesde: null, alcance: "obliga" });
    expect(p.fuente.gaceta).toBeNull();
    expect(p.detalle).toMatch(/6\.746/);
  });

  it("ingreso mínimo integral y bono de guerra: anuncio para el sector público, referencia para DTD", () => {
    expect(porId("ingreso-minimo-integral")).toMatchObject({ valor: 240, unidad: "USD", alcance: "referencia" });
    expect(porId("ingreso-minimo-integral").texto).toMatch(/sector público/);
    expect(porId("ingreso-minimo-integral").texto).toMatch(/exhortó/);
    expect(porId("bono-guerra")).toMatchObject({ valor: 200, unidad: "USD", alcance: "referencia" });
  });

  it("contribución de pensiones 9 % (Decreto 4.952, G.O. 42.880)", () => {
    const p = porId("contribucion-pensiones");
    expect(p).toMatchObject({ valor: 9, unidad: "pct", vigenteDesde: "2024-05-16" });
    expect(p.fuente.gaceta).toContain("42.880");
  });
});

describe("compararParametro", () => {
  it("sin reglas, todo falta", () => {
    expect(compararParametro(porId("salario-minimo"), null).estado).toBe("falta");
  });

  it("sin el campo en las reglas (la base no tiene la 0556), falta", () => {
    expect(compararParametro(porId("contribucion-pensiones"), reglas()).estado).toBe("falta");
    expect(compararParametro(porId("sso-patrono"), reglas()).estado).toBe("falta");
    expect(compararParametro(porId("ingreso-minimo-integral"), reglas()).estado).toBe("falta");
  });

  it("con la 0556, cada norma nueva se compara con su campo", () => {
    expect(compararParametro(porId("contribucion-pensiones"), reglas0556()).estado).toBe("al-dia");
    expect(compararParametro(porId("contribucion-pensiones"), reglas0556({ pension_contrib_pct: 12 })).estado).toBe("difiere");
    expect(compararParametro(porId("rpe-patrono"), reglas0556()).estado).toBe("al-dia");
    expect(compararParametro(porId("faov-patrono"), reglas0556({ faov_patronal_pct: 1 })).estado).toBe("difiere");
    expect(compararParametro(porId("inces-patrono"), reglas0556()).estado).toBe("al-dia");
    expect(compararParametro(porId("inces-trabajador"), reglas0556()).estado).toBe("al-dia");
    expect(compararParametro(porId("vacaciones-adicionales"), reglas0556()).estado).toBe("al-dia");
    expect(compararParametro(porId("bono-vacacional-maximo"), reglas0556({ bono_vacacional_max_days: 15 })).estado).toBe("difiere");
  });

  it("un campo «sin configurar» (null) falta: nunca se lee como cero ni queda «al día»", () => {
    const sinConfigurar = reglas0556({
      pension_contrib_pct: null,
      sso_patronal_pct: null,
      rpe_patronal_pct: null,
      faov_patronal_pct: null,
      inces_patronal_pct: null,
      inces_utilidades_pct: null,
      vacaciones_extra_max: null,
      bono_vacacional_max_days: null,
      ingreso_minimo_integral_usd: null,
    });
    for (const id of [
      "contribucion-pensiones",
      "sso-patrono",
      "rpe-patrono",
      "faov-patrono",
      "inces-patrono",
      "inces-trabajador",
      "vacaciones-adicionales",
      "bono-vacacional-maximo",
      "ingreso-minimo-integral",
    ]) {
      expect(compararParametro(porId(id), sinConfigurar).estado, id).toBe("falta");
    }
  });

  it("un cero configurado SÍ es un valor: difiere de la ley, no «falta»", () => {
    expect(compararParametro(porId("contribucion-pensiones"), reglas0556({ pension_contrib_pct: 0 })).estado).toBe("difiere");
    expect(compararParametro(porId("rpe-patrono"), reglas0556({ rpe_patronal_pct: 0 })).estado).toBe("difiere");
  });

  it("IVSS del patrono: 9, 10 u 11 según el riesgo; fuera de ese rango difiere", () => {
    for (const pct of [9, 10, 11]) {
      expect(compararParametro(porId("sso-patrono"), reglas0556({ sso_patronal_pct: pct })).estado, String(pct)).toBe("al-dia");
    }
    expect(compararParametro(porId("sso-patrono"), reglas0556({ sso_patronal_pct: 8 })).estado).toBe("difiere");
    expect(compararParametro(porId("sso-patrono"), reglas0556({ sso_patronal_pct: 12 })).estado).toBe("difiere");
  });

  it("ingreso mínimo integral: se compara en USD con su campo propio", () => {
    const c = compararParametro(porId("ingreso-minimo-integral"), reglas0556());
    expect(c.estado).toBe("al-dia");
    expect(c.unidadRegla).toBe("USD");
    expect(compararParametro(porId("ingreso-minimo-integral"), reglas0556({ ingreso_minimo_integral_usd: 0 })).estado).toBe("difiere");
  });

  it("cestaticket y bono dicen su moneda: en USD se comparan con la referencia; en Bs, otra moneda (D4)", () => {
    const enUsd = compararParametro(porId("cestaticket"), reglas0556({ cestaticket: 40 }));
    expect(enUsd.unidadRegla).toBe("USD");
    expect(enUsd.estado).toBe("al-dia");
    const enBs = compararParametro(porId("cestaticket"), reglas0556({ cestaticket: 40, cestaticket_moneda: "VES" }));
    expect(enBs.unidadRegla).toBe("VES");
    expect(enBs.estado).toBe("unidad");
    const bono = compararParametro(porId("bono-guerra"), reglas0556({ bono_guerra: 200 }));
    expect(bono.unidadRegla).toBe("USD");
    expect(bono.estado).toBe("al-dia");
  });

  it("unidadDelCampo: los bonos leen su moneda; sin la 0556, bolívares; el resto, la fija", () => {
    expect(unidadDelCampo("cestaticket", reglas0556())).toBe("USD");
    expect(unidadDelCampo("bono_guerra", reglas0556({ bono_guerra_moneda: "VES" }))).toBe("VES");
    expect(unidadDelCampo("cestaticket", reglas())).toBe("VES");
    expect(unidadDelCampo("cestaticket", null)).toBe("VES");
    expect(unidadDelCampo("min_salary", reglas0556())).toBe("VES");
    expect(unidadDelCampo("ingreso_minimo_integral_usd", null)).toBe("USD");
    expect(unidadDelCampo("pension_contrib_pct", null)).toBe("pct");
  });

  it("igual: coincide o difiere", () => {
    expect(compararParametro(porId("salario-minimo"), reglas()).estado).toBe("al-dia");
    expect(compararParametro(porId("salario-minimo"), reglas({ min_salary: 150 })).estado).toBe("difiere");
  });

  it("monto en Bs frente a referencia en USD → otra moneda, no «al día»", () => {
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

describe("obligaciones y referencias", () => {
  it("un anuncio o algo que no obliga a DTD no cuenta como obligación", () => {
    expect(cuentaComoObligacion(porId("ingreso-minimo-integral"))).toBe(false);
    expect(cuentaComoObligacion(porId("bono-guerra"))).toBe(false);
    expect(cuentaComoObligacion(porId("cestaticket"))).toBe(false);
    expect(cuentaComoObligacion(porId("salario-minimo"))).toBe(true);
    expect(cuentaComoObligacion(porId("sso-trabajador"))).toBe(true);
  });

  it("el resumen cuenta solo obligaciones; las referencias van aparte", () => {
    const r = resumenComparacion(compararConLey(reglas()));
    // Sin la 0556 faltan los aportes del patrono, la contribución, el INCES de utilidades y las dos escalas.
    expect(r).toEqual({
      obligaciones: 20,
      obligacionesAlDia: 12,
      porRevisar: 0,
      faltan: 8,
      referencias: 3,
      noVerificados: 13,
    });
    expect(r.obligaciones + r.referencias).toBe(PARAMETROS_LEY.length);
    expect(r.obligacionesAlDia + r.porRevisar + r.faltan).toBe(r.obligaciones);
  });

  it("con una versión de la 0556 en los valores de la ley, ninguna obligación falta", () => {
    const r = resumenComparacion(compararConLey(reglas0556()));
    expect(r).toEqual({
      obligaciones: 20,
      obligacionesAlDia: 20,
      porRevisar: 0,
      faltan: 0,
      referencias: 3,
      noVerificados: 13,
    });
  });

  it("una versión de la 0556 sin configurar aportes ni escalas: faltan 8 y ninguno cuenta como al día", () => {
    const sinConfigurar = reglas0556({
      pension_contrib_pct: null,
      sso_patronal_pct: null,
      rpe_patronal_pct: null,
      faov_patronal_pct: null,
      inces_patronal_pct: null,
      inces_utilidades_pct: null,
      vacaciones_extra_max: null,
      bono_vacacional_max_days: null,
    });
    const r = resumenComparacion(compararConLey(sinConfigurar));
    expect(r.faltan).toBe(8);
    expect(r.obligacionesAlDia).toBe(12);
    expect(r.porRevisar).toBe(0);
  });

  it("cargar el bono anunciado no sube la cuenta de obligaciones al día", () => {
    const base = resumenComparacion(compararConLey(reglas()));
    const conBono = resumenComparacion(compararConLey(reglas({ bono_guerra: 200 })));
    expect(conBono.obligacionesAlDia).toBe(base.obligacionesAlDia);
  });

  it("una obligación que difiere sí se cuenta por revisar", () => {
    const r = resumenComparacion(compararConLey(reglas({ min_salary: 100, overtime_pct: 10 })));
    expect(r.porRevisar).toBe(2);
    expect(r.obligacionesAlDia).toBe(10);
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
  it("solo importa tipos: nada de base de datos, Supabase ni consultas en tiempo de ejecución", () => {
    const src = readFileSync(fileURLToPath(new URL("./parametros.ts", import.meta.url)), "utf8");
    const imports = src.split("\n").filter((l) => /^\s*import\b/.test(l));
    expect(imports.length).toBeGreaterThan(0);
    for (const l of imports) {
      // `import type` se borra al compilar: no ejecuta el módulo importado.
      expect(l, l).toMatch(/^\s*import type\b/);
      expect(l, l).not.toMatch(/@supabase|@\/lib\/db|queries|server-only/);
    }
    expect(src).not.toMatch(/\brequire\(|\bimport\(/);
  });
});
