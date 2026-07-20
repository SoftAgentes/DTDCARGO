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
 *   (remarketing), `ad.doubleclick.net` (beacon de conversión `ccm/collect` del gtag AW-*)
 *   y `www.google.com` en img-src/connect-src (+ googleadservices en
 *   script-src). Sin esto el CSP bloquea los pings de conversión a Google Ads.
 */
const cspHeader = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.googleadservices.com https://googleads.g.doubleclick.net${isDev ? " 'unsafe-eval'" : ""}`,
  `style-src 'self' 'unsafe-inline'`,
  `font-src 'self' data:`,
  `img-src 'self' data: blob: https://*.supabase.co https://*.google-analytics.com https://www.googletagmanager.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://ad.doubleclick.net https://www.google.com`,
  // `media-src` para <audio>/<video>: `blob:` = preview de la grabación de Bitácora
  // (URL.createObjectURL) · `https://*.supabase.co` = playback del audio firmado
  // (signed URL del bucket). Sin esta línea heredarían `default-src 'self'` y ambos
  // se bloquearían en silencio (SDD-0146 Fase 3). Aplica también a /m (mismo cspHeader).
  `media-src 'self' blob: https://*.supabase.co`,
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://ad.doubleclick.net https://www.google.com${isDev ? " ws: wss:" : ""}`,
  `frame-ancestors 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `object-src 'none'`,
].join("; ");

/**
 * CSP permisiva ACOTADA a `/marca/*` — sirve el Brand Book vigente (material de
 * marca interno). El standalone embebe sus assets en base64 y carga las fuentes
 * desde Google Fonts (CDN) — por eso `style-src`/`font-src` permiten
 * `fonts.googleapis`/`fonts.gstatic`. `img`/`connect` con `data:`/`blob:`
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

// `/calculadora/embed` la enmarca el FAB del portal (ventana flotante Norte) en
// un iframe SAME-ORIGIN. Igual que /marca y /norte.html: framing SAMEORIGIN,
// resto estricto. Sin esto heredaría el `frame-ancestors 'none'` + `X-Frame-Options:
// DENY` del catch-all y el iframe saldría en blanco.
const calcEmbedHeaders = securityHeaders.map((h) =>
  h.key === "Content-Security-Policy"
    ? {
        key: h.key,
        value: cspHeader.replace(
          "frame-ancestors 'none'",
          "frame-ancestors 'self'",
        ),
      }
    : h.key === "X-Frame-Options"
      ? { key: h.key, value: "SAMEORIGIN" }
      : h,
);

const nextConfig: NextConfig = {
  // Sitio público, optimizado para SEO. App Router por default.
  reactStrictMode: true,
  // Bloquea que el sitio dependa accidentalmente del repo del ERP.
  // Si alguien importa de "hailuway-erp" → error de bundling.
  experimental: {
    serverActions: {
      // El registro del cliente (`/registro`, unificado en SDD-0061 B2.5) sube la
      // foto de cédula/RIF por Server Action (RegisterForm → `fd.set("cedula_photo", photo)`).
      // bodySizeLimit es global (no por-ruta), así que cubre /registro igual. El
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
  // El route handler de descargas del hub de marca (`/interno/marca/d/[bundle]`)
  // arma zips leyendo archivos de disco; en prod el tracer no los incluye solo —
  // hay que declararlos para que viajen en el bundle de la función.
  outputFileTracingIncludes: {
    "/interno/marca/d/[bundle]": [
      "./public/brand/**",
      "./private/marca/**",
      "./docs/marketing/whatsapp-business.md",
    ],
    // Visor autenticado del Brand Book + herramientas: los HTML se movieron a
    // `private/marca/` (fuera de `public/`) y se sirven por fs.read en esta ruta;
    // hay que trazarlos para que viajen en el bundle de la función en prod.
    "/marca/asset/[name]": ["./private/marca/**"],
    // Reportes de Bitácora (SDD-0146 · Fase 7): el acta/tareas embeben el isólogo
    // como data-URI leído de `public/brand/` por fs → trazarlo para prod (si el
    // fs falla, el reporte degrada al wordmark de texto, sin romper).
    "/api/studio/bitacora/export": ["./public/brand/**"],
    // Documentos de Marketing en el Studio (SDD-0158): el lector lee los `.md`
    // de docs/marketing por fs en runtime → deben viajar en el bundle en prod.
    "/studio/marketing/docs": ["./docs/marketing/**/*.md"],
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
    // Bitácora graba audio (SDD-0146 Fase 3): microphone=(self) SOLO en sus dos
    // superficies. Móvil = ppMobile + micrófono (mantiene cámara/GPS por si acaso);
    // desktop = estricto + solo micrófono. Los operarios PIN (/m/cn · /m/ve) NO
    // graban → siguen con ppMobile (micrófono apagado).
    //
    // GOTCHA (ya vivido con QR/GPS en /m): varios `Permissions-Policy` que matchean
    // la misma URL se INTERSECTAN al valor MÁS restrictivo. Por eso cada regla mic
    // debe quedar SOLA para su URL: `/studio/bitacora` se excluye del catch-all, y
    // `/m/erp/bitacora` se excluye del `/m/:path*` de abajo (si no, el micrófono se
    // anula en silencio).
    const ppMobileBitacora =
      "camera=(self), microphone=(self), geolocation=(self), payment=(), usb=(), gyroscope=(), magnetometer=(), accelerometer=()";
    const ppStudioBitacora =
      "camera=(), microphone=(self), geolocation=(), payment=(), usb=(), gyroscope=(), magnetometer=(), accelerometer=()";
    const baseNoPP = securityHeaders.filter(
      (h) => h.key !== "Permissions-Policy",
    );
    // `/marca/*` sirve el Brand Book vigente (HTML autocontenido, material de
    // marca interno): CSP permisiva + framing same-origin (lo enmarca el visor) +
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
      // Bitácora móvil (staff): micrófono habilitado. Va ANTES de `/m/:path*` y ese
      // rule lo excluye (negative lookahead) para que no le intersecte mic=().
      {
        source: "/m/erp/bitacora/:path*",
        headers: [
          ...baseNoPP,
          { key: "Permissions-Policy", value: ppMobileBitacora },
        ],
      },
      // Resto de la PWA móvil (operarios PIN incluidos): cámara+GPS, micrófono OFF.
      // Excluye `erp/bitacora` (lo cubre la regla de arriba con micrófono). `/m/cn`
      // y `/m/ve` (QR + GPS) NO empiezan con `erp/bitacora` → siguen con ppMobile.
      {
        source: "/m/:path((?!erp/bitacora).*)",
        headers: [...baseNoPP, { key: "Permissions-Policy", value: ppMobile }],
      },
      // Bitácora desktop: estricto + micrófono. Se excluye del catch-all de abajo.
      {
        source: "/studio/bitacora/:path*",
        headers: [
          ...baseNoPP,
          { key: "Permissions-Policy", value: ppStudioBitacora },
        ],
      },
      {
        source: "/marca/:path*",
        headers: marcaHeaders,
      },
      {
        source: "/norte.html",
        headers: norteHeaders,
      },
      // Calc embebible del portal: SAMEORIGIN (la enmarca el FAB). Excluida del
      // catch-all de abajo (negative lookahead) para no pisarle el DENY.
      // Fase 3: la calc FCL embebible vive en /fcl/embed.
      {
        source: "/fcl/embed/:path*",
        headers: calcEmbedHeaders,
      },
      {
        source: "/fcl/embed",
        headers: calcEmbedHeaders,
      },
      {
        source:
          "/:path((?!m/|marca/|norte\\.html|studio/bitacora|fcl/embed).*)",
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return [
      // Red de seguridad del 301 de dominio doortudoor.com → dtdcargo.com.
      // El 301 REAL vive en el DNS/hosting externo (Hostinger) — pero ya se
      // cayó una vez (clientHold, ver memoria project_dominio_clienthold).
      // Estos redirects host-based son INERTES mientras el externo funcione;
      // si algún día doortudoor.com se apunta a este deployment de Vercel, el
      // 301 path-preserving sigue vivo desde código. Regla SEO #1: nunca
      // quitar este redirect (docs/marketing/seo.md).
      {
        source: "/:path*",
        has: [{ type: "host", value: "doortudoor.com" }],
        destination: "https://dtdcargo.com/:path*",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.doortudoor.com" }],
        destination: "https://dtdcargo.com/:path*",
        permanent: true,
      },
      // El kit de marca dejó de ser público: la marca ahora vive en la zona
      // interna gateada `/interno/marca` (login del ERP). El `/brand` viejo
      // (indexado) redirige al home para no dejar un 404 a quien lo tenga
      // guardado. Los PNG estáticos en `public/brand/*` siguen sirviéndose
      // (el sitio los usa en nav/footer/og/favicon) — el redirect es exacto a
      // `/brand`, no afecta `/brand/<archivo>.png`.
      {
        source: "/brand",
        destination: "/",
        permanent: true,
      },
      // Fase 3: la calculadora pública quedó FCL-only en `/fcl` (el CBM/LCL se
      // retiró del sitio · rediseño aparte). Las rutas viejas de calc/cotización
      // (LCL, FCL, flete SeaRates, estimación, el `/cotizar` histórico y el
      // efímero `/tarifas`) hacen 301 permanente a `/fcl` — se conserva su SEO y
      // no se dejan 404 a links externos/guardados.
      { source: "/cotizar", destination: "/fcl", permanent: true },
      { source: "/estimacion", destination: "/fcl", permanent: true },
      { source: "/calculadora", destination: "/fcl", permanent: true },
      { source: "/calculadora-fcl", destination: "/fcl", permanent: true },
      { source: "/cotizador-flete", destination: "/fcl", permanent: true },
      { source: "/tarifas", destination: "/fcl", permanent: true },
      // La calc embebible del portal se movió: viejo iframe → nuevo embed.
      { source: "/calculadora/embed", destination: "/fcl/embed", permanent: true },
      { source: "/tarifas/embed", destination: "/fcl/embed", permanent: true },
      // Migración de dominio doortudoor.com → dtdcargo.com (Search Console
      // "Cambio de dirección" activo, 2026-06-07). El 301 del dominio viejo es
      // path-preserving, pero estas páginas del sitio VIEJO no tienen slug
      // equivalente en el nuevo → caían en 404 tras el redirect, perdiendo su
      // equity SEO. Las mapeamos a la página nueva más relevante (verificadas
      // 200 + orígenes 404). Datos: reporte Rendimiento de la propiedad
      // doortudoor.com (impresiones 3 meses entre paréntesis).
      {
        // Artículo "cómo calcular CBM" — la de más equity (397 impresiones).
        // Fase 3: apunta directo a /fcl (evita la cadena vía /calculadora).
        source: "/como-calcular-metro-cubico-cbm-de-la-mercancia",
        destination: "/fcl",
        permanent: true,
      },
      // `/nosotros` se reclamó: ahora es la página real "Sobre Nosotros"
      // (app/nosotros/page.tsx). Ya no redirige al home — recupera su SEO propio.
      {
        // Definición incoterm CIF → glosario (18 impresiones).
        source: "/significado-del-incoterm-cif",
        destination: "/glosario",
        permanent: true,
      },
      {
        // "Mi cuenta" del sitio viejo → portal del cliente (15 impresiones).
        source: "/mi-cuenta",
        destination: "/portal",
        permanent: true,
      },
      {
        // "Qué es un envío puerta a puerta" (definicional) → glosario (12 impr).
        source: "/que-es-un-envio-puerta-a-puerta",
        destination: "/glosario",
        permanent: true,
      },
      {
        // Definición incoterm EXW → glosario (10 impresiones).
        source: "/icoterm-exw",
        destination: "/glosario",
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
