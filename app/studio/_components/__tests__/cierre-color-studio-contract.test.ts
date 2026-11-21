/**
 * SDD-0686 · cierre del color del Studio (2026-11-21).
 *
 * - Ningún texto del Studio usa `--ink-mute`, que no llega a 4,5:1 (2,44 a 2,78:1
 *   en claro). Decisión de Sam: «a recomendada» (opción A): el texto pasa a
 *   `--ink-soft` y `--ink-mute` queda para bordes, fondos y deshabilitados.
 *   La única excepción es el texto deshabilitado, que WCAG exceptúa del contraste.
 * - El brillo del foco de los campos oscuros es azul de acción, no vino suave.
 * - «Volver a Publicadas» de Noticias web es un enlace: azul de acción.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fuentesDe, RAIZ, rel } from "./vino-detector";

const leer = (ruta: string) => readFileSync(join(RAIZ, ruta), "utf8");

/** Texto en `--ink-mute` que no es un estado deshabilitado: `ruta:línea`. */
function textosEnMute(fuente: (ruta: string) => string): string[] {
  const re = /(^|[^-A-Za-z])color["']?\s*:\s*([^,;{}]*?)var\(--ink-mute\)/g;
  return fuentesDe(join(RAIZ, "app/studio"), /\.(tsx|ts|css)$/)
    .filter((ruta) => !/\.test\.tsx?$/.test(ruta) && !ruta.endsWith("tokens.css"))
    .flatMap((ruta) => {
      const src = fuente(ruta);
      const fuera: string[] = [];
      for (const m of src.matchAll(re)) {
        const antes = m[2];
        if (/disabled\s*\?\s*["'`]$/.test(antes)) continue;
        if (ruta.endsWith(".css")) {
          const bloque = src.slice(src.lastIndexOf("}", m.index) + 1, m.index);
          if (/:disabled/.test(bloque)) continue;
        }
        fuera.push(`${rel(ruta)}:${src.slice(0, m.index).split("\n").length}`);
      }
      return fuera;
    });
}

describe("SDD-0686 · cierre del color del Studio", () => {
  it("ningún texto del Studio usa --ink-mute, salvo un deshabilitado", () => {
    expect(textosEnMute((ruta) => readFileSync(ruta, "utf8"))).toEqual([]);
  });

  it("los deshabilitados que quedan en --ink-mute son exactamente los tres de hoy", () => {
    expect(leer("app/studio/_components/ui/DateField.tsx")).toContain('disabled ? "var(--ink-mute)"');
    expect(leer("app/studio/(app)/fiscal/_components/FiscalConfig.tsx")).toContain('color: disabled ? "var(--ink-mute)"');
    expect(leer("app/studio/studio.css")).toMatch(/\.studio-cal-today-btn:disabled \{[^}]*color: var\(--ink-mute\);/);
  });

  it.each([
    ["un texto de TSX", "app/studio/(app)/dashboard/_components/DashboardWidgets.tsx"],
    ["una regla de studio.css", "app/studio/studio.css"],
  ])("mutante: %s vuelto a --ink-mute se detecta", (_, objetivo) => {
    const original = leer(objetivo);
    const i = original.indexOf("var(--ink-soft)");
    expect(i).toBeGreaterThan(-1);
    // El primer `color` en --ink-soft del archivo vuelve a --ink-mute.
    const m = /(^|[^-A-Za-z])color["']?\s*:\s*[^,;{}]*?var\(--ink-soft\)/.exec(original);
    expect(m).not.toBeNull();
    const fin = (m!.index ?? 0) + m![0].length;
    const mutado = original.slice(0, fin - "var(--ink-soft)".length) + "var(--ink-mute)" + original.slice(fin);
    const hallados = textosEnMute((ruta) => (rel(ruta) === objetivo ? mutado : readFileSync(ruta, "utf8")));
    expect(hallados).toHaveLength(1);
    expect(hallados[0].startsWith(`${objetivo}:`)).toBe(true);
  });

  it("el foco de los campos oscuros es azul de acción, no vino suave", () => {
    const regla = /\.studio-input-dark:focus-visible \{[^}]*\}/.exec(leer("app/studio/studio.css"))?.[0] ?? "";
    expect(regla).toContain("rgba(127, 170, 240, 0.22)");
    expect(regla).not.toMatch(/194,\s*116,\s*127/);
  });

  it("«Volver a Publicadas» de Noticias web es azul de acción con subrayado", () => {
    for (const f of [
      "app/studio/(app)/marketing/noticias-web/publicadas/[id]/page.tsx",
      "app/studio/(app)/marketing/noticias-web/retirar/[id]/page.tsx",
    ]) {
      const fuente = leer(f);
      expect(fuente).not.toContain("--color-wine-text");
      expect(fuente).toContain('style={{ color: "var(--accion-text)", textDecoration: "underline" }}');
    }
  });
});
