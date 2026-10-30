/**
 * lib/i18n/dict.ts · Diccionarios consolidados + helper t().
 *
 * Los archivos por dominio (chrome, warehouse, expenses…) se unen acá
 * en un objeto plano por locale. El tipo `I18nKey` se deriva del
 * dict es-VE — agregar una key en es-VE la hace requerida en zh-CN
 * (TypeScript fuerza coverage al cargar el dict zh-CN).
 *
 * Cuando se agreguen más dominios (warehouse, expenses, errors), se
 * importan acá y se mergean con `...spread`.
 *
 * Ver plan sección A.1 y A.2.
 */

import { chrome as chromeES } from "./es-VE/chrome";
import { chrome as chromeCN } from "./zh-CN/chrome";
import { warehouse as warehouseES } from "./es-VE/warehouse";
import { warehouse as warehouseCN } from "./zh-CN/warehouse";
import { bugReporter as bugReporterES } from "./es-VE/bug-reporter";
import { bugReporter as bugReporterCN } from "./zh-CN/bug-reporter";
import { pwaOperario as pwaOperarioES } from "./es-VE/pwa-operario";
import { pwaOperario as pwaOperarioCN } from "./zh-CN/pwa-operario";
import { errors as errorsES } from "./es-VE/errors";
import { errors as errorsCN } from "./zh-CN/errors";
import { users as usersES } from "./es-VE/users";
import { users as usersCN } from "./zh-CN/users";
import { expenses as expensesES } from "./es-VE/expenses";
import { expenses as expensesCN } from "./zh-CN/expenses";
import { guide as guideES } from "./es-VE/guide";
import { guide as guideCN } from "./zh-CN/guide";
import type { Locale } from "./locales";
import { DEFAULT_LOCALE } from "./locales";

const dicts = {
  "es-VE": {
    ...chromeES,
    ...warehouseES,
    ...bugReporterES,
    ...pwaOperarioES,
    ...errorsES,
    ...usersES,
    ...expensesES,
    ...guideES,
  },
  "zh-CN": {
    ...chromeCN,
    ...warehouseCN,
    ...bugReporterCN,
    ...pwaOperarioCN,
    ...errorsCN,
    ...usersCN,
    ...expensesCN,
    ...guideCN,
  },
} as const;

export type I18nKey = keyof typeof dicts["es-VE"];

/**
 * ¿Existe la key en el dict base? Para claves armadas en runtime (la guía
 * de SDD-0589 deriva `.before` de una clave base y lo omite si no existe).
 */
export function hasI18nKey(key: string): key is I18nKey {
  return Object.prototype.hasOwnProperty.call(dicts[DEFAULT_LOCALE], key);
}

/**
 * Devuelve el string traducido para el locale dado.
 *
 * Si la key no existe en el locale pedido (no debería pasar gracias al
 * type system), cae al DEFAULT_LOCALE. Si tampoco está ahí, devuelve la
 * key misma — útil para debug visual ("chrome.foo.bar" aparece crudo).
 *
 * `params` permite interpolación simple: `t(locale, "hello", { name: "Sam" })`
 * con el dict `"hello": "Hola {name}"` → "Hola Sam".
 */
export function t(
  locale: Locale,
  key: I18nKey,
  params?: Record<string, string | number>,
): string {
  const dict = dicts[locale] ?? dicts[DEFAULT_LOCALE];
  const raw = (dict as Record<string, string>)[key];
  if (!raw) {
    // fallback al default si la key existe ahí
    const def = (dicts[DEFAULT_LOCALE] as Record<string, string>)[key];
    if (!def) return key; // debug visual
    return interpolate(def, params);
  }
  return interpolate(raw, params);
}

function interpolate(
  template: string,
  params: Record<string, string | number> | undefined,
): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) =>
    String(params[k] ?? `{${k}}`),
  );
}
