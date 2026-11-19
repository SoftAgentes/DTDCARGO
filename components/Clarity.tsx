"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import { isAnalyticsExcludedUrl } from "@/components/Analytics";
import { clarityIdFromEnv } from "@/lib/clarity";
import {
  COOKIE_CONSENT_NAME,
  readCookieConsent,
  readCookieConsentServer,
  subscribeCookieConsent,
  type CookieConsent,
} from "@/lib/cookie-consent";

/**
 * Microsoft Clarity — SOLO el sitio público de dtdcargo.com (fase 1, apagado).
 *
 * Evaluación y decisión: `docs/marketing/clarity-evaluacion.md` (§2 y §5,
 * fila 1). Spec: `docs/specs/0684-clarity-fase-1-apagado/spec.md`.
 *
 * Qué hace y qué no:
 *  · Sin `NEXT_PUBLIC_CLARITY_ID` (o con `off`) no renderiza nada. No hay ID
 *    de respaldo (ver `lib/clarity.ts`).
 *  · Usa la MISMA guarda que GA (`isAnalyticsExcludedUrl`: rutas privadas,
 *    query no aprobada y credenciales en el fragmento) y además excluye
 *    `/registro`, `/entrar` y `/abrir`. Clarity guarda la URL completa y el
 *    DOM: grabar esas páginas sería grabar datos de alta o enlaces de acceso.
 *  · Consentimiento (evaluación §3.4, confirmado por el DG el 2026-11-19): el
 *    proyecto está en «requiere consentimiento», así que en las páginas
 *    públicas permitidas carga SIN cookies. Solo con `dtd_cookie_consent=granted`
 *    (cookie exacta, como GA) se manda `consentv2` con analítica concedida y
 *    publicidad SIEMPRE denegada; al revocar, `clarity('consent', false)`
 *    (borra sus cookies y detiene el seguimiento, Consent API v2).
 *  · Nunca se llama a `clarity('identify', …)` ni se ponen etiquetas con datos
 *    de la persona: Clarity queda seudónimo.
 *
 * Frontera público → privado. Un `<script>` no se descarga: si Clarity ya cargó
 * en una página pública y la persona pasa con navegación cliente a `/portal`,
 * el script sigue vivo y grabaría el DOM privado. No hay en la documentación
 * una orden para detener solo la grabación (inferencia de la evaluación §2.2),
 * así que el corte es doble:
 *  1. Clic en un enlace del mismo origen hacia una URL excluida: se cancela la
 *     navegación cliente ANTES de que Next pinte la página privada y se hace
 *     una navegación completa. El documento nuevo arranca sin Clarity.
 *  2. Red de seguridad para lo que no es un clic (`router.push`, atrás/adelante,
 *     cambio de fragmento): `clarity('consent', false)` y recarga completa.
 *
 * Las comprobaciones: `components/Clarity.test.tsx` (guarda, entorno,
 * consentimiento y corte) y `e2e/clarity-no-fuga.clarity.ts` (ninguna petición
 * a `*.clarity.ms` en rutas privadas ni tras pasar del público al Portal).
 */

/**
 * Apagado que el minificador pliega (patrón de la SDD-0544 en `Analytics.tsx`):
 * comparaciones escritas contra `process.env` directo. Con `off` o vacío en el
 * build, el define deja `"off" === "off"` o `!""`, el minificador descarta la
 * otra rama y `clarity.ms` no llega a ningún chunk de `.next/static`
 * (contrato: `components/Clarity.apagado-build.test.ts`). Con un `.trim()` o un
 * helper en medio eso no pasa; el recorte y la validación van después.
 */
const CLARITY_BUILD_OFF =
  process.env.NEXT_PUBLIC_CLARITY_ID === "off" || !process.env.NEXT_PUBLIC_CLARITY_ID;
const CLARITY_ID = CLARITY_BUILD_OFF ? "" : clarityIdFromEnv(process.env.NEXT_PUBLIC_CLARITY_ID);
const CLARITY_TAG_BASE = CLARITY_BUILD_OFF ? "" : "https://www.clarity.ms/tag/";

/**
 * Exclusiones propias de Clarity, además de las de GA. `/entrar` y `/abrir` ya
 * están en `PRIVATE_PREFIXES` de GA; se repiten para que esta lista no dependa
 * de que alguien las mantenga allá.
 *
 * `/cotizador` (revisión de la #710): con `DOCUMENT_IMPORT_ENABLED` muestra
 * como TEXTO el contenido de documentos importados (nombre del archivo,
 * Shipping Mark, productos, códigos y marcas). En Balanced eso se grabaría
 * legible. GA no graba el DOM y sigue midiéndolo; Clarity no.
 */
