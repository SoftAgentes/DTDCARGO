import type { ReactNode } from "react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";

const navigation = vi.hoisted(() => ({
  pathname: "/servicios",
  searchParams: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useSearchParams: () => navigation.searchParams,
}));

// Marcadores inertes: se observa si Analytics solicita el loader y el init
// sin scripts reales, hoisting de React ni solicitudes fuera de jsdom.
vi.mock("next/script", () => ({
  default: ({ id, src, children }: { id?: string; src?: string; children?: ReactNode }) => (
    <span data-analytics-script="true" id={id} data-src={src}>
      {children}
    </span>
  ),
}));

const GA_ID = "G-LOCAL-ANALYTICS-TEST";
const GA_DISABLE = `ga-disable-${GA_ID}`;
const ADS_DISABLE = "ga-disable-AW-561290482";
const browser = window as unknown as Record<string, unknown>;
const gtag = vi.fn();
let analytics: typeof import("./Analytics");
let originalUrl: string;
let originalTitle: string;
let originalGlobals: Map<string, PropertyDescriptor | undefined>;

function navigate(path: string) {
  window.history.replaceState({}, "", path);
  navigation.pathname = window.location.pathname;
  navigation.searchParams = new URLSearchParams(window.location.search);
}

// Se cancela en window, después del listener de document: el click real se
// mide, pero jsdom nunca intenta abrir el sitio externo de WhatsApp.
function preventExternalNavigation(event: MouseEvent) {
  event.preventDefault();
}

function clickWhatsApp() {
  const link = document.createElement("a");
  link.href = "https://wa.me/580000000000?text=Prueba-sintetica";
  link.textContent = "Contacto sintético";
  document.body.append(link);
  fireEvent.click(link);
  link.remove();
}

beforeAll(async () => {
  // Analytics resuelve el ID al evaluar el módulo; se configura antes de su
  // importación y se restaura al cerrar el archivo de pruebas.
  vi.stubEnv("NEXT_PUBLIC_GA_ID", GA_ID);
  analytics = await import("./Analytics");
});

beforeEach(() => {
  originalUrl = window.location.href;
  originalTitle = document.title;
  originalGlobals = new Map(
    ["gtag", "dataLayer", GA_DISABLE, ADS_DISABLE].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(window, key),
    ]),
  );
  gtag.mockReset();
  browser.gtag = gtag;
  delete browser[GA_DISABLE];
  delete browser[ADS_DISABLE];
  navigate("/servicios");
  document.title = "Página pública de prueba";
  window.addEventListener("click", preventExternalNavigation);
});

afterEach(() => {
  cleanup();
  window.removeEventListener("click", preventExternalNavigation);
  vi.restoreAllMocks();
  window.history.replaceState({}, "", originalUrl);
  document.title = originalTitle;
  for (const [key, descriptor] of originalGlobals) {
    if (descriptor) Object.defineProperty(window, key, descriptor);
    else delete browser[key];
  }
});

afterAll(() => {
  vi.unstubAllEnvs();
});

