// @vitest-environment node
/**
 * SDD-0654 fase 2 · motor de la guía y contenido de la Vista simple.
 * AC-15: 4 consejos y 2 opcionales; el tutorial del código tiene 6 pasos.
 * Copy (§6): tuteo sin voseo, «contenedor» o «consolidado» y nunca «lote»,
 * «Shipping Mark» y nunca «Markbox».
 */
import { describe, expect, it } from "vitest";
import { GLOSARIO } from "../contenido/glosario";
import { COMPARACION, COMPARACION_DATOS, COMPARACION_INTRO } from "../contenido/comparacion";
import { ANCLA_TEMA, GUIA_PRIMERAS_VECES, TUTORIAL_CODIGO, ancla } from "../contenido/guia";
import { FRASE_ESTADO } from "../contenido/estados";
import { pasoDe, primeraFase, siguienteFase, type FaseGuia } from "../guia-motor";

const todo = () => true;

function recorrer(aceptaExtra: boolean, existe: (a: string) => boolean = todo): string[] {
  const vistos: string[] = [];
  let fase: FaseGuia = primeraFase(GUIA_PRIMERAS_VECES, existe);
  for (let n = 0; n < 20 && fase.tipo !== "fin"; n++) {
    vistos.push(fase.tipo === "continuar" ? "¿continuar?" : (pasoDe(GUIA_PRIMERAS_VECES, fase)?.etiqueta ?? "?"));
    fase = siguienteFase(GUIA_PRIMERAS_VECES, fase, existe, aceptaExtra);
  }
  return vistos;
}

describe("motor de la guía", () => {
  it("bienvenida, 4 consejos y la pregunta; «Listo por ahora» termina", () => {
    expect(recorrer(false)).toEqual([
      "Bienvenida",
      "Consejo 1 de 4",
      "Consejo 2 de 4",
      "Consejo 3 de 4",
      "Consejo 4 de 4",
      "¿continuar?",
    ]);
  });

  it("«Sí, 2 consejos más» muestra los 2 opcionales", () => {
    expect(recorrer(true).slice(-3)).toEqual(["¿continuar?", "Consejo extra 1 de 2", "Consejo extra 2 de 2"]);
  });

  it("se salta un paso cuya ancla no está en la pantalla", () => {
    const sinTema = (a: string) => a !== ANCLA_TEMA;
    expect(recorrer(true, sinTema).slice(-2)).toEqual(["¿continuar?", "Consejo extra 1 de 2"]);
    const sinExtras = (a: string) => a !== ANCLA_TEMA && a !== ancla("vista");
    // Sin ningún extra posible, no se pregunta si quiere continuar.
    expect(recorrer(true, sinExtras).at(-1)).toBe("Consejo 4 de 4");
  });

  it("el tutorial del código tiene 6 pasos y termina", () => {
    let fase: FaseGuia = primeraFase(TUTORIAL_CODIGO, todo);
    const etiquetas: string[] = [];
    while (fase.tipo === "paso") {
      etiquetas.push(pasoDe(TUTORIAL_CODIGO, fase)?.etiqueta ?? "");
      fase = siguienteFase(TUTORIAL_CODIGO, fase, todo);
    }
    expect(etiquetas).toEqual(["Paso 1 de 6", "Paso 2 de 6", "Paso 3 de 6", "Paso 4 de 6", "Paso 5 de 6", "Paso 6 de 6"]);
    expect(fase.tipo).toBe("fin");
  });
});

/** Todo el texto que ve el cliente en el contenido de la Vista simple. */
function textos(): string[] {
  const guia = [GUIA_PRIMERAS_VECES, TUTORIAL_CODIGO].flatMap((r) => [
    ...r.pasos.flatMap((p) => [p.titulo, p.texto, p.siguiente ?? ""]),
    ...(r.extra ?? []).flatMap((p) => [p.titulo, p.texto]),
    r.continuar ? [r.continuar.titulo, r.continuar.texto, r.continuar.si, r.continuar.no] : [],
  ].flat());
  return [
    ...guia,
    ...GLOSARIO.flatMap((g) => [g.termino, g.explicacion]),
    ...COMPARACION.flatMap((f) => [f.aspecto, f.simple, f.pro]),
    COMPARACION_INTRO,
    COMPARACION_DATOS,
    ...Object.values(FRASE_ESTADO),
  ];
}

describe("copy de la Vista simple", () => {
  it("sin «lote» ni «Markbox»", () => {
    for (const t of textos()) {
      expect(t, t).not.toMatch(/\blotes?\b/i);
      expect(t, t).not.toMatch(/markbox/i);
    }
  });

  it("sin voseo en los imperativos", () => {
    const voseo = /\b(tocá|elegí|copiá|mandá|registrá|pedí|pagá|subí|mirá|escribí|avisá|podés|tenés|querés|sabés)\b/i;
    for (const t of textos()) expect(t, t).not.toMatch(voseo);
  });

  it("la comparación no promete Faro mientras no exista (fase 3)", () => {
    for (const f of COMPARACION) expect(`${f.simple} ${f.pro}`).not.toMatch(/faro/i);
  });

  it("el glosario trae las palabras de la spec", () => {
    expect(GLOSARIO.map((g) => g.id)).toEqual(
      expect.arrayContaining(["consolidado", "m3", "packing-list", "prealerta", "aduana", "shipping-mark"]),
    );
  });
});
