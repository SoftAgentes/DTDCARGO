/**
 * SDD-0303 · Todo bloque JSON-LD se serializa con `serializeJsonLd`.
 *
 * ## Qué protege
 *
 * Un `<script type="application/ld+json">` se inyecta con
 * `dangerouslySetInnerHTML`. Si el JSON lleva un `<` sin escapar y algún valor
 * contiene `</script>`, el navegador **cierra la etiqueta ahí** y lo que sigue
 * deja de ser datos y pasa a ser marcado. `serializeJsonLd` escapa `<` a
 * `<` y lo impide.
 *
 * ## Por qué hace falta un contrato y no basta con el helper
 *
 * El helper existe desde el 2026-08-02… y **la corrección aterrizó a medias**:
 * el arreglo original quedó en una rama archivada que nunca se mergeó (ver
 * SDD-0301). Al medir el 2026-08-26, **18 bloques usaban el helper y 4 no** —
 * tres con `JSON.stringify` crudo y uno con el escape copiado a mano.
 *
 * Nada falla al desplegar: el sitio se ve igual. Falla el día que un valor
 * dinámico traiga `</script>`.
 *
 * Hoy ningún llamador pasa datos dinámicos (los breadcrumbs son literales),
 * así que no había exploit vivo — pero el próximo con un título de artículo o
 * un nombre de servicio venido de la base sí lo tendría.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const RAIZ = process.cwd();

/** Todos los `.tsx` bajo `app/` y `components/`. */
function fuentes(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) {
      if (e === "node_modules" || e === "__tests__") continue;
      fuentes(p, out);
    } else if (e.endsWith(".tsx")) {
      out.push(p);
    }
  }
  return out;
}

type Bloque = { archivo: string; linea: number; expr: string };

/** Cada `dangerouslySetInnerHTML` que sigue de cerca a un `ld+json`. */
function bloquesJsonLd(): Bloque[] {
  const out: Bloque[] = [];
  const rx = /ld\+json[\s\S]{0,400}?dangerouslySetInnerHTML=\{\{\s*__html:\s*([^\n}]+)/g;
  for (const dir of ["app", "components"]) {
    for (const archivo of fuentes(path.join(RAIZ, dir))) {
      const t = readFileSync(archivo, "utf8");
      if (!t.includes("ld+json")) continue;
      for (const m of t.matchAll(rx)) {
        out.push({
          archivo: path.relative(RAIZ, archivo).split(path.sep).join("/"),
          linea: t.slice(0, m.index).split("\n").length,
          expr: m[1].trim(),
        });
      }
    }
  }
  return out;
}

describe("contrato · escape de JSON-LD (SDD-0303)", () => {
  const bloques = bloquesJsonLd();

  it("el escaneo encuentra bloques de verdad", () => {
    // Un escaneo que no encuentra nada pasa siempre. Este es el seguro.
    expect(bloques.length).toBeGreaterThan(10);
  });

  it("🔴 ninguno serializa con `JSON.stringify` directo", () => {
    const crudos = bloques.filter((b) => !b.expr.includes("serializeJsonLd"));
    expect(
      crudos.map((b) => `${b.archivo}:${b.linea}  __html: ${b.expr}`),
      `Estos bloques JSON-LD NO usan serializeJsonLd(). Si algún valor llega a ` +
        `contener "</script>", el navegador cierra la etiqueta y lo que sigue ` +
        `deja de ser datos. Usa serializeJsonLd() de @/lib/public/json-ld.`,
    ).toEqual([]);
  });

  it("🔴 tampoco vale copiar el escape a mano", () => {
    // Un `.replace(/</g, ...)` inline hace hoy lo mismo que el helper, pero se
    // desincroniza el día que el helper escape algo más. El escape vive en UN
    // lugar. Es el caso real de WebPageJsonLd.tsx antes de esta spec.
    const aMano = bloques.filter(
      (b) => b.expr.includes(".replace(") && !b.expr.includes("serializeJsonLd"),
    );
    expect(aMano.map((b) => `${b.archivo}:${b.linea}`)).toEqual([]);
  });
});
