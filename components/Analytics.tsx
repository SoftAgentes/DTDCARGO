"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

/**
 * Google Analytics 4 (gtag.js) — SOLO el sitio público de dtdcargo.com.
 *
 * Alcance: las rutas de marketing. Las áreas autenticadas (/studio ERP,
 * /portal cliente, /m operario, /back CMS, /invitar) quedan EXCLUIDAS: ahí
 * las URLs llevan datos sensibles (MARKBOX, nº de factura, emails) y mandarlos
 * a Google sería PII — viola los ToS de GA y arriesga la cuenta. Decisión
 * founder 2026-06-05. Ver memoria project_google_analytics_ga4.
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
 * Prefijos de rutas autenticadas — GA NO se carga acá (evita PII a Google).
 * El match es exacto o con barra (`/m` cubre `/m` y `/m/...` pero NO `/marca`).
 */
const PRIVATE_PREFIXES = ["/studio", "/portal", "/m", "/back", "/invitar"];

export function isPrivatePath(pathname: string): boolean {
  return PRIVATE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
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
    const qs = searchParams.toString();
    const path = qs ? `${pathname}?${qs}` : pathname;
    window.gtag("event", "page_view", {
      page_path: path,
      page_location: window.location.href,
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
      if (!anchor || !/wa\.me|api\.whatsapp\.com|whatsapp:/i.test(anchor.href)) {
        return;
      }
      if (typeof window.gtag !== "function") return;
      window.gtag("event", "conversion", {
        send_to: WHATSAPP_CONVERSION,
        value: 1.0,
        currency: "USD",
      });
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return null;
}

export function Analytics() {
  const pathname = usePathname();
  if (!GA_ID || isPrivatePath(pathname)) return null;

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
