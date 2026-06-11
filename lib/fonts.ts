import { JetBrains_Mono } from "next/font/google";

/**
 * JetBrains Mono (mono de marca) — instancia ÚNICA para el sitio público.
 *
 * Las páginas que muestran valores copiables (Shipping Mark, teléfonos,
 * códigos postales, emails) montan `jetbrainsMono.variable` en su wrapper y
 * los componentes la consumen vía FONT_MONO (lib/design-tokens). Hoy:
 * /calculadora, /faq y /contacto.
 *
 * Va acá y NO inline en cada page.tsx: si una página redefiniera
 * JetBrains_Mono con otros weights, su `--font-mono` resolvería a un
 * font-face sin los pesos que FONT_MONO asume (500/600/700) y el navegador
 * renderizaría faux-bold sin avisar. Una sola definición = una sola config.
 */
export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-mono",
  display: "swap",
});
