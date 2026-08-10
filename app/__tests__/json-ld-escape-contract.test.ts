import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Contrato de escapado del JSON-LD público.
 *
 * Todo bloque `<script type="application/ld+json">` se inyecta con
 * `dangerouslySetInnerHTML`. Si el JSON serializado contiene `</script>` el
 * navegador cierra la etiqueta ahí y lo que sigue se ejecuta como HTML: XSS
 * almacenado. Convertir `<` a `\u003c` lo neutraliza sin cambiar el JSON — los
 * parsers de JSON leen `\u003c` como `<`, el parser de HTML no ve la etiqueta.
 *
 * No es teórico acá: `/noticias/[slug]` serializa título, resumen y cuerpo que
 * vienen del CMS (`app/back`), o sea texto que escribe una persona. El criterio
 * de aceptación 6 de SDD-0235 ya lo exigía; estaba aplicado en 4 de 19 puntos.
 */
const RAIZ = "app";

function paginas(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(join(process.cwd(), dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === "__tests__") continue;
      paginas(rel, acc);
    } else if (e.name.endsWith(".tsx")) {
      acc.push(rel);
    }
  }
  return acc;
}

describe("JSON-LD público · escapado de `<`", () => {
  it("ningún bloque inyecta JSON.stringify sin escapar", () => {
    const sinEscapar: string[] = [];
    for (const p of paginas(RAIZ)) {
      const lineas = readFileSync(join(process.cwd(), p), "utf8").split("\n");
      lineas.forEach((linea, i) => {
        if (!linea.includes("__html: JSON.stringify")) return;
        if (linea.includes("replace(/</g")) return;
        sinEscapar.push(`${p}:${i + 1}`);
      });
    }
    expect(sinEscapar).toEqual([]);
  });

  /**
   * El test de arriba vigila la REGRESIÓN (que nadie vuelva a serializar a
   * mano), pero desde que los 17 puntos pasaron a `serializeJsonLd()` pasaría
   * también en un repo donde alguien inyecta JSON-LD por otra vía. Esta es la
   * invariante de verdad: todo bloque `ld+json` sale por el helper.
   */
  it("todo bloque ld+json se serializa con serializeJsonLd()", () => {
    const sueltos: string[] = [];
    for (const p of paginas(RAIZ)) {
      const src = readFileSync(join(process.cwd(), p), "utf8");
      if (!src.includes("application/ld+json")) continue;
      const lineas = src.split("\n");
      lineas.forEach((linea, i) => {
        if (!linea.includes("dangerouslySetInnerHTML")) return;
        // El `__html` puede ir en esta línea o en la siguiente (Prettier parte
        // el objeto cuando la llamada es larga).
        const bloque = `${linea}\n${lineas[i + 1] ?? ""}`;
        if (!bloque.includes("__html")) return;
        if (bloque.includes("serializeJsonLd(")) return;
        sueltos.push(`${p}:${i + 1}`);
      });
    }
    expect(sueltos).toEqual([]);
  });

  it("el escape produce \\u003c, que es lo único que neutraliza </script>", () => {
    const payload = { titulo: 'cierre </script><img src=x onerror=alert(1)>' };
    const serializado = JSON.stringify(payload).replace(/</g, "\\u003c");
    expect(serializado).not.toContain("</script>");
    expect(serializado).toContain("\\u003c/script");
    // Y sigue siendo el mismo dato una vez parseado.
    expect(JSON.parse(serializado)).toEqual(payload);
  });
});
