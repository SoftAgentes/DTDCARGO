/**
 * Enlazado automático de jerga al glosario (`/glosario#<ancla>`).
 *
 * Idea del founder (2026-08-19): que un visitante que se topa con "DDP" pueda
 * tocar la sigla y llegar a la explicación, en vez de quedarse con la duda o
 * irse a buscarla afuera. Se generalizó a toda la jerga del glosario, no sólo
 * a DDP.
 *
 * Acá vive la parte PURA (partir un texto en segmentos). El render vive en
 * `components/TerminoGlosario.tsx`. Están separados a propósito: así el gate
 * puede testear las reglas con Vitest sin montar React.
 *
 * ── Por qué la lista es CURADA y no sale sola de `GLOSSARY_TERMS` ──
 *
 * El glosario tiene 15 entradas, pero enlazarlas todas rompería la página:
 *
 *  1. **"Puerta a Puerta" y "Pagas al llegar" quedan FUERA.** No son jerga que
 *     el cliente necesite buscar — son el nombre del servicio y la promesa
 *     comercial, y aparecen en casi todos los párrafos del sitio. Enlazarlos
 *     llenaría el copy de marketing de links azules. La regla es enlazar lo que
 *     el lector NO entiende, no lo que la marca quiere que recuerde.
 *  2. Los `term` del glosario traen la explicación pegada ("LCL — Carga
 *     consolidada"), y en el copy la sigla aparece sola. Hace falta el patrón
 *     real, no el título de la ficha.
 *
 * ── Las tres reglas que evitan el ruido ──
 *
 *  · **Sólo la PRIMERA aparición** de cada término en un mismo texto. Un párrafo
 *    que repite "CBM" cuatro veces lleva un link, no cuatro.
 *  · **Límites de palabra estrictos.** "DDP" dentro de `puerta_a_puerta_DDP` no
 *    se toca, y "ETA" no matchea dentro de "meta" ni "etapa".
 *  · **Las siglas van en MAYÚSCULAS y se comparan sensible a mayúsculas.** Es lo
 *    que las distingue de una palabra común: "pod" en minúscula no es un POD.
 */

/** Un término enlazable: el texto que aparece en el copy y su ancla en /glosario. */
export type TerminoEnlazable = {
  /** Cómo aparece literalmente en el copy. */
  patron: string;
  /** El `id` de su ficha en `GLOSSARY_TERMS` (ancla de /glosario). */
  ancla: string;
  /**
   * `true` si se compara respetando mayúsculas. Las siglas SÍ (para no pisar
   * palabras comunes); los términos con espacios no hace falta.
   */
  sensible: boolean;
};

/**
 * La lista curada. El orden importa y tiene DOS reglas, no una:
 *
 *  · Entre variantes que compiten por el mismo texto, primero la más larga
 *    ("Incoterms" antes que "Incoterm").
 *  · Entre una sigla y su nombre largo, primero la SIGLA — así "tu BL (Bill of
 *    Lading)" enlaza donde el ojo llega primero.
 */
export const TERMINOS_ENLAZABLES: TerminoEnlazable[] = [
  { patron: "Shipping Mark", ancla: "markbox", sensible: false },
  { patron: "HS Code", ancla: "hs-code", sensible: false },
  { patron: "Incoterms", ancla: "incoterm", sensible: false },
  { patron: "Incoterm", ancla: "incoterm", sensible: false },
  { patron: "DDP", ancla: "ddp", sensible: true },
  { patron: "DTDU", ancla: "dtdu", sensible: true },
  { patron: "AWB", ancla: "awb", sensible: true },
  { patron: "CBM", ancla: "cbm", sensible: true },
  { patron: "ETA", ancla: "eta", sensible: true },
  { patron: "ETD", ancla: "etd", sensible: true },
  { patron: "FCL", ancla: "fcl", sensible: true },
  { patron: "LCL", ancla: "lcl", sensible: true },
  { patron: "POD", ancla: "pod", sensible: true },
  { patron: "BL", ancla: "bl", sensible: true },
  // Los nombres largos van DESPUÉS de su sigla, y el orden no es cosmético: en
  // "tu BL (Bill of Lading)" queremos el enlace en la sigla, que es lo primero
  // que se lee. Como la sigla se compara sensible a mayúsculas, "BL" nunca
  // matchea dentro de "Bill" — así que las dos entradas conviven sin pisarse y
  // cada texto enlaza la forma que de verdad usa.
  { patron: "Bill of Lading", ancla: "bl", sensible: false },
  { patron: "Air Waybill", ancla: "awb", sensible: false },
];

/** Un trozo del texto ya resuelto: o es texto pelado, o es un término a enlazar. */
export type Segmento =
  | { tipo: "texto"; valor: string }
  | { tipo: "termino"; valor: string; ancla: string };

/** Escapa lo que tenga significado en una regex (hoy ninguno lo tiene, pero el patrón es dato). */
function escapar(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Parte `texto` en segmentos, marcando la primera aparición de cada término.
 *
 * Devuelve SIEMPRE al menos un segmento (el texto entero si no hubo matches),
 * así el llamador nunca tiene que distinguir el caso vacío.
 *
 * `excluir` saca términos puntuales — lo usa la propia /glosario para no
 * enlazarse a sí misma, y cualquier página que ya explique la sigla en el mismo
 * párrafo (enlazar ahí sería redundante).
 */
export function partirPorTerminos(
  texto: string,
  opciones: { excluir?: string[] } = {},
): Segmento[] {
  if (!texto) return [{ tipo: "texto", valor: "" }];

  const excluidos = new Set(opciones.excluir ?? []);
  const candidatos = TERMINOS_ENLAZABLES.filter((t) => !excluidos.has(t.ancla));

  // Primera posición de cada término, sin solaparse con uno ya aceptado.
  type Hit = { desde: number; hasta: number; valor: string; ancla: string };
  const hits: Hit[] = [];
  const anclasUsadas = new Set<string>();

  for (const t of candidatos) {
    if (anclasUsadas.has(t.ancla)) continue; // una sola vez por ancla
    const flags = t.sensible ? "" : "i";
    // `\b` no alcanza con guiones bajos: `puerta_a_puerta_DDP` tiene borde de
    // palabra antes de DDP porque `_` cuenta como carácter de palabra… pero el
    // `_` PEGADO sí lo delata, así que se exige que el vecino no sea `_`.
    const re = new RegExp(`(^|[^\\w_])(${escapar(t.patron)})(?![\\w_])`, flags);
    const m = re.exec(texto);
    if (!m || m.index === undefined) continue;
    const desde = m.index + m[1].length;
    const hasta = desde + m[2].length;
    if (hits.some((h) => desde < h.hasta && hasta > h.desde)) continue; // solape
    hits.push({ desde, hasta, valor: m[2], ancla: t.ancla });
    anclasUsadas.add(t.ancla);
  }

  if (hits.length === 0) return [{ tipo: "texto", valor: texto }];

  hits.sort((a, b) => a.desde - b.desde);
  const salida: Segmento[] = [];
  let cursor = 0;
  for (const h of hits) {
    if (h.desde > cursor) salida.push({ tipo: "texto", valor: texto.slice(cursor, h.desde) });
    salida.push({ tipo: "termino", valor: h.valor, ancla: h.ancla });
    cursor = h.hasta;
  }
  if (cursor < texto.length) salida.push({ tipo: "texto", valor: texto.slice(cursor) });
  return salida;
}

/** El href de una ficha del glosario. Un solo lugar por si la ruta cambia. */
export function hrefGlosario(ancla: string): string {
  return `/glosario#${ancla}`;
}
