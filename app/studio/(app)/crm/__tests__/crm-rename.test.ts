// @vitest-environment node
/**
 * Contract test del rebrand a "CRM" (founder 2026-08-11).
 *
 * Decisión: el módulo comercial se llama **CRM** — un rótulo neutro respecto al
 * proveedor. Si mañana montamos el nuestro o cambiamos de herramienta, el
 * nombre sobrevive. Como corolario, la palabra "Kommo" **no aparece en pantalla**.
 *
 * Lo que NO se renombra (y este test lo fija, para que nadie lo "arregle"):
 * el `id` del módulo, la clave de RBAC, las tablas `kommo_*`, las edge
 * functions y los identificadores de código. Eso es plomería, no marca —
 * renombrarlo movería permisos y contratos de datos sin ninguna ganancia.
 *
 * Sigue el molde de `app/studio/(app)/cotizador/__tests__/fase-c-rename.test.ts`
 * (SDD-0061 Fase C): un rename se afirma en el registro Y en i18n, porque el
 * sidebar lee el `labelKey` y el label suelto sólo es el respaldo.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("rebrand CRM · registro de módulos", () => {
  it("hay UNA sola entrada de CRM y se llama 'CRM'", () => {
    const registry = read("lib/studio/modules.ts");
    expect(registry).toContain(
      'label: "CRM", labelKey: "chrome.sidebar.crm"',
    );
    // La entrada vieja "CRM · Leads" (placeholder vacío) se eliminó.
    expect(registry).not.toContain('"CRM · Leads"');
    expect(registry).not.toContain('slug: "/studio/leads"');
    // Y no queda ningún rótulo con el nombre del proveedor.
    expect(registry).not.toContain('label: "Kommo CRM"');
  });

  it("el id del módulo sigue siendo 'kommo' (clave de RBAC y de datos)", () => {
    expect(read("lib/studio/modules.ts")).toContain('id: "kommo"');
    expect(read("lib/studio/rbac.ts")).toContain("kommo:");
  });

  it("la ruta es /studio/crm", () => {
    expect(read("lib/studio/modules.ts")).toContain('slug: "/studio/crm"');
    expect(existsSync(join(process.cwd(), "app/studio/(app)/crm/page.tsx"))).toBe(
      true,
    );
    expect(existsSync(join(process.cwd(), "app/studio/(app)/leads"))).toBe(false);
  });
});

describe("rebrand CRM · i18n en los DOS idiomas", () => {
  // El Studio es bilingüe: el equipo de Yiwu lo ve en chino. Un rename que
  // sólo toca es-VE deja el sidebar a medias.
  it("la clave chrome.sidebar.crm existe en es-VE y en zh-CN", () => {
    expect(read("lib/i18n/es-VE/chrome.ts")).toContain(
      '"chrome.sidebar.crm": "CRM"',
    );
    expect(read("lib/i18n/zh-CN/chrome.ts")).toContain(
      '"chrome.sidebar.crm": "CRM"',
    );
  });

  it("la clave vieja chrome.sidebar.leads ya no existe en ningún locale", () => {
    expect(read("lib/i18n/es-VE/chrome.ts")).not.toContain("chrome.sidebar.leads");
    expect(read("lib/i18n/zh-CN/chrome.ts")).not.toContain("chrome.sidebar.leads");
  });
});

describe("rebrand CRM · redirects", () => {
  it("las rutas viejas hacen 308 permanente a /studio/crm", () => {
    const cfg = read("next.config.ts");
    expect(cfg).toContain(
      '{ source: "/studio/kommo", destination: "/studio/crm", permanent: true }',
    );
    expect(cfg).toContain(
      '{ source: "/studio/leads", destination: "/studio/crm", permanent: true }',
    );
  });
});

describe("rebrand CRM · la palabra 'Kommo' no llega a la pantalla", () => {
  /**
   * Recorre los .tsx del módulo y se queda sólo con las líneas de texto
   * visible. Descarta comentarios (`*`, `//`, `{/*`) e imports: ahí "Kommo"
   * SÍ puede seguir — es la mitigación del costo de soporte de haber quitado
   * el nombre del proveedor de la UI. Quien depure necesita saber qué hay
   * detrás; quien vende, no.
   */
  const visibles = (code: string): string[] =>
    code
      .split(/\r?\n/)
      .filter((l) => {
        const t = l.trim();
        if (!t.includes("Kommo")) return false;
        if (t.startsWith("*") || t.startsWith("//") || t.startsWith("/*")) return false;
        if (t.startsWith("{/*")) return false;
        if (t.startsWith("import ") || t.startsWith("} from")) return false;
        // Identificadores: Kommo pegado a una mayúscula (KommoClient, getKommoX).
        return /Kommo(?![A-Z])/.test(t);
      })
      .map((l) => l.trim());

  const dir = "app/studio/(app)/crm";
  const archivos = readdirSync(join(process.cwd(), dir, "_components"))
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => `${dir}/_components/${f}`)
    .concat([`${dir}/page.tsx`]);

  it.each(archivos)("sin 'Kommo' en texto visible de %s", (path) => {
    expect(visibles(read(path))).toEqual([]);
  });

  it("el <title> de la página es 'CRM'", () => {
    expect(read(`${dir}/page.tsx`)).toContain('title: "CRM"');
  });
});
