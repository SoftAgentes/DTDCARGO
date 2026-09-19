import { describe, it, expect, vi } from "vitest";
import { readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SERVICIOS_DETALLE, SERVICIOS_GRUPOS } from "@/lib/servicios-detalle";
import { FAQS } from "@/lib/faqs";
import { GEO_ZONAS } from "@/lib/geo-zonas";

/**
 * ⏱️ I/O-BOUND: este contrato RECORRE EL ÁRBOL DE ARCHIVOS del repo.
 *
 * Aislado corre en ~1 s. Pero la suite tiene NUEVE contratos que hacen lo mismo
 * y vitest los reparte en paralelo sobre 427 archivos de test: compitiendo por
 * el mismo disco, la lectura se va a 26-53 s y expira contra el `testTimeout`
 * global de 20 s. Falla un conjunto DISTINTO cada corrida — la firma de la
 * contención, no de una regresión (una regresión falla el mismo test las dos
 * veces, y con una aserción, no con un reloj).
 *
 * El timeout se sube ACÁ y no en `vitest.config.ts` a propósito: subirlo global
 * relajaría los otros ~4.960 tests, donde 20 s ya es señal de que algo va mal.
 */
vi.setConfig({ testTimeout: 120_000 });


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

/**
 * SDD-0486, seguimiento: lectura en paralelo con tope, como en
 * `invoice-read-boundary`. Leer los ~1.500 archivos uno por uno sumaba la
 * latencia de cada apertura; en Windows, además, el escaneo del antivirus.
 */
async function leerTodos(rutas: string[], tope = 32): Promise<string[]> {
  const textos = new Array<string>(rutas.length);
  let siguiente = 0;
  await Promise.all(
    Array.from({ length: tope }, async () => {
      while (siguiente < rutas.length) {
        const i = siguiente++;
        textos[i] = await readFile(rutas[i], "utf8");
      }
    }),
  );
  return textos;
}

/**
 * Prefiltro: la aserción final es `/casco\s+central/i` sobre el fuente SIN
 * comentarios, que es un recorte del fuente. Si la palabra «casco» no está en
 * el fuente entero, tampoco puede estar en un recorte suyo, así que ese archivo
 * no puede ser ofensor y no hace falta quitarle los comentarios. Deja pasar de
 * más (un «casco» suelto), nunca de menos.
 */
function puedeDecirlo(fuente: string): boolean {
  return /casco/i.test(fuente);
}

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

  /**
   * Segunda red, y la que de verdad hacía falta.
   *
   * La primera versión de este archivo sólo miraba las estructuras de datos, y
   * por ahí no pasaban dos textos que el cliente SÍ veía: el label
   * "Casco central DTD:" de `UltimoKmCalculator` y el valor
   * `tramoAplicado: "Casco central CBM"` de `fleteTerrestre`. Los dos vivían
   * como literales dentro del código, no como datos.
   *
   * Esto barre los literales de todo el código público. Se quitan comentarios
   * primero: explicar por qué el término murió es legítimo y no puede poner el
   * test en rojo.
   */
  it("ningún literal del código público lo dice", async () => {
    const RAIZ = join(__dirname, "..");
    const CARPETAS = ["components", "lib", "app"];
    // `venezuela-catalog.ts` queda fuera y NO es una excepción de conveniencia:
    // ahí "Casco Central" es el nombre real de un barrio de San Juan de los
    // Morros (Guárico), junto a Pariata y La Toscana. Es toponimia, no nuestro
    // término de precio. Un test que obligue a corromper datos geográficos
    // reales para ponerse verde es un test que hay que arreglar, no obedecer.
    const IGNORAR =
      /node_modules|__tests__|\.test\.|\.spec\.|[\\/]studio[\\/]|[\\/]back[\\/]|venezuela-catalog\.ts/;

    // SDD-0486, seguimiento: `withFileTypes` en vez de un `statSync` por
    // entrada. Preguntarle al sistema de archivos una vez por carpeta, en vez
    // de una por archivo, es lo que más pesa en Windows con el antivirus.
    function archivos(dir: string): string[] {
      let out: string[] = [];
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (IGNORAR.test(p)) continue;
        if (e.isDirectory()) out = out.concat(archivos(p));
        else if (/\.tsx?$/.test(p)) out.push(p);
      }
      return out;
    }

    const rutas = CARPETAS.flatMap((carpeta) => archivos(join(RAIZ, carpeta)));
    const fuentes = await leerTodos(rutas);
    const ofensores: string[] = [];
    rutas.forEach((f, i) => {
      // El prefiltro de abajo evita quitarle los comentarios a los ~1.500
      // archivos que ni mencionan la palabra. Deja pasar de más, nunca de
      // menos: lo prueba «el prefiltro no se come ningún caso».
      if (!puedeDecirlo(fuentes[i])) return;
      const sinComentarios = fuentes[i]
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "")
        .replace(/\/\/.*$/gm, "");
      if (/casco\s+central/i.test(sinComentarios)) {
        ofensores.push(f.slice(RAIZ.length + 1).replace(/\\/g, "/"));
      }
    });

    expect(
      ofensores,
      `Literales con el término muerto (fuera de comentarios):\n${ofensores.join("\n")}`,
    ).toEqual([]);
  });

  /**
   * SDD-0486, seguimiento. El prefiltro sólo puede equivocarse hacia un lado:
   * si deja fuera un archivo que hoy cuenta como ofensor, el contrato se vuelve
   * verde mintiendo. Estos casos son los que podrían escapársele.
   */
  it("el prefiltro no se come ningún caso", () => {
    for (const fuente of [
      "const x = 'Casco Central';",
      "const x = 'casco  central';", // dos espacios: el regex final usa \\s+
      "const x = 'CASCO\\n   CENTRAL';",
      "// comentario\nconst x = 'casco central';",
      "const x = 'casco'; const y = 'central';", // de más: pasa el prefiltro y no es ofensor
    ]) {
      expect(puedeDecirlo(fuente)).toBe(true);
    }
    // Sin la palabra entera no hay forma de que el regex final matchee.
    expect(puedeDecirlo("const x = 'centro histórico';")).toBe(false);
    // Partida en dos literales tampoco la ve el regex final, con prefiltro o
    // sin él: los dos dicen que no es ofensor, que es lo que importa acá.
    expect(puedeDecirlo("const x = 'cas' + 'co central';")).toBe(false);
    expect(/casco\s+central/i.test("const x = 'cas' + 'co central';")).toBe(false);
  });

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
