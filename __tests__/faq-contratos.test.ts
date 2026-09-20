// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FAQS } from "@/lib/faqs";

/**
 * Dos contratos sobre el FAQ maestro (`lib/faqs.ts`) — la fuente única que
 * alimenta `/faq`, su JSON-LD de `FAQPage` y los subconjuntos que reinyectan
 * `/puerta-a-puerta` y `/shipping-mark`.
 *
 * POR QUÉ EXISTE ESTE ARCHIVO. Hasta el 2026-08-20 el CONTENIDO del FAQ no
 * tenía ninguna prueba: el único contrato que importaba `FAQS` era
 * `copy-sin-casco-central`, y sólo busca dos términos. Los dos huecos que se
 * cierran acá aparecieron al reescribir las respuestas de pago y cancelación.
 */

const RAIZ = join(__dirname, "..");

describe("el subconjunto de /puerta-a-puerta sigue matcheando", () => {
  /**
   * `/shipping-mark` filtra por CATEGORÍA, así que no puede desalinearse.
   * `/puerta-a-puerta` filtra por FRAGMENTO DE TEXTO de la pregunta, y ahí está
   * la trampa: editar el enunciado de una FAQ vacía ese bloque —y su FAQPage
   * schema— sin romper nada. No hay error de tipos, no hay error en runtime, la
   * página renderiza con la lista vacía. Este test es lo único que lo atrapa.
   */
  const fuente = readFileSync(
    join(RAIZ, "app/puerta-a-puerta/page.tsx"),
    "utf8",
  );

  const bloque = fuente.match(
    /const PUERTA_A_PUERTA_FAQ_MATCH = \[([\s\S]*?)\];/,
  );

  it("el array PUERTA_A_PUERTA_FAQ_MATCH sigue existiendo con ese nombre", () => {
    expect(
      bloque,
      "No se encontró `const PUERTA_A_PUERTA_FAQ_MATCH = [...]` en " +
        "app/puerta-a-puerta/page.tsx. Si lo renombraste o cambiaste el filtro " +
        "a categoría, actualiza (o borra) este contrato.",
    ).not.toBeNull();
  });

  const fragmentos = [...(bloque?.[1] ?? "").matchAll(/"([^"]+)"/g)].map(
    (m) => m[1],
  );

  it("se extrajo al menos un fragmento del array", () => {
    // Si esto falla, la regex de arriba quedó obsoleta y los `it.each` de abajo
    // no correrían NINGUNA aserción — verde por vacío, que es peor que rojo.
    expect(fragmentos.length).toBeGreaterThan(0);
  });

  it.each(fragmentos)('el fragmento "%s" matchea alguna pregunta', (fragmento) => {
    const encontradas = FAQS.filter((f) => f.pregunta.includes(fragmento));
    expect(
      encontradas.length,
      `Ninguna pregunta de lib/faqs.ts contiene "${fragmento}", así que el ` +
        `bloque de FAQ de /puerta-a-puerta perdió esa entrada en silencio. ` +
        `O restauras el texto de la pregunta, o actualizas ` +
        `PUERTA_A_PUERTA_FAQ_MATCH en app/puerta-a-puerta/page.tsx.`,
    ).toBeGreaterThan(0);
  });
});

describe("términos prohibidos en el copy del FAQ", () => {
  /**
   * Tres reglas de marca que el copy de precio y pago roza de cerca:
   *
   * - **"responsabilidad"** abre el tema de seguros/liability en comunicación
   *   comercial (founder, 2026-06-09). El marco correcto es *hasta dónde llega
   *   el servicio*: "el servicio de DTD Cargo termina ahí".
   * - **"financiamiento"** se retiró el 2026-06-09 por riesgo legal: promete
   *   financiamiento garantizado cuando en realidad está sujeto a aprobación.
   * - **"prepago"** salió del copy de marketing el 2026-06-04. Sigue siendo
   *   válido en contexto legal y en los dropdowns internos del Studio, pero no
   *   acá: la verdad comercial de cara al cliente es "pagas al llegar".
   */
  const PROHIBIDOS = [
    {
      termino: "responsabilidad / responsable",
      patron: /responsabilidad|responsables?\b/i,
      arreglo: 'usa el marco "hasta dónde llega el servicio"',
    },
    {
      termino: "financiamiento",
      patron: /financiam/i,
      arreglo: 'retirado por riesgo legal — la frase es "pagas al llegar"',
    },
    {
      termino: "prepago",
      patron: /prepago/i,
      arreglo: 'retirado del marketing — la frase es "pagas al llegar"',
    },
  ];

  const textos = FAQS.flatMap((f) => [
    f.pregunta,
    f.respuesta,
    ...(f.bloques ?? []).flatMap((b) =>
      b.tipo === "parrafo" ? [b.texto] : b.items,
    ),
  ]);

  it("hay textos que revisar", () => {
    // Mismo motivo que arriba: un `textos` vacío pondría los siguientes en
    // verde sin haber mirado nada.
    expect(textos.length).toBeGreaterThan(0);
  });

  it.each(PROHIBIDOS)("ninguna FAQ dice $termino", ({ patron, arreglo }) => {
    const ofensores = textos.filter((t) => patron.test(t));
    expect(
      ofensores,
      `Término prohibido en lib/faqs.ts (${arreglo}):\n  ` +
        ofensores.join("\n  "),
    ).toEqual([]);
  });
});
