import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * SDD-0061 Fase A — renames de calculadoras públicas.
 *
 * Valida (a nivel de fuente, sin levantar Next) los criterios de `acceptance`
 * de la spec Fase A: `/cotizar` → `/estimacion` (+ 301), la calculadora terrestre
 * a página propia `/calculadora-terrestre`, sitemap actualizado, y que no queden
 * referencias colgadas al URL viejo en los archivos de ruteo/SEO.
 *
 * El smoke E2E (`e2e/smoke.spec.ts`) cubre el render/redirect en runtime; este
 * test corre dentro de `node scripts/verify.mjs` (Vitest), que es el gate.
 */

const root = resolve(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(resolve(root, rel), "utf8");

describe("SDD-0061 Fase A · ruta /estimacion (ex /cotizar)", () => {
  it("la página /estimacion existe y la vieja /cotizar ya no", () => {
    expect(existsSync(resolve(root, "app/estimacion/page.tsx"))).toBe(true);
    expect(existsSync(resolve(root, "app/cotizar/page.tsx"))).toBe(false);
  });

  it("metadata de /estimacion: title + canonical + og path al URL nuevo", () => {
    const page = read("app/estimacion/page.tsx");
    expect(page).toContain('title: "Estimación inicial"');
    expect(page).toContain('canonical: "/estimacion"');
    expect(page).toContain('path: "/estimacion"');
    // breadcrumb al URL nuevo
    expect(page).toContain('{ name: "Estimación", path: "/estimacion" }');
    expect(page).not.toContain('"/cotizar"');
  });

  it("el componente del form se renombró a EstimacionForm", () => {
    expect(existsSync(resolve(root, "components/EstimacionForm.tsx"))).toBe(true);
    expect(existsSync(resolve(root, "components/CotizarForm.tsx"))).toBe(false);
    const form = read("components/EstimacionForm.tsx");
    expect(form).toContain("export function EstimacionForm()");
    expect(form).not.toContain("export function CotizarForm");
    const page = read("app/estimacion/page.tsx");
    expect(page).toContain("import { EstimacionForm }");
  });
});

describe("SDD-0061 Fase A · calculadora terrestre a página propia", () => {
  it("/calculadora-terrestre existe y monta UltimoKmCalculator", () => {
    expect(existsSync(resolve(root, "app/calculadora-terrestre/page.tsx"))).toBe(
      true,
    );
    const page = read("app/calculadora-terrestre/page.tsx");
    expect(page).toContain("UltimoKmCalculator");
    expect(page).toContain('canonical: "/calculadora-terrestre"');
    expect(page).toContain(
      '{ name: "Calculadora terrestre", path: "/calculadora-terrestre" }',
    );
  });

  it("EstimacionForm ya no embebe la calc terrestre; deja enlace contextual", () => {
    const form = read("components/EstimacionForm.tsx");
    expect(form).not.toContain("<UltimoKmCalculator");
    expect(form).not.toContain("./UltimoKmCalculator");
    expect(form).toContain('href="/calculadora-terrestre"');
  });
});

describe("SDD-0061 Fase A · SEO / no romper", () => {
  it("next.config.ts redirige /cotizar → /estimacion (301 permanente)", () => {
    const cfg = read("next.config.ts");
    expect(cfg).toContain("async redirects()");
    expect(cfg).toContain('source: "/cotizar"');
    expect(cfg).toContain('destination: "/estimacion"');
    expect(cfg).toContain("permanent: true");
  });

  it("sitemap: con /estimacion + /calculadora-terrestre, sin /cotizar", () => {
    const sm = read("app/sitemap.ts");
    expect(sm).toContain("/estimacion");
    expect(sm).toContain("/calculadora-terrestre");
    expect(sm).not.toContain("/cotizar");
  });

  it("enlaces internos / plantillas apuntan al URL nuevo", () => {
    // HeroCotizador.tsx (el enlazador viejo del hero) se PODÓ el 2026-07-05:
    // era código muerto sin importadores desde el rediseño del Hero. No debe
    // volver — el enlace a /estimacion se reconectará desde otra superficie.
    expect(existsSync(resolve(root, "components/HeroCotizador.tsx"))).toBe(
      false,
    );
    expect(read("scripts/seed-mail-templates.ts")).toContain(
      "dtdcargo.com/estimacion",
    );
    expect(read("scripts/seed-mail-templates.ts")).not.toContain(
      "dtdcargo.com/cotizar",
    );
  });

  it("allowlists de ruta pública cubren las rutas nuevas", () => {
    const eslint = read("eslint.config.mjs");
    expect(eslint).toContain('"app/estimacion/**"');
    expect(eslint).toContain('"app/calculadora-terrestre/**"');
    expect(eslint).not.toContain('"app/cotizar/**"');
  });
});
