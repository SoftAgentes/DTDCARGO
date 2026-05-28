"use client";

/**
 * lib/i18n/LocaleProvider.tsx · Context para el locale + region activos.
 *
 * El layout server resuelve `locale` y `region` UNA vez por request
 * (ver `resolve-server.ts`) y los pasa como props a este provider.
 * Adentro, el provider lee `?lang=` del URL para aplicar override
 * temporal (admin VE que quiere ver el Studio en CN para QA).
 *
 * Cualquier client component descendiente lee:
 *
 *   const t = useT();                  // función de traducción
 *   const locale = useLocale();        // 'es-VE' | 'zh-CN'
 *   const region = useRegion();        // 've' | 'cn' | null
 *
 * Si un componente lo usa fuera del provider, cae a DEFAULT_LOCALE
 * con warning en dev — útil para tests aislados o storybook.
 */

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { DEFAULT_LOCALE, isLocale, type Locale } from "./locales";
import type { UserRegion } from "./region";
import { t as tBase, type I18nKey } from "./dict";

interface LocaleContextValue {
  locale: Locale;
  region: UserRegion | null;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  region: null,
});

/** Aliases cortos del URL → BCP-47. Coincide con resolve-server.ts. */
function urlLangToLocale(value: string | null | undefined): Locale | null {
  if (!value) return null;
  const v = value.toLowerCase();
  if (v === "cn" || v === "zh" || v === "zh-cn") return "zh-CN";
  if (v === "es" || v === "es-ve") return "es-VE";
  if (isLocale(v as Locale)) return v as Locale;
  return null;
}

export function LocaleProvider({
  locale: serverLocale,
  region,
  children,
}: {
  locale: Locale;
  region: UserRegion | null;
  children: ReactNode;
}) {
  const params = useSearchParams();
  const overrideLocale = urlLangToLocale(params.get("lang"));
  const locale = overrideLocale ?? serverLocale;
  const value = useMemo(() => ({ locale, region }), [locale, region]);
  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale(): Locale {
  return useContext(LocaleContext).locale;
}

export function useRegion(): UserRegion | null {
  return useContext(LocaleContext).region;
}

/**
 * Hook principal para traducir desde client components.
 *
 *   const t = useT();
 *   <button>{t("chrome.action.cancel")}</button>
 *   <span>{t("chrome.welcome", { name: user.name })}</span>
 */
export function useT(): (
  key: I18nKey,
  params?: Record<string, string | number>,
) => string {
  const { locale } = useContext(LocaleContext);
  return (key, params) => tBase(locale, key, params);
}
