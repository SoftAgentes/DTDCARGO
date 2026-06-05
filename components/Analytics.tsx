"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";

/**
 * Google Analytics 4 (gtag.js) para TODO el dominio dtdcargo.com.
 *
 * Measurement ID: se toma de `NEXT_PUBLIC_GA_ID` y, si no está seteado, cae al
 * ID de la propiedad de GA (público — viaja en el HTML, no es secreto) SOLO en
 * producción. En dev queda apagado salvo que seteés `NEXT_PUBLIC_GA_ID` a mano,
 * así no ensuciamos los reportes con tráfico de localhost.
 *
 * Por qué un componente propio en vez de `@next/third-parties`:
 *  - Cero dependencias nuevas (evita el preflight de pnpm).
 *  - Control del page_view en navegación SPA (App Router no recarga la página,
 *    así que el page_view hay que dispararlo a mano en cada cambio de ruta).
 *
 * El CSP (next.config.ts) ya permite googletagmanager.com + google-analytics.com.
 */

const GA_ID =
  process.env.NEXT_PUBLIC_GA_ID ??
  (process.env.NODE_ENV === "production" ? "G-25CD7BZH98" : "");

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

/**
 * Dispara un page_view por cada navegación cliente (SPA). El primer page_view
 * (carga inicial) lo manda `gtag('config')` de forma nativa al cargar el script,
 * así que acá saltamos el primer render para no contarlo dos veces.
 *
 * Usa useSearchParams → debe ir dentro de <Suspense> para no opt-out del SSG.
 */
function PageViews() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isFirst = useRef(true);

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
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
  if (!GA_ID) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`}
      </Script>
      <Suspense fallback={null}>
        <PageViews />
      </Suspense>
    </>
  );
}
