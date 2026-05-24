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
