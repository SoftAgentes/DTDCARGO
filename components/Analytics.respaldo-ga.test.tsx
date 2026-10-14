import type { ReactNode } from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * SDD-0518 · el Measurement ID de GA cae al respaldo también con cadena vacía.
 *
 * La imagen Docker de la 0505 recibe cada `NEXT_PUBLIC_*` como build arg, y un
 * build arg sin valor llega a `next build` como `""`, no como `undefined`. Con
 * `??` la cadena vacía no caía al ID de la propiedad: `GA_ID` quedaba vacío, el
 * componente devolvía null y tampoco cargaba la etiqueta de Google Ads.
 *
 * `GA_ID` se calcula al importar el módulo, así que cada caso fija el entorno y
 * vuelve a importar `./Analytics` desde cero. Lo que se observa es el render:
 * el loader de gtag.js y el init con los dos `config` (GA4 y Ads).
 */

vi.mock("next/navigation", () => ({
  usePathname: () => "/servicios",
  useSearchParams: () => new URLSearchParams(),
}));

// Marcadores inertes, igual que en Analytics.test.tsx: dejan ver el loader y el
// init sin ejecutar scripts ni pedir nada a Google desde jsdom.
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

const RESPALDO = "G-25CD7BZH98";
const ADS_ID = "AW-561290482";
const ID_REAL = "G-SYNTHETIC0518";
const browser = window as unknown as Record<string, unknown>;

let originalUrl: string;

async function renderAnalytics(gaId: string | undefined, nodeEnv: string) {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", nodeEnv);
  vi.stubEnv("NEXT_PUBLIC_GA_ID", gaId);
  const { Analytics } = await import("./Analytics");
  const { container } = render(<Analytics />);
  const scripts = [...container.querySelectorAll("[data-analytics-script]")];
  return {
    scripts,
    loaderSrc: scripts.find((s) => !s.id)?.getAttribute("data-src") ?? null,
    init: scripts.find((s) => s.id === "ga-init")?.textContent ?? null,
  };
}

function expectCargaCon(
  carga: Awaited<ReturnType<typeof renderAnalytics>>,
  id: string,
) {
  expect(carga.scripts).toHaveLength(2);
  expect(carga.loaderSrc).toBe(
    `https://www.googletagmanager.com/gtag/js?id=${id}`,
  );
  expect(carga.init).toContain(`gtag('config','${id}',{send_page_view:false});`);
  expect(carga.init).toContain(`gtag('config','${ADS_ID}');`);
}

beforeEach(() => {
  originalUrl = window.location.href;
  window.history.replaceState({}, "", "/servicios");
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  window.history.replaceState({}, "", originalUrl);
  for (const key of Object.keys(browser)) {
    if (key.startsWith("ga-disable-")) delete browser[key];
  }
});

describe("SDD-0518 · respaldo del Measurement ID con cadena vacía", () => {
  it("en producción, NEXT_PUBLIC_GA_ID vacía cae al ID de la propiedad y carga GA y Ads", async () => {
    expectCargaCon(await renderAnalytics("", "production"), RESPALDO);
  });

  it("en producción, NEXT_PUBLIC_GA_ID con sólo espacios también cae al respaldo", async () => {
    expectCargaCon(await renderAnalytics(" \t ", "production"), RESPALDO);
  });

  it("en producción, NEXT_PUBLIC_GA_ID sin definir sigue cayendo al respaldo", async () => {
    expectCargaCon(await renderAnalytics(undefined, "production"), RESPALDO);
  });

  it("un ID real se usa tal cual, sin el respaldo", async () => {
    const carga = await renderAnalytics(ID_REAL, "production");
    expectCargaCon(carga, ID_REAL);
    expect(carga.init).not.toContain(RESPALDO);
  });

  it("un ID real con espacios alrededor se usa recortado", async () => {
    expectCargaCon(await renderAnalytics(`  ${ID_REAL}\n`, "production"), ID_REAL);
  });

  it("fuera de producción, la cadena vacía deja GA apagado como hoy", async () => {
    const carga = await renderAnalytics("", "development");
    expect(carga.scripts).toHaveLength(0);
  });

  it("fuera de producción, un ID real sí carga", async () => {
    expectCargaCon(await renderAnalytics(ID_REAL, "development"), ID_REAL);
  });
});
