// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

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
    "app/studio/(app)/admin/_components/AppearanceSection.tsx",
    "app/studio/(app)/marketing/noticias-web/_components/LLMModeToggle.tsx",
  ])("consume el entorno con snapshot SSR en %s", (path) => {
    expect(source(path)).toContain("useSyncExternalStore");
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
