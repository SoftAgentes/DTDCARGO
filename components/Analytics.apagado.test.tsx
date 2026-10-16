import type { ReactNode } from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * SDD-0544 · `NEXT_PUBLIC_GA_ID=off` apaga Google Analytics y Ads en el build.
 *
 * El entorno de prueba de la SDD-0540 corre una imagen de producción
 * (`NODE_ENV=production`), así que sin un valor de apagado el componente caía al
 * ID real de la propiedad y cargaba la etiqueta de Ads: prueba ensuciaba los
 * reportes y las conversiones de la campaña.
 *
 * Esta prueba mira el render y los disparos. Que los IDs no lleguen a ningún
 * chunk del navegador lo prueba `Analytics.apagado-build.test.ts`, con el
 * compilador y el minificador de Next.
 *
 * `GA_ID` se calcula al importar el módulo: cada caso fija el entorno y vuelve a
 * importar `./Analytics` desde cero.
 */

vi.mock("next/navigation", () => ({
  usePathname: () => "/servicios",
  useSearchParams: () => new URLSearchParams(),
}));

// Marcadores inertes, igual que en Analytics.test.tsx.
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

const browser = window as unknown as Record<string, unknown>;
const gtag = vi.fn();
let originalUrl: string;

async function cargar(gaId: string | undefined) {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_GA_ID", gaId);
  return import("./Analytics");
}

function clickWhatsApp() {
  const link = document.createElement("a");
  link.href = "https://wa.me/584121234567";
  document.body.append(link);
  document.addEventListener("click", (event) => event.preventDefault(), {
    once: true,
  });
  link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  link.remove();
}

beforeEach(() => {
  originalUrl = window.location.href;
  window.history.replaceState({}, "", "/servicios");
  gtag.mockReset();
  // Un gtag ya presente en la ventana (otro script, una extensión): con el
  // apagado, el componente tampoco lo usa.
  browser.gtag = gtag;
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  window.history.replaceState({}, "", originalUrl);
  delete browser.gtag;
  for (const key of Object.keys(browser)) {
    if (key.startsWith("ga-disable-")) delete browser[key];
  }
});

describe("SDD-0544 · NEXT_PUBLIC_GA_ID=off apaga GA y Ads", () => {
  it("en producción, off no carga el loader ni el init", async () => {
    const { Analytics } = await cargar("off");
    const { container } = render(<Analytics />);
    expect(container.querySelectorAll("[data-analytics-script]")).toHaveLength(0);
    expect(container.innerHTML).not.toMatch(/G-25CD7BZH98|AW-561290482|googletagmanager/);
  });

  it("off no deja banderas ga-disable con los IDs reales", async () => {
    const { Analytics } = await cargar("off");
    render(<Analytics />);
    expect(Object.keys(browser).filter((k) => k.startsWith("ga-disable-"))).toEqual([]);
  });

  it("off no dispara la conversión de WhatsApp aunque haya un gtag", async () => {
    const { Analytics } = await cargar("off");
    render(<Analytics />);
    clickWhatsApp();
    expect(gtag).not.toHaveBeenCalled();
  });

  it("off tampoco registra leads ni conversiones manuales", async () => {
    const { trackLead, trackWhatsAppConversion } = await cargar("off");
    trackLead("registro");
    trackWhatsAppConversion("/tarifas");
    expect(gtag).not.toHaveBeenCalled();
  });

  it("producción sin cambios: con el valor vacío carga GA y Ads con el ID de la propiedad", async () => {
    const { Analytics } = await cargar("");
    const { container } = render(<Analytics />);
    const scripts = [...container.querySelectorAll("[data-analytics-script]")];
    expect(scripts).toHaveLength(2);
    expect(scripts.find((s) => !s.id)?.getAttribute("data-src")).toBe(
      "https://www.googletagmanager.com/gtag/js?id=G-25CD7BZH98",
    );
    const init = scripts.find((s) => s.id === "ga-init")?.textContent ?? "";
    expect(init).toContain("gtag('config','G-25CD7BZH98',{send_page_view:false});");
    expect(init).toContain("gtag('config','AW-561290482');");
  });

  it("producción sin cambios: la conversión de WhatsApp sigue saliendo con su send_to", async () => {
    const { Analytics } = await cargar("");
    render(<Analytics />);
    clickWhatsApp();
    expect(gtag).toHaveBeenCalledWith("event", "conversion", {
      send_to: "AW-561290482/qbu2CILjn7ocEPK50osC",
      value: 1.0,
      currency: "USD",
    });
  });
});
