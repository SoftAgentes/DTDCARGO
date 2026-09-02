import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

/**
 * ⏱️ I/O-BOUND: este contrato RECORRE EL ÁRBOL DE ARCHIVOS del repo.
 *
 * Aislado corre en ~1 s. Pero la suite tiene NUEVE contratos que hacen lo mismo
 * y vitest los reparte en paralelo sobre 427 archivos de test: compitiendo por
 * el mismo disco, la lectura se va a 26-53 s y expira contra el `testTimeout`
 * global de 20 s. Falla un conjunto DISTINTO cada corrida — la firma de la
 * contención, no de una regresión (una regresión falla el mismo test las dos
 * veces, y con una aserción, no con un reloj).
 *
 * El timeout se sube ACÁ y no en `vitest.config.mts` a propósito: subirlo global
 * relajaría los otros ~4.960 tests, donde 20 s ya es señal de que algo va mal.
 */
vi.setConfig({ testTimeout: 120_000 });


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
/**
 * 🔴 Eran DOS raíces, no una (SDD-0303).
 *
 * Este contrato escaneaba sólo `app/` y por eso **cuatro bloques de
 * `components/` pasaron sin escapar**: `BreadcrumbJsonLd`, `OperationGallery`,
 * `WorkBand` (los tres con `JSON.stringify` crudo) y `WebPageJsonLd` (con el
 * escape copiado a mano). Un contrato verde que no mira donde está el problema
 * da por cubierto lo que nunca miró.
 */
const RAICES = ["app", "components"];

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
    for (const p of RAICES.flatMap((raiz) => paginas(raiz))) {
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
    for (const p of RAICES.flatMap((raiz) => paginas(raiz))) {
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

  /**
   * Los dos tests de arriba dejan pasar el escape COPIADO A MANO — un
   * `.replace(/</g, ...)` inline— porque técnicamente escapa. Hoy hace lo mismo
   * que el helper; el día que el helper escape algo más, esa copia se queda
   * atrás sin que nadie lo note. Era el caso de `WebPageJsonLd.tsx` hasta
   * SDD-0303. El escape vive en UN lugar.
   */
  it("nadie copia el escape a mano en vez de usar el helper", () => {
    const copias: string[] = [];
    for (const p of RAICES.flatMap((raiz) => paginas(raiz))) {
      const src = readFileSync(join(process.cwd(), p), "utf8");
      if (!src.includes("application/ld+json")) continue;
      src.split(String.fromCharCode(10)).forEach((linea, k) => {
        if (!linea.includes("replace(/</g")) return;
        if (linea.includes("serializeJsonLd(")) return;
        copias.push(`${p}:${k + 1}`);
      });
    }
    expect(copias).toEqual([]);
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
