/**
 * SDD-0655 · La Bandeja salió del menú lateral y es una pestaña de CRM.
 *
 * - No hay ítem «Bandeja»; el ítem «CRM» la reúne con Embudos.
 * - «CRM» lleva a Embudos; a quien solo ve la Bandeja (support), a la Bandeja.
 * - Queda activo en las dos pestañas.
 * - El contador de no leídos (`BandejaBadge`) cuelga de «CRM», y solo si quien
 *   mira ve la Bandeja (rol + flag `chatwoot_inbox`).
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FEATURE_FLAG_DEFAULTS, type FeatureFlags } from "@/lib/studio/feature-flags-types";
import type { StudioUserRole } from "@/lib/studio/user-types";

const nav = vi.hoisted(() => ({ pathname: "/studio/dashboard" }));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("../BandejaBadge", async () => {
  const { createElement: h } = await import("react");
  return { BandejaBadge: () => h("span", { "data-testid": "badge-bandeja" }, "3") };
});

const { StudioSidebar } = await import("../StudioSidebar");

const ENCENDIDA: FeatureFlags = { ...FEATURE_FLAG_DEFAULTS, chatwoot_inbox: true };
const APAGADA: FeatureFlags = { ...FEATURE_FLAG_DEFAULTS, chatwoot_inbox: false };
const BANDEJA = { tenantId: "10000000-0000-4000-8000-000000000001", initial: [] };

function abrir(role: StudioUserRole, flags: FeatureFlags, pathname = "/studio/dashboard") {
  nav.pathname = pathname;
  render(<StudioSidebar role={role} featureFlags={flags} bandeja={BANDEJA} />);
}

const enlaceCrm = () => screen.queryByRole("link", { name: /^CRM/, hidden: true });

afterEach(() => {
  cleanup();
  try {
    localStorage.clear();
  } catch {
    // jsdom sin storage: nada que limpiar
  }
});

describe("menú lateral: la Bandeja dentro de CRM (SDD-0655)", () => {
  it.each(["admin", "commercial", "support"] as const)("%s no tiene ítem «Bandeja» en el menú", (rol) => {
    abrir(rol, ENCENDIDA, "/studio/crm");
    expect(screen.queryByRole("link", { name: /^Bandeja/, hidden: true })).toBeNull();
    expect(enlaceCrm()).toBeTruthy();
  });

  it("commercial: «CRM» lleva a Embudos y trae el contador de la Bandeja", () => {
    abrir("commercial", ENCENDIDA, "/studio/crm");
    expect(enlaceCrm()?.getAttribute("href")).toBe("/studio/crm");
    expect(screen.getByTestId("badge-bandeja")).toBeTruthy();
    expect(enlaceCrm()?.contains(screen.getByTestId("badge-bandeja"))).toBe(true);
  });

  it("support (ve la Bandeja, no CRM): «CRM» lleva a la Bandeja; no pierde su acceso", () => {
    abrir("support", ENCENDIDA, "/studio/clientes");
    expect(enlaceCrm()?.getAttribute("href")).toBe("/studio/bandeja");
    expect(screen.getByTestId("badge-bandeja")).toBeTruthy();
  });

  it("commercial con la Bandeja apagada: «CRM» sin contador", () => {
    abrir("commercial", APAGADA, "/studio/crm");
    expect(enlaceCrm()?.getAttribute("href")).toBe("/studio/crm");
    expect(screen.queryByTestId("badge-bandeja")).toBeNull();
  });

  it("support con la Bandeja apagada: sin ítem «CRM» (no ve ninguna pestaña)", () => {
    abrir("support", APAGADA, "/studio/clientes");
    expect(enlaceCrm()).toBeNull();
    expect(screen.queryByTestId("badge-bandeja")).toBeNull();
  });

  it("accounting: ni CRM ni contador", () => {
    abrir("accounting", ENCENDIDA, "/studio/dashboard");
    expect(enlaceCrm()).toBeNull();
    expect(screen.queryByTestId("badge-bandeja")).toBeNull();
  });

  it.each(["/studio/crm", "/studio/bandeja"])("«CRM» queda activo en %s", (ruta) => {
    abrir("commercial", ENCENDIDA, ruta);
    expect(enlaceCrm()?.getAttribute("aria-current")).toBe("page");
  });

  it("«CRM» no queda activo en Clientes", () => {
    abrir("commercial", ENCENDIDA, "/studio/clientes");
    expect(enlaceCrm()?.getAttribute("aria-current")).toBeNull();
  });
});
