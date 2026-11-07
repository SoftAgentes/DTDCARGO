// @vitest-environment node
/**
 * SDD-0611 §5.1 · Las piezas de los filtros, en sus límites: marcas (F4),
 * control determinista (F5), puntaje (F6), ritmo (F7), huella (F3), avisos
 * (§4.5) y motivos de retiro (§4.11).
 */
import { describe, expect, it } from "vitest";
import { avisoPublicadaPorPersona, avisoPublicadaSola, avisoRetenida } from "../aviso";
import { controlLineasRojas, tieneDatosPersonales } from "../control";
import { evaluarFiltros } from "../filtros";
import { huellaDe, serializarParaHuella } from "../huella";
import { contarMarcas, listarMarcas } from "../marcas";
import { notaParaOficina, validarRetiro } from "../motivos";
import { evaluarPuntaje, muletillasEn, problemasDelTitular } from "../puntaje";
import { evaluarRitmo, fechaCaracas, lunesCaracas, validarTopes } from "../ritmo";
import { computeArticleScore } from "@/lib/news/score";
import { NOMBRES_PROHIBIDOS, TITULAR, cuerpo, entradaFeliz } from "./fixture";

describe("F4 · marcas [VERIFICAR en cualquier forma", () => {
  const SI = [
    "[VERIFICAR]",
    "[VERIFICAR: ]",
    "[verificar: x]",
    "[VERIFICAR: 30%]",
    "[ VERIFICAR algo]",
    "[VERIFICAR sin cerrar",
    "［VERIFICAR］",
    "[VERI​FICAR: invisible]",
    "[VERI­FICAR]",
    "https://dtdcargo.com/x?%5BVERIFICAR%5D",
    "https://dtdcargo.com/x?%5bverificar",
  ];
  for (const t of SI) it(`cuenta ${JSON.stringify(t)}`, () => expect(contarMarcas(t)).toBeGreaterThan(0));

  it("no cuenta la palabra suelta ni un corchete normal", () => {
    expect(contarMarcas("Hay que verificar el peso [nota] antes.")).toBe(0);
  });

  it("verifyMarkers ahora lista la marca vacía (antes daba cero)", () => {
    expect(computeArticleScore("Texto [VERIFICAR] y [VERIFICAR: ] y [VERIFICAR: dato].", "").verifyMarkers).toEqual([
      "(sin texto)",
      "(sin texto)",
      "dato",
    ]);
    expect(listarMarcas("[verificar: x]")).toEqual(["x"]);
  });
});

