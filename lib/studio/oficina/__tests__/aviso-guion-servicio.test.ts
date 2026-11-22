/**
 * SDD-0705 · El aviso al cliente y el guion `explicar-servicio` (aprobados por Sam el 21/11/2026).
 */
import { describe, expect, it } from "vitest";

import { AVISO_CLIENTE, TEXTO_MAXIMO_BORRADOR, cabeEnBorrador, conAvisoAlCliente, esPrimeraRespuesta } from "../aviso-cliente";
import type { MensajeLeido } from "../chatwoot-lectura";
import { enlacesAjenos, revisarRespuesta } from "../eval-automatico";
import { GUIONES_SOPORTE, VERSION_GUIONES, guionPorId } from "../guiones-soporte";

const cliente = (texto: string): MensajeLeido => ({ rol: "cliente", texto });
const dtd = (texto: string): MensajeLeido => ({ rol: "agente", texto });

describe("aviso al cliente", () => {
  it("es el texto aprobado, palabra por palabra", () => {
    expect(AVISO_CLIENTE).toBe(
      "Hola, soy el asistente virtual de DTD Cargo. Una persona del equipo revisa cada respuesta antes de enviártela.",
    );
  });

  it("va AL FINAL en la primera respuesta (v0.2, Sam: «el aviso va al final»): el borrador abre con el guion", () => {
    const t = conAvisoAlCliente("¡Hola! Gracias por escribirle a DTD Cargo.", [cliente("Hola"), cliente("¿Siguen ahí?")]);
    expect(t).toBe(`¡Hola! Gracias por escribirle a DTD Cargo.\n\n${AVISO_CLIENTE}`);
    expect(t.startsWith("¡Hola! Gracias")).toBe(true);
    expect(t.endsWith(AVISO_CLIENTE)).toBe(true);
  });

  it("con el aviso, un borrador de más de 4000 caracteres no cabe (el despachador escala borrador_largo)", () => {
    expect(TEXTO_MAXIMO_BORRADOR).toBe(4000);
    const margen = TEXTO_MAXIMO_BORRADOR - (AVISO_CLIENTE.length + 2);
    expect(cabeEnBorrador(conAvisoAlCliente("a".repeat(margen), [cliente("Hola")]))).toBe(true);
    expect(cabeEnBorrador(conAvisoAlCliente("a".repeat(margen + 1), [cliente("Hola")]))).toBe(false);
    // Se cuenta como la base: caracteres (no bytes) y sin espacios a los lados.
    expect(cabeEnBorrador(`  ${"ñ".repeat(4000)}  `)).toBe(true);
  });

  it("v0.3 (M1): mide como btrim de PostgreSQL, que quita solo espacios, no saltos de línea ni tabuladores", () => {
    // 4000 caracteres + saltos al final: la base los cuenta (btrim no los quita) → no cabe.
    expect(cabeEnBorrador(`${"a".repeat(4000)}\n\n`)).toBe(false);
    expect(cabeEnBorrador(`\t${"a".repeat(4000)}`)).toBe(false);
    // Los espacios sí se quitan a los dos lados.
    expect(cabeEnBorrador(`   ${"a".repeat(4000)}   `)).toBe(true);
  });

  it("v0.3 (M3): el tope aplica también sin el aviso (respuestas que no son la primera)", () => {
    const sinAviso = conAvisoAlCliente("a".repeat(4001), [cliente("Hola"), dtd("Hola, ¿en qué te ayudo?")]);
    expect(sinAviso).not.toContain(AVISO_CLIENTE);
    expect(cabeEnBorrador(sinAviso)).toBe(false);
  });

  it("no se repite si DTD ya respondió (el agente o una persona del equipo)", () => {
    const mensajes = [cliente("Hola"), dtd("Hola, ¿en qué te ayudo?"), cliente("¿Cómo funciona?")];
    expect(esPrimeraRespuesta(mensajes)).toBe(false);
    expect(conAvisoAlCliente("Entendí tu pregunta.", mensajes)).toBe("Entendí tu pregunta.");
  });

  it("nunca lo duplica si el texto ya trae el aviso (al final o en otro lugar)", () => {
    const alFinal = `Hola.\n\n${AVISO_CLIENTE}`;
    expect(conAvisoAlCliente(alFinal, [cliente("Hola")])).toBe(alFinal);
    const delante = `${AVISO_CLIENTE}\n\nHola.`;
    expect(conAvisoAlCliente(delante, [cliente("Hola")])).toBe(delante);
  });

  it("no trae cifras, fechas, datos personales ni enlaces (pasaría la revisión por sí solo)", () => {
    expect(/\d/.test(AVISO_CLIENTE)).toBe(false);
    expect(enlacesAjenos(AVISO_CLIENTE, "")).toEqual([]);
  });
});

