/**
 * lib/studio/nomina/ley/parametros.ts · La ley pública de nómina (SDD-0653).
 *
 * Única fuente de verdad legal del módulo: la usa la pestaña «Reglas» para
 * comparar lo que el tenant tiene cargado con lo que dice la ley, y la usará el
 * estante «Ley» de Faro (fase B1). Son datos puros: sin React, sin base de
 * datos, sin datos de empleados. Este repositorio es público: aquí solo va
 * información publicada en Gaceta o anunciada por el Ejecutivo.
 *
 * Cada entrada dice de dónde sale y qué tan verificada está. Lo que no está
 * verificado se muestra con asterisco y con la nota de `NOTA_NO_VERIFICADO`.
 * Investigación del 2026-11-16 (spec 0653 §2 y §9); la revisa el contador.
 */

import type { PayrollRules } from "../payroll-rules-types";

/** Fecha de corte de la investigación legal (AAAA-MM-DD). */
export const FECHA_CORTE_LEY = "2026-11-17";

/** Nota fija para todo lo que no se pudo verificar contra la Gaceta. */
export const NOTA_NO_VERIFICADO =
  "No está verificado. Consúltalo con un abogado laboral o con el contador antes de usarlo.";

/**
 * - `verificado`: se leyó la Gaceta o el texto de la ley (o una fuente que la cita).
 * - `anuncio`: lo anunció el Ejecutivo; no se encontró decreto en Gaceta.
 * - `por-confirmar`: norma conocida, pero no se volvió a leer el texto oficial.
 */
export type GradoLey = "verificado" | "anuncio" | "por-confirmar";

export type UnidadLey = "VES" | "USD" | "pct" | "dias" | "sm";

export type GrupoLey = "montos" | "deducciones" | "recargos" | "provisiones" | "patrono";

export interface FuenteLegal {
  /** «LOTTT», «Decreto N° 4.952», «Ley del Seguro Social». */
  readonly instrumento: string;
  /** «G.O. N° 6.691 Extraordinario»; null si solo hay anuncio. */
  readonly gaceta: string | null;
  /** Fecha de publicación AAAA-MM-DD, si se conoce. */
  readonly fecha: string | null;
  /** «Art. 131», si aplica. */
  readonly articulo: string | null;
}

/** Campos numéricos de las reglas que se pueden comparar con la ley. */
export type CampoRegla = Extract<
  keyof PayrollRules,
  | "min_salary"
  | "cestaticket"
  | "bono_guerra"
  | "sso_pct"
  | "rpe_pct"
  | "faov_pct"
  | "sso_cap_sm"
  | "rpe_cap_sm"
  | "overtime_pct"
  | "night_pct"
  | "holiday_pct"
  | "utilidades_days"
  | "bono_vacacional_days"
  | "vacaciones_days"
>;

/** Unidad en que la pantalla de Reglas guarda cada campo (los montos, en Bs). */
export const UNIDAD_CAMPO: Record<CampoRegla, UnidadLey> = {
  min_salary: "VES",
  cestaticket: "VES",
  bono_guerra: "VES",
  sso_pct: "pct",
  rpe_pct: "pct",
  faov_pct: "pct",
  sso_cap_sm: "sm",
  rpe_cap_sm: "sm",
  overtime_pct: "pct",
  night_pct: "pct",
  holiday_pct: "pct",
  utilidades_days: "dias",
  bono_vacacional_days: "dias",
  vacaciones_days: "dias",
};

export interface ParametroLey {
  readonly id: string;
  readonly grupo: GrupoLey;
  readonly etiqueta: string;
  /** Campo de las reglas que lo modela; null si las reglas aún no lo tienen. */
  readonly campo: CampoRegla | null;
  /** Valor de referencia para comparar. */
  readonly valor: number;
  readonly unidad: UnidadLey;
  /** `igual`: debe coincidir. `minimo`: la regla puede ser mayor (piso legal). */
  readonly comparacion: "igual" | "minimo";
  /** Tope legal, si lo hay (p. ej. 120 días de utilidades). */
  readonly maximo?: number;
  /** Lo que dice la norma, en una o dos frases llanas. */
  readonly texto: string;
  readonly fuente: FuenteLegal;
  readonly vigenteDesde: string | null;
  readonly grado: GradoLey;
  /** Precisión extra que se muestra en la ficha legal. */
  readonly detalle?: string;
  /** Dónde se leyó el texto (Gaceta oficial, organismo, reproducción). */
  readonly comprobadoEn?: string;
}

