import { describe, it, expect } from "vitest";
import { SERVICIOS_DETALLE, SERVICIOS_GRUPOS } from "@/lib/servicios-detalle";
import { FAQS } from "@/lib/faqs";
import { GEO_ZONAS } from "@/lib/geo-zonas";

/**
 * "Casco central" no se le dice más al cliente (founder, 1-ago-2026 · SDD-0237).
 *
 * POR QUÉ ESTE ARCHIVO EXISTE. El barrido original tocó los cuatro sitios que
 * el founder listó de memoria y se dio por cerrado. Faltaban tres, y sólo
 * aparecieron al mirar el HTML que producción estaba sirviendo: el término
 * seguía vivo en `/tarifas`, `/servicios`, `/faq` y `/calculadora-terrestre`,
 * porque entra por el CATÁLOGO de servicios y por el FAQ, no por las páginas.
 *
 * La lección no es "faltaron tres archivos": es que un barrido de copy hecho
 * a mano no tiene forma de saber cuándo terminó. Este test sí — recorre los
 * datos REALES que alimentan las páginas y falla si el término vuelve por
 * cualquier vía.
 *
 * Se camina la ESTRUCTURA DE DATOS y no el texto fuente a propósito: los
 * comentarios del código sí explican el cambio y deben poder nombrar el
 * término viejo sin poner el test en rojo.
 */

/** Junta todos los strings de una estructura, con la ruta donde vive cada uno. */
function stringsDe(valor: unknown, ruta = ""): { ruta: string; texto: string }[] {
  if (typeof valor === "string") return [{ ruta, texto: valor }];
  if (Array.isArray(valor)) {
    return valor.flatMap((v, i) => stringsDe(v, `${ruta}[${i}]`));
  }
  if (valor && typeof valor === "object") {
    return Object.entries(valor).flatMap(([k, v]) =>
      stringsDe(v, ruta ? `${ruta}.${k}` : k),
    );
  }
  return [];
}

const FUENTES: { nombre: string; datos: unknown }[] = [
  { nombre: "SERVICIOS_DETALLE (alimenta /servicios, /tarifas y el JSON-LD)", datos: SERVICIOS_DETALLE },
  { nombre: "SERVICIOS_GRUPOS", datos: SERVICIOS_GRUPOS },
  { nombre: "FAQS (alimenta /faq y la base del bot)", datos: FAQS },
  { nombre: "GEO_ZONAS (18 landings indexadas)", datos: GEO_ZONAS },
];

describe("el copy público no dice 'casco central'", () => {
  for (const { nombre, datos } of FUENTES) {
    it(`${nombre}`, () => {
      const ofensores = stringsDe(datos)
        .filter(({ texto }) => /casco\s+central/i.test(texto))
        .map(({ ruta, texto }) => `${ruta}: "${texto.slice(0, 90)}…"`);

      expect(
        ofensores,
        `El término murió de cara al cliente. Usa "entrega incluida" para la zona sin costo, o describe el cobro por metro cúbico:\n${ofensores.join("\n")}`,
      ).toEqual([]);
    });
  }

  it("tampoco promete un cobro por distancia", () => {
    // El otro lado de la misma moneda: la entrega se cobra por VOLUMEN. Un
    // copy que hable de recargo por km o por distancia insinúa un modelo de
    // precio que murió con SDD-0237, aunque no use la palabra "casco".
    const ofensores = FUENTES.flatMap(({ nombre, datos }) =>
      stringsDe(datos, nombre)
        .filter(({ texto }) =>
          /(recargo|cobro|costo|cargo)\s+(adicional\s+)?por\s+(distancia|kil[óo]metro)/i.test(
            texto,
          ),
        )
        .map(({ ruta, texto }) => `${ruta}: "${texto.slice(0, 90)}…"`),
    );

    expect(ofensores, ofensores.join("\n")).toEqual([]);
  });
});
