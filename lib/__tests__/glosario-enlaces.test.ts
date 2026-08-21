import { describe, expect, it } from "vitest";
import {
  ambitoGlosario,
  hrefGlosario,
  partirPorTerminos,
  TERMINOS_ENLAZABLES,
} from "@/lib/glosario-enlaces";
import { GLOSSARY_TERMS } from "@/lib/design-tokens";

/** Atajo: sólo las anclas que quedaron marcadas como término. */
const anclas = (t: string, opts?: { excluir?: string[] }) =>
  partirPorTerminos(t, opts)
    .filter((s) => s.tipo === "termino")
    .map((s) => (s as { ancla: string }).ancla);

/** Reconstruye el texto desde los segmentos. */
const rearmar = (t: string) =>
  partirPorTerminos(t)
    .map((s) => s.valor)
    .join("");

describe("glosario · enlazado de términos", () => {
  it("enlaza una sigla suelta", () => {
    expect(anclas("Viaja en modalidad DDP hasta tu puerta.")).toEqual(["ddp"]);
  });

  it("NUNCA pierde ni inventa texto — los segmentos rearman el original", () => {
    const casos = [
      "Tarifa DDP con LCL y FCL, más el CBM y el BL.",
      "Sin ningún término del glosario acá.",
      "DDP",
      "",
    ];
    for (const c of casos) expect(rearmar(c)).toBe(c);
  });

  it("enlaza SÓLO la primera aparición de cada término", () => {
    const t = "El CBM manda: si tu CBM sube, el CBM final cambia.";
    expect(anclas(t)).toEqual(["cbm"]);
  });

  it("enlaza varios términos distintos en el mismo texto", () => {
    expect(anclas("Con LCL pagas por CBM; con FCL, por contenedor.").sort()).toEqual([
      "cbm",
      "fcl",
      "lcl",
    ]);
  });

  // El enum interno es `puerta_a_puerta_DDP` y viaja en props y datos. Si el
  // enlazador lo tocara, partiría un identificador al medio.
  it("NO toca una sigla pegada a guion bajo (el enum interno)", () => {
    expect(anclas("El servicio es puerta_a_puerta_DDP en la base.")).toEqual([]);
  });

  it("NO matchea una sigla dentro de una palabra", () => {
    expect(anclas("La meta de la etapa siguiente.")).toEqual([]); // ETA
    expect(anclas("Un problema doble.")).toEqual([]); // BL
  });

  it("las siglas son sensibles a mayúsculas — 'pod' en minúscula no es un POD", () => {
    expect(anclas("Se podó el árbol y quedó podado.")).toEqual([]);
    expect(anclas("Firmá el POD al recibir.")).toEqual(["pod"]);
  });

  it("los términos con espacios NO son sensibles a mayúsculas", () => {
    expect(anclas("Tu shipping mark identifica la carga.")).toEqual(["markbox"]);
    expect(anclas("Tu Shipping Mark identifica la carga.")).toEqual(["markbox"]);
  });

  it("prefiere el término largo: 'HS Code' no se parte", () => {
    const segs = partirPorTerminos("Declaramos el HS Code correcto.");
    const term = segs.find((s) => s.tipo === "termino");
    expect(term?.valor).toBe("HS Code");
  });

  // El copy público casi nunca escribe "BL" — escribe "Bill of Lading", que es
  // más claro. Durante un tiempo la lista sólo traía la sigla, así que las 20
  // menciones del nombre completo no enlazaban a ninguna parte: el visitante
  // que elegía consolidado se topaba con un documento sin explicación.
  it("enlaza el nombre largo del documento, no sólo la sigla", () => {
    expect(anclas("Recibes tu propio Bill of Lading en Venezuela.")).toEqual([
      "bl",
    ]);
    expect(anclas("Para carga aérea emitimos el Air Waybill.")).toEqual(["awb"]);
  });

  // Cuando el texto trae las dos formas, el enlace va donde el ojo llega
  // primero. Esto es lo que fija el ORDEN de la lista (sigla antes que nombre
  // largo): si se invirtiera, el enlace saltaría al paréntesis del final.
  it("con sigla y nombre largo juntos, enlaza la sigla", () => {
    const segs = partirPorTerminos("Te entregamos tu BL (Bill of Lading).");
    const terms = segs.filter((s) => s.tipo === "termino");
    expect(terms).toHaveLength(1);
    expect(terms[0].valor).toBe("BL");
  });

  // El riesgo del patrón nuevo: "BL" es sensible a mayúsculas justamente para
  // no morder dentro de palabras que empiezan distinto. "Bill" sola no es un BL.
  it("'Bill' suelta no enlaza nada", () => {
    expect(anclas("La factura viene con el Bill Master del contenedor.")).toEqual(
      [],
    );
  });

  it("`excluir` deja fuera un término — lo usa /glosario para no enlazarse a sí misma", () => {
    expect(anclas("Tarifa DDP con CBM.", { excluir: ["ddp"] })).toEqual(["cbm"]);
  });

  it("devuelve un segmento aunque el texto esté vacío", () => {
    expect(partirPorTerminos("")).toHaveLength(1);
  });

  // ── El contrato que importa: los enlaces no pueden apuntar a la nada ──
  //
  // Si alguien renombra un `id` del glosario, esta prueba lo caza. Sin ella el
  // enlace seguiría existiendo y llevaría a /glosario sin saltar a ninguna
  // ficha — se ve casi bien, que es la peor forma de estar roto.
  it("TODA ancla enlazable existe como id real en GLOSSARY_TERMS", () => {
    const ids = new Set(GLOSSARY_TERMS.map((t) => t.id));
    const huerfanas = TERMINOS_ENLAZABLES.filter((t) => !ids.has(t.ancla)).map(
      (t) => `${t.patron} -> #${t.ancla}`,
    );
    expect(huerfanas).toEqual([]);
  });

  // Decisión del founder: enlazar lo que el lector NO entiende, no el copy de
  // marca. "Puerta a Puerta" y "Pagas al llegar" aparecen en casi todos los
  // párrafos del sitio; enlazarlos llenaría el marketing de links.
  it("el copy de marca NO se enlaza, aunque esté en el glosario", () => {
    const t = "Servicio puerta a puerta: pagas al llegar, todo incluido.";
    expect(anclas(t)).toEqual([]);
  });

  it("hrefGlosario arma la ruta con el ancla", () => {
    expect(hrefGlosario("ddp")).toBe("/glosario#ddp");
  });
});