describe("Analytics — accesos privados sin loader ni señales de Google", () => {
  it.each([
    "/acceso",
    "/acceso/token-sintetico-analytics",
    "/entrar",
    "/entrar/codigo-sintetico-analytics",
  ])("no monta loader/init ni emite page_view en la carga inicial de %s", (path) => {
    navigate(`${path}?token=secreto-sintetico&utm_source=prueba`);
    const { container } = render(<analytics.Analytics />);

    expect(container.querySelectorAll("[data-analytics-script]")).toHaveLength(0);
    expect(gtag).not.toHaveBeenCalled();
    expect(browser[GA_DISABLE]).toBe(true);
    expect(browser[ADS_DISABLE]).toBe(true);
  });

  it("no crea gtag ni dataLayer en una carga privada sin tag previo", () => {
    delete browser.gtag;
    delete browser.dataLayer;
    navigate("/acceso/token-sintetico-analytics");
    const { container } = render(<analytics.Analytics />);

    expect(container.querySelectorAll("[data-analytics-script]")).toHaveLength(0);
    expect(browser.gtag).toBeUndefined();
    expect(browser.dataLayer).toBeUndefined();
  });

  it.each([
    "/acceso/token-sintetico-analytics",
    "/entrar/codigo-sintetico-analytics",
  ])("apaga GA/Ads, retira el listener y no emite vistas/eventos al navegar a %s", (path) => {
    const added = vi.spyOn(document, "addEventListener");
    const removed = vi.spyOn(document, "removeEventListener");
    const { container, rerender } = render(<analytics.Analytics />);
    const clickListener = added.mock.calls.find(([type]) => type === "click")?.[1];
    expect(clickListener).toBeTypeOf("function");
    expect(gtag).toHaveBeenCalledWith("event", "page_view", expect.any(Object));
    clickWhatsApp();
    expect(gtag).toHaveBeenCalledWith("event", "whatsapp_click", { cta_origin: "/servicios" });
    gtag.mockClear();

    navigate(path);
    rerender(<analytics.Analytics />);
    clickWhatsApp();
    analytics.trackLead("contacto");
    analytics.trackWhatsAppConversion("cta-sintetico");

    expect(browser[GA_DISABLE]).toBe(true);
    expect(browser[ADS_DISABLE]).toBe(true);
    expect(container.querySelectorAll("[data-analytics-script]")).toHaveLength(0);
    expect(removed).toHaveBeenCalledWith("click", clickListener);
    expect(gtag).not.toHaveBeenCalled();

    navigate("/tarifas?utm_source=prueba&token=secreto-sintetico");
    rerender(<analytics.Analytics />);
    expect(browser[GA_DISABLE]).toBe(false);
    expect(browser[ADS_DISABLE]).toBe(false);
    expect(gtag).toHaveBeenCalledExactlyOnceWith("event", "page_view", {
      page_path: "/tarifas?utm_source=prueba",
      page_location: `${window.location.origin}/tarifas?utm_source=prueba`,
      page_title: document.title,
    });
    clickWhatsApp();
    expect(gtag).toHaveBeenCalledWith("event", "whatsapp_click", { cta_origin: "/tarifas" });
  });

  it("conserva el loader, el init y un page_view saneado en una ruta pública", () => {
    navigate("/servicios?utm_source=prueba&token=secreto-sintetico");
    const { container } = render(<analytics.Analytics />);

    expect(container.querySelector("[data-analytics-script][data-src]")?.getAttribute("data-src")).toBe(
      `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`,
    );
    expect(container.querySelector("#ga-init")).not.toBeNull();
    expect(browser[GA_DISABLE]).toBe(false);
    expect(browser[ADS_DISABLE]).toBe(false);
    expect(gtag).toHaveBeenCalledExactlyOnceWith("event", "page_view", {
      page_path: "/servicios?utm_source=prueba",
      page_location: `${window.location.origin}/servicios?utm_source=prueba`,
      page_title: document.title,
    });
  });

  it.each(["pushState", "replaceState"] as const)(
    "apaga ambos tags antes de que un observador previo de history.%s vea la URL privada",
    (method) => {
      const observed = vi.fn();
      const original = window.history[method].bind(window.history);
      vi.spyOn(window.history, method).mockImplementation((data, unused, url) => {
        observed({ ga: browser[GA_DISABLE], ads: browser[ADS_DISABLE] });
        original(data, unused, url);
      });
      render(<analytics.Analytics />);
      gtag.mockClear();

      window.history[method]({}, "", "/acceso/token-sintetico-analytics");

      expect(observed).toHaveBeenCalledExactlyOnceWith({ ga: true, ads: true });
      expect(window.location.pathname).toBe("/acceso/token-sintetico-analytics");
      expect(gtag).not.toHaveBeenCalled();
    },
  );

  it.each(["/tarifas", "/servicios"])(
    "reactiva ambos tags al confirmar %s si el paso privado fue sustituido antes del render",
    (publicPath) => {
      const { rerender } = render(<analytics.Analytics />);
      gtag.mockClear();

      // React puede agrupar ambas navegaciones y nunca confirmar la privada.
      // El guard de history debe apagar de inmediato; el siguiente commit
      // público debe reactivar incluso si isPrivate sigue siendo false.
      navigate("/acceso/token-sintetico-analytics");
      expect(browser[GA_DISABLE]).toBe(true);
      expect(browser[ADS_DISABLE]).toBe(true);
      navigate(publicPath);
      rerender(<analytics.Analytics />);

      expect(browser[GA_DISABLE]).toBe(false);
      expect(browser[ADS_DISABLE]).toBe(false);
      expect(gtag).toHaveBeenCalledExactlyOnceWith("event", "page_view", {
        page_path: publicPath,
        page_location: `${window.location.origin}${publicPath}`,
        page_title: document.title,
      });
    },
  );
});

describe("helpers Analytics — defensa por ubicación actual aunque gtag siga cargado", () => {
  it.each([
    "/acceso",
    "/acceso/token-sintetico-analytics",
    "/entrar",
    "/entrar/codigo-sintetico-analytics",
    "/studio/clientes",
    "/portal/perfil",
  ])("no emite leads ni conversiones desde %s sin depender del componente", (path) => {
    navigate(path);
    analytics.trackLead("registro");
    analytics.trackWhatsAppConversion("cta-sintetico");
    expect(gtag).not.toHaveBeenCalled();
  });

  it.each(["/servicios", "/registro", "/accesorios", "/entradas"])(
    "mantiene las señales públicas desde %s",
    (path) => {
      navigate(path);
      analytics.trackLead("contacto");
      analytics.trackWhatsAppConversion("cta-publico-sintetico");

      expect(gtag).toHaveBeenCalledWith("event", "generate_lead", { lead_method: "contacto" });
      expect(gtag).toHaveBeenCalledWith("event", "conversion", {
        send_to: "AW-561290482/qbu2CILjn7ocEPK50osC",
        value: 1,
        currency: "USD",
      });
      expect(gtag).toHaveBeenCalledWith("event", "whatsapp_click", {
        cta_origin: "cta-publico-sintetico",
      });
      expect(gtag).toHaveBeenCalledTimes(3);
    },
  );
});
