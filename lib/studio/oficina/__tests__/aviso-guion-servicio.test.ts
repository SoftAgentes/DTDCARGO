/**
 * SDD-0705 · El aviso al cliente y el guion `explicar-servicio` (aprobados por Sam el 21/11/2026).
 */
import { describe, expect, it } from "vitest";

import { AVISO_CLIENTE, TEXTO_MAXIMO_BORRADOR, cabeEnBorrador, conAvisoAlCliente, esPrimeraRespuesta } from "../aviso-cliente";
import type { MensajeLeido } from "../chatwoot-lectura";
import { PATRONES, enlacesAjenos, normal, revisarRespuesta, sinFrasesDelGuion } from "../eval-automatico";
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
      extras: [
        " Cuesta 120 USD.",
        " Tarda quince días.",
        " Llega el lunes.",
        // v0.4 (opción B de Sam): el 60 y el 90 valen SOLO dentro de su frase del guion.
        " Tu caja cuesta 60.",
        " El tuyo llega en 90 días.",
        " Con suerte en 30 días.",
        " El envío es gratis.",
        " Sale mañana.",
        // v0.5: cantidades en letras y promesas sin cifra.
        " Te llega en cuarenta días.",
        " Tarda entre cuarenta y cincuenta.",
        " Tu caja cuesta sesenta.",
        " Sale en cien días.",
        " Son doscientos.",
        " Te llega en una semana.",
        " Te aseguro que llega antes.",
        " Llega sin falta.",
        // Revisión de la #777: «mes» sin plural, plazos vagos, del trece al diecinueve y más promesas.
        " Llega en un mes.",
        " Te llega a fin de mes.",
        " A finales de mes lo tienes.",
        " Sale la semana que viene.",
        " Tarda catorce días.",
        " Tarda dieciséis días.",
        " En un par de semanas lo tienes.",
        " Tarda unas semanas.",
        " Son varios días.",
        " Garantizamos la entrega.",
        " Te prometo que no pasa.",
        " Seguro que te llega.",
        // Re-revisión de la #777 (H1): una frase por cada palabra nueva, para que ninguna quede sin vigilar.
        " Sale el mes que viene.",
        " Tarda trece días.",
        " En once días.",
        " Tarda doce días.",
        " En unos días.",
        " Son varias semanas.",
        " Pocos días.",
        " Pocas semanas.",
        " Algunos días.",
        " Algunas semanas.",
        " Te lo garantizo.",
        " Te lo prometo.",
        " Prometemos la entrega.",
        " Te llega en diecisiete días.",
        " Tarda dieciocho días.",
        " Tarda diecinueve días.",
        " Le aseguro que llega.",
      ],
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

  it("ninguno trae montos, enlaces ni marcadores; la única cifra es el rango de 60 a 90 días de precios-tiempos", () => {
    for (const { id } of casos) {
      const g = guionPorId(id)!;
      expect(g.texto.match(/\d+/g) ?? [], id).toEqual(id === "precios-tiempos" ? ["60", "90"] : []);
      expect(/\$|usd|d[oó]lar|bol[ií]var/i.test(g.texto), id).toBe(false);
      expect(enlacesAjenos(g.texto, ""), id).toEqual([]);
      expect(/\[[^\]]+\]/.test(g.texto), id).toBe(false);
    }
  });

  it("M2: cada guion es el texto aprobado, palabra por palabra", () => {
    // Opción B de Sam (22/11/2026): «Guion precios-tiempos: opción B, mi v0.4 con Tarifas y 60 a 90 días».
    expect(guionPorId("precios-tiempos")!.texto).toBe(
      "Entendí que quieres saber el costo o los tiempos de tu envío. Los precios los ves en la página web de DTD Cargo, en la sección Tarifas. Los tiempos dependen de cada embarque, pero en general estamos entre 60 y 90 días. Si quieres más detalles, te puedo pasar con un asesor. O si tienes otras preguntas técnicas, aquí estoy para ayudarte.",
    );
    expect(guionPorId("estado-sin-guia")!.texto).toBe(
      "Entendí que quieres saber de tu paquete. Para verlo necesito tu número de guía. ¿Me lo compartes?",
    );
    expect(guionPorId("quejas")!.texto).toBe(
      "Entendí tu molestia, y lo siento. Te paso de inmediato con una persona del equipo para que lo revisen contigo.",
    );
  });

  it("M2: de PATRONES, el texto de los tres solo trae el 60 y el 90 de precios-tiempos (ni fechas, ni montos, ni promesas)", () => {
    for (const { id } of casos) {
      const texto = normal(guionPorId(id)!.texto);
      const hallados = PATRONES.flatMap((patron) => [...texto.matchAll(new RegExp(patron.source, patron.flags))].map((m) => m[0]));
      expect(hallados, id).toEqual(id === "precios-tiempos" ? ["60", "90"] : []);
    }
  });

  it("M2: el rango es informativo («en general»), no una fecha ni una promesa", () => {
    const t = guionPorId("precios-tiempos")!.texto;
    expect(t).toContain("en general estamos entre 60 y 90 días");
    expect(t).not.toMatch(/https?:|www\.|\.com/i);
  });

  it("M2 mutantes: si la frase del rango cambia (30 días, otro rango) o trae un monto, escala", () => {
    const g = guionPorId("precios-tiempos")!;
    const acuse = casos[0].acuse;
    for (const mutante of [
      g.texto.replace("entre 60 y 90 días", "entre 30 y 90 días"),
      g.texto.replace("entre 60 y 90 días", "en 30 días"),
      g.texto.replace("entre 60 y 90 días", "entre 60 y 120 días"),
      g.texto.replace("entre 60 y 90 días", "entre sesenta y noventa días"),
      g.texto.replace("entre 60 y 90 días", "entre cuarenta y cincuenta días"),
      g.texto.replace("entre 60 y 90 días", "en un mes"),
      g.texto.replace("en la sección Tarifas", "desde 60 USD"),
    ]) {
      expect(mutante, "el mutante sí cambió el texto").not.toBe(g.texto);
      expect(revisarRespuesta({ tipo: "respuesta", acuse, texto: mutante, guion: g.id }, GUIONES_SOPORTE), mutante).toContain(
        "dato_inventado",
      );
    }
  });

  it("v0.5: «mil gracias» es un agradecimiento y no escala; «mil dólares» o «mil cajas» sí", () => {
    const g = guionPorId("quejas")!;
    const acuse = "Entendí tu molestia, y lo siento.";
    const revisar = (extra: string) =>
      revisarRespuesta({ tipo: "respuesta", acuse, texto: g.texto + extra, guion: g.id }, GUIONES_SOPORTE);
    expect(revisar(" Mil gracias por tu paciencia.")).toEqual([]);
    expect(revisar(" Son mil graciasss.")).toContain("dato_inventado");
    expect(revisar(" Son mil dólares.")).toContain("dato_inventado");
    expect(revisar(" Llegaron mil cajas.")).toContain("dato_inventado");
  });

  it("el 60 y el 90 no pasan con otro guion: fuera de precios-tiempos escalan", () => {
    const acuse = "Entiendo tu consulta.";
    const texto = `${guionPorId("derivar-equipo")!.texto} En general estamos entre 60 y 90 días.`;
    expect(revisarRespuesta({ tipo: "respuesta", acuse, texto, guion: "derivar-equipo" }, GUIONES_SOPORTE)).toContain(
      "dato_inventado",
    );
  });

  it("sinFrasesDelGuion quita solo las frases copiadas tal cual y deja el resto", () => {
    const guion = guionPorId("precios-tiempos")!.texto;
    expect(sinFrasesDelGuion(normal(guion), guion).trim()).toBe("");
    expect(sinFrasesDelGuion(normal(`${guion} Cuesta 60.`), guion)).toMatch(/cuesta 60/);
  });

  it("pedir-guia ya no existe (lo reemplaza estado-sin-guia) y derivar-equipo ya no cubre reclamos", () => {
    expect(guionPorId("pedir-guia")).toBeUndefined();
    expect(guionPorId("derivar-equipo")!.cuando).not.toMatch(/reclamos/);
    expect(guionPorId("derivar-equipo")!.cuando).toMatch(/quejas/);
  });
});
