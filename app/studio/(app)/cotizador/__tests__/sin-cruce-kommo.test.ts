// @vitest-environment node
/**
 * SDD-0614 · S0 (D-6.6-1, H13): el detalle del estimado no cruza con Kommo.
 *
 * Para un estimado web sin vincular, el detalle buscaba el teléfono del
 * prospecto en los contactos del espejo de Kommo y mostraba sus nombres
 * («Coincide con el CRM: … contactos del CRM (…)»). S0 lo quita: Kommo queda
 * fuera del Studio hasta la migración completa. En S2, R3 pone en su lugar la
 * línea de la tarjeta del CRM propio.
 *
 * Es una prueba de fuente, como `fase-c-rename.test.ts`: lo que se afirma es el
 * cableado (la página no llama al cruce y el detalle no tiene dónde pintarlo).
 * Ocultar no es borrar: la función del cruce sigue en `lib/studio/kommo-convert.ts`
 * hasta 8.7.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

/** Quita comentarios: lo que cuenta es el código que corre. */
function codigo(p: string): string {
  return read(p)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const PAGINA = "app/studio/(app)/cotizador/[code]/page.tsx";
const DETALLE = "app/studio/(app)/cotizador/_components/QuoteDetailClient.tsx";

describe("el detalle del estimado no cruza el teléfono con Kommo (SDD-0614 S0)", () => {
  it("la página no llama al cruce con contactos de Kommo", () => {
    const pagina = codigo(PAGINA);
    expect(pagina).not.toContain("findKommoContactsByPhone");
    expect(pagina).not.toContain("@/lib/studio/kommo-convert");
    expect(pagina).not.toContain("kommoMatches");
  });

  it("el detalle no recibe ni pinta contactos de Kommo", () => {
    const detalle = codigo(DETALLE);
    expect(detalle).not.toContain("kommoMatches");
    expect(detalle).not.toContain("KommoContactPick");
    expect(detalle).not.toContain("Coincide con el CRM");
  });

  it("el detalle sigue ofreciendo vincular el estimado web a un cliente", () => {
    // El aviso iba dentro de la sección de vincular: quitarlo no se lleva la sección.
    const detalle = codigo(DETALLE);
    expect(detalle).toContain("linkEstimateToClientAction");
    expect(detalle).toContain('aria-label="Shipping Mark del cliente"');
  });

  it("ocultar no es borrar: la función del cruce sigue en el repo", () => {
    expect(read("lib/studio/kommo-convert.ts")).toContain(
      "export async function findKommoContactsByPhone(",
    );
  });
});