export const CLARITY_EXTRA_PRIVATE_PREFIXES = ["/registro", "/entrar", "/abrir", "/cotizador"] as const;

function hasPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isClarityExcludedUrl(
  pathname: string,
  searchParams: URLSearchParams,
  hash = "",
): boolean {
  return (
    CLARITY_EXTRA_PRIVATE_PREFIXES.some((prefix) => hasPrefix(pathname, prefix)) ||
    isAnalyticsExcludedUrl(pathname, searchParams, hash)
  );
}

/** Una URL que no se puede leer cuenta como excluida (falla cerrado). */
export function isClarityExcludedHref(href: string, base?: string): boolean {
  if (!href) return true;
  try {
    const url = base ? new URL(href, base) : new URL(href);
    return isClarityExcludedUrl(url.pathname, url.searchParams, url.hash);
  } catch {
    return true;
  }
}

type ClarityFn = ((...args: unknown[]) => void) & { q?: unknown[] };

declare global {
  interface Window {
    clarity?: ClarityFn;
    /** Lo consulta el snippet inline antes de insertar la etiqueta. */
    __dtdClarityAllowed?: () => boolean;
  }
}

function clarityLoaded(): boolean {
  return typeof window !== "undefined" && typeof window.clarity === "function";
}

/** Consent API v2: la publicidad de Microsoft va siempre denegada. */
export const CLARITY_GRANTED = { ad_Storage: "denied", analytics_Storage: "granted" } as const;
export const CLARITY_DENIED = { ad_Storage: "denied", analytics_Storage: "denied" } as const;

/**
 * Snippet oficial de Clarity, con dos cambios:
 *  · antes de nada pregunta a `__dtdClarityAllowed()`, que evalúa la guarda
 *    de rutas sobre `location.href` en ese momento. `next/script` con
 *    `lazyOnload` inserta el script después de `load` aunque el componente ya
 *    se haya desmontado; si para entonces la persona está en una ruta
 *    privada, el snippet no hace nada;
 *  · encola la señal de consentimiento leída de la misma cookie exacta que GA
 *    (nombre y valor completos, una sola visible) antes de cargar la etiqueta:
 *    concedida solo con `granted`; si no, denegada (corre sin cookies).
 */
export function buildClaritySnippet(id: string): string {
  if (!CLARITY_TAG_BASE || !clarityIdFromEnv(id)) return "";
  const granted = JSON.stringify(CLARITY_GRANTED);
  const denied = JSON.stringify(CLARITY_DENIED);
  return (
    `(function(c,l,a,r,i){` +
    `if(typeof c.__dtdClarityAllowed!=='function'||!c.__dtdClarityAllowed())return;` +
    `if(typeof c[a]==='function')return;` +
    `c[a]=function(){(c[a].q=c[a].q||[]).push(arguments)};` +
    `var k=l.cookie.split(';').map(function(s){return s.trim();}).filter(function(s){return s.indexOf('${COOKIE_CONSENT_NAME}=')===0;});` +
    `c[a]('consentv2',k.length===1&&k[0]==='${COOKIE_CONSENT_NAME}=granted'?${granted}:${denied});` +
    `var t=l.createElement(r);t.async=1;t.src='${CLARITY_TAG_BASE}'+i;` +
    `var y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);` +
    `})(window,document,'clarity','script','${id}');`
  );
}

/**
 * Navegación completa. Va en un objeto para que las pruebas la observen (jsdom
 * no implementa `location.assign` ni `reload`).
 */
export const clarityNavigation = {
  assign(href: string) {
    window.location.assign(href);
  },
  reload() {
    window.location.reload();
  },
};

/**
 * Corta Clarity antes de una navegación completa. `consent false` primero: si el navegador tarda en
 * salir, la etiqueta ya dejó de seguir y borró sus cookies.
 */
function stopClarity() {
  try {
    window.clarity?.("consent", false);
  } catch {
    // Una etiqueta rota no debe impedir la navegación completa.
  }
}

const LOCATION_CHANGE_EVENT = "dtd:clarity-location-change";

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
  // Igual que GA: sin la URL completa del navegador (el servidor no ve el
  // fragmento) no se adivina que la página es pública.
  return "";
}

/** Destino del mismo origen de un clic que Next resolvería en el cliente. */
function sameOriginDestination(event: MouseEvent): URL | null {
  if (event.defaultPrevented || event.button !== 0) return null;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const anchor = (event.target as Element | null)?.closest?.("a[href]") as
    | HTMLAnchorElement
    | null;
  if (!anchor) return null;
  const target = anchor.getAttribute("target");
  if (target && target !== "_self") return null;
  if (anchor.hasAttribute("download")) return null;
  try {
    const url = new URL(anchor.href, window.location.href);
    return url.origin === window.location.origin ? url : null;
  } catch {
    return null;
  }
}