describe("F5 · control determinista, una fila por regla de §4.3.1", () => {
  const control = (texto: string, fuentes: Array<{ url?: string }> = []) =>
    controlLineasRojas({ textos: [texto], fuentes, nombresProhibidos: NOMBRES_PROHIBIDOS });

  const FILAS: Array<[string, string, string]> = [
    ["precio con dólares", "El flete cuesta 120 dólares.", "linea_roja:precio"],
    ["precio con $", "Sale en $ 45 la caja.", "linea_roja:precio"],
    ["precio con USD", "Unos 300 USD de diferencia.", "linea_roja:precio"],
    ["precio con Bs", "Pagas Bs. 900 de más.", "linea_roja:precio"],
    ["precio con yuanes", "Cuesta 50 yuanes en Yiwu.", "linea_roja:precio"],
    ["precio por kilo", "Son 3 por kilo.", "linea_roja:precio"],
    ["precio por metro cúbico", "Unos 280 el metro cúbico.", "linea_roja:precio"],
    ["plazo garantizado", "Te garantizamos la entrega.", "linea_roja:plazo"],
    ["plazo en N días", "Tu carga llega en 30 días.", "linea_roja:plazo"],
    ["plazo en N semanas", "La recibes en 6 semanas.", "linea_roja:plazo"],
    ["descuento", "Hay un descuento para ti.", "linea_roja:descuento"],
    ["reembolso", "Te hacemos el reembolso.", "linea_roja:descuento"],
    ["gratis", "El primer envío es gratis.", "linea_roja:descuento"],
    ["oferta", "Aprovecha la oferta.", "linea_roja:descuento"],
    ["operador nombrado", "Trabajamos con Consolidadora Ficticia Andina.", "linea_roja:operador"],
    ["operador con guion", "Trabajamos con Consoli-dadora Ficti-cia Andina.", "linea_roja:operador"],
    ["lenguaje técnico", "Mejora tu flujo de caja.", "linea_roja:lenguaje_calle"],
    ["rotación", "La rotación del inventario sube.", "linea_roja:lenguaje_calle"],
    ["CCC", "Baja el CCC del negocio.", "linea_roja:lenguaje_calle"],
    ["pedir que compre menos", "Lo mejor es que compres menos y compra menos cada vez.", "linea_roja:compra_menos"],
    ["reduce tus compras", "Reduce tus compras grandes.", "linea_roja:compra_menos"],
    ["teléfono", "Escribe al 0414-123-45-67.", "linea_roja:datos_personales"],
    ["teléfono con +58", "Llama al +58 412 1234567.", "linea_roja:datos_personales"],
    ["correo", "Escribe a alguien@ejemplo.test.", "linea_roja:datos_personales"],
    ["cédula", "Su cédula V-12.345.678 quedó.", "linea_roja:datos_personales"],
    ["RIF", "El RIF J-12345678-9 aparece.", "linea_roja:datos_personales"],
    ["dirección", "Queda en la calle Real del sector, casa 12.", "linea_roja:datos_personales"],
    ["enlace ajeno sin fuente", "Mira https://otro.test/nota para más.", "linea_roja:enlace_ajeno"],
  ];
  for (const [nombre, texto, codigo] of FILAS) {
    it(`${nombre} → ${codigo}`, () => expect(control(texto)).toContain(codigo));
  }

  it("un enlace a DTD Cargo o a una fuente declarada no es ajeno", () => {
    expect(control("Mira https://dtdcargo.com/tarifas y https://www.dtdcargo.com/fcl.")).toEqual([]);
    expect(control("Según https://fuente.test/nota.", [{ url: "https://fuente.test/" }])).toEqual([]);
  });

  it("un texto limpio no da nada", () => {
    expect(control("Repartir las compras del trimestre deja la caja respirar.")).toEqual([]);
  });

  it("sin lista de nombres cargada falla cerrado", () => {
    expect(controlLineasRojas({ textos: ["Hola."], fuentes: [], nombresProhibidos: null })).toEqual([
      "linea_roja:lista_no_cargada",
    ]);
    expect(controlLineasRojas({ textos: ["Hola."], fuentes: [], nombresProhibidos: ["  ", "ab"] })).toEqual([
      "linea_roja:lista_no_cargada",
    ]);
  });

  it("privacidad (§5): detecta teléfono, correo y cédula en el cuerpo", () => {
    expect(tieneDatosPersonales("Llama al 0412 555 12 34")).toBe(true);
    expect(tieneDatosPersonales("correo: persona@dominio.test")).toBe(true);
    expect(tieneDatosPersonales("C.I. 12345678")).toBe(true);
    expect(tieneDatosPersonales("Sin datos de nadie.")).toBe(false);
  });
});