describe("guion explicar-servicio (v0.3)", () => {
  const g = guionPorId("explicar-servicio")!;
  const acuse = "Entendí tu pregunta sobre cómo funciona el servicio de DTD Cargo.";

  it("existe y sigue en la lista (v0.4 suma los tres guiones del encargo B)", () => {
    expect(g).toBeDefined();
    expect(VERSION_GUIONES).toBe("0.4");
    expect(GUIONES_SOPORTE.map((x) => x.id)).toEqual([
      "acuse-general",
      "estado-sin-guia",
      "precios-tiempos",
      "quejas",
      "derivar-equipo",
      "explicar-servicio",
      "control",
    ]);
  });

  it("empieza con su acuse y trae los cinco pasos aprobados", () => {
    expect(g.texto.startsWith(acuse)).toBe(true);
    for (const paso of [
      "1. Compras tus productos y los envías a nuestro almacén en China (Yiwu).",
      "2. Los recibimos y los registramos.",
      "3. Los consolidamos en un contenedor y zarpa hacia Venezuela.",
      "4. Llega a Venezuela, pasa por aduana y se reparte.",
      "5. Te avisamos para coordinar la entrega.",
    ]) {
      expect(g.texto).toContain(paso);
    }
  });

  it("el guion tal cual pasa la revisión automática (los números de la lista vienen del guion)", () => {
    expect(revisarRespuesta({ tipo: "respuesta", acuse, texto: g.texto, guion: g.id }, GUIONES_SOPORTE)).toEqual([]);
  });

  it("no trae precios, montos, fechas ni enlaces", () => {
    const sinLista = g.texto.replace(/^[1-5]\. /gm, "");
    expect(/\d/.test(sinLista)).toBe(false);
    expect(/\$|usd|d[oó]lar|bol[ií]var/i.test(g.texto)).toBe(false);
    expect(enlacesAjenos(g.texto, "")).toEqual([]);
  });

  it("si el agente le agrega un precio o un plazo, la revisión lo escala (dato_inventado)", () => {
    for (const extra of [" El flete cuesta 300 USD.", " Llega en quince días.", " Tu envío ya zarpó."]) {
      const r = { tipo: "respuesta" as const, acuse, texto: g.texto + extra, guion: g.id };
      expect(revisarRespuesta(r, GUIONES_SOPORTE)).toContain("dato_inventado");
    }
  });

  it("su «cuándo» prohíbe precios, fechas y estados", () => {
    expect(g.cuando).toMatch(/NUNCA da precios, fechas de entrega ni el estado de un envío/);
  });
});

describe("guiones v0.4 (encargo B de Hermes, aprobados por Sam: «Apruebo 1, 2 y 3»)", () => {
  const casos = [
    {
      id: "precios-tiempos",
      acuse: "Entendí que quieres saber el costo o los tiempos de tu envío.",
      extras: [" Cuesta 120 USD.", " Tarda quince días.", " Llega el lunes."],
    },
    {
      id: "estado-sin-guia",
      acuse: "Entendí que quieres saber de tu paquete.",
      extras: [" Tu envío está en tránsito.", " Ya zarpó.", " Llega mañana."],
    },
    {
      id: "quejas",
      acuse: "Entendí tu molestia, y lo siento.",
      extras: [" Te devolvemos el dinero.", " Te garantizo que no vuelve a pasar.", " Tienes un descuento."],
    },
  ];

  it.each(casos)("$id: existe, empieza con su acuse y pasa la revisión tal cual", ({ id, acuse }) => {
    const g = guionPorId(id)!;
    expect(g).toBeDefined();
    expect(g.texto.startsWith(acuse)).toBe(true);
    expect(revisarRespuesta({ tipo: "respuesta", acuse, texto: g.texto, guion: id }, GUIONES_SOPORTE)).toEqual([]);
  });

  it.each(casos)("$id: si el agente agrega un precio, un plazo, un estado o una promesa, escala", ({ id, acuse, extras }) => {
    const g = guionPorId(id)!;
    for (const extra of extras) {
      const r = { tipo: "respuesta" as const, acuse, texto: g.texto + extra, guion: id };
      expect(revisarRespuesta(r, GUIONES_SOPORTE), extra).toContain("dato_inventado");
    }
  });

  it("ninguno trae cifras, montos, enlaces ni marcadores", () => {
    for (const { id } of casos) {
      const g = guionPorId(id)!;
      expect(/\d/.test(g.texto), id).toBe(false);
      expect(/\$|usd|d[oó]lar|bol[ií]var/i.test(g.texto), id).toBe(false);
      expect(enlacesAjenos(g.texto, ""), id).toEqual([]);
      expect(/\[[^\]]+\]/.test(g.texto), id).toBe(false);
    }
  });

  it("pedir-guia ya no existe (lo reemplaza estado-sin-guia) y derivar-equipo ya no cubre reclamos", () => {
    expect(guionPorId("pedir-guia")).toBeUndefined();
    expect(guionPorId("derivar-equipo")!.cuando).not.toMatch(/reclamos/);
    expect(guionPorId("derivar-equipo")!.cuando).toMatch(/quejas/);
  });
});
