import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * Content Security Policy — defense-in-depth contra XSS.
 *
 * Decisiones explícitas:
 * - `script-src 'unsafe-inline'`: requerido por el `<script type="application/ld+json">`
 *   inline en `app/layout.tsx`. Para sacar 'unsafe-inline' habría que mover el JSON-LD
 *   a un endpoint o implementar nonces (complejo con SSG/ISR de Next).
 * - `script-src 'unsafe-eval'` SOLO en dev: Next/Turbopack HMR usa eval(). En prod
 *   está bloqueado.
 * - `style-src 'unsafe-inline'`: los `style={{...}}` attributes están en todo el código.
 *   CSP aplica también a atributos style inline, no solo a `<style>` tags.
 * - `img-src https://*.supabase.co`: previsto para cuando Payload sirva media desde
 *   Storage. El sitio público actual no carga imágenes externas.
 * - `connect-src https://*.supabase.co wss://*.supabase.co`: REST + Realtime del
 *   Studio y de las PWAs operario desde el browser client (`lib/db/client.ts` →
 *   `createBrowserClient`). Sin esto, el websocket de Realtime no conecta en prod
 *   (el bridge cross-cliente no actualiza solo). El `ws: wss:` extra es SOLO en dev
 *   (websocket de HMR de Turbopack).
 * - `frame-ancestors 'none'`: bloquea ser iframeado (espejo moderno de X-Frame-Options).
 * - `object-src 'none'`: cero soporte para <object>, <embed>, <applet> (legacy Flash).
 * - `base-uri 'self'`: previene inyección de <base href="evil"> que cambiaría todos
 *   los relative paths a un dominio atacante.
 * - `form-action 'self'`: forms solo pueden POSTear al mismo origen.
 * - Google Analytics (GA4 · gtag.js, `components/Analytics.tsx`): `googletagmanager.com`
 *   en script-src (carga el loader); `*.google-analytics.com` + `*.analytics.google.com`
 *   en connect-src (beacons de eventos) y en img-src (pixel fallback cuando el beacon
 *   no está disponible). Sin esto el CSP bloquea gtag.js en prod.
 * - Google Ads (conversión Click WhatsApp, `AW-561290482`, mismo `Analytics.tsx`):
 *   `googleadservices.com` (pings de conversión + linker), `googleads.g.doubleclick.net`
 *   (remarketing) y `www.google.com` en img-src/connect-src (+ googleadservices en
 *   script-src). Sin esto el CSP bloquea los pings de conversión a Google Ads.
 */
const cspHeader = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.googleadservices.com https://googleads.g.doubleclick.net${isDev ? " 'unsafe-eval'" : ""}`,
  `style-src 'self' 'unsafe-inline'`,
  `font-src 'self' data:`,
  `img-src 'self' data: blob: https://*.supabase.co https://*.google-analytics.com https://www.googletagmanager.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://www.google.com`,
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://www.google.com${isDev ? " ws: wss:" : ""}`,
  `frame-ancestors 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `object-src 'none'`,
].join("; ");

/**
 * CSP permisiva ACOTADA a `/marca/*` — sirve el Brand Book (material de marca
 * interno). El v3.2 embebe sus imágenes en base64 (`window.__DTD_ASSETS`) pero
 * referencia `erp/tokens.css` (servido en `public/marca/erp/`) y carga las fuentes
 * Archivo / Nunito Sans desde Google Fonts (CDN) — por eso `style-src`/`font-src`
 * permiten `fonts.googleapis`/`fonts.gstatic`. `img`/`connect` con `data:`/`blob:`
 * + inline/eval para los assets embebidos. El resto del sitio mantiene la CSP estricta.
 */
