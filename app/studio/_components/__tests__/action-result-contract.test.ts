// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { act, cleanup, render, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/studio/(app)/_actions/apariencia-actions", () => ({
  guardarAparienciaAction: vi.fn(),
}));
vi.mock("../ui/ToastProvider", () => ({ useToast: () => ({ show: vi.fn() }) }));

import { AppearanceSection } from "../../(app)/admin/_components/AppearanceSection";
import { applyDensity, applyTheme } from "../appearance-prefs";

afterEach(() => {
  cleanup();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  delete document.documentElement.dataset.density;
});

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("resultados de acciones y preferencias", () => {
  it.each([
    "app/portal/_components/ReferralInviteForm.tsx",
    "app/portal/(app)/reclamos/_components/PortalClaims.tsx",
    "app/studio/(app)/admin/_components/RecepcionAddonsSection.tsx",
    "app/studio/(app)/fiscal/_components/FiscalConfig.tsx",
  ])("maneja cada respuesta una sola vez en %s", (path) => {
    expect(source(path)).toContain("handledState !== state");
  });

  it.each([
    "app/portal/_components/ShareProviderButton.tsx",
    "app/registro/RegisterForm.tsx",
    "app/studio/(app)/marketing/noticias-web/_components/LLMModeToggle.tsx",
  ])("consume el entorno con snapshot SSR en %s", (path) => {
    expect(source(path)).toContain("useSyncExternalStore");
  });

  it("Apariencia conserva el snapshot SSR aunque el navegador tenga otra elección", () => {
    applyDensity("ultra");
    applyTheme("light");
    const container = document.createElement("div");
    container.innerHTML = renderToString(createElement(AppearanceSection));
    expect(within(container).getByRole("radio", { name: /Compacta/, checked: true })).toBeTruthy();
    expect(within(container).getByRole("radio", { name: /Oscuro/, checked: true })).toBeTruthy();
  });

  it("Apariencia refleja cambios externos de vista y tema después del montaje", () => {
    applyDensity("compact");
    applyTheme("dark");
    const view = render(createElement(AppearanceSection));
    expect(view.getByRole("radio", { name: /Compacta/, checked: true })).toBeTruthy();
    expect(view.getByRole("radio", { name: /Oscuro/, checked: true })).toBeTruthy();
    act(() => {
      applyDensity("normal");
      applyTheme("light");
    });
    expect(view.getByRole("radio", { name: /Normal/, checked: true })).toBeTruthy();
    expect(view.getByRole("radio", { name: /Claro/, checked: true })).toBeTruthy();
  });

  it("conserva el token de API para revelarlo una sola vez", () => {
    const code = source(
      "app/studio/(app)/admin/_components/ApiIntegrationSection.tsx",
    );
    expect(code).toContain("setRevealToken(createState.token)");
    expect(code).toContain("handledCreateState !== createState");
  });

  it("salta al paso de amonestación que contiene el error", () => {
    const code = source(
      "app/studio/(app)/nomina/_components/AmonestacionDrawer.tsx",
    );
    expect(code).toContain("handledFieldErrors !== state.fieldErrors");
    expect(code).toContain("setStep(1)");
  });
});
