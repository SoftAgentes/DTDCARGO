/**
 * lib/i18n/index.ts · API pública del sistema de internacionalización.
 *
 * Cliente:
 *   import { useT, useLocale, useRegion } from "@/lib/i18n";
 *   const t = useT();
 *
 * Server:
 *   import { resolveLocale } from "@/lib/i18n/resolve-server";  // server-only
 *   import { t } from "@/lib/i18n";
 *   t("es-VE", "chrome.action.cancel");
 *
 * Formatters (cliente o server):
 *   import { formatDate, formatCurrency } from "@/lib/i18n";
 *
 * Región:
 *   import { localeForRegion, currencyDefaultForRegion } from "@/lib/i18n";
 *
 * NOTA: `resolveLocale` se importa desde `@/lib/i18n/resolve-server` —
 * está marcado `import "server-only"` para que un client component que
 * lo intente importar falle en build con error claro.
 */

export {
  type Locale,
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  LOCALE_NATIVE_LABELS,
  isLocale,
  parseAcceptLanguage,
} from "./locales";

export {
  type UserRegion,
  type ExpenseCurrency,
  DEFAULT_REGION,
  SUPPORTED_REGIONS,
  REGION_DEFAULTS,
  isUserRegion,
  localeForRegion,
  timezoneForRegion,
  currencyDefaultForRegion,
  visibleCurrenciesFor,
  visibleCurrenciesForAdmin,
} from "./region";

export {
  formatDate,
  formatNumber,
  formatCurrency,
  type DateStyle,
} from "./format";

export { t, hasI18nKey, type I18nKey } from "./dict";

export {
  LocaleProvider,
  useLocale,
  useRegion,
  useT,
} from "./LocaleProvider";

export {
  type ErrorCode,
  ERROR_CODE_KEY,
  isErrorCode,
} from "./error-codes";

export {
  resolveErrorMessage,
  type ActionStateWithError,
} from "./error-message";