const brandBookCspHeader = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline' 'unsafe-eval'`,
  `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
  `font-src 'self' data: blob: https://fonts.gstatic.com`,
  `img-src 'self' data: blob:`,
  `connect-src 'self' data: blob:`,
  `frame-ancestors 'self'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `object-src 'none'`,
].join("; ");

/**
 * Security headers aplicados a TODAS las rutas.
 *
 * Verificar en prod con: https://securityheaders.com/?q=dtdcargo.com
 * Target: grade A o A+.
 */
const securityHeaders = [
  { key: "Content-Security-Policy", value: cspHeader },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), gyroscope=(), magnetometer=(), accelerometer=()",
  },
  // HSTS — los browsers lo ignoran en localhost http, así que es safe dejarlo siempre.
  // 2 años + includeSubDomains + preload = configuración estándar para preload list.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  // Sitio público, optimizado para SEO. App Router por default.
  reactStrictMode: true,
  // Bloquea que el sitio dependa accidentalmente del repo del ERP.
  // Si alguien importa de "hailuway-erp" → error de bundling.
  experimental: {
    serverActions: {
      // El registro del Portal (`/portal/registro`) sube la foto de cédula/RIF
      // por Server Action (RegisterForm → `fd.set("cedula_photo", photo)`). El
      // default de Next es 1 MB: una foto de teléfono (2-5 MB) excede el límite
      // del framework ANTES de que corra la action, y el browser muestra
      // "This page couldn't load" (413/500) en vez del error amable. La action
      // valida hasta 8 MB (PHOTO_MAX_BYTES); 12 MB cubre esos 8 MB + el resto
      // del form con holgura, dejando que el check de 8 MB sí se alcance y
      // devuelva su mensaje amable cuando la foto pasa de 8.
      bodySizeLimit: "12mb",
    },
  },
  // Permite que Supabase Storage sirva imágenes vía next/image.
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  async headers() {
    // El operario PWA (`/m/*`) necesita cámara (scan QR · QrScanner) y
    // geolocalización (GPS camionero · GpsBlock) en same-origin. El resto del
    // sitio queda estricto (allowlist vacío). Como múltiples `Permissions-Policy`
    // se intersectan al valor MÁS restrictivo, el catch-all DEBE excluir `/m`
    // (negative lookahead): si ambos rules matchearan `/m`, ganaría el estricto
    // y la cámara seguiría apagada.
    const ppMobile =
      "camera=(self), microphone=(), geolocation=(self), payment=(), usb=(), gyroscope=(), magnetometer=(), accelerometer=()";
    const baseNoPP = securityHeaders.filter(
      (h) => h.key !== "Permissions-Policy",
    );
    // `/marca/*` sirve el Brand Book v3.1 (HTML autocontenido, material de marca
    // interno): CSP permisiva + framing same-origin (lo enmarca el visor) +
    // noindex, TODO acotado a este prefijo. El catch-all de abajo lo excluye
    // (negative lookahead) para que no le pise estos headers con los estrictos.
    const marcaHeaders = [
      { key: "Content-Security-Policy", value: brandBookCspHeader },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value:
          "camera=(), microphone=(), geolocation=(), payment=(), usb=(), gyroscope=(), magnetometer=(), accelerometer=()",
      },
      {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      },
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
    ];
    // `/norte.html` sirve el Norte visual horneado en el build (SDD-0050 Slice B):
    // HTML estático autocontenido que `/studio/debug` → Norte embebe en un iframe.
    // Misma CSP permisiva acotada que el Brand Book (fuentes Google Fonts + inline/
    // eval para sus scripts vanilla de tabs/tema/filtros) + `frame-ancestors 'self'`
    // (lo enmarca la torre de control) + noindex (artefacto interno). El catch-all de
    // abajo lo excluye (negative lookahead) para no pisarle los headers estrictos.
    const norteHeaders = [
      { key: "Content-Security-Policy", value: brandBookCspHeader },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value:
          "camera=(), microphone=(), geolocation=(), payment=(), usb=(), gyroscope=(), magnetometer=(), accelerometer=()",
      },
      {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      },
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
    ];
    return [
      {
        source: "/m/:path*",
        headers: [...baseNoPP, { key: "Permissions-Policy", value: ppMobile }],
      },
      {
        source: "/marca/:path*",
        headers: marcaHeaders,
      },
      {
        source: "/norte.html",
        headers: norteHeaders,
      },
      {
        source: "/:path((?!m/|marca/|norte\\.html).*)",
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return [
      // SDD-0059 Fase A: `/cotizar` se renombró a `/estimacion` (vocabulario QB:
      // "cotización" se retira). 301 permanente para no perder el SEO ni los
      // links externos al URL viejo.
      {
        source: "/cotizar",
        destination: "/estimacion",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      // Digital Asset Links del TWA operario. Android lo busca en
      // /.well-known/assetlinks.json; lo servimos desde un route handler que
      // lee el fingerprint SHA-256 de env (sin rebuild). Ver
      // app/api/well-known/assetlinks + docs/runbooks/setup-android-apk.md.
      {
        source: "/.well-known/assetlinks.json",
        destination: "/api/well-known/assetlinks",
      },
    ];
  },
};

export default nextConfig;
