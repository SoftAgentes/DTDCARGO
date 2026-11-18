// @vitest-environment node
/**
 * SDD-0614 · S0 (P-10): la guía «Antes en Kommo → Ahora aquí» se queda.
 *
 * S0 oculta Kommo del Studio, pero la guía de la SDD-0589 no es Kommo: enseña a
 * dejarlo y no conecta con él. Sam la mantiene («Sí, se queda», 2026-11-07
 * 03:56Z) hasta que decida apagarla. Esto lo fija como propiedad, no como
 * consejo:
 *
 * 1. El layout del Studio sigue importando y montando `<GuiaStudio>`. El
 *    detector se prueba contra sus mutantes (sin montaje, montaje comentado, sin
 *    import): si alguien la quita, esta prueba se pone roja.
 * 2. `/studio/crm` sin `?tab=` abre **Embudos**, la pestaña donde viven las
 *    anclas `embudo.*` del recorrido Embudo. Antes de S0 abría Dirección y el
 *    recorrido no encontraba sus anclas al entrar.
 *
 * Que el diff de S0 no toque ningún archivo de la guía se comprueba al cerrar
 * el tramo con `git diff --name-only` (spec §5 y §8): una prueba que llama a git
 * depende de la historia del checkout de CI.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { RECORRIDO_EMBUDO, rutaCoincide } from "@/lib/studio/guia/recorridos";
import { resolveKommoTab } from "../_components/kommo-tabs.shared";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const LAYOUT = "app/studio/(app)/layout.tsx";
const KANBAN = "app/studio/(app)/crm/_components/CrmTableroKanban.tsx";

/** Quita comentarios JSX, de bloque y de línea: un montaje comentado no cuenta. */
function sinComentarios(fuente: string): string {
  return fuente
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

/** ¿El layout importa `GuiaStudio` de la guía y lo monta como elemento? */
function montaGuia(fuente: string): boolean {
  const codigo = sinComentarios(fuente);
  const importa = /import\s*\{\s*GuiaStudio\s*\}\s*from\s*"\.\.\/_components\/guia\/GuiaStudio"/.test(
    codigo,
  );
  const monta = /<GuiaStudio\b[^>]*\/?>/.test(codigo);
  return importa && monta;
}

describe("la guía sigue montada en el Studio (SDD-0614 S0, P-10)", () => {
  const layout = read(LAYOUT);

  it("el layout importa y monta <GuiaStudio>", () => {
    expect(montaGuia(layout)).toBe(true);
  });

  it("mutante: sin el montaje, el detector da rojo", () => {
    const mutante = layout.replace(/<GuiaStudio\b[^>]*\/>/, "");
    expect(mutante).not.toBe(layout);
    expect(montaGuia(mutante)).toBe(false);
  });

  it("mutante: con el montaje comentado, el detector da rojo", () => {
    const mutante = layout.replace(/(<GuiaStudio\b[^>]*\/>)/, "{/* $1 */}");
    expect(mutante).not.toBe(layout);
    expect(montaGuia(mutante)).toBe(false);
  });

  it("mutante: sin el import, el detector da rojo", () => {
    const mutante = layout.replace(/import\s*\{\s*GuiaStudio\s*\}[^\n]*\n/, "");
    expect(mutante).not.toBe(layout);
    expect(montaGuia(mutante)).toBe(false);
  });
});

describe("/studio/crm sin ?tab= abre Embudos, donde están las anclas del recorrido (P-10)", () => {
  it.each([undefined, null, ""])("resolveKommoTab(%j) es «embudos»", (raw) => {
    expect(resolveKommoTab(raw)).toBe("embudos");
  });

  it("el recorrido Embudo arranca en /studio/crm, sin pedir pestaña", () => {
    expect(rutaCoincide(RECORRIDO_EMBUDO, "/studio/crm")).toBe(true);
  });

  it("cada ancla del recorrido Embudo está en el tablero de Embudos", () => {
    const kanban = read(KANBAN);
    const anclas = RECORRIDO_EMBUDO.pasos.map((p) => p.ancla);
    // Piso: si el recorrido se vacía, esta prueba no puede salir verde sin mirar nada.
    expect(anclas.length).toBeGreaterThanOrEqual(4);
    for (const ancla of anclas) {
      expect(ancla.startsWith("embudo.")).toBe(true);
      expect(kanban, `falta data-guia="${ancla}" en el tablero`).toContain(`"${ancla}"`);
    }
  });
});
