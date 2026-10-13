import localFont from "next/font/local";

/**
 * Fuentes de la marca, servidas DESDE EL REPOSITORIO (tipografía SDD-0505, 2026-10-13).
 *
 * Decisión de Sam (2026-10-13): el sitio usa solo **Archivo** (con su corte
 * Black para el logotipo y los títulos) y **JetBrains Mono** para los códigos.
 * Salieron Sora y Nunito Sans (Studio/Portal, BD-035) y Noto Sans SC / Noto
 * Serif SC (chino, BD-036): el chino usa la fuente del sistema del dispositivo.
 *
 * Por qué locales y no `next/font/google`: `next build` bajaba cada fuente de
 * Google en el momento del build y ese día falló 5 veces entre GitHub y Vercel
 * («next/font/google queries have exactly one entry»), justo antes del corte al
 * servidor propio. Con los woff2 en `lib/font-files/` el build no sale a la red.
 * Una prueba (`__tests__/fuentes-locales.test.ts`) impide que vuelva a entrar
 * `next/font/google`.
 *
 * Los archivos son el subconjunto «latin» de Google Fonts (U+0000-00FF y
 * signos comunes: cubre todo el español). Archivo y JetBrains Mono son fuentes
 * variables: un solo archivo trae todos los pesos. Licencia SIL OFL 1.1 (va en
 * los metadatos de cada fuente); origen y huellas en `lib/font-files/README.md`.
 *
 * Los NOMBRES de variable no cambian (`--font-archivo`, `--font-archivo-black`,
 * `--font-mono`, `--font-jetbrains-mono`): el CSS que ya las consume sigue igual.
 */

/** Archivo variable (100-900): todo el texto de la web, Studio y Portal. */
export const archivo = localFont({
  src: "./font-files/archivo-latin-wght.woff2",
  weight: "100 900",
  style: "normal",
  variable: "--font-archivo",
  display: "swap",
  fallback: ["system-ui", "-apple-system", "Segoe UI", "Arial", "sans-serif"],
});

/** Archivo Black (400, se ve como 900): logotipo, H1/H2 grandes, KPIs. */
export const archivoBlack = localFont({
  src: "./font-files/archivo-black-latin-400.woff2",
  weight: "400",
  style: "normal",
  variable: "--font-archivo-black",
  display: "swap",
  fallback: ["Arial Black", "Archivo", "system-ui", "sans-serif"],
});

/**
 * JetBrains Mono — sitio público (`--font-mono`): valores copiables con énfasis
 * vía FONT_MONO (lib/design-tokens). Hoy: home, /servicios, /calculadora, /faq
 * y /contacto montan `jetbrainsMono.variable` en su wrapper.
 *
 * Es variable (100-800): las dos instancias de abajo comparten el mismo archivo,
 * así que ya no hay riesgo de faux-bold por pesos que una instancia no cargara.
 * Se conservan las dos variables para no renombrar ~90 consumidores.
 */
export const jetbrainsMono = localFont({
  src: "./font-files/jetbrains-mono-latin-wght.woff2",
  weight: "100 800",
  style: "normal",
  variable: "--font-mono",
  display: "swap",
  fallback: ["ui-monospace", "SF Mono", "Consolas", "Menlo", "monospace"],
});

/**
 * JetBrains Mono — superficies de cuenta (`--font-jetbrains-mono`): /registro,
 * /portal (layout autenticado) e /interno/marca, que la consumen en estilos
 * inline (Shipping Mark, tracking, RIF, hex de la paleta).
 */
export const jetbrainsMonoUi = localFont({
  src: "./font-files/jetbrains-mono-latin-wght.woff2",
  weight: "100 800",
  style: "normal",
  variable: "--font-jetbrains-mono",
  display: "swap",
  fallback: ["ui-monospace", "SF Mono", "Consolas", "Menlo", "monospace"],
});
