import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("SDD-0323 · fundamentos Web Quality", () => {
  it("permite zoom en la PWA y anuncia el idioma chino", () => {
    const layout = source("app/m/layout.tsx");
    const login = source("app/m/cn/login/page.tsx");

    expect(layout).not.toContain("maximumScale");
    expect(layout).not.toContain("userScalable: false");
    expect(login).toContain('lang={lang === "cn" ? "zh-CN" : "es"}');
  });

  it("genera un id de tarifa por formulario y completa el teclado de las tabs", () => {
    const form = source("components/CalculadoraForm.tsx");
    const tabs = source("components/TarifasTabs.tsx");

    expect(form).toContain("const tarifaCbmId = useId()");
    expect(form).toContain("htmlFor={tarifaCbmId}");
    expect(form).toContain("id={tarifaCbmId}");
    expect(form).not.toContain('id="tarifa-cbm"');
    expect(tabs).toContain("tabIndex={active ? 0 : -1}");
    for (const key of ["ArrowLeft", "ArrowRight", "Home", "End"]) {
      expect(tabs).toContain(`"${key}"`);
    }
  });

  it("usa semántica de selector y contraste legible en el dashboard", () => {
    const dashboard = source(
      "app/studio/(app)/dashboard/_components/DashboardWidgets.tsx",
    );

    expect(dashboard).toContain('role="group" aria-label="Período del gráfico"');
    expect(dashboard).toContain("aria-pressed={active}");
    expect(dashboard).not.toContain('role="tab"');
    expect(dashboard).not.toContain("var(--ink-mute)");
  });

  it("expone estado CRM textual y un skip-link funcional", () => {
    const crm = source(
      "app/studio/(app)/crm/_components/PuntoConversacion.tsx",
    );
    const nav = source("components/Nav.tsx");

    expect(crm).toContain('urgente ? "Nuevo" : "Enviado"');
    expect(crm).toContain('<span className="sr-only">{rotulo}</span>');
    expect(nav).toContain('href="#main-content"');
    expect(nav).toContain('document.querySelector<HTMLElement>("main")');
    expect(nav).toContain("main.focus()");
  });

  it("cubre las páginas legales indexables y el heading de enlaces", () => {
    const sitemap = source("app/sitemap.ts");
    const enlaces = source("app/enlaces/page.tsx");

    expect(sitemap).toContain("`${base}/cookies`");
    expect(sitemap).toContain("`${base}/privacidad`");
    expect(sitemap).toContain("if (TERMINOS_LIVE)");
    expect(sitemap).toContain("`${base}/terminos`");
    expect(enlaces).toContain('<h1 className="enlaces-tagline">');
  });
});
