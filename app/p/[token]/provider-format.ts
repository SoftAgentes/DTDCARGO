import type { PackingListCurrency } from "@/lib/studio/prealertas/packlist-form";
import type { ProviderLocale } from "./PackingListGuidedForm";

/** UI number formatting only; business calculations and the printed document keep their contracts. */
export function formatProviderNumber(value: number, locale: ProviderLocale, maximumFractionDigits = 3, minimumFractionDigits = 0) {
  return value.toLocaleString(locale === "zh" ? "zh-CN" : locale === "es" ? "es-ES" : "en-US", { minimumFractionDigits, maximumFractionDigits });
}
export function formatProviderMoney(value: number, currency: PackingListCurrency, locale: ProviderLocale, maximumFractionDigits = 2) {
  return `${currency} ${formatProviderNumber(value, locale, maximumFractionDigits, 2)}`;
}
