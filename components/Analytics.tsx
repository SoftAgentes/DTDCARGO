"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

/**
 * Google Analytics 4 (gtag.js) — SOLO el sitio público de dtdcargo.com.
 *
 * Alcance: las rutas de marketing. Las áreas autenticadas (/studio ERP,
 * /portal cliente, /m operario, /back CMS, /invitar, /interno, /marca) y las
 * rutas públicas cuya URL lleva datos de cliente (/verificar?c=<mark|folio>,
 * /p/[token]) quedan EXCLUIDAS: ahí las URLs llevan datos sensibles (MARKBOX,
 * tokens, emails) y mandarlos a Google sería PII — viola los ToS de GA y
 * arriesga la cuenta. Decisión founder 2026-06-05; ampliada 2026-07-05 (fuga
 * detectada en /verificar, /p, /interno). /track/[code] y /calculadora/embed
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
  // Ampliación 2026-07-05 — fuga PII detectada en auditoría de medición:
  "/verificar", // ?c=<Shipping Mark | folio de diploma> viajaba en el page_view
  "/p", //          /p/[token] — packing list con token capability (SDD-0096)
  "/interno", //    zona interna del equipo (gateada por login del ERP)
  "/marca", //      brand book gated por login — sin valor de marketing
  // Iframe del FAB del portal (clientes YA captados): medirla contamina las
  // métricas públicas y filtra el referrer del portal a Google.
  "/calculadora/embed",
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
  return pathname.replace(/^\/track\/[^/]+/, "/track/[code]");
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
    if (ALLOWED_QUERY_PARAMS.has(k.toLowerCase())) clean.append(k, v);
  }
  return clean.toString();
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
 * Dentro de un iframe NO cuenta: /calculadora/embed vive embebida en el portal
 * de clientes ya captados — sus clicks contaminarían la conversión de captación.
 */
function fireWhatsAppSignals(origin: string) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  if (window.top !== window.self) return;
  window.gtag("event", "conversion", {
    send_to: WHATSAPP_CONVERSION,
    value: 1.0,
    currency: "USD",
  });
  window.gtag("event", "whatsapp_click", { cta_origin: origin });
}

/**
 * Conversión WhatsApp para flujos que abren wa.me con `window.open()` (sin
 * `<a>`): calculadora, /estimacion y "Arma tu envío" (/servicios). El listener
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
  // Mismo guard que la conversión: dentro de un iframe (embed en el portal de
  // clientes ya captados) un "lead" no es captación.
  if (window.top !== window.self) return;
  window.gtag("event", "generate_lead", { lead_method: method });
}

export function Analytics() {
  const pathname = usePathname();
  const isPrivate = isPrivatePath(pathname);

  // Kill-switch oficial de gtag: en navegación SPA público→privado el script
  // ya quedó cargado, y la "medición mejorada" de GA4 (history changes, se
  // activa en la consola, no acá) emitiría hits con la URL privada. La bandera
  // window['ga-disable-<ID>'] apaga el tag por completo mientras sea true.
  useEffect(() => {
    if (!GA_ID || typeof window === "undefined") return;
    const w = window as unknown as Record<string, unknown>;
    w[`ga-disable-${GA_ID}`] = isPrivate;
    w[`ga-disable-${ADS_ID}`] = isPrivate;
  }, [isPrivate]);

  if (!GA_ID || isPrivate) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}',{send_page_view:false});gtag('config','${ADS_ID}');`}
      </Script>
      <Suspense fallback={null}>
        <PageViews />
      </Suspense>
      <WhatsAppConversionTracker />
    </>
  );
}
