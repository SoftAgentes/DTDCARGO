import "server-only";

/**
 * lib/i18n/resolve-server.ts · Resolver del locale activo · server-only.
 *
 * Prioridad de resolución (server-side, una vez por request):
 *
 *   1. searchParams.get('lang')             → override URL temporal
 *                                              'cn' → 'zh-CN'
 *                                              'es' → 'es-VE'
 *   2. user_profiles.locale (si != null)    → override avanzado por user
 *                                              (uso casi nulo — solo casos
 *                                               raros tipo admin VE que
 *                                               quiere ver el Studio en CN)
 *   3. localeForRegion(user_tenants.region) → derivación normal de la oficina
 *   4. Accept-Language header               → fallback para sesión anónima
 *                                              o user sin region asignada
 *   5. DEFAULT_LOCALE (es-VE)               → último recurso
 *
 * El resolver se llama UNA vez desde `app/studio/(app)/layout.tsx` y el
 * resultado se propaga vía LocaleProvider al árbol cliente.
 *
 * Ver plan sección A.3.
 */

import { headers } from "next/headers";
import {
  DEFAULT_LOCALE,
  isLocale,
  parseAcceptLanguage,
  type Locale,
} from "./locales";
import { isUserRegion, localeForRegion, type UserRegion } from "./region";

export interface ResolveLocaleInput {
  /** Valor del query param `?lang=cn|es` (raw). */
  urlLangParam?: string | null;
  /** Valor persistido en `user_profiles.locale`. NULL si el user no lo seteó. */
  userProfileLocale?: string | null;
  /** Valor persistido en `user_tenants.region`. NULL si no hay sesión / no se resolvió. */
  userTenantRegion?: UserRegion | string | null;
}

export interface ResolveLocaleResult {
  locale: Locale;
  /** Region efectiva del user (puede ser null para sesión anónima). */
  region: UserRegion | null;
  /** De dónde salió el locale ganador — útil para debug y telemetría. */
  source: "url" | "user_profile" | "region" | "accept_language" | "default";
}

/** Mapea aliases corto del URL ("cn" / "es") al BCP-47 completo. */
function normalizeUrlLang(value: string | null | undefined): Locale | null {
  if (!value) return null;
  const v = value.toLowerCase().trim();
  if (v === "cn" || v === "zh" || v === "zh-cn") return "zh-CN";
  if (v === "es" || v === "es-ve") return "es-VE";
  return null;
}

export async function resolveLocale(
  input: ResolveLocaleInput,
): Promise<ResolveLocaleResult> {
  // 1. URL override
  const urlLocale = normalizeUrlLang(input.urlLangParam);
  if (urlLocale) {
    return {
      locale: urlLocale,
      region: isUserRegion(input.userTenantRegion)
        ? (input.userTenantRegion as UserRegion)
        : null,
      source: "url",
    };
  }

  // 2. user_profiles.locale override avanzado
  if (isLocale(input.userProfileLocale)) {
    return {
      locale: input.userProfileLocale,
      region: isUserRegion(input.userTenantRegion)
        ? (input.userTenantRegion as UserRegion)
        : null,
      source: "user_profile",
    };
  }

  // 3. derivado de user_tenants.region
  if (isUserRegion(input.userTenantRegion)) {
    const region = input.userTenantRegion as UserRegion;
    return {
      locale: localeForRegion(region),
      region,
      source: "region",
    };
  }

  // 4. Accept-Language fallback (sesión anónima, user sin region)
  const h = await headers();
  const acceptLang = h.get("accept-language");
  const parsed = parseAcceptLanguage(acceptLang);
  if (parsed) {
    return {
      locale: parsed,
      region: null,
      source: "accept_language",
    };
  }

  // 5. default duro
  return {
    locale: DEFAULT_LOCALE,
    region: null,
    source: "default",
  };
}
