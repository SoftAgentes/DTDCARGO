/**
 * Feriados oficiales 2026 para el calendario operativo (SDD-0015).
 *
 * Datos hardcoded por simplicidad V1. Cuando se necesite editar /
 * agregar feriados custom por tenant, migrar a tabla BD con RLS.
 *
 * Fechas en ISO `YYYY-MM-DD`. Rangos inclusivos (`endDate` incluido).
 *
 * Convención: feriados `critical: true` paralizan operación entera
 * (Año Nuevo Chino + Golden Week). Los demás reducen.
 */

export type HolidayCountry = "CN" | "VE";

export type Holiday = {
  /** Estable para keys de React y URLs futuras. */
  id: string;
  country: HolidayCountry;
  /** ISO `YYYY-MM-DD`. Inclusivo. */
  startDate: string;
  /** ISO `YYYY-MM-DD`. Inclusivo. */
  endDate: string;
  /** Nombre completo, ej "Año Nuevo Chino · 春节". */
  name: string;
  /** Nombre corto para el grid, ej "CNY · 春节". */
  shortName: string;
  /** True para feriados que paralizan operación entera. */
  critical?: boolean;
};

export const CN_HOLIDAYS_2026: Holiday[] = [
  {
    id: "cn-2026-newyear",
    country: "CN",
    startDate: "2026-01-01",
    endDate: "2026-01-01",
    name: "Año Nuevo Internacional",
    shortName: "Año Nuevo",
  },
  {
    id: "cn-2026-cny",
    country: "CN",
    startDate: "2026-02-16",
    endDate: "2026-02-24",
    name: "Año Nuevo Chino · 春节",
    shortName: "CNY · 春节",
    critical: true,
  },
  {
    id: "cn-2026-qingming",
    country: "CN",
    startDate: "2026-04-04",
    endDate: "2026-04-06",
    name: "Qingming · 清明节",
    shortName: "Qingming",
  },
  {
    id: "cn-2026-laborday",
    country: "CN",
    startDate: "2026-05-01",
    endDate: "2026-05-05",
    name: "Día del Trabajador CN · 劳动节",
    shortName: "Día Trab. CN",
  },
  {
    id: "cn-2026-dragonboat",
    country: "CN",
    startDate: "2026-06-19",
    endDate: "2026-06-21",
    name: "Dragon Boat · 端午节",
    shortName: "Dragon Boat",
  },
  {
    id: "cn-2026-midautumn",
    country: "CN",
    startDate: "2026-09-25",
    endDate: "2026-09-27",
    name: "Mid-Autumn · 中秋节",
    shortName: "Mid-Autumn",
  },
  {
    id: "cn-2026-goldenweek",
    country: "CN",
    startDate: "2026-10-01",
    endDate: "2026-10-07",
    name: "Golden Week · 国庆节",
    shortName: "Golden Week",
    critical: true,
  },
];

export const VE_HOLIDAYS_2026: Holiday[] = [
  {
    id: "ve-2026-newyear",
    country: "VE",
    startDate: "2026-01-01",
    endDate: "2026-01-01",
    name: "Año Nuevo VE",
    shortName: "Año Nuevo",
  },
  {
    id: "ve-2026-holyweek",
    country: "VE",
    startDate: "2026-04-02",
    endDate: "2026-04-03",
    name: "Semana Santa",
    shortName: "Semana Santa",
  },
  {
    id: "ve-2026-independence-declaration",
    country: "VE",
    startDate: "2026-04-19",
    endDate: "2026-04-19",
    name: "Declaración Independencia",
    shortName: "Decl. Indep.",
  },
  {
    id: "ve-2026-laborday",
    country: "VE",
    startDate: "2026-05-01",
    endDate: "2026-05-01",
    name: "Día del Trabajador VE",
    shortName: "Día Trab. VE",
  },
  {
    id: "ve-2026-independence",
    country: "VE",
    startDate: "2026-07-05",
    endDate: "2026-07-05",
    name: "Independencia",
    shortName: "Independencia",
  },
  {
    id: "ve-2026-bolivar",
    country: "VE",
    startDate: "2026-07-24",
    endDate: "2026-07-24",
    name: "Natalicio Bolívar",
    shortName: "Bolívar",
  },
  {
    id: "ve-2026-christmas",
    country: "VE",
    startDate: "2026-12-25",
    endDate: "2026-12-25",
    name: "Navidad",
    shortName: "Navidad",
  },
];

/** Lista combinada — el orden no importa, los helpers ordenan. */
export const ALL_HOLIDAYS_2026: Holiday[] = [
  ...CN_HOLIDAYS_2026,
  ...VE_HOLIDAYS_2026,
];

/**
 * Ferias y expos comerciales 2026 (sourcing en China · demanda en
 * Venezuela). Datos estáticos V1 — mismo criterio que los feriados.
 * El cliente viaja a comprar (CN) o a distribuir (VE); planificar
 * embarques alrededor de estas fechas es parte de la operación.
 */
