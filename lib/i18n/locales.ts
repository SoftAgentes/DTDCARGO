/**
 * lib/i18n/locales.ts · BCP-47 locales soportados por el Studio.
 *
 * El Studio opera oficialmente en 2 locales:
 *   - es-VE  Español (Venezuela)  — default, oficina VE
 *   - zh-CN  Mandarín simplificado — oficina CN (Yiwu, Guangzhou,
 *                                    Shenzhen, Shanghai)
 *
 * REGLA DE PROYECTO: "chino" en este codebase SIEMPRE significa
 * mandarín simplificado (zh-CN). NO cantonés (zh-HK), NO mandarín
 * tradicional (zh-TW). Las oficinas CN están en China continental.
 */

export type Locale = "es-VE" | "zh-CN";

export const SUPPORTED_LOCALES: readonly Locale[] = ["es-VE", "zh-CN"] as const;

export const DEFAULT_LOCALE: Locale = "es-VE";

/** Display label de cada locale en su propio idioma (UI de selección). */
export const LOCALE_NATIVE_LABELS: Record<Locale, string> = {
  "es-VE": "Español (Venezuela)",
  "zh-CN": "中文（简体）",
};

/** Type guard: filtra strings arbitrarios al set válido. */
export function isLocale(value: unknown): value is Locale {
  return value === "es-VE" || value === "zh-CN";
}

/**
 * Parsea un `Accept-Language` header del request y devuelve el primer
 * locale soportado que matchea, o `null` si ninguno calza.
 *
 * Ejemplos:
 *   "zh-CN,zh;q=0.9,en;q=0.8"  → "zh-CN"
 *   "zh-HK,zh;q=0.9"           → "zh-CN" (zh* mappea a zh-CN)
 *   "es-VE,es;q=0.9"           → "es-VE"
 *   "es-AR,es;q=0.9"           → "es-VE" (es* mappea a es-VE)
 *   "en-US,en;q=0.9"           → null
 */
export function parseAcceptLanguage(header: string | null): Locale | null {
  if (!header) return null;
  // Tomamos solo el código de cada item (antes del `;q=`), en orden.
  const tags = header
    .split(",")
    .map((s) => s.trim().split(";")[0]?.toLowerCase() ?? "")
    .filter(Boolean);
  for (const tag of tags) {
    if (tag.startsWith("zh")) return "zh-CN";
    if (tag.startsWith("es")) return "es-VE";
  }
  return null;
}