/**
 * Una ficha de servicio son muchos textos cortos que el lector ve como UNA
 * pieza. Sin ámbito compartido cada viñeta enlaza lo suyo: medido sobre
 * servicios-detalle.ts, 24 enlaces donde bastan 14.
 */
describe("glosario · ámbito compartido entre textos", () => {
  const anclasDe = (segs: ReturnType<ReturnType<typeof ambitoGlosario>>) =>
    segs.filter((s) => s.tipo === "termino").map((s) => (s as { ancla: string }).ancla);

  it("el mismo término no se enlaza dos veces en el mismo ámbito", () => {
    const glosar = ambitoGlosario();
    expect(anclasDe(glosar("Se cobra por CBM."))).toEqual(["cbm"]);
    expect(anclasDe(glosar("Tu CBM define el precio."))).toEqual([]);
  });

  it("términos distintos sí enlazan, cada uno una vez", () => {
    const glosar = ambitoGlosario();
    expect(anclasDe(glosar("Viaja LCL consolidado."))).toEqual(["lcl"]);
    expect(anclasDe(glosar("Recibes tu Bill of Lading."))).toEqual(["bl"]);
    expect(anclasDe(glosar("El LCL usa ese BL."))).toEqual([]);
  });

  // Cada ficha arranca de cero: si el registro se filtrara entre ámbitos, la
  // segunda ficha de la página saldría sin un solo enlace.
  it("dos ámbitos son independientes", () => {
    const a = ambitoGlosario();
    const b = ambitoGlosario();
    expect(anclasDe(a("Tarifa DDP."))).toEqual(["ddp"]);
    expect(anclasDe(b("Tarifa DDP."))).toEqual(["ddp"]);
  });

  it("respeta un excluir inicial — lo usa la página que ya explicó el término", () => {
    const glosar = ambitoGlosario({ excluir: ["ddp"] });
    expect(anclasDe(glosar("Tarifa DDP con CBM."))).toEqual(["cbm"]);
  });

  it("no pierde texto: los segmentos rearman cada original", () => {
    const glosar = ambitoGlosario();
    for (const t of ["Se cobra por CBM.", "El CBM manda.", "Tu BL llega después."]) {
      expect(glosar(t).map((s) => s.valor).join("")).toBe(t);
    }
  });
});
