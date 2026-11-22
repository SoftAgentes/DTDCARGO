/**
 * SDD-0657 · Enlaces contextuales entre servicios, guías y calculadoras.
 *
 * El pie da a cada página al menos un enlace (`components/Footer.enlaces.test.tsx`).
 * Aquí se prueba el enlace dentro del contenido, que es el que le dice a Google
 * de qué trata la página enlazada: cada servicio con su calculadora, y la guía
 * de puerta a puerta con su ficha y con las ciudades. El pie y el menú se
 * sustituyen para que solo cuenten los enlaces del cuerpo.
 */
import type { ReactNode } from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/Nav", () => ({ Nav: () => null }));
vi.mock("@/components/Footer", () => ({ Footer: () => null }));
vi.mock("@/components/WhatsAppFAB", () => ({ WhatsAppFAB: () => null }));
vi.mock("@/lib/fonts", () => ({ jetbrainsMono: { variable: "font-mono-local" } }));
// Solo se sustituyen las lecturas remotas y las calculadoras interactivas.
vi.mock("@/lib/public/servicios-queries", async () => ({
  getServiciosParaSitio: async () => (await import("@/lib/servicios-detalle")).SERVICIOS_DETALLE,
}));
vi.mock("@/lib/public/rates-queries", () => ({
  getPublicFclRoutes: async () => [],
  getPublicCbmRate: async () => null,
  getPublicCalculatorConfig: async () => null,
  getPublicCalculatorCities: async () => [],
  getPublicCarrierTariffs: async () => [],
  combinarDestinos: () => [],
}));
vi.mock("@/components/TarifasTabs", () => ({ TarifasTabs: () => null }));
vi.mock("@/components/FclCalculator", () => ({ FclCalculator: () => null }));

afterEach(cleanup);

type Pagina = { default: () => ReactNode | Promise<ReactNode> };

const CASOS: Array<[string, () => Promise<Pagina>, string[]]> = [
  ["/puerta-a-puerta", () => import("@/app/puerta-a-puerta/page"), ["/servicios/puerta-a-puerta", "/importar-de-china"]],
  ["/servicios/puerta-a-puerta", () => import("@/app/servicios/puerta-a-puerta/page"), ["/puerta-a-puerta", "/importar-de-china"]],
  ["/fcl", () => import("@/app/fcl/page"), ["/servicios/fcl", "/llenado"]],
  ["/servicios/fcl", () => import("@/app/servicios/fcl/page"), ["/fcl", "/llenado"]],
  ["/servicios/lcl", () => import("@/app/servicios/lcl/page"), ["/tarifas", "/servicios/puerta-a-puerta"]],
  ["/tarifas", () => import("@/app/tarifas/page"), ["/servicios/puerta-a-puerta", "/servicios/lcl", "/fcl"]],
];

describe.each(CASOS)("%s", (_ruta, cargar, esperadas) => {
  it("enlaza desde el contenido a sus páginas hermanas", async () => {
    const { default: Pagina } = await cargar();
    const { container } = render(<>{await Pagina()}</>);
    const enlaces = [...container.querySelectorAll("a[href]")].map((a) => a.getAttribute("href"));
    for (const destino of esperadas) {
      expect(enlaces, destino).toContain(destino);
    }
  });
});
