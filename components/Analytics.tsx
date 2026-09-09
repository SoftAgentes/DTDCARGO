"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useLayoutEffect, useSyncExternalStore } from "react";

/**
 * Google Analytics 4 (gtag.js) — SOLO el sitio público de dtdcargo.com.
 *
 * Alcance: las rutas de marketing. Las áreas autenticadas (/studio ERP,
 * /portal cliente, /m operario, /back CMS, /invitar, /interno, /marca) y las
 * rutas públicas cuya URL lleva datos de cliente (/verificar?c=<mark|folio>,
 * /p/[token]) quedan EXCLUIDAS: ahí las URLs llevan datos sensibles (MARKBOX,
 * tokens, emails) y mandarlos a Google sería PII — viola los ToS de GA y
 * arriesga la cuenta. Decisión founder 2026-06-05; ampliada 2026-07-05 (fuga
 * detectada en /verificar, /p, /interno). /track/[code] y los embeds de calc
 * también quedan EXCLUIDAS: gtag adjunta la URL cruda (`dl`) y el título a
 * CADA hit — incluido el ping del tag de Ads al cargar — así que redactar el
 * page_view manual NO basta; la única vía estanca es no cargar el tag ahí.
 * El buscador /track sí se mide. Ver memoria project_google_analytics_ga4.
 *
 * Measurement ID: de `NEXT_PUBLIC_GA_ID`; si falta, cae al ID de la propiedad
 * (público — viaja en el HTML) SOLO en producción. En dev queda apagado para
 * no ensuciar reportes con localhost.
 *
 * Componente propio (no `@next/third-parties`): cero deps nuevas + control del
 * page_view en navegación SPA + gating por ruta. El CSP (next.config.ts) ya
 * permite googletagmanager.com + google-analytics.com.
 */

const GA_ID =
  process.env.NEXT_PUBLIC_GA_ID ??
  (process.env.NODE_ENV === "production" ? "G-25CD7BZH98" : "");

/**
 * Google Ads — conversión de la campaña. La etiqueta de Ads carga junto al gtag
 * de GA4 (mismo loader) y la conversión "Click WhatsApp" se dispara en cada
 * click a un link de WhatsApp (el CTA principal del sitio). El `send_to` lo
 * generó la acción de conversión en Google Ads (categoría Contacto).
 */
const ADS_ID = "AW-561290482";
const WHATSAPP_CONVERSION = "AW-561290482/qbu2CILjn7ocEPK50osC";

/**
 * Prefijos de rutas donde GA NO se carga (evita PII a Google).
 * El match es exacto o con barra (`/m` cubre `/m` y `/m/...` pero NO `/marca`,
 * que va como entrada propia; `/p` cubre `/p/[token]` pero NO `/portal`).
 */
const PRIVATE_PREFIXES = [
  "/studio",
  "/portal",
  "/m",
  "/back",
  "/invitar",
  "/acceso", // recuperación Studio: el token sigue vivo durante el GET
  "/entrar", // puerta Portal: puede llevar código o email de acceso
  "/abrir", // magic link Portal: recibe token_hash en la query
  // Ampliación 2026-07-05 — fuga PII detectada en auditoría de medición:
  "/verificar", // ?c=<Shipping Mark | folio de diploma> viajaba en el page_view
  "/p", //          /p/[token] — packing list con token capability (SDD-0096)
  "/interno", //    zona interna del equipo (gateada por login del ERP)
  "/marca", //      brand book gated por login — sin valor de marketing
  // Iframes del FAB del portal (clientes YA captados): medirlos contamina las
  // métricas públicas y filtra el referrer del portal a Google. La calc CBM/LCL
  // (antes /calculadora/embed) vive en /tarifas/embed; el FCL en /fcl/embed.
  "/tarifas/embed",
  "/fcl/embed",
];

export function isPrivatePath(pathname: string): boolean {
  // /track/<código> es dato de cliente: el buscador /track ES público, pero la
  // página del código NO se mide — gtag mandaría el código en `dl`, título y
  // referrer aunque el page_view manual lo redacte. Además quien rastrea ya es
  // cliente: sus clicks a WhatsApp no son conversión de captación.
  if (/^\/track\/./.test(pathname)) return true;
  return PRIVATE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/**
 * Redacta segmentos con datos de cliente ANTES de mandar el path a Google.
 * Defensa en profundidad: `/track/<código>` ya está EXCLUIDA por isPrivatePath
 * (gtag ni carga ahí); esta redacción queda por si esa exclusión regresara.
 */
export function sanitizePath(pathname: string): string {
  return pathname
    .replace(/^\/track\/[^/]+/, "/track/[code]")
    .replace(/^\/acceso\/[^/]+/, "/acceso/[token]")
    .replace(/^\/entrar\/[^/]+/, "/entrar/[code]");
}

/**
 * Whitelist de query params que viajan a GA. Cualquier otro parámetro puede
 * llevar datos de cliente (`?est=EST-XXXX`, `?ref=<referido>`, `?c=<mark>`)
 * y NO sale del sitio. Solo atribución: UTM + origen (/enlaces) + click IDs.
 */
const ALLOWED_QUERY_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "origen", // atribución del hub /enlaces (link-in-bio.md)
  "gclid",
  "gbraid",
  "wbraid", // click IDs de Google Ads
]);

