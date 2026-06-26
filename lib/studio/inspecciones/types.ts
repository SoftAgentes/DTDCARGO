/**
 * Tipos + helpers PUROS del módulo Inspecciones de calidad (SDD-0066 · Fase 1).
 * Matchea el schema de supabase/migrations/0176_inspecciones.sql.
 *
 * Dos tipos de reporte WHITE-LABEL con marca DTD:
 *   - product_psi   · inspección de producto (AQL / PSI)   → DTD-QC-NNNN
 *   - factory_audit · auditoría de fábrica (puntaje /100)   → DTD-FA-NNNN
 *
 * El proveedor tercero vive SOLO en `provider_internal` (INTERNO) — nunca se
 * renderiza al cliente. Los sub-datos del reporte viven en `payload` (jsonb):
 * el shape se valida acá en TS, no en la DB, porque varía entre los dos tipos.
 *
 * Sin React, sin server-only → importable desde client y server. Validadores
 * manuales (no Zod, patrón del repo). Numéricos `numeric` llegan como string →
 * se coercen con `num()`.
 */

// Tonos del set del sistema (los que acepta <Badge>).
export type InspectionBadgeTone =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "wine"
  | "neutral";

/** Coacciona un valor crudo a número finito (default 0). */
export function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Tipo de reporte · PSI / auditoría de fábrica               ║
// ╚═══════════════════════════════════════════════════════════╝
export type InspectionType = "product_psi" | "factory_audit";

export const INSPECTION_TYPES: InspectionType[] = [
  "product_psi",
  "factory_audit",
];

export const INSPECTION_TYPE_META: Record<
  InspectionType,
  { label: string; short: string; prefix: string; tone: InspectionBadgeTone }
> = {
  product_psi: {
    label: "Inspección de producto",
    short: "Producto · PSI",
    prefix: "DTD-QC-",
    tone: "info",
  },
  factory_audit: {
    label: "Auditoría de fábrica",
    short: "Fábrica",
    prefix: "DTD-FA-",
    tone: "wine",
  },
};

export const INSPECTION_TYPE_OPTIONS: {
  value: InspectionType;
  label: string;
}[] = INSPECTION_TYPES.map((t) => ({
  value: t,
  label: INSPECTION_TYPE_META[t].label,
}));

