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
 * Investigación del 2026-11-16 y 17 (spec 0653 §2 y §9); la revisa el contador.
 */

// Solo el TIPO de las reglas (se borra al compilar): este módulo no ejecuta
// nada de la capa de datos. La prueba de frontera lo exige así.
import type { PayrollRules } from "../payroll-rules-types";

/** Fecha de corte de la investigación legal (AAAA-MM-DD). */
export const FECHA_CORTE_LEY = "2026-11-17";

/** Nota fija para todo lo que no se pudo verificar contra la Gaceta. */
export const NOTA_NO_VERIFICADO =
  "No está verificado. Consúltalo con un abogado laboral o con el contador antes de usarlo.";

/**
 * - `verificado`: el texto se leyó en la Gaceta Oficial: en el PDF de la
 *   Imprenta Nacional, o en un facsímil de esa misma Gaceta cuando el sitio
 *   oficial la tiene solo escaneada. Exige número y fecha de Gaceta y fecha de
 *   vigencia.
 * - `anuncio`: lo anunció el Ejecutivo; no se encontró decreto en Gaceta.
 * - `por-confirmar`: todo lo demás: la página de un organismo que no cita ley
 *   ni fecha, una reproducción, una sentencia que transcribe la norma o una
 *   fuente secundaria.
 */
export type GradoLey = "verificado" | "anuncio" | "por-confirmar";

/**
 * - `obliga`: una ley la impone a una empresa privada como DTD.
 * - `referencia`: no consta que obligue al sector privado; se muestra para
 *   comparar, pero no cuenta en «obligaciones al día».
 */
export type AlcanceLey = "obliga" | "referencia";

export type UnidadLey = "VES" | "USD" | "pct" | "dias" | "sm";

export type GrupoLey = "montos" | "deducciones" | "recargos" | "provisiones" | "patrono";

export interface FuenteLegal {
  /** «LOTTT», «Decreto N° 4.952», «Ley del Seguro Social». */
  readonly instrumento: string;
  /** «G.O. N° 6.691 Extraordinario»; null si no se tiene la Gaceta. */
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
  // SDD-0653 A2b · migración 0556: sin ella la base no trae estos campos y la comparación dice «falta».
  | "ingreso_minimo_integral_usd"
  | "sso_patronal_pct"
  | "rpe_patronal_pct"
  | "faov_patronal_pct"
  | "inces_patronal_pct"
  | "inces_utilidades_pct"
  | "pension_contrib_pct"
  | "vacaciones_extra_max"
  | "bono_vacacional_max_days"
>;

/**
 * Unidad en que la pantalla de Reglas guarda cada campo por omisión (cestaticket y bono, en Bs).
 * Con la 0556 cada bono lleva su moneda: usa `unidadDelCampo`, que la lee de la versión.
 */
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
  ingreso_minimo_integral_usd: "USD",
  sso_patronal_pct: "pct",
  rpe_patronal_pct: "pct",
  faov_patronal_pct: "pct",
  inces_patronal_pct: "pct",
  inces_utilidades_pct: "pct",
  pension_contrib_pct: "pct",
  vacaciones_extra_max: "dias",
  bono_vacacional_max_days: "dias",
};

/** La unidad real de un campo en una versión de las reglas: los bonos dicen su moneda (D4). */
export function unidadDelCampo(campo: CampoRegla, rules: PayrollRules | null): UnidadLey {
  if (campo === "cestaticket") return rules?.cestaticket_moneda ?? UNIDAD_CAMPO.cestaticket;
  if (campo === "bono_guerra") return rules?.bono_guerra_moneda ?? UNIDAD_CAMPO.bono_guerra;
  return UNIDAD_CAMPO[campo];
}

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
  /** Desde cuándo rige. null = no se pudo establecer; la ficha lo dice. */
  readonly vigenteDesde: string | null;
  readonly grado: GradoLey;
  readonly alcance: AlcanceLey;
  /** Precisión extra que se muestra en la ficha legal. */
  readonly detalle?: string;
  /** Dónde se leyó el texto (Gaceta oficial, organismo, reproducción). */
  readonly comprobadoEn: string;
}

