/**
 * Validadores de input del módulo Inspecciones (SDD-0066 · Fase 1-3).
 *
 * Validación MANUAL (no Zod, patrón del repo). `validateInspectionInput` valida
 * la CABECERA (tipo, cliente, título, fecha, conclusión, puntaje, días-hombre).
 * Los `parse*Payload` (Fase 2/3) leen el FormData del builder y arman el
 * PsiPayload / FactoryPayload normalizado (números no negativos, booleanos de
 * checkbox, listas dinámicas). El shape se valida en TS, no en la DB.
 *
 * Devuelve `{ input, fieldErrors? }` al estilo del repo.
 */

import {
  isInspectionType,
  isInspectionConclusion,
  PSI_CATEGORY_KEYS,
  FACTORY_COMPANY_TYPES,
  type InspectionType,
  type InspectionConclusion,
  type PsiPayload,
  type FactoryPayload,
  type PsiCategory,
  type PsiDefect,
  type FactoryHr,
  type FactoryTurnover,
  type FactoryMachine,
  type FactoryRequirement,
  type FactoryCompanyType,
  type PsiOverall,
} from "./types";

export type InspectionInput = {
  type: InspectionType;
  client_id: string | null;
  title: string;
  product: string | null;
  inspection_date: string | null;
  duration_mandays: number | null;
  score: number | null;
  conclusion: InspectionConclusion | null;
  provider_internal: string | null;
};

export type InspectionActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  /** report_no del reporte recién creado (para toast + highlight). */
  createdNo?: string;
};

function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function numOrNull(v: unknown): number | null {
  if (v == null || String(v).trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : Number.NaN;
}

/** Valida `yyyy-mm-dd` (lo que emite <input type="date">). */
function isIsoDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(v + "T00:00:00");
  return !Number.isNaN(d.getTime());
}

