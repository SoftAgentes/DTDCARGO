import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("accesibilidad de shells web", () => {
  it("expone un destino SSR para el skip link de la home", () => {
    expect(source("app/page.tsx")).toContain(
      '<main id="main-content" className="home-surface">',
    );
  });

  it.each([
    "app/entrar/EntrarForm.tsx",
    "app/studio/(auth)/login/LoginForm.tsx",
    "app/m/ve/login/page.tsx",
  ])("usa un landmark main en %s", (path) => {
    expect(source(path)).toContain("<main");
  });

  it("vuelve inerte el drawer mientras está cerrado", () => {
    expect(source("components/Nav.tsx")).toContain("inert={!open}");
  });

  it("retira opacidades de texto no AA del footer", () => {
    expect(source("components/Footer.tsx")).not.toMatch(
      /text-white\/(?:35|40|45)\b/,
    );
  });

  it("usa el token inverso legible y subraya recuperación en Studio", () => {
    const content = source("app/studio/(auth)/login/LoginForm.tsx");
    expect(content).toContain('color: "var(--ink-inv-soft)"');
    expect(content).toContain('textDecoration: "underline"');
  });
});
