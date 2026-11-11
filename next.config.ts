import type { NextConfig } from "next";
// Import RELATIVO a propósito: el loader de `next.config.ts` corre antes del
// bundler y no resuelve el alias `@/`.
import { originFromEnv } from "./lib/runtime/supabase-origin";
import { chatwootOriginFromEnv } from "./lib/runtime/chatwoot-origin";

const isDev = process.env.NODE_ENV === "development";

/**
 * Supabase propio (SDD-0505). Si `NEXT_PUBLIC_SUPABASE_URL` apunta a un host que
 * no es `*.supabase.co` (self-hosted en el dominio propio, o `http://api-gw:8000`
 * en una prueba local), ese origen entra en la CSP (https para REST/Storage y
 * ws(s) para Realtime) y en `images.remotePatterns`. `*.supabase.co` se conserva
 * siempre: los builds de Vercel contra Cloud no cambian. Con la URL vacía o
 * inválida `originFromEnv` devuelve null y no se añade nada.
 */
const ownSupabase = (() => {
  const origin = originFromEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
  return origin && !origin.isSupabaseCloud ? origin : null;
})();
/** Fuentes http(s) de Supabase para `img-src` y `media-src`. */
const supabaseHttpSrc = `https://*.supabase.co${ownSupabase ? ` ${ownSupabase.origin}` : ""}`;
/** Lo mismo más el websocket de Realtime, para `connect-src`. */
const supabaseConnectSrc = `https://*.supabase.co wss://*.supabase.co${
  ownSupabase ? ` ${ownSupabase.origin} ${ownSupabase.wsOrigin}` : ""
}`;

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
 * - Supabase propio (SDD-0505): cuando `NEXT_PUBLIC_SUPABASE_URL` no es Cloud, su
 *   origen se suma a `img-src`/`media-src`/`connect-src` (+ `ws(s)://`) vía
 *   `supabaseHttpSrc`/`supabaseConnectSrc`, sin quitar `*.supabase.co`.
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
  `img-src 'self' data: blob: ${supabaseHttpSrc} https://*.google-analytics.com https://www.googletagmanager.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://ad.doubleclick.net https://www.google.com`,
  // `media-src` para <audio>/<video>: `blob:` = preview de la grabación de Bitácora
  // (URL.createObjectURL) · `https://*.supabase.co` = playback del audio firmado
  // (signed URL del bucket). Sin esta línea heredarían `default-src 'self'` y ambos
  // se bloquearían en silencio (SDD-0146 Fase 3). Aplica también a /m (mismo cspHeader).
  `media-src 'self' blob: ${supabaseHttpSrc}`,
  `connect-src 'self' ${supabaseConnectSrc} https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://ad.doubleclick.net https://www.google.com${isDev ? " ws: wss:" : ""}`,
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
 * Los CDN que cargan los documentos de Cloud Design, y por qué hay que nombrarlos.
 *
 * NO ES UNA CONCESIÓN ESTÉTICA: sin esto, 14 de los 35 documentos publicados
 * están rotos en producción y cinco **abren en blanco**. Medido el 2026-08-11
 * bajando los 35 de Storage y leyendo sus `<script src>`:
 *
 *  · `unpkg.com` — React + ReactDOM + Babel standalone. `Iconos de Perfil` (los
 *    avatares de WhatsApp de cada rol), `WeChat · Perfil`, `Ciclo DTD` y
 *    `Uniformes` MONTAN su contenido con React. Bloqueado el script, el
 *    contenedor queda vacío: se reportó como "no están las imágenes", y era
 *    exacto — no es que la imagen falle, es que la página nunca se pinta.
 *  · `cdnjs.cloudflare.com` / `cdn.jsdelivr.net` — html2canvas, JSZip y demás.
 *    Son los que arman las descargas. Sin ellos el documento SE VE pero el botón
 *    "Descargar PNG" no hace nada: el segundo síntoma que se reportó.
 *
 * ⚠️ QUÉ CUESTA, sin maquillaje: estos tres hosts pasan a poder ejecutar script
 * en nuestro origen dentro de `/marca/doc/*`. La superficie ya era ancha —esta
 * CSP concede `unsafe-inline` y `unsafe-eval` a HTML que no escribimos
 * nosotros—, así que el delta es "el HTML de Cloud Design puede todo" → "…y
 * además tres CDN". No es gratis y NO se debe extender: va sólo en el visor de
 * documentos; el catálogo, que sí es código nuestro, sigue con la CSP estricta.
 * Autorizado por el founder el 2026-08-11.
 *
 * Se listan hosts EXACTOS y no comodines a propósito: `https:` a secas habría
 * arreglado lo mismo abriendo el origen a internet entero.
 *
 * La alternativa —bajar las librerías y reescribir los `<script src>` al subir—
 * se descartó: todo este sistema se apoya en NO reescribir un solo atributo, que
 * es lo que lo hace sobrevivir al próximo NORTE-SYNC sin un parche que
 * mantener. Ver la cabecera de `app/marca/doc/[...ruta]/route.ts`.
 */
