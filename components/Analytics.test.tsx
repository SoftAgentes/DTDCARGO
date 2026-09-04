import type { ReactNode } from "react";
import { cleanup, render } from "@testing-library/react";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const navigation = vi.hoisted(() => ({
  pathname: "/servicios",
  searchParams: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useSearchParams: () => navigation.searchParams,
}));

// Marcadores inertes: permiten observar loader e init sin ejecutar scripts ni
// hacer solicitudes reales desde jsdom.
vi.mock("next/script", () => ({
  default: ({
    id,
    src,
    children,
  }: {
    id?: string;
    src?: string;
    children?: ReactNode;
  }) => (
    <span data-analytics-script="true" id={id} data-src={src}>
      {children}
    </span>
  ),
}));

const GA_ID = "G-SYNTHETIC-ANALYTICS";
const GA_DISABLE = `ga-disable-${GA_ID}`;
const ADS_DISABLE = "ga-disable-AW-561290482";
const browser = window as unknown as Record<string, unknown>;
const gtag = vi.fn();
let analytics: typeof import("./Analytics");
let originalUrl: string;
let originalTitle: string;
let originalGlobals: Map<string, PropertyDescriptor | undefined>;

function navigate(path: string, method: "pushState" | "replaceState" = "replaceState") {
  window.history[method]({}, "", path);
  navigation.pathname = window.location.pathname;
  navigation.searchParams = new URLSearchParams(window.location.search);
}

function clickWhatsApp() {
  const link = document.createElement("a");
  link.href = "https://wa.me/584121234567";
  document.body.append(link);
  // Registrado después del tracker: éste observa el click real y este segundo
  // listener evita que jsdom intente navegar fuera del documento de prueba.
  document.addEventListener("click", (event) => event.preventDefault(), {
    once: true,
  });
  link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  link.remove();
}

beforeAll(async () => {
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
  document.title = "Página pública sintética";
});