export function inspectionTypeLabel(t: string): string {
  return INSPECTION_TYPE_META[t as InspectionType]?.label ?? t;
}
export function inspectionTypeShort(t: string): string {
  return INSPECTION_TYPE_META[t as InspectionType]?.short ?? t;
}
export function inspectionTypeTone(t: string): InspectionBadgeTone {
  return INSPECTION_TYPE_META[t as InspectionType]?.tone ?? "neutral";
}
export function inspectionTypePrefix(t: InspectionType): string {
  return INSPECTION_TYPE_META[t].prefix;
}
export function isInspectionType(v: unknown): v is InspectionType {
  return typeof v === "string" && (INSPECTION_TYPES as string[]).includes(v);
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Conclusión · veredicto del reporte                         ║
// ╚═══════════════════════════════════════════════════════════╝
export type InspectionConclusion = "approved" | "observations" | "rejected";

export const INSPECTION_CONCLUSIONS: InspectionConclusion[] = [
  "approved",
  "observations",
  "rejected",
];

export const INSPECTION_CONCLUSION_META: Record<
  InspectionConclusion,
  { label: string; tone: InspectionBadgeTone }
> = {
  approved: { label: "Aprobado", tone: "success" },
  observations: { label: "Aprobado con observaciones", tone: "warning" },
  rejected: { label: "Rechazado", tone: "danger" },
};

export const INSPECTION_CONCLUSION_OPTIONS: {
  value: InspectionConclusion;
  label: string;
}[] = INSPECTION_CONCLUSIONS.map((c) => ({
  value: c,
  label: INSPECTION_CONCLUSION_META[c].label,
}));

export function inspectionConclusionLabel(c: string): string {
  return INSPECTION_CONCLUSION_META[c as InspectionConclusion]?.label ?? c;
}
export function inspectionConclusionTone(c: string): InspectionBadgeTone {
  return (
    INSPECTION_CONCLUSION_META[c as InspectionConclusion]?.tone ?? "neutral"
  );
}
export function isInspectionConclusion(v: unknown): v is InspectionConclusion {
  return (
    typeof v === "string" && (INSPECTION_CONCLUSIONS as string[]).includes(v)
  );
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Estado de edición · draft / final                          ║
// ╚═══════════════════════════════════════════════════════════╝
export type InspectionStatus = "draft" | "final";

export const INSPECTION_STATUSES: InspectionStatus[] = ["draft", "final"];

export const INSPECTION_STATUS_META: Record<
  InspectionStatus,
  { label: string; tone: InspectionBadgeTone }
> = {
  draft: { label: "Borrador", tone: "neutral" },
  final: { label: "Emitido", tone: "success" },
};

export function inspectionStatusLabel(s: string): string {
  return INSPECTION_STATUS_META[s as InspectionStatus]?.label ?? s;
}
export function inspectionStatusTone(s: string): InspectionBadgeTone {
  return INSPECTION_STATUS_META[s as InspectionStatus]?.tone ?? "neutral";
}
export function isInspectionStatus(v: unknown): v is InspectionStatus {
  return typeof v === "string" && (INSPECTION_STATUSES as string[]).includes(v);
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Payload jsonb · shapes por tipo (validados en TS)          ║
// ╚═══════════════════════════════════════════════════════════╝

/** Cabecera de la orden (PSI). */
export type PsiOrder = {
  po: string | null;
  itemNo: string | null;
  orderQty: number | null;
  destination: string | null;
  shippingMark: string | null;
  arrival: string | null;
  departure: string | null;
};

/** Aceptación por AQL (PSI). */
export type PsiAql = {
  standard: string | null; // ej. "ISO 2859-1 / ANSI Z1.4"
  level: string | null; // ej. "II"
  sampleSize: number | null;
  found: { critical: number; major: number; minor: number };
  maxAllowed: { critical: number; major: number; minor: number };
};

/** Sección de chequeo conforme/no conforme (PSI). */
export type PsiCategory = {
  key: string;
  conform: boolean | null; // null = no aplica / no evaluado
  comment: string | null;
};

/** Defecto encontrado, clasificado por severidad (PSI). */
export type PsiDefect = {
  desc: string;
  critical: number;
  major: number;
  minor: number;
};

/** Avance de producción / empaque (PSI). */
export type PsiProduction = {
  ordered: number | null;
  available: number | null;
  pctDone: number | null;
  boxesPacked: number | null;
  pcsPerBox: number | null;
  pctPacked: number | null;
};

/** Medidas y peso (PSI). Dimensiones libres "L×A×H cm" como texto. */
export type PsiMeasures = {
  masterBox: string | null; // caja máster L×A×H cm
  grossKg: number | null; // peso bruto caja máster (kg)
  colorBox: string | null; // color box L×A×H cm
  colorBoxGrossG: number | null; // PB color box (g)
  product: string | null; // producto L×A×H cm
  netG: number | null; // peso neto (g)
};

/** Veredicto técnico del muestreo (PSI). */
export type PsiOverall = "pass" | "fail" | "pending";

/** Payload completo de una inspección de producto / PSI. */
export type PsiPayload = {
  order: PsiOrder;
  aql: PsiAql;
  categories: PsiCategory[];
  defects: PsiDefect[];
  production: PsiProduction;
  measures: PsiMeasures;
  overall: PsiOverall;
};

/** Tipo de empresa del proveedor. */
export type FactoryCompanyType = "manufactory" | "trading" | "combined";

/** Datos legales del proveedor (auditoría de fábrica). */
export type FactoryLegal = {
  supplierName: string | null;
  registeredName: string | null;
  licenseNo: string | null;
  estYear: number | null;
  legalRep: string | null;
  regCapital: string | null;
  address: string | null;
  companyType: FactoryCompanyType | null;
  /** ¿El producto del cliente está en el alcance de la fábrica? */
  clientProductInScope: boolean | null;
  /** ¿La empresa está en la lista de operación anormal del registro chino? */
  abnormalList: boolean | null;
};

/** Edificios e instalaciones (m²). */
export type FactoryBuilding = {
  totalArea: number | null;
  buildings: number | null;
  offices: number | null;
  production: number | null;
  warehouse: number | null;
};

/** Datos bancarios + sello de la compañía. */
export type FactoryBank = {
  beneficiary: string | null;
  bank: string | null;
  accountNo: string | null;
  companySeal: boolean | null;
};

/** Plantilla por departamento (RRHH). */
export type FactoryHr = {
  dept: string;
  perFactory: number | null;
  actual: number | null;
};

/** Producto y perfil exportador. */
export type FactoryProduct = {
  mainProducts: string | null;
  clientProduct: string | null;
  exportLicense: boolean | null;
  pctExport: number | null;
  pctOem: number | null;
};

/** Facturación por año. */
export type FactoryTurnover = {
  year: number | null;
  amount: string | null;
  topMarkets: string | null;
  pctVolume: number | null;
};

/** Estado de las instalaciones (booleanos). */
export type FactoryFacilities = {
  tidy: boolean | null;
  lit: boolean | null;
  ventilated: boolean | null;
  power: boolean | null;
};

/** Maquinaria. */
export type FactoryMachine = {
  name: string;
  qty: number | null;
  state: string | null;
};

/** Pregunta/respuesta del cuestionario de requisitos. */
export type FactoryRequirement = {
  question: string;
  answer: string | null;
};

/** Payload completo de una auditoría de fábrica. */
export type FactoryPayload = {
  legal: FactoryLegal;
  building: FactoryBuilding;
  bank: FactoryBank;
  hr: FactoryHr[];
  product: FactoryProduct;
  turnover: FactoryTurnover[];
  facilities: FactoryFacilities;
  machines: FactoryMachine[];
  requirements: FactoryRequirement[];
  score: number | null;
};

/** Payload genérico (lo que se persiste en la columna jsonb). */
export type InspectionPayload = Partial<PsiPayload> & Partial<FactoryPayload>;

/** Payload vacío por defecto para un reporte recién creado (cabecera). */
export function emptyPayload(): InspectionPayload {
  return {};
}

// ── Categorías fijas del PSI (7, en orden de la plantilla) ──────
export const PSI_CATEGORY_KEYS = [
  "quantity",
  "description",
  "workmanship",
  "testing",
  "measurement",
  "packaging",
  "shipping_mark",
] as const;

export type PsiCategoryKey = (typeof PSI_CATEGORY_KEYS)[number];

export const PSI_CATEGORY_LABELS: Record<PsiCategoryKey, string> = {
  quantity: "Cantidad",
  description: "Descripción / estilo / color",
  workmanship: "Mano de obra",
  testing: "Pruebas / verificación",
  measurement: "Medición",
  packaging: "Empaque",
  shipping_mark: "Shipping Mark",
};

/** Departamentos default del bloque RRHH (auditoría de fábrica). */
export const FACTORY_HR_DEPTS = [
  "Administración",
  "Recursos humanos",
  "Ventas",
  "Financiero",
  "Producción",
  "Ingeniería / I+D",
  "Calidad",
  "Otros",
] as const;

export const FACTORY_COMPANY_TYPES: FactoryCompanyType[] = [
  "manufactory",
  "trading",
  "combined",
];

export const FACTORY_COMPANY_TYPE_META: Record<FactoryCompanyType, string> = {
  manufactory: "Fabricante",
  trading: "Comercial / Trading",
  combined: "Combinada",
};

export const FACTORY_COMPANY_TYPE_OPTIONS: {
  value: FactoryCompanyType;
  label: string;
}[] = FACTORY_COMPANY_TYPES.map((t) => ({
  value: t,
  label: FACTORY_COMPANY_TYPE_META[t],
}));

export function factoryCompanyTypeLabel(t: string | null): string {
  if (!t) return "—";
  return FACTORY_COMPANY_TYPE_META[t as FactoryCompanyType] ?? t;
}

export const PSI_OVERALL_OPTIONS: { value: PsiOverall; label: string }[] = [
  { value: "pass", label: "Aprobado (Pass)" },
  { value: "fail", label: "Rechazado (Fail)" },
  { value: "pending", label: "Pendiente (Pending)" },
];

export function psiOverallLabel(o: string | null | undefined): string {
  return (
    PSI_OVERALL_OPTIONS.find((x) => x.value === o)?.label ??
    "Pendiente (Pending)"
  );
}

export function psiOverallTone(
  o: string | null | undefined,
): InspectionBadgeTone {
  if (o === "pass") return "success";
  if (o === "fail") return "danger";
  return "neutral";
}

// ── Constructores de payload por defecto (para el builder) ─────
export function emptyPsiPayload(): PsiPayload {
  return {
    order: {
      po: null,
      itemNo: null,
      orderQty: null,
      destination: null,
      shippingMark: null,
      arrival: null,
      departure: null,
    },
    aql: {
      standard: "ANSI/ASQ Z1.4 · MIL-STD-105E",
      level: "G – II",
      sampleSize: null,
      found: { critical: 0, major: 0, minor: 0 },
      maxAllowed: { critical: 0, major: 0, minor: 0 },
    },
    categories: PSI_CATEGORY_KEYS.map((key) => ({
      key,
      conform: null,
      comment: null,
    })),
    defects: [],
    production: {
      ordered: null,
      available: null,
      pctDone: null,
      boxesPacked: null,
      pcsPerBox: null,
      pctPacked: null,
    },
    measures: {
      masterBox: null,
      grossKg: null,
      colorBox: null,
      colorBoxGrossG: null,
      product: null,
      netG: null,
    },
    overall: "pending",
  };
}

export function emptyFactoryPayload(): FactoryPayload {
  return {
    legal: {
      supplierName: null,
      registeredName: null,
      licenseNo: null,
      estYear: null,
      legalRep: null,
      regCapital: null,
      address: null,
      companyType: null,
      clientProductInScope: null,
      abnormalList: null,
    },
    building: {
      totalArea: null,
      buildings: null,
      offices: null,
      production: null,
      warehouse: null,
    },
    bank: { beneficiary: null, bank: null, accountNo: null, companySeal: null },
    hr: FACTORY_HR_DEPTS.map((dept) => ({
      dept,
      perFactory: null,
      actual: null,
    })),
    product: {
      mainProducts: null,
      clientProduct: null,
      exportLicense: null,
      pctExport: null,
      pctOem: null,
    },
    turnover: [0, 1, 2].map(() => ({
      year: null,
      amount: null,
      topMarkets: null,
      pctVolume: null,
    })),
    facilities: { tidy: null, lit: null, ventilated: null, power: null },
    machines: [],
    requirements: [],
    score: null,
  };
}

/** Asegura un PsiPayload completo a partir de un payload parcial leído de DB. */
export function ensurePsiPayload(p: InspectionPayload | undefined): PsiPayload {
  const base = emptyPsiPayload();
  if (!p) return base;
  return {
    order: { ...base.order, ...(p.order ?? {}) },
    aql: {
      ...base.aql,
      ...(p.aql ?? {}),
      found: { ...base.aql.found, ...(p.aql?.found ?? {}) },
      maxAllowed: { ...base.aql.maxAllowed, ...(p.aql?.maxAllowed ?? {}) },
    },
    categories:
      p.categories && p.categories.length > 0 ? p.categories : base.categories,
    defects: p.defects ?? [],
    production: { ...base.production, ...(p.production ?? {}) },
    measures: { ...base.measures, ...(p.measures ?? {}) },
    overall: p.overall ?? "pending",
  };
}

/** Asegura un FactoryPayload completo a partir de un payload parcial. */
export function ensureFactoryPayload(
  p: InspectionPayload | undefined,
): FactoryPayload {
  const base = emptyFactoryPayload();
  if (!p) return base;
  return {
    legal: { ...base.legal, ...(p.legal ?? {}) },
    building: { ...base.building, ...(p.building ?? {}) },
    bank: { ...base.bank, ...(p.bank ?? {}) },
    hr: p.hr && p.hr.length > 0 ? p.hr : base.hr,
    product: { ...base.product, ...(p.product ?? {}) },
    turnover: p.turnover && p.turnover.length > 0 ? p.turnover : base.turnover,
    facilities: { ...base.facilities, ...(p.facilities ?? {}) },
    machines: p.machines ?? [],
    requirements: p.requirements ?? [],
    score: p.score ?? null,
  };
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Fila persistida + KPIs                                      ║
// ╚═══════════════════════════════════════════════════════════╝
export type InspectionReport = {
  id: string;
  tenant_id: string;
  report_no: string;
  type: InspectionType;
  client_id: string | null;
  client_name: string | null;
  title: string;
  product: string | null;
  inspection_date: string | null;
  duration_mandays: number | null;
  score: number | null;
  conclusion: InspectionConclusion | null;
  status: InspectionStatus;
  payload: InspectionPayload;
  provider_internal: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type InspectionKpis = {
  /** Reportes con inspection_date en el mes corriente. */
  month_count: number;
  /** De los del mes: conclusión aprobada. */
  month_approved: number;
  /** De los del mes: con observaciones o rechazado. */
  month_observed: number;
  /** Borradores vivos (cualquier fecha). */
  draft_count: number;
};

/** ¿La fecha ISO (yyyy-mm-dd) cae en el mes/año de `ref` (default: hoy)? */
export function isSameMonth(isoDate: string | null, ref = new Date()): boolean {
  if (!isoDate) return false;
  const d = new Date(isoDate + "T00:00:00");
  if (Number.isNaN(d.getTime())) return false;
  return (
    d.getUTCFullYear() === ref.getUTCFullYear() &&
    d.getUTCMonth() === ref.getUTCMonth()
  );
}

/**
 * KPIs del mes (PURO — testeable sin DB). Cuenta los reportes cuya
 * inspection_date cae en el mes de `ref`, y separa aprobados de observados.
 */
export function computeInspectionKpis(
  reports: {
    inspection_date: string | null;
    conclusion: InspectionConclusion | null;
    status: InspectionStatus;
  }[],
  ref = new Date(),
): InspectionKpis {
  let monthCount = 0;
  let approved = 0;
  let observed = 0;
  let drafts = 0;
  for (const r of reports) {
    if (r.status === "draft") drafts += 1;
    if (isSameMonth(r.inspection_date, ref)) {
      monthCount += 1;
      if (r.conclusion === "approved") approved += 1;
      else if (r.conclusion === "observations" || r.conclusion === "rejected")
        observed += 1;
    }
  }
  return {
    month_count: monthCount,
    month_approved: approved,
    month_observed: observed,
    draft_count: drafts,
  };
}

// ── Filtros del listado (client-side) ──────────────────────────
export type InspectionTypeFilter = "todos" | InspectionType;
export type InspectionStatusFilter = "todos" | InspectionStatus;

export const INSPECTION_TYPE_FILTERS: {
  value: InspectionTypeFilter;
  label: string;
}[] = [
  { value: "todos", label: "Todos los tipos" },
  ...INSPECTION_TYPES.map((t) => ({
    value: t,
    label: INSPECTION_TYPE_META[t].short,
  })),
];

export const INSPECTION_STATUS_FILTERS: {
  value: InspectionStatusFilter;
  label: string;
}[] = [
  { value: "todos", label: "Todos" },
  ...INSPECTION_STATUSES.map((s) => ({
    value: s,
    label: INSPECTION_STATUS_META[s].label,
  })),
];

export function inspectionMatchesFilters(
  report: {
    type: InspectionType;
    status: InspectionStatus;
    client_id: string | null;
  },
  typeFilter: InspectionTypeFilter,
  statusFilter: InspectionStatusFilter,
  clientFilter: string | "todos",
): boolean {
  if (typeFilter !== "todos" && report.type !== typeFilter) return false;
  if (statusFilter !== "todos" && report.status !== statusFilter) return false;
  if (clientFilter !== "todos" && report.client_id !== clientFilter)
    return false;
  return true;
}

// ── Helper de display del correlativo ──────────────────────────
/**
 * Arma el correlativo display a partir de tipo + número. Solo formato; el número
 * real lo emite la RPC `next_inspection_report_no` en la DB.
 */
export function buildReportNoDisplay(type: InspectionType, n: number): string {
  return `${inspectionTypePrefix(type)}${String(n).padStart(4, "0")}`;
}
