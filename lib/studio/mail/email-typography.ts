import type { MailSignatureLang } from "@/lib/studio/mail-types";

/**
 * Pilas inline para email. Los clientes de correo no resuelven variables CSS
 * ni garantizan webfonts, por eso el orden y los fallbacks viven como texto.
 */
export const EMAIL_FONT_STACK = {
  brand: "Archivo, system-ui, sans-serif",
  brandDisplay: "'Archivo Black', Archivo, system-ui, sans-serif",
  data: "'JetBrains Mono', ui-monospace, monospace",
  cnUi: "'Noto Sans SC', sans-serif",
  cnDocument: "'Noto Serif SC', 'Noto Sans SC', sans-serif",
} as const;

export type EmailTypographyContract = {
  htmlLang: "es" | "en" | "zh-CN";
  bodyFont: string;
  formalChinese: boolean;
};

/**
 * La firma de email es correspondencia formal: cuando su idioma explícito es
 * chino usa Song Ti con Hei Ti como fallback. Español/inglés conservan Archivo.
 */
export function emailTypographyForSignature(
  lang: MailSignatureLang,
): EmailTypographyContract {
  if (lang === "zh") {
    return {
      htmlLang: "zh-CN",
      bodyFont: EMAIL_FONT_STACK.cnDocument,
      formalChinese: true,
    };
  }
  return {
    htmlLang: lang,
    bodyFont: EMAIL_FONT_STACK.brand,
    formalChinese: false,
  };
}
