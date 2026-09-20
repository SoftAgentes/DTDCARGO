// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Contrato: ABRIR un enlace con token NO lo consume.
 *
 * POR QUÉ EXISTE. La primera versión de `/acceso/[token]` canjeaba el token en
 * el GET. El escáner de correo de Gmail abre los enlaces del mensaje apenas
 * llega, así que lo gastaba antes de que la persona hiciera clic: **ningún
 * enlace llegó vivo a su destinatario**. El arreglo fue mover el consumo a la
 * server action del formulario, donde hay alguien de verdad guardando su clave.
 *
 * POR QUÉ ESTE TEST Y NO EL DE E2E QUE YA HABÍA. `e2e/auth.spec.ts` abría el
 * enlace dos veces y comparaba el texto del `<body>`, con un token
 * **inexistente**. Eso no puede detectar la regresión: si alguien devuelve el
 * consumo al GET, el `update` no encuentra fila que gastar, las dos cargas
 * muestran el mismo mensaje y el test se queda VERDE. Su docstring afirmaba lo
 * contrario. Encima comparaba la página entera, así que cualquier diferencia de
 * hidratación entre la primera carga (compilando) y la segunda lo ponía rojo por
 * la razón equivocada — flakeó así el 2026-08-09.
 *
 * Este mira el código, que es donde vive la invariante: la ruta que RENDERIZA no
 * escribe. Si alguien mete un `.update()` en el `page.tsx`, esto se pone rojo con
 * el archivo y la línea.
 */

/** Rutas cuyo GET recibe un token de un solo uso por correo. */
const PAGINAS_CON_TOKEN = [
  "app/acceso/[token]/page.tsx",
  "app/invitar/[token]/page.tsx",
];

/**
 * Verbos de escritura de PostgREST. `.rpc()` queda fuera a propósito: hay RPCs
 * de sólo lectura y prohibirlas de plano daría un falso positivo.
 */
const ESCRITURAS = /\.(update|insert|upsert|delete)\s*\(/g;

describe("abrir un enlace con token no lo consume", () => {
  for (const rel of PAGINAS_CON_TOKEN) {
    it(`${rel} no escribe en la base`, () => {
      const src = readFileSync(join(process.cwd(), rel), "utf8");
      const hallazgos = [...src.matchAll(ESCRITURAS)].map((m) => {
        const linea = src.slice(0, m.index).split("\n").length;
        return `${rel}:${linea} → ${m[1]}()`;
      });
      expect(
        hallazgos,
        `El GET de una ruta con token NO puede escribir: es lo que gastaba el ` +
          `enlace antes de que la persona lo abriera (el escáner de Gmail lo ` +
          `consumía primero). El consumo va en la server action del formulario, ` +
          `condicionado con .is("used_at", null). Encontrado: ${hallazgos.join(", ")}`,
      ).toEqual([]);
    });
  }

  it("la server action SÍ consume, y de forma condicional", () => {
    // El complemento del test de arriba: si el consumo desapareciera de la
    // action, el token sería reusable para siempre y esto lo delata.
    const src = readFileSync(
      join(process.cwd(), "app/acceso/[token]/actions.ts"),
      "utf8",
    );
    expect(src).toMatch(/\.update\(\s*\{\s*used_at/);
    expect(src).toContain('.is("used_at", null)');
  });
});