export function sanitizeSearch(searchParams: URLSearchParams): string {
  const clean = new URLSearchParams();
  for (const [k, v] of searchParams) {
    if (ALLOWED_QUERY_PARAMS.has(k.toLowerCase()) && !hasSensitiveAssignment(v)) {
      clean.append(k, v);
    }
  }
  return clean.toString();
}

/**
 * Un parámetro no aprobado o un valor permitido que anide una credencial puede
 * transportar un código, email o capability. Limpiarlo sólo en el page_view
 * manual no basta: gtag/Ads también observan la URL real. Por eso cualquier
 * query insegura apaga los tags para esa vista completa.
 */
function hasUnsafeQuery(searchParams: URLSearchParams): boolean {
  for (const [key, value] of searchParams) {
    if (
      !ALLOWED_QUERY_PARAMS.has(key.toLowerCase()) ||
      hasSensitiveAssignment(value)
    ) {
      return true;
    }
  }
  return false;
}

const SENSITIVE_URL_KEY =
  /(?:^|_)(?:token|secret|password|passwd|pwd|pass|otp|code|state|nonce|authorization|auth|bearer|jwt|session|sid|key|signature|sig|hmac|hash|csrf|xsrf|email|c|est|ref|folio|markbox)(?:_|$)|(?:token|secret|password|code|nonce|sessionid|apikey)$/;
const PARAM_ASSIGNMENT =
  /(?=(?:^|[^a-z0-9_.\-\[\]])["']?([a-z0-9_.\-\[\]]+)["']?\s*(?:=|:))/gi;
const URL_INSPECTION_DECODE_PASSES = 2;

function normalizeSensitiveKey(key: string): string {
  return key
    .replace(/\[([^\]]*)\]/g, "_$1")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[.-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase();
}

function decodeForInspection(
  value: string,
  failClosedOnMalformed: boolean,
): string | null {
  let decoded = value;
  for (let pass = 0; pass < URL_INSPECTION_DECODE_PASSES; pass += 1) {
    if (!decoded.includes("%")) return decoded;
    try {
      // Un UTM puede incluir un porcentaje literal (descuento-50%). Escaparlo
      // sólo para inspección permite decodificar los escapes válidos vecinos:
      // `%3D...%ZZ` debe revelar `=`, nunca devolver la credencial codificada.
      // Hashes y secuencias UTF-8 inválidas siguen fallando cerrado.
      const input = failClosedOnMalformed
        ? decoded
        : decoded.replace(/%(?![0-9a-f]{2})/gi, "%25");
      const next = decodeURIComponent(input);
      if (next === decoded) return decoded;
      decoded = next;
    } catch {
      return null;
    }
  }
  // Si todavía queda una capa válida, no adivinar qué ocultaba.
  return /%[0-9a-f]{2}/i.test(decoded) ? null : decoded;
}

function hasSensitiveAssignment(
  value: string,
  failClosedOnMalformed = false,
): boolean {
  const decoded = decodeForInspection(value, failClosedOnMalformed);
  if (decoded === null) return true;

  PARAM_ASSIGNMENT.lastIndex = 0;
  for (const match of decoded.matchAll(PARAM_ASSIGNMENT)) {
    if (SENSITIVE_URL_KEY.test(normalizeSensitiveKey(match[1]))) return true;
  }
  return false;
}

function hasSensitiveHash(hash: string): boolean {
  if (!hash) return false;
  // Un fragmento mal codificado no se envía a un tercero.
  return hasSensitiveAssignment(hash, true);
}

export function isAnalyticsExcludedUrl(
  pathname: string,
  searchParams: URLSearchParams,
  hash = "",
): boolean {
  return (
    isPrivatePath(pathname) ||
    hasUnsafeQuery(searchParams) ||
    hasSensitiveHash(hash)
  );
}

function isLocationExcluded(href: string): boolean {
  if (!href) return true;
  try {
    const url = new URL(href);
    return isAnalyticsExcludedUrl(url.pathname, url.searchParams, url.hash);
  } catch {
    return true;
  }
}

const LOCATION_CHANGE_EVENT = "dtd:analytics-location-change";

function subscribeToLocation(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener("hashchange", onChange);
  window.addEventListener(LOCATION_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener("hashchange", onChange);
    window.removeEventListener(LOCATION_CHANGE_EVENT, onChange);
  };
}

function getLocationSnapshot() {
  return window.location.href;
}

function getServerLocationSnapshot() {
  // Analytics espera a conocer la URL completa del navegador. El servidor no
  // recibe fragmentos y, por seguridad, no debe adivinar que la URL es pública.
  return "";
}

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

/**
 * Dispara un page_view por cada vista pública (carga inicial + navegación SPA).
 * El config inicial usa `send_page_view:false`, así que TODOS los page_views
 * los emite este tracker — incluido el primer render y los re-montajes al
 * volver del ERP al sitio público. Sin doble conteo, sin perder vistas.
 *
 * useSearchParams → debe ir dentro de <Suspense> para no opt-out del SSG.
 */
function PageViews() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window.gtag !== "function") return;
    if (
      isAnalyticsExcludedUrl(pathname, searchParams, window.location.hash) ||
      isLocationExcluded(window.location.href)
    ) {
      return;
    }
    const qs = sanitizeSearch(searchParams);
    const cleanPath = sanitizePath(pathname);
    const path = qs ? `${cleanPath}?${qs}` : cleanPath;
    window.gtag("event", "page_view", {
      page_path: path,
      // page_location se arma desde el path YA redactado — `location.href`
      // mandaría el código de tracking del cliente de vuelta a Google.
      page_location: `${window.location.origin}${path}`,
      page_title: document.title,
    });
  }, [pathname, searchParams]);

  return null;
}