const CDN_DOCUMENTOS =
  "https://unpkg.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com";

/**
 * CSP del VISOR de documentos (`/marca/doc/*`): la permisiva de arriba + los CDN.
 *
 * `connect-src` va incluido además de `script-src` porque varias de esas
 * librerías se traen sus propios recursos por `fetch` una vez cargadas (los
 * chunks de Babel, lo que html2canvas resuelve). Sin él el script arranca y
 * muere a la mitad — se ve igual de roto pero cuesta mucho más encontrarlo.
 */
const brandDocCspHeader = brandBookCspHeader
  .replace(
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${CDN_DOCUMENTOS}`,
  )
  .replace(
    "connect-src 'self' data: blob:",
    `connect-src 'self' data: blob: ${CDN_DOCUMENTOS}`,
  );

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

// Los embeds de calculadora (`/tarifas/embed` = CBM/LCL, `/fcl/embed` = FCL) los
// enmarca el FAB del portal (ventana flotante Norte) en un iframe SAME-ORIGIN.
// Igual que /marca y /norte.html: framing SAMEORIGIN, resto estricto. Sin esto
// heredarían el `frame-ancestors 'none'` + `X-Frame-Options: DENY` del catch-all
// y el iframe saldría en blanco.
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
  /**
   * Carpeta de salida. Por defecto `.next` — lo que usan `pnpm dev`, `pnpm build`
   * y Vercel, que NO define esta variable.
   *
   * El paso `build` de `scripts/verify.mjs` la apunta a otro lado (SDD-0280).
   * Motivo: `next build` y `next dev` comparten `.next`, y un residuo ahí ya
   * costó un gate rojo falso —typecheck reventando con TS2307 contra
   * `.next/dev/types/` de un dev server viejo (SDD-0277)—. Construir en una
   * carpeta aparte deja intacto el `.next` del dev y no envenena la corrida
   * siguiente.
   */
  distDir: process.env.VERIFY_DIST_DIR || ".next",
  /**
   * Salida `standalone` SOLO para la imagen Docker (SDD-0505). El `Dockerfile`
   * fija `DTD_STANDALONE=1` y copia `.next/standalone` + `.next/static` +
   * `public/` al runner, que arranca con `node server.js` sin `node_modules`
   * completos. Vercel, `pnpm build` local y `scripts/check-build.mjs` no
   * definen la variable y conservan la salida de siempre: un `output` fijo
   * cambiaría lo que Vercel despliega y lo que el gate construye.
   */
  output: process.env.DTD_STANDALONE === "1" ? "standalone" : undefined,
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
      // Storage del Supabase propio (SDD-0505). `port` va explícito: `""` es el
      // puerto por defecto, y así el patrón queda tan estrecho como el de Cloud.
      ...(ownSupabase
        ? [
            {
              protocol: ownSupabase.protocol,
              hostname: ownSupabase.hostname,
              port: ownSupabase.port,
              pathname: "/storage/v1/object/public/**",
            },
          ]
        : []),
    ],
  },
  // El route handler de descargas del hub de marca (`/interno/marca/d/[bundle]`)
  // arma zips leyendo archivos de disco; en prod el tracer no los incluye solo —
  // hay que declararlos para que viajen en el bundle de la función.
  outputFileTracingIncludes: {
    "/interno/marca/d/[bundle]": [
      "./public/brand/**",
      "./private/marca/herramientas/**",
      "./docs/marketing/whatsapp-business.md",
    ],
    // Herramientas de WhatsApp: se sirven por fs.read desde
    // `private/marca/herramientas/`, así que hay que trazarlas para que viajen
    // en el bundle de la función en prod.
    //
    // Antes esto decía `./private/marca/**`, que arrastraba los 14 MB del Brand
    // Book a DOS bundles de función. El book salió de git a Storage
    // (founder 2026-08-02) y esta ruta lo lee del bucket, no del disco.
    "/marca/asset/[name]": ["./private/marca/herramientas/**"],
    // Reportes de Bitácora (SDD-0146 · Fase 7): el acta/tareas embeben el isólogo
    // como data-URI leído de `public/brand/` por fs → trazarlo para prod (si el
    // fs falla, el reporte degrada al wordmark de texto, sin romper).
    "/api/studio/bitacora/export": ["./public/brand/**"],
    // Packing list pre-llenado del proveedor (SDD-0602): el GET lee la plantilla
    // de `public/templates/` por fs → trazarla para prod.
    "/p/[token]/packlist": ["./public/templates/dtd-packing-list-invoice.xlsx"],
    // Documentos de Marketing en el Studio (SDD-0158): el lector lee los `.md`
    // de docs/marketing por fs en runtime → deben viajar en el bundle en prod.
    "/studio/marketing/docs": ["./docs/marketing/**/*.md"],
    // «Analizar con IA» de Actualizaciones (SDD-0588, paso 3.4) lee la superficie
    // propia de DTD por fs (lib/studio/chatwoot/analisis-superficie.ts). Solo esas
    // carpetas, sin subcarpetas: nunca `.env*`, `secretos/` ni `pruebas/`.
    "/studio/admin/actualizaciones": [
      "./infra/chatwoot/rails/*.rb",
      "./infra/chatwoot/compose.yml",
      "./infra/chatwoot/panel/*.html",
      "./lib/studio/chatwoot/*.ts",
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
    // Bandeja de Chatwoot (SDD-0585, E2-D2/E2-D14): el panel va en un iframe de
    // `chat.dtdcargo.com` y graba notas de voz. Hacen falta las DOS cosas: la
    // CSP con `frame-src` del chat (sin ella el marco cae a `default-src 'self'`)
    // y el micrófono delegado al origen del chat (con `microphone=()` el iframe
    // recibe NotAllowedError aunque lleve `allow="microphone"`). Medido en la
    // PoC 2.1 (I3, M2, M3). Mismo gotcha que Bitácora: la regla queda SOLA para
    // su URL y el catch-all la excluye.
    const chatwootOrigin = chatwootOriginFromEnv();
    const ppStudioBandeja = `camera=(), microphone=(self "${chatwootOrigin}"), geolocation=(), payment=(), usb=(), gyroscope=(), magnetometer=(), accelerometer=()`;
    const bandejaHeaders = securityHeaders.map((h) =>
      h.key === "Content-Security-Policy"
        ? { key: h.key, value: `${cspHeader}; frame-src ${chatwootOrigin}` }
        : h.key === "Permissions-Policy"
          ? { key: h.key, value: ppStudioBandeja }
          : h,
    );
    // Ficha DTD (SDD-0585, paso 2.4, E2-D28): la Dashboard App que Chatwoot
    // enmarca al lado de cada conversación. SOLO el chat puede enmarcarla:
    // `frame-ancestors <chat>` y sin `X-Frame-Options` (no sabe nombrar un
    // origen; con DENY el navegador la bloquearía). El resto, la CSP estricta.
    const fichaChatHeaders = securityHeaders
      .filter((h) => h.key !== "X-Frame-Options")
      .map((h) =>
        h.key === "Content-Security-Policy"
          ? { key: h.key, value: cspHeader.replace("frame-ancestors 'none'", `frame-ancestors ${chatwootOrigin}`) }
          : h,
      );
    // Salida de Studio (SDD-0585, paso 2.7, E2-D13): `/studio/cerrar-chat` abre
    // el chat en un marco oculto para cerrar su sesión. Solo suma `frame-src`
    // del chat; Studio sigue sin dejarse enmarcar y sin micrófono.
    const cerrarChatHeaders = securityHeaders.map((h) =>
      h.key === "Content-Security-Policy" ? { key: h.key, value: `${cspHeader}; frame-src ${chatwootOrigin}` } : h,
    );
    const baseNoPP = securityHeaders.filter(
      (h) => h.key !== "Permissions-Policy",
    );
    // `/marca/asset/*` sirve el Brand Book standalone (HTML autocontenido con
    // todo en base64 + Google Fonts): CSP permisiva + framing same-origin (lo
    // enmarcan el catálogo y el visor) + noindex.
    //
    // SDD-0238: esto ANTES cubría todo `/marca/*`. Cuando `/marca` pasó a ser
    // una página nuestra (el catálogo con código de acceso), dejarla bajo la CSP
    // permisiva le habría regalado `unsafe-eval` y `unsafe-inline` sin
    // necesitarlos. La permisiva quedó acotada al standalone, que es el único que
    // no controlamos; el catálogo y el visor van con la CSP estricta del sitio.
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
    // El resto de `/marca/*` (el catálogo y el visor) es código nuestro: CSP
    // ESTRICTA del sitio + noindex. La miniatura de cada archivo carga desde
    // `*.supabase.co` (URL firmada tras el redirect de /api/marca/download), que
    // el `img-src` estricto ya permite.
    const marcaStrictHeaders = [
      ...securityHeaders,
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
      // Bandeja de Chatwoot: CSP con frame-src del chat + micrófono delegado.
      // Se excluye del catch-all de abajo.
      {
        source: "/studio/bandeja/:path*",
        headers: bandejaHeaders,
      },
      // Ficha DTD: solo la ruta exacta, sin subrutas. Se excluye del catch-all.
      {
        source: "/studio/ficha-chat",
        headers: fichaChatHeaders,
      },
      // Salida de Studio: solo la ruta exacta. Se excluye del catch-all.
      {
        source: "/studio/cerrar-chat",
        headers: cerrarChatHeaders,
      },
      // Las CUATRO reglas de `/marca` son MUTUAMENTE EXCLUYENTES a propósito: si
      // dos matchearan, Next emite dos `Content-Security-Policy` y el navegador
      // aplica la intersección — el standalone quedaría bloqueado por la estricta.
      {
        source: "/marca/asset/:path*",
        headers: marcaHeaders,
      },
      // `/marca/doc/*` sirve el SISTEMA navegable: los mismos documentos de Cloud
      // Design que el standalone, sólo que sueltos en vez de embebidos en uno. Va
      // con la permisiva por la misma razón — scripts inline, `data:` y Google
      // Fonts que no controlamos. Bajo la estricta el visor abre en blanco, que es
      // exactamente el fallo que costó tres verdes falsos en esta misma spec.
      //
      // Y va con la permisiva MÁS los CDN (`brandDocCspHeader`), que es lo único
      // que lo distingue del standalone de `/marca/asset/*`: aquel embebe todo en
      // base64 y no pide nada de afuera; estos documentos sueltos cargan React y
      // html2canvas de unpkg/cdnjs/jsdelivr. Ver `CDN_DOCUMENTOS` arriba — con la
      // lista corta, 14 de 35 documentos estaban rotos en producción.
      {
        source: "/marca/doc/:path*",
        headers: marcaHeaders.map((h) =>
          h.key === "Content-Security-Policy"
            ? { key: h.key, value: brandDocCspHeader }
            : h,
        ),
      },
      {
        source: "/marca/:path((?!asset|doc).*)",
        headers: marcaStrictHeaders,
      },
      {
        source: "/marca",
        headers: marcaStrictHeaders,
      },
      {
        source: "/norte.html",
        headers: norteHeaders,
      },
      // Calcs embebibles del portal: SAMEORIGIN (las enmarca el FAB). Excluidas
      // del catch-all de abajo (negative lookahead) para no pisarles el DENY.
      // `/tarifas/embed` = calculadora CBM/LCL (la del producto principal, la
      // que muestra el FAB) · `/fcl/embed` = cotizador de contenedor completo.
      {
        source: "/tarifas/embed/:path*",
        headers: calcEmbedHeaders,
      },
      {
        source: "/tarifas/embed",
        headers: calcEmbedHeaders,
      },
      {
        source: "/fcl/embed/:path*",
        headers: calcEmbedHeaders,
      },
      {
        source: "/fcl/embed",
        headers: calcEmbedHeaders,
      },
      {
        // `marca` sin barra: cubre tanto `/marca` (el catálogo) como `/marca/…`.
        // Con `marca/` la raíz caía acá Y en su regla propia → CSP duplicada.
        source:
          "/:path((?!m/|marca|norte\\.html|studio/bitacora|studio/bandeja(?:/|$)|studio/ficha-chat$|studio/cerrar-chat$|tarifas/embed|fcl/embed).*)",
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
      // Calculadoras públicas: la del PRODUCTO PRINCIPAL (CBM/LCL, 2 pestañas:
      // Puerta a Puerta + Consolidado) vive en `/tarifas`; la de contenedor
      // completo (SeaRates) vive en `/fcl`. Las rutas viejas hacen 301 permanente
      // a la que les corresponde — se conserva su SEO y no se dejan 404 a links
      // externos/guardados.
      { source: "/cotizar", destination: "/tarifas", permanent: true },
      { source: "/estimacion", destination: "/tarifas", permanent: true },
      { source: "/calculadora", destination: "/tarifas", permanent: true },
      { source: "/calculadora-fcl", destination: "/fcl", permanent: true },
      { source: "/cotizador-flete", destination: "/fcl", permanent: true },
      // La calc embebible del portal se movió: viejo iframe → nuevo embed.
      { source: "/calculadora/embed", destination: "/tarifas/embed", permanent: true },
      // `/markbox` se renombró a `/shipping-mark` (el nombre visible al cliente
      // es "Shipping Mark"; MARKBOX quedó como identificador interno). 301 para
      // no perder el SEO de la URL vieja, que estaba indexada.
      { source: "/markbox", destination: "/shipping-mark", permanent: true },
      // Studio · el módulo comercial se unificó en UNA sola entrada llamada
      // "CRM" (founder 2026-08-11): `/studio/kommo` se renombró a `/studio/crm`
      // —el rótulo es neutro respecto al proveedor— y el placeholder vacío
      // `/studio/leads` ("CRM · Leads") se eliminó. 308 permanente para no
      // romper marcadores ni el historial del equipo; Next preserva el query
      // string, así que los deep-links `?tab=…&pipeline=…` siguen sirviendo.
      { source: "/studio/kommo", destination: "/studio/crm", permanent: true },
      { source: "/studio/leads", destination: "/studio/crm", permanent: true },
      // SDD-0276: el login del portal se mudó a `/entrar`, la puerta única del
      // sitio público. 301 permanente para no romper los correos de bienvenida
      // e invitación ya enviados; Next preserva el query string, así que los
      // `?email=…`, `?error=expired` y `?status=nohabilitado` siguen llegando.
      { source: "/portal/login", destination: "/entrar", permanent: true },
      // Fase 6: el rastreo público se retiró — vive dentro del portal. El
      // buscador `/track` y los deep-links `/track/<código>` (que se comparten
      // por WhatsApp) hacen 301 permanente a la puerta, sin dejar 404.
      // El más específico primero para que gane sobre el genérico.
      // ⚠️ Apuntan DIRECTO a `/entrar`, no al viejo `/portal/login`: encadenar
      // 301 → 301 diluye equity SEO y suma un salto a cada enlace compartido.
      { source: "/track/:path*", destination: "/entrar", permanent: true },
      { source: "/track", destination: "/entrar", permanent: true },
      // Migración de dominio doortudoor.com → dtdcargo.com (Search Console
      // "Cambio de dirección" activo, 2026-06-07). El 301 del dominio viejo es
      // path-preserving, pero estas páginas del sitio VIEJO no tienen slug
      // equivalente en el nuevo → caían en 404 tras el redirect, perdiendo su
      // equity SEO. Las mapeamos a la página nueva más relevante (verificadas
      // 200 + orígenes 404). Datos: reporte Rendimiento de la propiedad
      // doortudoor.com (impresiones 3 meses entre paréntesis).
      {
        // Artículo "cómo calcular CBM" — la de más equity (397 impresiones).
        // Apunta directo a /tarifas (la calc por CBM); evita la cadena de 301.
        source: "/como-calcular-metro-cubico-cbm-de-la-mercancia",
        destination: "/tarifas",
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
