/**
 * lib/i18n/region.ts · Región del user + derivaciones.
 *
 * La oficina del user (region) es la única decisión que toma el admin
 * al invitar. De ahí se derivan automáticamente:
 *   - locale (`zh-CN` para CN, `es-VE` para VE)
 *   - timezone (Asia/Shanghai vs America/Caracas)
 *   - moneda default (CNY vs USD)
 *
 * Persistido en `user_tenants.region` (migración 0052_user_region.sql).
 *
 * Ver plan: `~/.claude/plans/estamos-en-modo-planning-glowing-marshmallow.md`
 * sección A.3.
 */

import type { Locale } from "./locales";

export type UserRegion = "ve" | "cn";

export const SUPPORTED_REGIONS: readonly UserRegion[] = ["ve", "cn"] as const;

export const DEFAULT_REGION: UserRegion = "ve";

export function isUserRegion(value: unknown): value is UserRegion {
  return value === "ve" || value === "cn";
}

/** Monedas soportadas en expenses (debe matchear el enum public.expense_currency). */
export type ExpenseCurrency = "USD" | "VES" | "CNY";

/**
 * Defaults derivados de la región. Single source of truth — cualquier
 * nuevo aspecto que dependa de la oficina lee de acá.
 */
interface RegionDefaults {
  locale: Locale;
  timezone: string;
  /** Moneda preferida al cargar gastos / mostrar montos. */
  currency: ExpenseCurrency;
  /** Label de la oficina para la UI de invitación. */
  officeLabel: string;
  /** Bandera emoji (decorativa). */
  flag: string;
}

export const REGION_DEFAULTS: Record<UserRegion, RegionDefaults> = {
  ve: {
    locale: "es-VE",
    timezone: "America/Caracas",
    currency: "USD",
    officeLabel: "Venezuela",
    flag: "🇻🇪",
  },
  cn: {
    locale: "zh-CN",
    timezone: "Asia/Shanghai",
    currency: "CNY",
    officeLabel: "China",
    flag: "🇨🇳",
  },
};

export function localeForRegion(region: UserRegion): Locale {
  return REGION_DEFAULTS[region].locale;
}

export function timezoneForRegion(region: UserRegion): string {
  return REGION_DEFAULTS[region].timezone;
}

export function currencyDefaultForRegion(region: UserRegion): ExpenseCurrency {
  return REGION_DEFAULTS[region].currency;
}

/**
 * Monedas visibles en el selector de Expenses según región.
 *
 * - CN: trabajan en CNY (renminbi) y USD. NO usan bolívar.
 * - VE: trabajan en USD y VES. NO usan renminbi.
 *
 * Previene errores tipo "la contadora CN cargó accidentalmente VES".
 * Admins ven las 3 — ver overrideVisibleCurrenciesForAdmin().
 */
export function visibleCurrenciesFor(region: UserRegion): ExpenseCurrency[] {
  return region === "cn" ? ["CNY", "USD"] : ["USD", "VES"];
}

/** Si el caller es admin, mostrar las 3 monedas con default según su región. */
export function visibleCurrenciesForAdmin(region: UserRegion): ExpenseCurrency[] {
  const own = currencyDefaultForRegion(region);
  const rest: ExpenseCurrency[] = ["USD", "VES", "CNY"].filter(
    (c): c is ExpenseCurrency => c !== own,
  );
  return [own, ...rest];
}