afterEach(() => {
  cleanup();
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

describe("Analytics — carga inicial sintética", () => {
  it.each([
    "/acceso/token-sintetico-analytics",
    "/entrar/codigo-sintetico-analytics",
    "/abrir?token_hash=token-sintetico&type=magiclink",
    "/registro?ref=REF-SINTETICO-0001",
    "/servicios#access_token=token-sintetico",
  ])("no monta ni emite Analytics en %s", (path) => {
    navigate(path);
    const { container } = render(<analytics.Analytics />);

    expect(container.querySelectorAll("[data-analytics-script]")).toHaveLength(0);
    expect(gtag).not.toHaveBeenCalled();
    expect(browser[GA_DISABLE]).toBe(true);
    expect(browser[ADS_DISABLE]).toBe(true);
  });

  it("no crea globals de Google al iniciar en una URL excluida", () => {
    navigate("/abrir?token_hash=token-sintetico&type=magiclink");
    delete browser.gtag;
    delete browser.dataLayer;

    const { container } = render(<analytics.Analytics />);

    expect(container.querySelectorAll("[data-analytics-script]")).toHaveLength(0);
    expect("gtag" in window).toBe(false);
    expect("dataLayer" in window).toBe(false);
    expect(browser[GA_DISABLE]).toBe(true);
    expect(browser[ADS_DISABLE]).toBe(true);
  });

  it("mantiene la carga y el page_view para una URL pública permitida", () => {
    navigate("/servicios?utm_source=prueba&utm_campaign=sintetica#cotizar");
    const { container } = render(<analytics.Analytics />);

    expect(
      container
        .querySelector("[data-analytics-script][data-src]")
        ?.getAttribute("data-src"),
    ).toBe(`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`);
    expect(container.querySelector("#ga-init")).not.toBeNull();
    expect(browser[GA_DISABLE]).toBe(false);
    expect(browser[ADS_DISABLE]).toBe(false);
    expect(gtag).toHaveBeenCalledExactlyOnceWith("event", "page_view", {
      page_path: "/servicios?utm_source=prueba&utm_campaign=sintetica",
      page_location:
        `${window.location.origin}/servicios` +
        "?utm_source=prueba&utm_campaign=sintetica",
      page_title: document.title,
    });
  });
});

describe("Analytics — navegación cliente sintética", () => {
  it.each([
    ["pushState", "/acceso/token-sintetico-analytics"],
    ["replaceState", "/abrir?token_hash=token-sintetico&type=magiclink"],
    ["pushState", "/registro?ref=REF-SINTETICO-0002"],
    ["pushState", "/servicios#access_token=token-sintetico"],
  ] as const)("apaga GA/Ads antes de history.%s hacia %s", (method, destination) => {
    const observed = vi.fn();
    const originalNavigation = window.history[method].bind(window.history);
    vi.spyOn(window.history, method).mockImplementation(
      (data, unused, url) => {
        observed({ ga: browser[GA_DISABLE], ads: browser[ADS_DISABLE] });
        originalNavigation(data, unused, url);
      },
    );
    const { container, rerender } = render(<analytics.Analytics />);
    expect(gtag).toHaveBeenCalledTimes(1);
    gtag.mockClear();

    navigate(destination, method);

    expect(observed).toHaveBeenCalledExactlyOnceWith({ ga: true, ads: true });
    analytics.trackLead("registro");
    analytics.trackWhatsAppConversion("cta-sintetico-privado");
    expect(gtag).not.toHaveBeenCalled();

    rerender(<analytics.Analytics />);
    expect(container.querySelectorAll("[data-analytics-script]")).toHaveLength(0);
    expect(browser[GA_DISABLE]).toBe(true);
    expect(browser[ADS_DISABLE]).toBe(true);
    expect(gtag).not.toHaveBeenCalled();

    navigate("/tarifas?utm_source=prueba", "pushState");
    rerender(<analytics.Analytics />);
    expect(browser[GA_DISABLE]).toBe(false);
    expect(browser[ADS_DISABLE]).toBe(false);
    expect(gtag).toHaveBeenCalledExactlyOnceWith("event", "page_view", {
      page_path: "/tarifas?utm_source=prueba",
      page_location: `${window.location.origin}/tarifas?utm_source=prueba`,
      page_title: document.title,
    });
  });

  it("permanece apagado durante una navegación privada→pública agrupada", () => {
    const { rerender } = render(<analytics.Analytics />);
    gtag.mockClear();

    navigate("/acceso/token-sintetico-analytics", "pushState");
    navigate("/servicios?utm_source=prueba", "replaceState");

    // No se reactiva dentro del wrapper de History: React debe confirmar que
    // la URL final es pública antes de volver a habilitar los tags.
    expect(browser[GA_DISABLE]).toBe(true);
    expect(browser[ADS_DISABLE]).toBe(true);
    expect(gtag).not.toHaveBeenCalled();

    rerender(<analytics.Analytics />);
    expect(browser[GA_DISABLE]).toBe(false);
    expect(browser[ADS_DISABLE]).toBe(false);
    expect(gtag).toHaveBeenCalledExactlyOnceWith("event", "page_view", {
      page_path: "/servicios?utm_source=prueba",
      page_location: `${window.location.origin}/servicios?utm_source=prueba`,
      page_title: document.title,
    });
  });

  it("remonta un solo listener de WhatsApp al volver a una URL pública", () => {
    const { rerender } = render(<analytics.Analytics />);

    navigate("/entrar/codigo-sintetico-analytics", "pushState");
    rerender(<analytics.Analytics />);
    navigate("/servicios", "pushState");
    rerender(<analytics.Analytics />);
    gtag.mockClear();

    clickWhatsApp();

    expect(gtag).toHaveBeenCalledWith("event", "conversion", {
      send_to: "AW-561290482/qbu2CILjn7ocEPK50osC",
      value: 1,
      currency: "USD",
    });
    expect(gtag).toHaveBeenCalledWith("event", "whatsapp_click", {
      cta_origin: "/servicios",
    });
    expect(gtag).toHaveBeenCalledTimes(2);
  });
});