const LOTTT = (articulo: string): FuenteLegal => ({
  instrumento: "LOTTT",
  gaceta: "G.O. N° 6.076 Extraordinario",
  fecha: "2012-05-07",
  articulo,
});

export const PARAMETROS_LEY: readonly ParametroLey[] = [
  // ── Montos base ───────────────────────────────────────────
  {
    id: "salario-minimo",
    grupo: "montos",
    etiqueta: "Salario mínimo",
    campo: "min_salary",
    valor: 130,
    unidad: "VES",
    comparacion: "igual",
    texto: "Salario mínimo nacional mensual de Bs 130,00 para los sectores público y privado. No ha cambiado desde marzo de 2022.",
    fuente: {
      instrumento: "Decreto N° 4.653",
      gaceta: "G.O. N° 6.691 Extraordinario",
      fecha: "2022-03-15",
      articulo: "Art. 1",
    },
    vigenteDesde: "2022-03-15",
    grado: "verificado",
    comprobadoEn: "PDF de la Imprenta Nacional (gacetaoficial.gob.ve)",
  },
  {
    id: "ingreso-minimo-integral",
    grupo: "montos",
    etiqueta: "Ingreso mínimo integral",
    campo: null,
    valor: 240,
    unidad: "USD",
    comparacion: "igual",
    texto:
      "USD 240 al mes, pagados en bolívares a tasa BCV (antes USD 190). Es la suma de bonos; no es salario.",
    fuente: {
      instrumento: "Anuncio del Ejecutivo Nacional",
      gaceta: null,
      fecha: "2026-04-30",
      articulo: null,
    },
    vigenteDesde: "2026-05-01",
    grado: "anuncio",
    detalle: "La figura existe en la Ley de Protección de las Pensiones (Art. 7) como base mínima de la contribución del 9 %. El monto de USD 240 no aparece en los sumarios de las Gacetas de 2026 que publica la Imprenta Nacional; faltan allí 68 Extraordinarias, entre ellas las N° 7.021 a 7.024, de las fechas del anuncio.",
    comprobadoEn: "Sumarios de las 273 Gacetas de 2026 en gacetaoficial.gob.ve (hasta el 2 de noviembre): sin decreto",
  },
  {
    id: "cestaticket",
    grupo: "montos",
    etiqueta: "Cestaticket",
    campo: "cestaticket",
    valor: 40,
    unidad: "USD",
    comparacion: "igual",
    texto: "USD 40 al mes indexados a la tasa BCV. El último monto en Gaceta es Bs 1.000 (2023).",
    fuente: {
      instrumento: "Ley del Cestaticket Socialista",
      gaceta: "G.O. N° 6.746 Extraordinario",
      fecha: "2023-05-12",
      articulo: null,
    },
    vigenteDesde: "2024-05-01",
    grado: "anuncio",
    detalle: "Los USD 40 vienen de los anuncios de 2024 y de 2026. La Gaceta de 2023 que fija Bs 1.000 (N° 6.746 Ext.) no está en el sitio de la Imprenta Nacional; se conoce por reproducciones.",
  },
  {
    id: "bono-guerra",
    grupo: "montos",
    etiqueta: "Bono de guerra económica",
    campo: "bono_guerra",
    valor: 200,
    unidad: "USD",
    comparacion: "igual",
    texto: "USD 200 al mes (antes USD 150). Ningún texto lo hace obligatorio para el sector privado.",
    fuente: {
      instrumento: "Anuncio del Ejecutivo Nacional",
      gaceta: null,
      fecha: "2026-04-30",
      articulo: null,
    },
    vigenteDesde: "2026-05-01",
    grado: "anuncio",
    detalle: "En Gaceta solo se conoce el de 2023, para la administración pública (N° 6.746 Ext., que no está en el sitio de la Imprenta Nacional). El de 2026 no aparece en los sumarios oficiales.",
  },
  // ── Deducciones del trabajador ────────────────────────────
  {
    id: "sso-trabajador",
    grupo: "deducciones",
    etiqueta: "SSO / IVSS",
    campo: "sso_pct",
    valor: 4,
    unidad: "pct",
    comparacion: "igual",
    texto: "El trabajador aporta 4 % de su salario al Seguro Social.",
    fuente: { instrumento: "Ley del Seguro Social (página informativa del IVSS)", gaceta: null, fecha: null, articulo: null },
    vigenteDesde: null,
    grado: "verificado",
    comprobadoEn: "Página oficial del IVSS (ivss.gov.ve); no cita el artículo",
  },
  {
    id: "sso-tope",
    grupo: "deducciones",
    etiqueta: "Tope IVSS",
    campo: "sso_cap_sm",
    valor: 5,
    unidad: "sm",
    comparacion: "igual",
    texto: "La cotización al IVSS se calcula hasta un tope de 5 salarios mínimos.",
    fuente: { instrumento: "Ley del Seguro Social (página informativa del IVSS)", gaceta: null, fecha: null, articulo: null },
    vigenteDesde: null,
    grado: "verificado",
    comprobadoEn: "Página oficial del IVSS (ivss.gov.ve); no cita el artículo",
  },
  {
    id: "rpe-trabajador",
    grupo: "deducciones",
    etiqueta: "RPE",
    campo: "rpe_pct",
    valor: 0.5,
    unidad: "pct",
    comparacion: "igual",
    texto: "El trabajador aporta 0,5 % al Régimen Prestacional de Empleo.",
    fuente: {
      instrumento: "Ley del Régimen Prestacional de Empleo",
      gaceta: "G.O. N° 38.281",
      fecha: "2005-09-27",
      articulo: "Art. 46",
    },
    vigenteDesde: "2005-09-27",
    grado: "verificado",
    detalle: "La cotización total es 2,50 % del salario normal: 80 % la paga el empleador (2 %) y 20 % el trabajador (0,5 %). La base va de 1 a 10 salarios mínimos.",
    comprobadoEn: "Reproducción del texto de la ley (la Gaceta de 2005 no está en el sitio de la Imprenta Nacional)",
  },
  {
    id: "rpe-tope",
    grupo: "deducciones",
    etiqueta: "Tope RPE",
    campo: "rpe_cap_sm",
    valor: 10,
    unidad: "sm",
    comparacion: "igual",
    texto: "La cotización al RPE se calcula hasta un tope de 10 salarios mínimos.",
    fuente: {
      instrumento: "Ley del Régimen Prestacional de Empleo",
      gaceta: "G.O. N° 38.281",
      fecha: "2005-09-27",
      articulo: "Art. 46",
    },
    vigenteDesde: "2005-09-27",
    grado: "verificado",
    detalle: "La cotización total es 2,50 % del salario normal: 80 % la paga el empleador (2 %) y 20 % el trabajador (0,5 %). La base va de 1 a 10 salarios mínimos.",
    comprobadoEn: "Reproducción del texto de la ley (la Gaceta de 2005 no está en el sitio de la Imprenta Nacional)",
  },
  {
    id: "faov-trabajador",
    grupo: "deducciones",
    etiqueta: "FAOV",
    campo: "faov_pct",
    valor: 1,
    unidad: "pct",
    comparacion: "igual",
    texto: "El trabajador aporta 1 % al Fondo de Ahorro Obligatorio para la Vivienda, sin tope.",
    fuente: {
      instrumento: "Ley del Régimen Prestacional de Vivienda y Hábitat",
      gaceta: null,
      fecha: null,
      articulo: null,
    },
    vigenteDesde: null,
    grado: "por-confirmar",
    detalle: "Una fuente lo calcula sobre el salario integral; hoy el recibo lo calcula sobre el sueldo base.",
    comprobadoEn: "No se pudo abrir el sitio de BANAVIH; solo fuentes secundarias",
  },
  {
    id: "inces-trabajador",
    grupo: "deducciones",
    etiqueta: "INCES sobre utilidades",
    campo: null,
    valor: 0.5,
    unidad: "pct",
    comparacion: "igual",
    texto: "El patrono retiene al trabajador el 0,5 % de sus utilidades anuales para el INCES.",
    fuente: {
      instrumento: "Ley del INCES",
      gaceta: null,
      fecha: null,
      articulo: "Art. 14 y 15 (Decreto de 2008); Art. 49 y 50 (Decreto de 2014)",
    },
    vigenteDesde: null,
    grado: "verificado",
    comprobadoEn: "Artículos de la ley transcritos en una sentencia del TSJ",
  },
  // ── Recargos ──────────────────────────────────────────────
  {
    id: "hora-extra",
    grupo: "recargos",
    etiqueta: "Hora extra diurna",
    campo: "overtime_pct",
    valor: 50,
    unidad: "pct",
    comparacion: "minimo",
    texto: "Las horas extraordinarias se pagan con un recargo de 50 %, por lo menos, sobre el salario de la jornada ordinaria.",
    fuente: LOTTT("Art. 118"),
    vigenteDesde: "2012-05-07",
    grado: "verificado",
    comprobadoEn: "Facsímil de la Gaceta en el repositorio FAOLEX de la FAO",
  },
  {
    id: "bono-nocturno",
    grupo: "recargos",
    etiqueta: "Bono nocturno",
    campo: "night_pct",
    valor: 30,
    unidad: "pct",
    comparacion: "minimo",
    texto: "La jornada nocturna se paga con un recargo de 30 %, por lo menos, sobre el salario de la jornada diurna.",
    fuente: LOTTT("Art. 117"),
    vigenteDesde: "2012-05-07",
    grado: "verificado",
    comprobadoEn: "Facsímil de la Gaceta en el repositorio FAOLEX de la FAO",
  },
  {
    id: "dia-feriado",
    grupo: "recargos",
    etiqueta: "Día feriado",
    campo: "holiday_pct",
    valor: 50,
    unidad: "pct",
    comparacion: "minimo",
    texto: "Quien trabaja un feriado cobra el salario de ese día y, además, el del trabajo realizado con un recargo de 50 % sobre el salario normal.",
    fuente: LOTTT("Art. 120"),
    vigenteDesde: "2012-05-07",
    grado: "verificado",
    comprobadoEn: "Facsímil de la Gaceta en el repositorio FAOLEX de la FAO",
  },
  // ── Provisiones ───────────────────────────────────────────
  {
    id: "utilidades",
    grupo: "provisiones",
    etiqueta: "Utilidades",
    campo: "utilidades_days",
    valor: 30,
    unidad: "dias",
    comparacion: "minimo",
    maximo: 120,
    texto: "Las utilidades son, por trabajador, de 30 días de salario como mínimo y de cuatro meses (120 días) como máximo.",
    fuente: LOTTT("Art. 131"),
    vigenteDesde: "2012-05-07",
    grado: "verificado",
    comprobadoEn: "Facsímil de la Gaceta en el repositorio FAOLEX de la FAO",
  },
  {
    id: "vacaciones",
    grupo: "provisiones",
    etiqueta: "Vacaciones",
    campo: "vacaciones_days",
    valor: 15,
    unidad: "dias",
    comparacion: "minimo",
    texto: "15 días hábiles de vacaciones al cumplir un año, más 1 día adicional por cada año de servicio, hasta 15 días hábiles adicionales.",
    fuente: LOTTT("Art. 190"),
    vigenteDesde: "2012-05-07",
    grado: "verificado",
    detalle: "Las reglas guardan un número fijo: todavía no suman el día por año de antigüedad.",
    comprobadoEn: "Facsímil de la Gaceta en el repositorio FAOLEX de la FAO",
  },
  {
    id: "bono-vacacional",
    grupo: "provisiones",
    etiqueta: "Bono vacacional",
    campo: "bono_vacacional_days",
    valor: 15,
    unidad: "dias",
    comparacion: "minimo",
    maximo: 30,
    texto: "Un mínimo de 15 días de salario normal, más 1 día por cada año de servicio, hasta un total de 30 días. Tiene carácter salarial.",
    fuente: LOTTT("Art. 192"),
    vigenteDesde: "2012-05-07",
    grado: "verificado",
    detalle: "Las reglas guardan un número fijo: todavía no suman el día por año de antigüedad.",
    comprobadoEn: "Facsímil de la Gaceta en el repositorio FAOLEX de la FAO",
  },
  // ── Aportes del patrono (las reglas todavía no los tienen) ─
  {
    id: "sso-patrono",
    grupo: "patrono",
    etiqueta: "IVSS del patrono",
    campo: null,
    valor: 9,
    unidad: "pct",
    comparacion: "minimo",
    texto: "El patrono aporta 9 % (riesgo mínimo), 10 % (riesgo medio) u 11 % (riesgo máximo) al Seguro Social, hasta 5 salarios mínimos.",
    fuente: { instrumento: "Ley del Seguro Social (página informativa del IVSS)", gaceta: null, fecha: null, articulo: null },
    vigenteDesde: null,
    grado: "verificado",
    comprobadoEn: "Página oficial del IVSS (ivss.gov.ve); no cita el artículo",
  },
  {
    id: "rpe-patrono",
    grupo: "patrono",
    etiqueta: "RPE del patrono",
    campo: null,
    valor: 2,
    unidad: "pct",
    comparacion: "igual",
    texto: "El patrono aporta 2 % al Régimen Prestacional de Empleo.",
    fuente: {
      instrumento: "Ley del Régimen Prestacional de Empleo",
      gaceta: "G.O. N° 38.281",
      fecha: "2005-09-27",
      articulo: "Art. 46",
    },
    vigenteDesde: "2005-09-27",
    grado: "verificado",
    detalle: "La cotización total es 2,50 % del salario normal: 80 % la paga el empleador (2 %) y 20 % el trabajador (0,5 %). La base va de 1 a 10 salarios mínimos.",
    comprobadoEn: "Reproducción del texto de la ley (la Gaceta de 2005 no está en el sitio de la Imprenta Nacional)",
  },
  {
    id: "faov-patrono",
    grupo: "patrono",
    etiqueta: "FAOV del patrono",
    campo: null,
    valor: 2,
    unidad: "pct",
    comparacion: "igual",
    texto: "El patrono aporta 2 % al FAOV.",
    fuente: {
      instrumento: "Ley del Régimen Prestacional de Vivienda y Hábitat",
      gaceta: null,
      fecha: null,
      articulo: null,
    },
    vigenteDesde: null,
    grado: "por-confirmar",
    comprobadoEn: "No se pudo abrir el sitio de BANAVIH; solo fuentes secundarias",
  },
  {
    id: "inces-patrono",
    grupo: "patrono",
    etiqueta: "INCES del patrono",
    campo: null,
    valor: 2,
    unidad: "pct",
    comparacion: "igual",
    texto: "Con 5 o más trabajadores, el patrono aporta 2 % del salario normal, cada trimestre.",
    fuente: {
      instrumento: "Ley del INCES",
      gaceta: null,
      fecha: null,
      articulo: "Art. 14 y 15 (Decreto de 2008); Art. 49 y 50 (Decreto de 2014)",
    },
    vigenteDesde: null,
    grado: "verificado",
    comprobadoEn: "Artículos de la ley transcritos en una sentencia del TSJ",
  },
  {
    id: "contribucion-pensiones",
    grupo: "patrono",
    etiqueta: "Contribución para las pensiones",
    campo: null,
    valor: 9,
    unidad: "pct",
    comparacion: "igual",
    texto:
      "La empresa paga 9 % de todo lo que entrega a sus trabajadores (salario y bonos), cada mes, al SENIAT. La base por trabajador nunca es menor que el ingreso mínimo integral.",
    fuente: {
      instrumento: "Decreto N° 4.952 (Ley de Protección de las Pensiones, G.O. N° 6.806 Ext., Arts. 6, 7 y 9)",
      gaceta: "G.O. N° 42.880",
      fecha: "2024-05-16",
      articulo: "Art. 7",
    },
    vigenteDesde: "2024-05-16",
    grado: "verificado",
    detalle:
      "Solo la pagan las personas jurídicas. La declaración y el pago siguen la Providencia SNAT/2024/000042 (G.O. N° 42.881, 2024-05-17). Tope legal: 15 %.",
    comprobadoEn: "PDF de la Imprenta Nacional (gacetaoficial.gob.ve)",
  },
];