const EN_IMPRENTA = "PDF de la Imprenta Nacional (gacetaoficial.gob.ve)";
const EN_FACSIMIL_LOTTT =
  "Facsímil de la G.O. N° 6.076 Ext. en FAOLEX (FAO); en el sitio de la Imprenta Nacional esa Gaceta está escaneada, sin texto";
const EN_IVSS =
  "Página informativa del IVSS (ivss.gov.ve). No cita la ley, el artículo ni la fecha de vigencia";
const EN_REPRO_RPE =
  "Reproducción del texto de la ley. La Gaceta de 2005 no está en el sitio de la Imprenta Nacional";
const EN_SECUNDARIA_FAOV =
  "Fuentes secundarias. El sitio de BANAVIH no abrió (certificado inválido)";
const EN_SENTENCIA_INCES =
  "Sentencia del TSJ que transcribe los artículos. No se leyó la Gaceta de la ley";

const LOTTT = (articulo: string): FuenteLegal => ({
  instrumento: "LOTTT",
  gaceta: "G.O. N° 6.076 Extraordinario",
  fecha: "2012-05-07",
  articulo,
});

const SEGURO_SOCIAL: FuenteLegal = {
  instrumento: "Ley del Seguro Social",
  gaceta: null,
  fecha: null,
  articulo: null,
};

const RPE: FuenteLegal = {
  instrumento: "Ley del Régimen Prestacional de Empleo",
  gaceta: "G.O. N° 38.281",
  fecha: "2005-09-27",
  articulo: "Art. 46",
};

const VIVIENDA: FuenteLegal = {
  instrumento: "Ley del Régimen Prestacional de Vivienda y Hábitat",
  gaceta: null,
  fecha: null,
  articulo: null,
};

const INCES: FuenteLegal = {
  instrumento: "Ley del INCES",
  gaceta: null,
  fecha: null,
  articulo: "Art. 14 y 15 (Decreto de 2008); Art. 49 y 50 (Decreto de 2014)",
};

const ANUNCIO_2026: FuenteLegal = {
  instrumento: "Anuncio del Ejecutivo Nacional",
  gaceta: null,
  fecha: "2026-04-30",
  articulo: null,
};

