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

/**
 * JetBrains Mono — instancia ÚNICA para las superficies de cuenta:
 * /registro, /portal (layout autenticado) e /interno/marca, que consumen
 * `var(--font-jetbrains-mono)` en estilos inline (MARKBOX, tracking, RIF,
 * hex de la paleta).
 *
 * ¿Por qué DOS variables y no una?
 * - `--font-mono` (arriba) = sitio público, weights 500/600/700: valores
 *   copiables con énfasis vía FONT_MONO (lib/design-tokens).
 * - `--font-jetbrains-mono` (esta) = portal/registro/interno, weights
 *   400/500/700: sus estilos inline dependen del 400 como peso por defecto,
 *   que la instancia pública no carga.
 * Unificarlas obligaría a cargar los 4 weights (4 woff2) en TODAS las
 * superficies y a renombrar la variable en ~30 archivos consumidores, sin
 * ganancia real: el riesgo de faux-bold era la MISMA variable redefinida con
 * configs distintas, y eso se elimina con una sola definición por variable —
 * exactamente lo que garantiza este archivo. Si un consumidor nuevo necesita
 * el peso que le falta a su clúster, se agrega acá (una sola config).
 */
export const jetbrainsMonoUi = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});