export const GRUPOS_LEY: readonly { id: GrupoLey; titulo: string; bajada: string }[] = [
  { id: "montos", titulo: "Montos base", bajada: "Salario mínimo y bonos de ley" },
  { id: "deducciones", titulo: "Deducciones del trabajador", bajada: "Lo que se descuenta del recibo" },
  { id: "recargos", titulo: "Recargos", bajada: "Horas extra, noches y feriados" },
  { id: "provisiones", titulo: "Provisiones", bajada: "Utilidades y vacaciones" },
  { id: "patrono", titulo: "Aportes del patrono", bajada: "Lo que paga la empresa por cada trabajador" },
];

export function estaVerificado(p: ParametroLey): boolean {
  return p.grado === "verificado";
}

export const GRADO_META: Record<GradoLey, { etiqueta: string; explicacion: string }> = {
  verificado: {
    etiqueta: "Verificado",
    explicacion: "Se leyó en la Gaceta Oficial o en el texto de la ley.",
  },
  anuncio: {
    etiqueta: "Solo anuncio",
    explicacion: "Lo anunció el Ejecutivo, pero no encontramos el decreto en la Gaceta Oficial.",
  },
  "por-confirmar": {
    etiqueta: "Por confirmar",
    explicacion: "Es la norma conocida, pero no volvimos a leer el texto oficial.",
  },
};