const DETALLE_RPE =
  "La cotización total es 2,50 % del salario normal: 80 % la paga el empleador (2 %) y 20 % el trabajador (0,5 %). La base va de 1 a 10 salarios mínimos.";

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
    texto:
      "Salario mínimo nacional mensual de Bs 130,00 para los sectores público y privado. No ha cambiado desde marzo de 2022.",
    fuente: {
      instrumento: "Decreto N° 4.653",
      gaceta: "G.O. N° 6.691 Extraordinario",
      fecha: "2022-03-15",
      articulo: "Art. 1",
    },
    vigenteDesde: "2022-03-15",
    grado: "verificado",
    alcance: "obliga",
    comprobadoEn: EN_IMPRENTA,
  },
  {
    id: "ingreso-minimo-integral",
    grupo: "montos",
    etiqueta: "Ingreso mínimo integral",
    campo: "ingreso_minimo_integral_usd",
    valor: 240,
    unidad: "USD",
    comparacion: "igual",
    texto:
      "USD 240 al mes, pagados en bolívares a tasa BCV (antes USD 190). Es la suma de bonos, no es salario. El aumento se anunció para el sector público; a las empresas privadas solo se les exhortó a alcanzarlo.",
    fuente: ANUNCIO_2026,
    vigenteDesde: "2026-05-01",
    grado: "anuncio",
    alcance: "referencia",
    detalle:
      "La figura existe en la Ley de Protección de las Pensiones (Art. 7) como base mínima de la contribución del 9 %: ahí sí afecta a DTD. El monto de USD 240 no aparece en los sumarios de las Gacetas de 2026 que publica la Imprenta Nacional; faltan allí 68 Extraordinarias, entre ellas las N° 7.021 a 7.024, de las fechas del anuncio.",
    comprobadoEn:
      "Sumarios de las Gacetas de 2026 en gacetaoficial.gob.ve (hasta el 2 de noviembre): sin decreto",
  },
  {
    id: "cestaticket",
    grupo: "montos",
    etiqueta: "Cestaticket",
    campo: "cestaticket",
    valor: 40,
    unidad: "USD",
    comparacion: "igual",
    texto:
      "USD 40 al mes indexados a la tasa BCV, según los anuncios de 2024 y de 2026. El beneficio es de ley; lo que no tiene Gaceta a la vista es este monto.",
    fuente: ANUNCIO_2026,
    vigenteDesde: null,
    grado: "anuncio",
    alcance: "obliga",
    detalle:
      "El beneficio lo crea la Ley del Cestaticket Socialista, que alcanza a las empresas privadas (su Gaceta no se pudo leer). El último monto que se conoce en Gaceta es Bs 1.000 (G.O. N° 6.746 Ext., 2023), pero esa Gaceta no está en el sitio de la Imprenta Nacional. El sumario de la G.O. N° 6.691 Ext. de 2022 sí trae el Decreto N° 4.654, que lo incrementó. No se sabe desde cuándo rigen los USD 40.",
    comprobadoEn:
      "Prensa sobre los anuncios. Sumarios de 2026 en gacetaoficial.gob.ve: sin decreto del monto",
  },
  {
    id: "bono-guerra",
    grupo: "montos",
    etiqueta: "Bono de guerra económica",
    campo: "bono_guerra",
    valor: 200,
    unidad: "USD",
    comparacion: "igual",
    texto:
      "USD 200 al mes (antes USD 150) para el sector público. Ningún texto lo hace obligatorio para el sector privado.",
    fuente: ANUNCIO_2026,
    vigenteDesde: "2026-05-01",
    grado: "anuncio",
    alcance: "referencia",
    detalle:
      "En Gaceta solo se conoce el de 2023, para la administración pública (N° 6.746 Ext., que no está en el sitio de la Imprenta Nacional). El de 2026 no aparece en los sumarios oficiales.",
    comprobadoEn:
      "Prensa sobre el anuncio. Sumarios de 2026 en gacetaoficial.gob.ve: sin decreto",
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
    fuente: SEGURO_SOCIAL,
    vigenteDesde: null,
    grado: "por-confirmar",
    alcance: "obliga",
    comprobadoEn: EN_IVSS,
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
    fuente: SEGURO_SOCIAL,
    vigenteDesde: null,
    grado: "por-confirmar",
    alcance: "obliga",
    comprobadoEn: EN_IVSS,
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
    fuente: RPE,
    vigenteDesde: "2005-09-27",
    grado: "por-confirmar",
    alcance: "obliga",
    detalle: DETALLE_RPE,
    comprobadoEn: EN_REPRO_RPE,
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
    fuente: RPE,
    vigenteDesde: "2005-09-27",
    grado: "por-confirmar",
    alcance: "obliga",
    detalle: DETALLE_RPE,
    comprobadoEn: EN_REPRO_RPE,
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
    fuente: VIVIENDA,
    vigenteDesde: null,
    grado: "por-confirmar",
    alcance: "obliga",
    detalle:
      "Una fuente lo calcula sobre el salario integral; hoy el recibo lo calcula sobre el sueldo base.",
    comprobadoEn: EN_SECUNDARIA_FAOV,
  },
  {
    id: "inces-trabajador",
    grupo: "deducciones",
    etiqueta: "INCES sobre utilidades",
    campo: "inces_utilidades_pct",
    valor: 0.5,
    unidad: "pct",
    comparacion: "igual",
    texto: "El patrono retiene al trabajador el 0,5 % de sus utilidades anuales para el INCES.",
    fuente: INCES,
    vigenteDesde: null,
    grado: "por-confirmar",
    alcance: "obliga",
    comprobadoEn: EN_SENTENCIA_INCES,
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
    texto:
      "Las horas extraordinarias se pagan con un recargo de 50 %, por lo menos, sobre el salario de la jornada ordinaria.",
    fuente: LOTTT("Art. 118"),
    vigenteDesde: "2012-05-07",
    grado: "verificado",
    alcance: "obliga",
    comprobadoEn: EN_FACSIMIL_LOTTT,
  },
  {
    id: "bono-nocturno",
    grupo: "recargos",
    etiqueta: "Bono nocturno",
    campo: "night_pct",
    valor: 30,
    unidad: "pct",
    comparacion: "minimo",
    texto:
      "La jornada nocturna se paga con un recargo de 30 %, por lo menos, sobre el salario de la jornada diurna.",
    fuente: LOTTT("Art. 117"),
    vigenteDesde: "2012-05-07",
    grado: "verificado",
    alcance: "obliga",
    comprobadoEn: EN_FACSIMIL_LOTTT,
  },
  {
    id: "dia-feriado",
    grupo: "recargos",
    etiqueta: "Día feriado",
    campo: "holiday_pct",
    valor: 50,
    unidad: "pct",
    comparacion: "minimo",
    texto:
      "Quien trabaja un feriado cobra el salario de ese día y, además, el del trabajo realizado con un recargo de 50 % sobre el salario normal.",
    fuente: LOTTT("Art. 120"),
    vigenteDesde: "2012-05-07",
    grado: "verificado",
    alcance: "obliga",
    comprobadoEn: EN_FACSIMIL_LOTTT,
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
    texto:
      "Las utilidades son, por trabajador, de 30 días de salario como mínimo y de cuatro meses (120 días) como máximo.",
    fuente: LOTTT("Art. 131"),
    vigenteDesde: "2012-05-07",
    grado: "verificado",
    alcance: "obliga",
    comprobadoEn: EN_FACSIMIL_LOTTT,
  },
  {
    id: "vacaciones",
    grupo: "provisiones",
    etiqueta: "Vacaciones",
    campo: "vacaciones_days",
    valor: 15,
    unidad: "dias",
    comparacion: "minimo",
    texto:
      "15 días hábiles de vacaciones al cumplir un año, más 1 día adicional por cada año de servicio, hasta 15 días hábiles adicionales.",
    fuente: LOTTT("Art. 190"),
    vigenteDesde: "2012-05-07",
    grado: "verificado",
    alcance: "obliga",
    detalle:
      "Las reglas guardan los 15 días base y, con la migración 0556, el máximo de días adicionales. El cálculo por antigüedad de cada empleado no está en esta fase.",
    comprobadoEn: EN_FACSIMIL_LOTTT,
  },
  {
    id: "vacaciones-adicionales",
    grupo: "provisiones",
    etiqueta: "Vacaciones: días adicionales",
    campo: "vacaciones_extra_max",
    valor: 15,
    unidad: "dias",
    comparacion: "igual",
    texto: "Un día hábil adicional por cada año de servicio, hasta un máximo de 15 días hábiles adicionales.",
    fuente: LOTTT("Art. 190"),
    vigenteDesde: "2012-05-07",
    grado: "verificado",
    alcance: "obliga",
    comprobadoEn: EN_FACSIMIL_LOTTT,
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
    texto:
      "Un mínimo de 15 días de salario normal, más 1 día por cada año de servicio, hasta un total de 30 días. Tiene carácter salarial.",
    fuente: LOTTT("Art. 192"),
    vigenteDesde: "2012-05-07",
    grado: "verificado",
    alcance: "obliga",
    detalle:
      "Las reglas guardan los 15 días base y, con la migración 0556, el máximo con la antigüedad. El cálculo por antigüedad de cada empleado no está en esta fase.",
    comprobadoEn: EN_FACSIMIL_LOTTT,
  },
  {
    id: "bono-vacacional-maximo",
    grupo: "provisiones",
    etiqueta: "Bono vacacional: máximo",
    campo: "bono_vacacional_max_days",
    valor: 30,
    unidad: "dias",
    comparacion: "igual",
    texto: "El bono vacacional crece un día por año de servicio y no pasa de 30 días en total.",
    fuente: LOTTT("Art. 192"),
    vigenteDesde: "2012-05-07",
    grado: "verificado",
    alcance: "obliga",
    comprobadoEn: EN_FACSIMIL_LOTTT,
  },
  // ── Aportes del patrono (con la migración 0556 las reglas los guardan) ─
  {
    id: "sso-patrono",
    grupo: "patrono",
    etiqueta: "IVSS del patrono",
    campo: "sso_patronal_pct",
    valor: 9,
    unidad: "pct",
    comparacion: "minimo",
    maximo: 11,
    texto:
      "El patrono aporta 9 % (riesgo mínimo), 10 % (riesgo medio) u 11 % (riesgo máximo) al Seguro Social, hasta 5 salarios mínimos.",
    fuente: SEGURO_SOCIAL,
    vigenteDesde: null,
    grado: "por-confirmar",
    alcance: "obliga",
    comprobadoEn: EN_IVSS,
  },
  {
    id: "rpe-patrono",
    grupo: "patrono",
    etiqueta: "RPE del patrono",
    campo: "rpe_patronal_pct",
    valor: 2,
    unidad: "pct",
    comparacion: "igual",
    texto: "El patrono aporta 2 % al Régimen Prestacional de Empleo.",
    fuente: RPE,
    vigenteDesde: "2005-09-27",
    grado: "por-confirmar",
    alcance: "obliga",
    detalle: DETALLE_RPE,
    comprobadoEn: EN_REPRO_RPE,
  },
  {
    id: "faov-patrono",
    grupo: "patrono",
    etiqueta: "FAOV del patrono",
    campo: "faov_patronal_pct",
    valor: 2,
    unidad: "pct",
    comparacion: "igual",
    texto: "El patrono aporta 2 % al FAOV.",
    fuente: VIVIENDA,
    vigenteDesde: null,
    grado: "por-confirmar",
    alcance: "obliga",
    comprobadoEn: EN_SECUNDARIA_FAOV,
  },
  {
    id: "inces-patrono",
    grupo: "patrono",
    etiqueta: "INCES del patrono",
    campo: "inces_patronal_pct",
    valor: 2,
    unidad: "pct",
    comparacion: "igual",
    texto: "Con 5 o más trabajadores, el patrono aporta 2 % del salario normal, cada trimestre.",
    fuente: INCES,
    vigenteDesde: null,
    grado: "por-confirmar",
    alcance: "obliga",
    comprobadoEn: EN_SENTENCIA_INCES,
  },
  {
    id: "contribucion-pensiones",
    grupo: "patrono",
    etiqueta: "Contribución para las pensiones",
    campo: "pension_contrib_pct",
    valor: 9,
    unidad: "pct",
    comparacion: "igual",
    texto:
      "La empresa paga 9 % de todo lo que entrega a sus trabajadores (salario y bonos), cada mes, al SENIAT. La base por trabajador nunca es menor que el ingreso mínimo integral.",
    fuente: {
      instrumento: "Decreto N° 4.952 (Ley de Protección de las Pensiones, G.O. N° 6.806 Ext., Arts. 6, 7 y 9)",
      gaceta: "G.O. N° 42.880",
      fecha: "2024-05-16",
      articulo: "Art. 1",
    },
    vigenteDesde: "2024-05-16",
    grado: "verificado",
    alcance: "obliga",
    detalle:
      "Solo la pagan las personas jurídicas. La declaración y el pago siguen la Providencia SNAT/2024/000042 (G.O. N° 42.881, 2024-05-17). Tope legal: 15 %.",
    comprobadoEn: EN_IMPRENTA,
  },
];