describe("F6 · puntaje mínimo, en el límite de cada métrica", () => {
  const base = {
    titular: TITULAR,
    tipo: "informativo" as const,
    categoria: "importa-sin-perder-plata" as const,
    focusKeyword: "importador",
    coverImageUrl: null,
    contentKind: "guide",
  };
  const conCuerpo = (palabras: number, subtitulos = 6, ocurrencias = 10) =>
    evaluarPuntaje({ ...base, markdown: cuerpo({ palabras, subtitulos, ocurrencias }) });

  it("el cuerpo feliz pasa", () => expect(conCuerpo(1000)).toEqual([]));

  it("399 palabras no está listo; 400 sí (isPublishReady)", () => {
    expect(conCuerpo(399, 6, 4)).toContain("puntaje:listo");
    expect(conCuerpo(400, 6, 4)).not.toContain("puntaje:listo");
  });

  it("largo del tipo: 849 y 1151 fuera, 850 y 1150 dentro (Informativo 1.000 ± 150)", () => {
    expect(conCuerpo(849, 6, 9)).toContain("puntaje:largo");
    expect(conCuerpo(850, 6, 9)).not.toContain("puntaje:largo");
    expect(conCuerpo(1150, 6, 12)).not.toContain("puntaje:largo");
    expect(conCuerpo(1151, 6, 12)).toContain("puntaje:largo");
  });

  it("Curiosidad 700 y Polémica 1.100", () => {
    const curiosidad = { ...base, tipo: "curiosidad" as const, categoria: "que-se-mueve-en-china" as const, titular: TITULAR.replace("Importa · ", "China · ") };
    expect(evaluarPuntaje({ ...curiosidad, markdown: cuerpo({ palabras: 700, subtitulos: 6, ocurrencias: 7 }) })).toEqual([]);
    expect(evaluarPuntaje({ ...curiosidad, markdown: cuerpo({ palabras: 1000, subtitulos: 6, ocurrencias: 10 }) })).toContain("puntaje:largo");
    const polemica = { ...base, tipo: "polemica" as const, categoria: "venezuela-y-tu-bolsillo" as const, titular: TITULAR.replace("Importa · ", "Bolsillo · ") };
    expect(evaluarPuntaje({ ...polemica, markdown: cuerpo({ palabras: 1100, subtitulos: 6, ocurrencias: 11 }) })).toEqual([]);
  });

  it("cuatro subtítulos no; cinco y siete sí; ocho no", () => {
    expect(conCuerpo(1000, 4)).toContain("puntaje:subtitulos");
    expect(conCuerpo(1000, 5)).not.toContain("puntaje:subtitulos");
    expect(conCuerpo(1000, 7)).not.toContain("puntaje:subtitulos");
    expect(conCuerpo(1000, 8)).toContain("puntaje:subtitulos");
  });

  it("densidad 0,4 % no; 0,5 % sí; 2,5 % sí; 2,6 % no", () => {
    expect(conCuerpo(1000, 6, 4)).toContain("puntaje:densidad");
    expect(conCuerpo(1000, 6, 5)).not.toContain("puntaje:densidad");
    expect(conCuerpo(1000, 6, 25)).not.toContain("puntaje:densidad");
    expect(conCuerpo(1000, 6, 26)).toContain("puntaje:densidad");
  });

  it("sin palabra clave, o sin aparecer, falla", () => {
    expect(evaluarPuntaje({ ...base, focusKeyword: null, markdown: cuerpo({ palabras: 1000, subtitulos: 6 }) })).toContain("puntaje:palabra_clave");
    expect(conCuerpo(1000, 6, 0)).toContain("puntaje:palabra_clave");
  });

  it("sin párrafo de tesis falla", () => {
    const md = cuerpo({ palabras: 1000, subtitulos: 6, ocurrencias: 10 }).replace(/\./g, "");
    expect(evaluarPuntaje({ ...base, markdown: md })).toContain("puntaje:tesis");
  });

  it("titular: prefijo exacto, 35 a 50 caracteres después, sin comillas, numeración ni emojis", () => {
    const cat = "importa-sin-perder-plata" as const;
    expect(problemasDelTitular(TITULAR, cat)).toEqual([]);
    expect(problemasDelTitular("Importa: Cómo repartir tus compras grandes en el año", cat)).toEqual(["prefijo"]);
    expect(problemasDelTitular(`Importa · ${"a".repeat(34)}`, cat)).toEqual(["largo"]);
    expect(problemasDelTitular(`Importa · ${"a".repeat(35)}`, cat)).toEqual([]);
    expect(problemasDelTitular(`Importa · ${"a".repeat(50)}`, cat)).toEqual([]);
    expect(problemasDelTitular(`Importa · ${"a".repeat(51)}`, cat)).toEqual(["largo"]);
    expect(problemasDelTitular("Importa · «Cómo repartir» tus compras grandes del año", cat)).toContain("comillas");
    expect(problemasDelTitular("Importa · 5) Formas de repartir tus compras grandes", cat)).toContain("numeracion");
    expect(problemasDelTitular("Importa · Cómo repartir tus compras grandes en el 🚢", cat)).toContain("emoji");
  });

  it("portada propia del sitio o la de la categoría; una externa no", () => {
    expect(evaluarPuntaje({ ...base, coverImageUrl: "/fotos/x.jpg", markdown: cuerpo({ palabras: 1000, subtitulos: 6, ocurrencias: 10 }) })).toEqual([]);
    expect(evaluarPuntaje({ ...base, coverImageUrl: "https://otro.test/x.jpg", markdown: cuerpo({ palabras: 1000, subtitulos: 6, ocurrencias: 10 }) })).toContain("puntaje:portada");
    expect(evaluarPuntaje({ ...base, coverImageUrl: "//otro.test/x.jpg", markdown: cuerpo({ palabras: 1000, subtitulos: 6, ocurrencias: 10 }) })).toContain("puntaje:portada");
  });

  it("tipo de contenido declarado", () => {
    expect(evaluarPuntaje({ ...base, contentKind: null, markdown: cuerpo({ palabras: 1000, subtitulos: 6, ocurrencias: 10 }) })).toContain("puntaje:tipo_contenido");
    expect(evaluarPuntaje({ ...base, contentKind: "otro", markdown: cuerpo({ palabras: 1000, subtitulos: 6, ocurrencias: 10 }) })).toContain("puntaje:tipo_contenido");
  });

  it("naturalidad: una muletilla retiene", () => {
    expect(muletillasEn("En conclusión, todo sale bien.")).toEqual(["en conclusion"]);
    expect(muletillasEn("Cabe destacar que sí.")).toEqual(["cabe destacar"]);
    expect(muletillasEn("Uno — dos — tres — cuatro.")).toEqual(["raya larga repetida"]);
    const md = `${cuerpo({ palabras: 1000, subtitulos: 6, ocurrencias: 10 })}\n\nEn resumen, sale bien.`;
    expect(evaluarPuntaje({ ...base, markdown: md })).toContain("puntaje:muletillas");
  });
});