export type EstadoComparacion = "al-dia" | "difiere" | "unidad" | "falta";

export const ESTADO_META: Record<EstadoComparacion, { etiqueta: string }> = {
  "al-dia": { etiqueta: "Al día" },
  difiere: { etiqueta: "Difiere" },
  unidad: { etiqueta: "Otra moneda" },
  falta: { etiqueta: "No está en tus reglas" },
};

export interface Comparacion {
  readonly parametro: ParametroLey;
  /** Valor cargado en las reglas; null si las reglas no tienen el campo. */
  readonly valorRegla: number | null;
  readonly unidadRegla: UnidadLey | null;
  readonly estado: EstadoComparacion;
}

/** Compara un parámetro de la ley con el valor cargado en las reglas. */
export function compararParametro(p: ParametroLey, rules: PayrollRules | null): Comparacion {
  if (!p.campo || !rules) {
    return { parametro: p, valorRegla: null, unidadRegla: null, estado: "falta" };
  }
  const valorRegla = Number(rules[p.campo]);
  const unidadRegla = UNIDAD_CAMPO[p.campo];
  if (!Number.isFinite(valorRegla)) {
    return { parametro: p, valorRegla: null, unidadRegla, estado: "falta" };
  }
  if (unidadRegla !== p.unidad) {
    return { parametro: p, valorRegla, unidadRegla, estado: "unidad" };
  }
  const dentroDelTope = p.maximo == null || valorRegla <= p.maximo;
  const ok =
    p.comparacion === "minimo"
      ? valorRegla >= p.valor && dentroDelTope
      : Math.abs(valorRegla - p.valor) < 0.005;
  return { parametro: p, valorRegla, unidadRegla, estado: ok ? "al-dia" : "difiere" };
}