/**
 * Dispara la conversión de Google Ads ("Click WhatsApp") en cada click a un link
 * de WhatsApp del sitio: botones "Cotizar por WhatsApp", FAB flotante, footer.
 *
 * Listener en fase de BURBUJA (no captura) a propósito: corre DESPUÉS del onClick
 * del FAB. En mobile el 1er tap del FAB solo expande el menú y llama
 * `preventDefault()` (no abre WhatsApp) → con `e.defaultPrevented` descartamos
 * esa interacción y contamos solo los clicks que realmente abren WhatsApp.
 * Los demás links de WhatsApp (hero/footer) navegan sin prevenir → cuentan.
 */
function WhatsAppConversionTracker() {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented) return;
      if (isLocationExcluded(window.location.href)) return;
      const anchor = (e.target as Element | null)?.closest?.("a[href]") as
        | HTMLAnchorElement
        | null;
      if (!anchor || !WHATSAPP_LINK_RE.test(anchor.href)) {
        return;
      }
      // wa.me/?text=… SIN número = COMPARTIR (ej. el estado de /track con un
      // conocido) — no es un contacto a DTD, no cuenta como conversión.
      if (WHATSAPP_SHARE_RE.test(anchor.href)) return;
      // El origen viaja como param de evento → SIEMPRE redactado.
      fireWhatsAppSignals(sanitizePath(window.location.pathname));
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return null;
}

/** Links que abren WhatsApp — mismo matcher para el listener y los tests. */
export const WHATSAPP_LINK_RE = /wa\.me|api\.whatsapp\.com|whatsapp:/i;

/** `wa.me/?text=…` (sin número de destino) = link de COMPARTIR, no de contacto. */
export const WHATSAPP_SHARE_RE = /wa\.me\/\?/i;

/**
 * Las DOS señales de un click real a WhatsApp:
 *  1. La conversión de Google Ads — SIEMPRE el mismo `send_to` (no fragmentar
 *     el historial que alimenta Smart Bidding).
 *  2. El espejo GA4 `whatsapp_click` — la conversión de Ads NO llega a la
 *     propiedad GA4; este evento sí (key event + audiencias de remarketing).
 *
 * Dentro de un iframe NO cuenta: /tarifas/embed vive embebida en el portal
 * de clientes ya captados — sus clicks contaminarían la conversión de captación.
 */
function fireWhatsAppSignals(origin: string) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  if (isLocationExcluded(window.location.href)) return;
  if (window.top !== window.self) return;
  window.gtag("event", "conversion", {
    send_to: WHATSAPP_CONVERSION,
    value: 1.0,
    currency: "USD",
  });
  window.gtag("event", "whatsapp_click", { cta_origin: sanitizePath(origin) });
}

/**
 * Conversión WhatsApp para flujos que abren wa.me con `window.open()` (sin
 * `<a>`): calculadora (/tarifas) y "Arma tu envío" (/servicios). El listener
 * global solo ve clicks en anchors — estos 3 flujos de MAYOR intención eran
 * invisibles (subconteo del CTA principal, diagnóstico 2026-07-05). Llamar
 * JUSTO antes del `window.open`.
 */
export function trackWhatsAppConversion(origin: string) {
  fireWhatsAppSignals(origin);
}