describe("F7 · ritmo, con reloj fijo en hora de Caracas", () => {
  const MARTES = new Date("2026-11-17T15:00:00Z"); // 11:00 en Caracas
  const r = (ahora: Date, automaticas: Date[], topeDia = 1, topeSemana = 2) =>
    evaluarRitmo({ ahora, automaticas, topeDia, topeSemana });

  it("la fecha y el lunes salen en hora de Caracas (UTC−4)", () => {
    expect(fechaCaracas(new Date("2026-11-17T03:59:00Z"))).toBe("2026-11-16");
    expect(fechaCaracas(new Date("2026-11-17T04:00:00Z"))).toBe("2026-11-17");
    // Domingo 22 a las 23:00 en Caracas sigue siendo la semana del lunes 16.
    expect(lunesCaracas(new Date("2026-11-23T03:00:00Z"))).toBe("2026-11-16");
    expect(lunesCaracas(new Date("2026-11-23T04:00:00Z"))).toBe("2026-11-23");
  });

  it("topes 1 y 2: el segundo automático del día queda retenido", () => {
    expect(r(MARTES, [new Date("2026-11-17T12:00:00Z")])).toEqual(["tope_dia"]);
  });

  it("topes 1 y 2: el tercero automático de la semana queda retenido y el del lunes siguiente pasa", () => {
    const dos = [new Date("2026-11-16T15:00:00Z"), new Date("2026-11-17T13:00:00Z")];
    const jueves = new Date("2026-11-19T15:00:00Z");
    expect(r(jueves, dos)).toEqual(["tope_semana"]);
    expect(r(new Date("2026-11-23T15:00:00Z"), dos)).toEqual([]);
  });

  it("una de ayer en Caracas no cuenta para el tope de hoy aunque sea el mismo día en UTC", () => {
    // 2026-11-17 02:00Z es el 16 a las 22:00 en Caracas.
    expect(r(MARTES, [new Date("2026-11-17T02:00:00Z")], 1, 7)).toEqual([]);
  });

  it("topes 1 y 7: pasa una por día los siete días de la semana", () => {
    const publicadas: Date[] = [];
    for (let d = 0; d < 7; d++) {
      const dia = new Date(Date.UTC(2026, 10, 16 + d, 15));
      expect(r(dia, publicadas, 1, 7), `día ${d}`).toEqual([]);
      publicadas.push(dia);
    }
    expect(r(new Date(Date.UTC(2026, 10, 22, 20)), publicadas, 1, 7)).toEqual(["tope_dia"]);
  });

  it("una configuración de 2 por día se rechaza, y si llegara, falla cerrada", () => {
    expect(validarTopes(2, 7)).toBe("tope_dia_invalido");
    expect(validarTopes(1, 8)).toBe("tope_semana_invalido");
    expect(validarTopes(1.5, 2)).toBe("tope_dia_invalido");
    expect(validarTopes(1, 2)).toBe(null);
    expect(validarTopes(0, 0)).toBe(null);
    expect(r(MARTES, [], 2, 7)).toEqual(["tope_dia"]);
  });

  it("tope en cero no publica nada", () => {
    expect(r(MARTES, [], 0, 2)).toEqual(["tope_dia"]);
    expect(r(MARTES, [], 1, 0)).toEqual(["tope_semana"]);
  });
});

