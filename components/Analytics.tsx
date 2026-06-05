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
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}',{send_page_view:false});`}
      </Script>
      <Suspense fallback={null}>
        <PageViews />
      </Suspense>
    </>
  );
}
