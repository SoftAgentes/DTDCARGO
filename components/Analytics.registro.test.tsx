import type { ReactNode } from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * SDD-0684 fase 2 · Google Analytics en el registro.
 *
 * `/registro` a secas carga la etiqueta (ahí se mide la conversión de registro).
 * Las subrutas con un enlace personal en la ruta (`/registro/link/…`,
 * `/registro/activar/…`, `/registro/correo/…`) no la cargan, igual que Clarity.
 * Mira el render real del componente, no solo la lista de prefijos: si alguien
 * quita una de las tres exclusiones, el caso correspondiente falla.
 */

let ruta = "/registro";

vi.mock("next/navigation", () => ({
  usePathname: () => ruta,
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/script", () => ({
  default: ({ id, src, children }: { id?: string; src?: string; children?: ReactNode }) => (
    <span data-analytics-script="true" id={id} data-src={src}>
      {children}
    </span>
  ),
}));

let originalUrl: string;

async function montar(path: string) {
  ruta = path;
  window.history.replaceState({}, "", path);
  vi.resetModules();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_GA_ID", "G-TESTREGISTRO");
  const { Analytics } = await import("./Analytics");
  return render(<Analytics />).container;
}

beforeEach(() => {
  originalUrl = window.location.href;
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  window.history.replaceState({}, "", originalUrl);
});

describe("Google Analytics en el registro (SDD-0684 fase 2)", () => {
  it("carga la etiqueta en /registro", async () => {
    const container = await montar("/registro");
    expect(container.querySelectorAll("[data-analytics-script]").length).toBeGreaterThan(0);
  });

  it.each([
    "/registro/link/token-sintetico-ga",
    "/registro/activar/token-sintetico-ga",
    "/registro/correo/token-sintetico-ga",
  ])("no carga nada en %s", async (path) => {
    const container = await montar(path);
    expect(container.querySelectorAll("[data-analytics-script]").length).toBe(0);
    expect(container.innerHTML).not.toContain("token-sintetico-ga");
  });
});