export type Fair = {
  id: string;
  country: HolidayCountry;
  /** ISO `YYYY-MM-DD`. Inclusivo. */
  startDate: string;
  /** ISO `YYYY-MM-DD`. Inclusivo. */
  endDate: string;
  name: string;
  shortName: string;
  city: string;
  sector: string;
  /** True para ferias ancla (Cantón F3, etc.). */
  critical?: boolean;
};

export const FAIRS_CN_2026: Fair[] = [
  { id: "f-cn-huajiao", country: "CN", startDate: "2026-03-01", endDate: "2026-03-04", name: "Feria de China Oriental · 华交会", shortName: "Huajiao", city: "Shanghái", sector: "Textil · bienes de consumo" },
  { id: "f-cn-canton-s1", country: "CN", startDate: "2026-04-15", endDate: "2026-04-19", name: "Feria de Cantón · Fase 1 · 广交会", shortName: "Cantón F1", city: "Guangzhou", sector: "Electrónica · maquinaria" },
  { id: "f-cn-canton-s2", country: "CN", startDate: "2026-04-23", endDate: "2026-04-27", name: "Feria de Cantón · Fase 2 · 广交会", shortName: "Cantón F2", city: "Guangzhou", sector: "Hogar · regalos · decoración" },
  { id: "f-cn-canton-s3", country: "CN", startDate: "2026-05-01", endDate: "2026-05-05", name: "Feria de Cantón · Fase 3 · 广交会", shortName: "Cantón F3", city: "Guangzhou", sector: "Textil · oficina · médico", critical: true },
  { id: "f-cn-szind", country: "CN", startDate: "2026-06-10", endDate: "2026-06-12", name: "Shenzhen Industrial Expo · 深圳工业展", shortName: "Shenzhen Ind.", city: "Shenzhen", sector: "Industrial · automatización" },
  { id: "f-cn-cantona1", country: "CN", startDate: "2026-10-15", endDate: "2026-10-19", name: "Cantón Otoño · Fase 1 · 广交会", shortName: "Cantón O1", city: "Guangzhou", sector: "Electrónica · maquinaria" },
  { id: "f-cn-yiwu", country: "CN", startDate: "2026-10-21", endDate: "2026-10-25", name: "Feria Internacional de Yiwu · 义乌博览会", shortName: "Yiwu Fair", city: "Yiwu", sector: "Bazar · general · mayorista" },
  { id: "f-cn-cantona3", country: "CN", startDate: "2026-10-31", endDate: "2026-11-04", name: "Cantón Otoño · Fase 3 · 广交会", shortName: "Cantón O3", city: "Guangzhou", sector: "Textil · oficina · médico" },
  { id: "f-cn-ciie", country: "CN", startDate: "2026-11-05", endDate: "2026-11-10", name: "Expo Intl. de Importaciones · 进博会", shortName: "CIIE", city: "Shanghái", sector: "Importaciones · multisector" },
];

export const FAIRS_VE_2026: Fair[] = [
  { id: "f-ve-construccion", country: "VE", startDate: "2026-03-12", endDate: "2026-03-15", name: "Expo Construcción & Vivienda", shortName: "Expo Construcción", city: "Caracas", sector: "Construcción · ferretería" },
  { id: "f-ve-pyme", country: "VE", startDate: "2026-05-14", endDate: "2026-05-16", name: "Expo PyME Industrial", shortName: "Expo PyME", city: "Valencia", sector: "Industrial · manufactura" },
  { id: "f-ve-fic", country: "VE", startDate: "2026-06-18", endDate: "2026-06-21", name: "Feria Internacional de Caracas · FIC", shortName: "FIC Caracas", city: "Caracas", sector: "Multisector · bienes y servicios" },
  { id: "f-ve-franquicias", country: "VE", startDate: "2026-07-09", endDate: "2026-07-11", name: "Expo Franquicias Venezuela", shortName: "Expo Franquicias", city: "Caracas", sector: "Comercio · retail" },
  { id: "f-ve-hogar", country: "VE", startDate: "2026-09-17", endDate: "2026-09-19", name: "Expo Hogar & Decoración", shortName: "Expo Hogar", city: "Maracaibo", sector: "Hogar · decoración" },
  { id: "f-ve-importado", country: "VE", startDate: "2026-10-22", endDate: "2026-10-24", name: "Expo Comercio Importado", shortName: "Expo Importado", city: "Valencia", sector: "Importadores · mayorista" },
  { id: "f-ve-navidad", country: "VE", startDate: "2026-11-12", endDate: "2026-11-14", name: "Expo Navidad Mayorista", shortName: "Expo Navidad", city: "Caracas", sector: "Estacional · mayorista" },
];

/** Lista combinada de ferias — los helpers ordenan / filtran por país. */
export const ALL_FAIRS_2026: Fair[] = [...FAIRS_CN_2026, ...FAIRS_VE_2026];