/**
 * Instala el corte de frontera mientras haya ID. Corre aunque la página actual
 * sea privada: si la persona vuelve al público, Clarity carga ahí y el corte
 * ya está puesto.
 */
function useBoundaryCut() {
  useLayoutEffect(() => {
    if (!CLARITY_ID) return;

    window.__dtdClarityAllowed = () => !isClarityExcludedHref(window.location.href);

    // 1. Clic hacia una URL excluida: navegación completa en vez de cliente.
    //    Fase de captura en `document`: corre antes de los listeners de React
    //    (que viven en el contenedor raíz) y del `onClick` de `next/link`.
    function onClick(event: MouseEvent) {
      if (!clarityLoaded()) return;
      const destination = sameOriginDestination(event);
      if (!destination) return;
      if (!isClarityExcludedUrl(destination.pathname, destination.searchParams, destination.hash)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      stopClarity();
      clarityNavigation.assign(destination.href);
    }

    // 2. Red de seguridad: cambios de historial que no vienen de un clic.
    const originalPush = window.history.pushState;
    const originalReplace = window.history.replaceState;
    function guard(method: History["pushState"]): History["pushState"] {
      return function (this: History, data, unused, url) {
        let crossesIntoPrivate = false;
        if (url != null && clarityLoaded()) {
          try {
            const destination = new URL(url, window.location.href);
            crossesIntoPrivate =
              destination.origin === window.location.origin &&
              isClarityExcludedUrl(destination.pathname, destination.searchParams, destination.hash);
          } catch {
            // history conserva su validación nativa.
          }
        }
        if (crossesIntoPrivate) stopClarity();
        const result = method.call(this, data, unused, url);
        window.dispatchEvent(new Event(LOCATION_CHANGE_EVENT));
        if (crossesIntoPrivate) clarityNavigation.reload();
        return result;
      };
    }
    const push = guard(originalPush);
    const replace = guard(originalReplace);
    window.history.pushState = push;
    window.history.replaceState = replace;

    function onHistoryMove() {
      if (clarityLoaded() && isClarityExcludedHref(window.location.href)) {
        stopClarity();
        clarityNavigation.reload();
      }
    }

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onHistoryMove, true);
    window.addEventListener("hashchange", onHistoryMove, true);

    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onHistoryMove, true);
      window.removeEventListener("hashchange", onHistoryMove, true);
      if (window.history.pushState === push) window.history.pushState = originalPush;
      if (window.history.replaceState === replace) window.history.replaceState = originalReplace;
    };
  }, []);
}

/**
 * Sigue la decisión de `dtd_cookie_consent` en caliente. La decisión inicial la
 * encola el snippet; aquí solo se reacciona a los cambios: aceptar manda
 * `consentv2` concedido; revocar después de haber aceptado, `consent false`.
 */
function useConsentSync() {
  const decision = useSyncExternalStore(
    subscribeCookieConsent,
    readCookieConsent,
    readCookieConsentServer,
  );
  const previous = useRef<CookieConsent | null | undefined>(undefined);

  useEffect(() => {
    const before = previous.current;
    previous.current = decision;
    if (!CLARITY_ID || before === undefined || before === decision) return;
    if (!clarityLoaded()) return;
    if (decision === "granted") {
      window.clarity?.("consentv2", CLARITY_GRANTED);
    } else if (before === "granted") {
      window.clarity?.("consent", false);
    }
  }, [decision]);
}

function ClarityRuntime() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locationHref = useSyncExternalStore(
    subscribeToLocation,
    getLocationSnapshot,
    getServerLocationSnapshot,
  );
  useBoundaryCut();
  useConsentSync();

  if (!CLARITY_ID) return null;
  const hash = locationHref ? new URL(locationHref).hash : "";
  const excluded =
    !locationHref ||
    isClarityExcludedUrl(pathname, searchParams, hash) ||
    isClarityExcludedHref(locationHref);
  if (excluded) return null;

  return (
    <Script id="clarity-init" strategy="lazyOnload">
      {buildClaritySnippet(CLARITY_ID)}
    </Script>
  );
}

export function Clarity() {
  // Sin ID ni siquiera se monta el runtime: el apagado no deja listeners.
  if (!CLARITY_ID) return null;
  return (
    <Suspense fallback={null}>
      <ClarityRuntime />
    </Suspense>
  );
}