export function validateInspectionInput(
  raw: Partial<Record<string, unknown>>,
): { input: InspectionInput | null; fieldErrors?: Record<string, string> } {
  const errors: Record<string, string> = {};

  // Tipo (obligatorio).
  const typeRaw = String(raw.type ?? "").trim();
  if (!isInspectionType(typeRaw)) {
    errors.type = "Tipo de inspección inválido.";
  }
  const type = typeRaw as InspectionType;

  // Título (obligatorio).
  const title = String(raw.title ?? "").trim();
  if (!title) errors.title = "Indica un título para el reporte.";

  // Fecha (opcional, pero si viene debe ser válida).
  const dateRaw = strOrNull(raw.inspection_date);
  if (dateRaw !== null && !isIsoDate(dateRaw)) {
    errors.inspection_date = "Fecha inválida.";
  }

  // Días-hombre (opcional, no negativo).
  const mandays = numOrNull(raw.duration_mandays);
  if (mandays !== null && !(Number.isFinite(mandays) && mandays >= 0)) {
    errors.duration_mandays = "Los días-hombre no pueden ser negativos.";
  }

  // Conclusión (opcional, del enum).
  const conclRaw = strOrNull(raw.conclusion);
  let conclusion: InspectionConclusion | null = null;
  if (conclRaw !== null) {
    if (!isInspectionConclusion(conclRaw))
      errors.conclusion = "Conclusión inválida.";
    else conclusion = conclRaw;
  }

  // Puntaje: SOLO aplica a factory_audit y vive en 0..100.
  const score = numOrNull(raw.score);
  if (score !== null) {
    if (!isInspectionType(typeRaw) || type !== "factory_audit") {
      errors.score = "El puntaje solo aplica a la auditoría de fábrica.";
    } else if (!(Number.isFinite(score) && score >= 0 && score <= 100)) {
      errors.score = "El puntaje debe estar entre 0 y 100.";
    }
  }

  if (Object.keys(errors).length > 0)
    return { input: null, fieldErrors: errors };

  return {
    input: {
      type,
      client_id: strOrNull(raw.client_id),
      title,
      product: strOrNull(raw.product),
      inspection_date: dateRaw,
      duration_mandays:
        mandays !== null && Number.isFinite(mandays) ? mandays : null,
      score:
        type === "factory_audit" && score !== null && Number.isFinite(score)
          ? Math.round(score)
          : null,
      conclusion,
      provider_internal: strOrNull(raw.provider_internal),
    },
  };
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Parsers del payload (Fase 2/3) · FormData → payload jsonb   ║
// ╚═══════════════════════════════════════════════════════════╝

/** Lee un FormDataEntryValue como número ≥ 0 o null (negativos → null). */
function nonNegNum(v: FormDataEntryValue | null): number | null {
  if (v == null || String(v).trim() === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/** Lee un entero ≥ 0 o null. */
function nonNegInt(v: FormDataEntryValue | null): number | null {
  const n = nonNegNum(v);
  return n == null ? null : Math.round(n);
}

function fStr(formData: FormData, key: string): string | null {
  return strOrNull(formData.get(key));
}

/** Checkbox / select tri-estado: "true"→true, "false"→false, ""/ausente→null. */
function triBool(v: FormDataEntryValue | null): boolean | null {
  const s = v == null ? "" : String(v).trim().toLowerCase();
  if (s === "true" || s === "si" || s === "sí" || s === "on" || s === "1")
    return true;
  if (s === "false" || s === "no" || s === "0") return false;
  return null;
}

/**
 * Construye el PsiPayload desde el FormData del builder. Campos planos con
 * prefijos (order_*, aql_*, prod_*, meas_*) + listas indexadas (cat_conform_N,
 * def_desc_N…). NO valida montos a fondo (los números negativos se descartan).
 */
export function parsePsiPayload(formData: FormData): PsiPayload {
  // Categorías: 7 fijas, en el orden de PSI_CATEGORY_KEYS.
  const categories: PsiCategory[] = PSI_CATEGORY_KEYS.map((key) => ({
    key,
    conform: triBool(formData.get(`cat_conform_${key}`)),
    comment: fStr(formData, `cat_comment_${key}`),
  }));

  // Defectos: filas dinámicas. Recolecta por índice mientras exista def_desc_N.
  const defects: PsiDefect[] = [];
  for (let i = 0; formData.has(`def_desc_${i}`); i++) {
    const desc = fStr(formData, `def_desc_${i}`);
    if (!desc) continue; // fila vacía → se ignora
    defects.push({
      desc,
      critical: nonNegInt(formData.get(`def_critical_${i}`)) ?? 0,
      major: nonNegInt(formData.get(`def_major_${i}`)) ?? 0,
      minor: nonNegInt(formData.get(`def_minor_${i}`)) ?? 0,
    });
  }

  const overallRaw = String(formData.get("overall") ?? "pending");
  const overall: PsiOverall =
    overallRaw === "pass" || overallRaw === "fail" ? overallRaw : "pending";

  return {
    order: {
      po: fStr(formData, "order_po"),
      itemNo: fStr(formData, "order_itemNo"),
      orderQty: nonNegInt(formData.get("order_orderQty")),
      destination: fStr(formData, "order_destination"),
      shippingMark: fStr(formData, "order_shippingMark"),
      arrival: fStr(formData, "order_arrival"),
      departure: fStr(formData, "order_departure"),
    },
    aql: {
      standard: fStr(formData, "aql_standard"),
      level: fStr(formData, "aql_level"),
      sampleSize: nonNegInt(formData.get("aql_sampleSize")),
      found: {
        critical: nonNegInt(formData.get("aql_found_critical")) ?? 0,
        major: nonNegInt(formData.get("aql_found_major")) ?? 0,
        minor: nonNegInt(formData.get("aql_found_minor")) ?? 0,
      },
      maxAllowed: {
        critical: nonNegNum(formData.get("aql_max_critical")) ?? 0,
        major: nonNegNum(formData.get("aql_max_major")) ?? 0,
        minor: nonNegNum(formData.get("aql_max_minor")) ?? 0,
      },
    },
    categories,
    defects,
    production: {
      ordered: nonNegInt(formData.get("prod_ordered")),
      available: nonNegInt(formData.get("prod_available")),
      pctDone: nonNegNum(formData.get("prod_pctDone")),
      boxesPacked: nonNegInt(formData.get("prod_boxesPacked")),
      pcsPerBox: nonNegInt(formData.get("prod_pcsPerBox")),
      pctPacked: nonNegNum(formData.get("prod_pctPacked")),
    },
    measures: {
      masterBox: fStr(formData, "meas_masterBox"),
      grossKg: nonNegNum(formData.get("meas_grossKg")),
      colorBox: fStr(formData, "meas_colorBox"),
      colorBoxGrossG: nonNegNum(formData.get("meas_colorBoxGrossG")),
      product: fStr(formData, "meas_product"),
      netG: nonNegNum(formData.get("meas_netG")),
    },
    overall,
  };
}

/** Construye el FactoryPayload desde el FormData del builder. */
export function parseFactoryPayload(formData: FormData): FactoryPayload {
  const companyTypeRaw = String(formData.get("legal_companyType") ?? "");
  const companyType: FactoryCompanyType | null = (
    FACTORY_COMPANY_TYPES as string[]
  ).includes(companyTypeRaw)
    ? (companyTypeRaw as FactoryCompanyType)
    : null;

  // RRHH: filas indexadas (hr_dept_N siempre presente para los 8 deptos default).
  const hr: FactoryHr[] = [];
  for (let i = 0; formData.has(`hr_dept_${i}`); i++) {
    const dept = fStr(formData, `hr_dept_${i}`);
    if (!dept) continue;
    hr.push({
      dept,
      perFactory: nonNegInt(formData.get(`hr_perFactory_${i}`)),
      actual: nonNegInt(formData.get(`hr_actual_${i}`)),
    });
  }

  // Facturación: 3 filas indexadas.
  const turnover: FactoryTurnover[] = [];
  for (let i = 0; formData.has(`turn_year_${i}`); i++) {
    const year = nonNegInt(formData.get(`turn_year_${i}`));
    const amount = fStr(formData, `turn_amount_${i}`);
    const topMarkets = fStr(formData, `turn_topMarkets_${i}`);
    const pctVolume = nonNegNum(formData.get(`turn_pctVolume_${i}`));
    if (year == null && !amount && !topMarkets && pctVolume == null) continue;
    turnover.push({ year, amount, topMarkets, pctVolume });
  }

  // Maquinaria: filas dinámicas.
  const machines: FactoryMachine[] = [];
  for (let i = 0; formData.has(`mach_name_${i}`); i++) {
    const name = fStr(formData, `mach_name_${i}`);
    if (!name) continue;
    machines.push({
      name,
      qty: nonNegInt(formData.get(`mach_qty_${i}`)),
      state: fStr(formData, `mach_state_${i}`),
    });
  }

  // Requerimientos: filas dinámicas.
  const requirements: FactoryRequirement[] = [];
  for (let i = 0; formData.has(`req_question_${i}`); i++) {
    const question = fStr(formData, `req_question_${i}`);
    if (!question) continue;
    requirements.push({
      question,
      answer: fStr(formData, `req_answer_${i}`),
    });
  }

  const score = nonNegInt(formData.get("score"));

  return {
    legal: {
      supplierName: fStr(formData, "legal_supplierName"),
      registeredName: fStr(formData, "legal_registeredName"),
      licenseNo: fStr(formData, "legal_licenseNo"),
      estYear: nonNegInt(formData.get("legal_estYear")),
      legalRep: fStr(formData, "legal_legalRep"),
      regCapital: fStr(formData, "legal_regCapital"),
      address: fStr(formData, "legal_address"),
      companyType,
      clientProductInScope: triBool(formData.get("legal_clientProductInScope")),
      abnormalList: triBool(formData.get("legal_abnormalList")),
    },
    building: {
      totalArea: nonNegNum(formData.get("build_totalArea")),
      buildings: nonNegInt(formData.get("build_buildings")),
      offices: nonNegNum(formData.get("build_offices")),
      production: nonNegNum(formData.get("build_production")),
      warehouse: nonNegNum(formData.get("build_warehouse")),
    },
    bank: {
      beneficiary: fStr(formData, "bank_beneficiary"),
      bank: fStr(formData, "bank_bank"),
      accountNo: fStr(formData, "bank_accountNo"),
      companySeal: triBool(formData.get("bank_companySeal")),
    },
    hr,
    product: {
      mainProducts: fStr(formData, "prod_mainProducts"),
      clientProduct: fStr(formData, "prod_clientProduct"),
      exportLicense: triBool(formData.get("prod_exportLicense")),
      pctExport: nonNegNum(formData.get("prod_pctExport")),
      pctOem: nonNegNum(formData.get("prod_pctOem")),
    },
    turnover,
    facilities: {
      tidy: triBool(formData.get("fac_tidy")),
      lit: triBool(formData.get("fac_lit")),
      ventilated: triBool(formData.get("fac_ventilated")),
      power: triBool(formData.get("fac_power")),
    },
    machines,
    requirements,
    score: score != null && score <= 100 ? score : null,
  };
}