export function compararConLey(rules: PayrollRules | null): Comparacion[] {
  return PARAMETROS_LEY.map((p) => compararParametro(p, rules));
}

export function resumenComparacion(items: readonly Comparacion[]): Record<EstadoComparacion, number> & {
  noVerificados: number;
} {
  const r = { "al-dia": 0, difiere: 0, unidad: 0, falta: 0, noVerificados: 0 };
  for (const c of items) {
    r[c.estado] += 1;
    if (!estaVerificado(c.parametro)) r.noVerificados += 1;
  }
  return r;
}

/** «Bs 130,00», «USD 40», «4 %», «5 SM», «30 días». */
export function formatearValorLey(valor: number, unidad: UnidadLey): string {
  const n = new Intl.NumberFormat("es-VE", {
    minimumFractionDigits: unidad === "VES" ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(valor);
  switch (unidad) {
    case "VES":
      return `Bs ${n}`;
    case "USD":
      return `USD ${n}`;
    case "pct":
      return `${n} %`;
    case "sm":
      return `${n} SM`;
    case "dias":
      return `${n} días`;
  }
}

/** «12 de mayo de 2023» a partir de AAAA-MM-DD, sin depender de la zona horaria. */
export function formatearFechaLey(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const meses = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
  if (!y || !m || !d) return iso;
  return `${d} de ${meses[m - 1]} de ${y}`;
}