/**
 * Evento GA4 `generate_lead` — el momento exacto en que un lead queda
 * capturado: form de contacto enviado, estimado guardado (EST-XXXX) o registro
 * con MARKBOX emitido. Base de las audiencias GA4 ("pidieron cotización") y de
 * los key events. NO toca la conversión de Ads (esa es el click a WhatsApp).
 */
export function trackLead(method: "contacto" | "estimado" | "registro") {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  if (isLocationExcluded(window.location.href)) return;
  // Mismo guard que la conversión: dentro de un iframe (embed en el portal de
  // clientes ya captados) un "lead" no es captación.
  if (window.top !== window.self) return;
  window.gtag("event", "generate_lead", { lead_method: method });
}

function disableAnalytics(disabled: boolean) {
  const flags = window as unknown as Record<string, unknown>;
  flags[`ga-disable-${GA_ID}`] = disabled;
  flags[`ga-disable-${ADS_ID}`] = disabled;
}

function AnalyticsRuntime() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locationHref = useSyncExternalStore(
    subscribeToLocation,
    getLocationSnapshot,
    getServerLocationSnapshot,
  );
  const currentUrl = locationHref ? new URL(locationHref) : null;
  const isPrivate =
    isAnalyticsExcludedUrl(pathname, searchParams, currentUrl?.hash ?? "") ||
    isLocationExcluded(locationHref);

  // Kill-switch oficial de gtag: en navegación SPA público→privado el script
  // ya quedó cargado, y la "medición mejorada" de GA4 (history changes, se
  // activa en la consola, no acá) emitiría hits con la URL privada. La bandera
  // window['ga-disable-<ID>'] apaga el tag por completo mientras sea true.
  useLayoutEffect(() => {
    if (!GA_ID || typeof window === "undefined") return;
    disableAnalytics(isPrivate);
  });

  // Next actualiza history antes de que React confirme la nueva ruta. Este
  // guard activa el kill-switch antes de delegar el cambio, de modo que un
  // observador de navegación ya instalado nunca vea la URL sensible con GA/Ads
  // habilitados. Volver a público se reactiva sólo tras el render confirmado.
  useLayoutEffect(() => {
    if (!GA_ID) return;
    const originalPush = window.history.pushState;
    const originalReplace = window.history.replaceState;

    function guard(method: History["pushState"]): History["pushState"] {
      return function (this: History, data, unused, url) {
        if (url != null) {
          try {
            const destination = new URL(url, window.location.href);
            if (
              destination.origin === window.location.origin &&
              isAnalyticsExcludedUrl(
                destination.pathname,
                destination.searchParams,
                destination.hash,
              )
            ) {
              disableAnalytics(true);
            }
          } catch {
            // history conserva su validación nativa; no registrar la URL.
          }
        }

        try {
          const result = method.call(this, data, unused, url);
          window.dispatchEvent(new Event(LOCATION_CHANGE_EVENT));
          return result;
        } catch (error) {
          disableAnalytics(isLocationExcluded(window.location.href));
          throw error;
        }
      };
    }

    const push = guard(originalPush);
    const replace = guard(originalReplace);
    window.history.pushState = push;
    window.history.replaceState = replace;

    function blockSensitiveLocation() {
      if (isLocationExcluded(window.location.href)) disableAnalytics(true);
    }

    window.addEventListener("popstate", blockSensitiveLocation, true);
    window.addEventListener("hashchange", blockSensitiveLocation, true);

    return () => {
      if (window.history.pushState === push) {
        window.history.pushState = originalPush;
      }
      if (window.history.replaceState === replace) {
        window.history.replaceState = originalReplace;
      }
      window.removeEventListener("popstate", blockSensitiveLocation, true);
      window.removeEventListener("hashchange", blockSensitiveLocation, true);
    };
  }, []);

  if (!GA_ID || isPrivate) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      {/* Google Consent Mode v2 — default = denied ANTES de cualquier config.
          Mientras el usuario no acepte, gtag corre restringido (pings sin cookies).
          `wait_for_update` da 500 ms al banner para llamar `consent update`. Si ya
          hay decisión `granted` en la cookie `dtd_cookie_consent`, arrancamos
          concedido para no re-medir a un usuario que ya aceptó. Ver lib/cookie-consent. */}
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());var __dtdc=document.cookie.indexOf('dtd_cookie_consent=granted')!==-1?'granted':'denied';gtag('consent','default',{ad_storage:__dtdc,ad_user_data:__dtdc,ad_personalization:__dtdc,analytics_storage:__dtdc,wait_for_update:500});gtag('config','${GA_ID}',{send_page_view:false});gtag('config','${ADS_ID}');`}
      </Script>
      <PageViews />
      <WhatsAppConversionTracker />
    </>
  );
}

export function Analytics() {
  return (
    <Suspense fallback={null}>
      <AnalyticsRuntime />
    </Suspense>
  );
}