describe("F3 · huella", () => {
  const c = {
    tipo: "informativo",
    categoria: "importa-sin-perder-plata",
    title: "T",
    focus_keyword: "k",
    secondary_keywords: ["a", "b"],
    meta_description: "m",
    body_markdown: "cuerpo",
  };
  it("es SHA-256 hex y cambia con una coma", () => {
    expect(huellaDe(c)).toMatch(/^[0-9a-f]{64}$/);
    expect(huellaDe({ ...c, body_markdown: "cuerpo," })).not.toBe(huellaDe(c));
    expect(huellaDe({ ...c, secondary_keywords: ["b", "a"] })).not.toBe(huellaDe(c));
  });
  it("la serialización es la de la función de la base (separadores U+001F y U+001E)", () => {
    expect(serializarParaHuella(c)).toBe(
      ["sdd0611-v1", "informativo", "importa-sin-perder-plata", "T", "k", "a\u001eb", "m", "cuerpo"].join("\u001f"),
    );
  });
});

describe("§4.5 · avisos a #noticias", () => {
  const resultados = evaluarFiltros(entradaFeliz()).resultados;
  const cuerpoReal = entradaFeliz().post.body_markdown;

  it("publicada sola: titular, enlace, filtros, conteo de la semana y retiro; sin el cuerpo", () => {
    const t = avisoPublicadaSola({
      titular: TITULAR,
      url: "https://dtdcargo.com/noticias/x",
      retiroUrl: "https://dtdcargo.com/studio/marketing/noticias-web/retirar/1",
      semana: { publicadas: 1, tope: 2 },
      resultados,
      riesgoRevisor: "Sin riesgos.",
      retiradas: null,
    });
    expect(t).toContain("Publicada sola");
    expect(t).toContain("1 de 2 esta semana");
    expect(t).toContain(TITULAR);
    expect(t).toContain("https://dtdcargo.com/noticias/x");
    expect(t).toContain("Retirar: https://dtdcargo.com/studio/marketing/noticias-web/retirar/1");
    expect(t).toContain("F1 a F10 en verde");
    expect(t).not.toContain(cuerpoReal.slice(0, 60));
  });

  it("con dos retiradas en la semana, lo dice primero", () => {
    const t = avisoPublicadaSola({
      titular: TITULAR, url: "u", retiroUrl: "r", semana: { publicadas: 2, tope: 2 }, resultados,
      riesgoRevisor: null, retiradas: { cantidad: 2, motivos: ["tono", "dato_incorrecto"] },
    });
    expect(t.split("\n")[0]).toBe("⚠️ Van 2 retiradas esta semana (tono, dato_incorrecto).");
  });

  it("la opinión del Revisor no viaja si trae un dato personal, ni menciones masivas", () => {
    const t = avisoPublicadaSola({
      titular: "Titular @everyone", url: "u", retiroUrl: "r", semana: { publicadas: 1, tope: 2 }, resultados,
      riesgoRevisor: "Llamar al 0414-123-45-67", retiradas: null,
    });
    expect(t).not.toContain("0414");
    expect(t).not.toContain("@everyone");
  });

  it("publicada por una persona lleva su etiqueta y el nombre", () => {
    const t = avisoPublicadaPorPersona({ titular: TITULAR, url: "u", persona: "Sam", retiroUrl: "r", retiradas: null });
    expect(t).toContain("Publicada por una persona");
    expect(t).toContain("Sam");
  });

  it("retenida por datos personales: no manda el titular, solo el código del borrador, el motivo y el enlace", () => {
    const titular = "Importa · Llama al 0414-123-45-67 para tu envío";
    const t = avisoRetenida({
      titular,
      motivos: ["linea_roja:datos_personales"],
      colaUrl: "https://dtdcargo.com/studio/marketing/noticias-web?estado=retenido",
      codigoBorrador: "30000000-0000-4000-8000-000000000001",
    });
    expect(t).not.toContain("0414");
    expect(t).not.toContain(titular);
    expect(t).toContain("Borrador 30000000");
    expect(t).toContain("linea_roja:datos_personales");
    expect(t).toContain("Cola de revisión: https://dtdcargo.com/studio/marketing/noticias-web?estado=retenido");
  });

  it("retenida por otra cosa sí lleva el titular", () => {
    const t = avisoRetenida({ titular: TITULAR, motivos: ["tope_dia"], colaUrl: "c", codigoBorrador: "30000000-0000-4000-8000-000000000001" });
    expect(t).toContain(TITULAR);
  });

  it("retenida lleva motivos y la cola", () => {
    const t = avisoRetenida({ titular: TITULAR, motivos: ["tope_dia", "linea_roja:precio"], colaUrl: "c", codigoBorrador: "x" });
    expect(t).toContain("tope_dia, linea_roja:precio");
    expect(t).toContain("Cola de revisión: c");
  });
});

describe("§4.11 · motivos de retiro", () => {
  it("sin motivo no se retira; «otro» pide nota", () => {
    expect(validarRetiro(undefined, "")).toBe("motivo_obligatorio");
    expect(validarRetiro("inventado", "")).toBe("motivo_obligatorio");
    expect(validarRetiro("otro", "  ")).toBe("nota_obligatoria");
    expect(validarRetiro("otro", "No aplica al lector")).toBe(null);
    expect(validarRetiro("tono", "")).toBe(null);
    expect(validarRetiro("tono", "x".repeat(1001))).toBe("nota_larga");
    expect(validarRetiro("dato_incorrecto", "El cliente pidió retirarla, su número es 0414-123-45-67")).toBe(
      "nota_con_datos_personales",
    );
  });
  it("una nota con un teléfono no se entrega a la oficina", () => {
    expect(notaParaOficina("Llamen al 0414-123-45-67")).toBe(null);
    expect(notaParaOficina("Suena a folleto")).toBe("Suena a folleto");
    expect(notaParaOficina(null)).toBe("");
  });
});