export const GRUPOS_LEY: readonly { id: GrupoLey; titulo: string; bajada: string }[] = [
  { id: "montos", titulo: "Montos base", bajada: "Salario mínimo y bonos" },
  { id: "deducciones", titulo: "Deducciones del trabajador", bajada: "Lo que se descuenta del recibo" },
  { id: "recargos", titulo: "Recargos", bajada: "Horas extra, noches y feriados" },
  { id: "provisiones", titulo: "Provisiones", bajada: "Utilidades y vacaciones" },
  { id: "patrono", titulo: "Aportes del patrono", bajada: "Lo que paga la empresa por cada trabajador" },
];

export function estaVerificado(p: ParametroLey): boolean {
  return p.grado === "verificado";
}

/**
 * ¿Cuenta en «obligaciones al día»? Solo lo que obliga a DTD y no es un
 * anuncio: un anuncio sin Gaceta no se puede dar por cumplido ni incumplido.
 */
export function cuentaComoObligacion(p: ParametroLey): boolean {
  return p.alcance === "obliga" && p.grado !== "anuncio";
}

export const GRADO_META: Record<GradoLey, { etiqueta: string; explicacion: string }> = {
  verificado: {
    etiqueta: "Verificado",
    explicacion: "Se leyó en la Gaceta Oficial.",
  },
  anuncio: {
    etiqueta: "Solo anuncio",
    explicacion: "Lo anunció el Ejecutivo, pero no encontramos el decreto en la Gaceta Oficial.",
  },
  "por-confirmar": {
    etiqueta: "Por confirmar",
    explicacion: "Es la norma conocida, pero no la leímos en la Gaceta Oficial.",
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
  const bruto = rules[p.campo];
  const unidadRegla = unidadDelCampo(p.campo, rules);
  // Sin la 0556 (undefined) o «sin configurar» (null): falta. Un null NUNCA se lee como cero.
  if (bruto === null || bruto === undefined) {
    return { parametro: p, valorRegla: null, unidadRegla, estado: "falta" };
  }
  const valorRegla = Number(bruto);
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

export interface ResumenComparacion {
  /** Parámetros que obligan a DTD y tienen norma (no anuncio). */
  readonly obligaciones: number;
  /** De esas obligaciones, cuántas tienen la regla al día. */
  readonly obligacionesAlDia: number;
  /** Obligaciones que difieren o están en otra moneda. */
  readonly porRevisar: number;
  /** Obligaciones que las reglas todavía no tienen. */
  readonly faltan: number;
  /** Anuncios y parámetros que no obligan: se muestran, no se cuentan. */
  readonly referencias: number;
  /** Entradas con asterisco, obliguen o no. */
  readonly noVerificados: number;
}

export function resumenComparacion(items: readonly Comparacion[]): ResumenComparacion {
  let obligaciones = 0;
  let obligacionesAlDia = 0;
  let porRevisar = 0;
  let faltan = 0;
  let referencias = 0;
  let noVerificados = 0;
  for (const c of items) {
    if (!estaVerificado(c.parametro)) noVerificados += 1;
    if (!cuentaComoObligacion(c.parametro)) {
      referencias += 1;
      continue;
    }
    obligaciones += 1;
    if (c.estado === "al-dia") obligacionesAlDia += 1;
    else if (c.estado === "falta") faltan += 1;
    else porRevisar += 1;
  }
  return { obligaciones, obligacionesAlDia, porRevisar, faltan, referencias, noVerificados };
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
