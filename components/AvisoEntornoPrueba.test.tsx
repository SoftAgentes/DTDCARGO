import { readFileSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AvisoEntornoPrueba } from "./AvisoEntornoPrueba";

/**
 * SDD-0544 · aviso «Entorno de prueba» (D11 de la SDD-0540).
 *
 * El componente decide con `resolveAppEnv` (`lib/runtime/app-env.ts`): sólo
 * `staging` lo pinta. Los Preview de Vercel no: escriben en la base de
 * producción. El render en las cuatro superficies está en
 * `app/__tests__/aviso-entorno-prueba-superficies.test.tsx`.
 */

afterEach(cleanup);

describe("SDD-0544 · AvisoEntornoPrueba", () => {
  it("con APP_ENV=staging se ve y se anuncia", () => {
    render(<AvisoEntornoPrueba env={{ APP_ENV: "staging", NODE_ENV: "production" }} />);
    const aviso = screen.getByRole("note", { name: "Entorno de prueba" });
    expect(aviso).toHaveTextContent("Entorno de prueba");
    expect(aviso).toHaveTextContent("No es el sitio real");
  });

  it("acepta STAGING con mayúsculas y espacios, como el resto del runtime", () => {
    render(<AvisoEntornoPrueba env={{ APP_ENV: " STAGING ", NODE_ENV: "production" }} />);
    expect(screen.getByRole("note", { name: "Entorno de prueba" })).toBeInTheDocument();
  });

  it.each([
    ["production", { APP_ENV: "production", NODE_ENV: "production" }],
    ["un valor desconocido, que cae a production", { APP_ENV: "prod", NODE_ENV: "production" }],
    ["APP_ENV vacío en una imagen de producción", { APP_ENV: "", NODE_ENV: "production" }],
    ["un Preview de Vercel, que escribe en producción", { VERCEL_ENV: "preview", NODE_ENV: "production" }],
    ["preview explícito", { APP_ENV: "preview", NODE_ENV: "production" }],
    ["local", { APP_ENV: "local", NODE_ENV: "development" }],
  ])("no aparece con %s", (_n, env) => {
    const { container } = render(<AvisoEntornoPrueba env={env} />);
    expect(container).toBeEmptyDOMElement();
  });
});

/**
 * Lo que hace que «se vea de verdad»: fijo, encima de cualquier capa del repo,
 * sin atrapar clics y con los tokens del tono «Atención» de BRAND.md.
 */
describe("SDD-0544 · estilos del aviso", () => {
  const css = readFileSync(resolve("app/globals.css"), "utf8");
  const regla = (selector: string) => {
    const m = css.match(new RegExp(`\\n${selector.replace(/[.]/g, "\\.")}\\s*\\{([^}]*)\\}`));
    if (!m) throw new Error(`no encuentro ${selector} en app/globals.css`);
    return m[1];
  };

  it("app/globals.css se parsea: un error de CSS no espera al build", () => {
    // Vitest corre con `css: false`, así que un comentario cerrado antes de
    // tiempo (`--s-*/--r-*` dentro de `/* … */`) sólo aparecía en `next build`:
    // así falló el CI de la primera cabeza de esta SDD. Se parsea con el
    // postcss que trae Next.
    const desdeNext = createRequire(createRequire(import.meta.url).resolve("next/package.json"));
    const postcss = desdeNext("postcss") as { parse: (css: string) => unknown };
    expect(() => postcss.parse(css)).not.toThrow();
    // Control: el comentario que rompió el build, vuelto a poner en su lugar,
    // da el mismo error que dio el CI («Unknown word no»).
    const roto = css.replace(
      "La escala de espacios y radios (--s-1 y siguientes, --r-sm y siguientes) no\n   está en :root",
      "La escala --s-*/--r-* no está en :root",
    );
    expect(roto).not.toBe(css);
    expect(() => postcss.parse(roto)).toThrow(/Unknown word no/);
  });

  it("la franja es fija, no atrapa clics y usa el dorado de atención", () => {
    const franja = regla(".entorno-prueba");
    expect(franja).toMatch(/position:\s*fixed/);
    expect(franja).toMatch(/pointer-events:\s*none/);
    expect(franja).toMatch(/var\(--color-status-warning\)/);
  });

  it("la etiqueta es dorado con texto navy fijo (--on-warning), sin hex sueltos", () => {
    const etiqueta = regla(".entorno-prueba__etiqueta");
    expect(etiqueta).toMatch(/background:\s*var\(--color-status-warning\)/);
    expect(etiqueta).toMatch(/color:\s*var\(--on-warning\)/);
    expect(etiqueta).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  it("queda por encima de cualquier z-index del repo", () => {
    const propio = Number(regla(".entorno-prueba").match(/z-index:\s*(\d+)/)?.[1]);
    expect(propio).toBeGreaterThan(0);

    const archivos: string[] = [];
    const recorrer = (dir: string) => {
      for (const nombre of readdirSync(dir)) {
        if (nombre === "node_modules" || nombre.startsWith(".")) continue;
        const ruta = join(dir, nombre);
        if (statSync(ruta).isDirectory()) recorrer(ruta);
        else if (/\.(css|tsx|ts)$/.test(nombre) && !/\.test\.tsx?$/.test(nombre)) archivos.push(ruta);
      }
    };
    recorrer(resolve("app"));
    recorrer(resolve("components"));

    let mayor = 0;
    for (const ruta of archivos) {
      let texto = readFileSync(ruta, "utf8");
      // Sin la regla del propio aviso: el resto tiene que quedar por debajo.
      if (ruta === resolve("app/globals.css")) texto = texto.replace(regla(".entorno-prueba"), "");
      for (const m of texto.matchAll(/z-index:\s*(\d+)|zIndex:\s*(\d+)|\bz-\[(\d+)\]/g)) {
        mayor = Math.max(mayor, Number(m[1] ?? m[2] ?? m[3]));
      }
    }
    expect(mayor).toBeGreaterThan(0);
    expect(propio).toBeGreaterThan(mayor);
  });
});
