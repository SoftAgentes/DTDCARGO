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

  it("existe, sube la versión a 0.3 y no reemplaza a los demás", () => {
    expect(g).toBeDefined();
    expect(VERSION_GUIONES).toBe("0.3");
    expect(GUIONES_SOPORTE.map((x) => x.id)).toEqual([
      "acuse-general",
      "pedir-guia",
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
