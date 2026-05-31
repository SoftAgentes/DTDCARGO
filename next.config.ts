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
 */
const cspHeader = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  `style-src 'self' 'unsafe-inline'`,
  `font-src 'self' data:`,
  `img-src 'self' data: blob: https://*.supabase.co`,
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co${isDev ? " ws: wss:" : ""}`,
  `frame-ancestors 'none'`,
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
    // (placeholder por si más adelante necesitamos turbo opts)
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
    return [
      {
        source: "/m/:path*",
        headers: [...baseNoPP, { key: "Permissions-Policy", value: ppMobile }],
      },
      {
        source: "/:path((?!m/).*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
