/**
 * SDD-0700 (hijo de SDD-0626, punto (a) de privacidad) · Tapar los datos personales ANTES de la llamada al modelo.
 *
 * El despachador de la Oficina_Virtual manda la conversación al agente, y el agente la pasa a un proveedor de
 * fuera (Z.AI y, de respaldo, DeepSeek). Desde este cambio, en cada mensaje se cambian los correos, teléfonos,
 * cédulas, RIF y direcciones por un marcador estable: «[correo]», «[teléfono]», «[cédula]», «[RIF]» y
 * «[dirección]». El agente no los necesita para redactar: los guiones no usan datos del cliente.
 *
 * Las expresiones son las MISMAS que detectan los datos en la salida: la lista de la Oficina_Virtual
 * (`datos-personales.ts`), que usa `detectorDelCable` y, con él, `revisarRespuesta` en eval-automatico.ts.
 *
 * Cómo se tapa:
 *   - Se busca sobre el texto normalizado (minúsculas, sin tildes), como el detector, y cada hallazgo se lleva de
 *     vuelta a su lugar en el texto original con un mapa de posiciones. Así «Urbanización» y «URB.» se tapan igual.
 *   - Si dos hallazgos se pisan (un RIF «V-12345678-9» también parece una cédula), se juntan en uno con el tipo del
 *     que empieza antes o es más largo.
 *   - Un hallazgo se estira sobre los dígitos que le siguen pegados (también tras un «.» o un «-»), para que no quede
 *     la cola de un número.
 *   - Una dirección se estira hasta el final de la frase (salto de línea, «?», «!», «;» o un punto que no sea de una
 *     abreviatura como «Av.»), con un tope de 120 caracteres, y hacia atrás hasta la primera palabra de calle de la
 *     misma frase (60 caracteres como mucho): el detector solo ve la palabra y el primer número, y el resto de la
 *     dirección también es dato personal. Se tapa de más a propósito.
 *
 * Después de tapar, `quedanDatos` vuelve a pasar el detector y mira que ningún marcador tenga dígitos pegados (un
 * número tapado a medias). Si ve algo, el despachador escala sin llamar al modelo: ante la duda, el texto no sale.
 */
import { normalizarTexto } from "@/lib/news/autopublicar/control";

import { detectorDelCable } from "./cable-textos";
import type { MensajeLeido } from "./chatwoot-lectura";
import { MARCADORES, PALABRAS_DE_CALLE, PATRONES_DATOS_PERSONALES, type TipoDatoPersonal } from "./datos-personales";

export { MARCADORES } from "./datos-personales";

/** Las expresiones del detector, en modo global para encontrar todos los hallazgos. */
const PATRONES = PATRONES_DATOS_PERSONALES.map(({ tipo, re }) => ({
  tipo,
  re: new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`),
}));

const TOPE_DIRECCION = 120;
const TOPE_ATRAS = 60;
/** Palabras cortas que terminan en punto dentro de una dirección («Av.», «Edif.», «Urb.», «Nro.»): no cierran la frase. */
const LARGO_ABREVIATURA = 4;

interface Mapa {
  normal: string;
  /** Para cada posición del texto normalizado: dónde empieza y dónde termina su carácter en el original. */
  inicio: number[];
  fin: number[];
}

/** El texto normalizado como lo ve el detector, carácter por carácter, con su posición en el original. */
function normalizarConMapa(texto: string): Mapa {
  let normal = "";
  const inicio: number[] = [];
  const fin: number[] = [];
  let i = 0;
  for (const ch of texto) {
    const n = normalizarTexto(ch);
    normal += n;
    for (let k = 0; k < n.length; k += 1) {
      inicio.push(i);
      fin.push(i + ch.length);
    }
    i += ch.length;
  }
  return { normal, inicio, fin };
}

interface Tramo {
  desde: number;
  hasta: number;
  tipo: TipoDatoPersonal;
  /** El largo de lo que vio la expresión, antes de estirar: desempata «V-12345678-9» (RIF) contra la cédula. */
  visto: number;
}

const esDigito = (c: string | undefined) => c !== undefined && c >= "0" && c <= "9";

/** Sobre los dígitos que siguen pegados, también tras un «.» o un «-» («12.345.678», «555-0101»). */
function estirarDigitos(texto: string, hasta: number): number {
  for (;;) {
    if (esDigito(texto[hasta])) hasta += 1;
    else if ((texto[hasta] === "." || texto[hasta] === "-") && esDigito(texto[hasta + 1])) hasta += 2;
    else return hasta;
  }
}

/**
 * ¿Termina una frase en la posición `i`? Salto de línea, «?», «!», «;», o un punto seguido de espacio (o del final)
 * cuya palabra no sea una abreviatura corta como «Av.» o «Edif.» (un número antes del punto sí cierra: «Calle 5.»).
 */
function finDeFrase(texto: string, i: number): boolean {
  const c = texto[i];
  if (c === "\n" || c === "?" || c === "!" || c === ";") return true;
  if (c !== "." || (i + 1 < texto.length && !/\s/.test(texto[i + 1]))) return false;
  const palabra = /[\p{L}\p{N}]*$/u.exec(texto.slice(Math.max(0, i - 40), i))?.[0] ?? "";
  return palabra.length > LARGO_ABREVIATURA || /^\d+$/.test(palabra);
}

/** Una dirección sigue hasta el final de su frase, con tope. Sin espacios ni comas colgando antes del marcador. */
function estirarDireccion(texto: string, hasta: number, desde: number): number {
  const tope = Math.min(texto.length, desde + TOPE_DIRECCION);
  while (hasta < tope && !finDeFrase(texto, hasta)) hasta += 1;
  while (hasta > desde && /[\s,]/.test(texto[hasta - 1])) hasta -= 1;
  return hasta;
}

/**
 * Desde dónde empieza la dirección: la primera palabra de calle de la misma frase, hasta 60 caracteres antes. En
 * «Av. Bolívar, Edif. Torre Sur, piso 3» la expresión solo ve «Edif. … 3» (pide el número a menos de 30 caracteres
 * de la palabra), y «Av. Bolívar» quedaría a la vista.
 */
function inicioDeDireccion(normal: string, desde: number): number {
  let limite = desde;
  while (limite > 0 && desde - limite < TOPE_ATRAS && !finDeFrase(normal, limite - 1)) limite -= 1;
  const m = new RegExp(PALABRAS_DE_CALLE.source, "g").exec(normal.slice(limite, desde));
  return m ? limite + m.index : desde;
}

/** Los tramos del texto ORIGINAL que hay que tapar, sin solaparse, en orden. */
function tramos(texto: string): Tramo[] {
  const { normal, inicio, fin } = normalizarConMapa(texto);
  const crudos: Tramo[] = [];
  for (const { tipo, re } of PATRONES) {
    for (const m of normal.matchAll(re)) {
      if (m[0].length === 0 || m.index === undefined) continue;
      const desde = inicio[tipo === "direccion" ? inicioDeDireccion(normal, m.index) : m.index];
      let hasta = estirarDigitos(texto, fin[m.index + m[0].length - 1]);
      if (tipo === "direccion") hasta = estirarDireccion(texto, hasta, desde);
      crudos.push({ desde, hasta, tipo, visto: m[0].length });
    }
  }
  // Por inicio; a igual inicio, el más largo; a igual largo, el que la expresión vio más largo; y si no, el que va
  // antes en la lista (la cédula antes que el RIF: «V-12345678» es cédula).
  crudos.sort((a, b) => a.desde - b.desde || b.hasta - a.hasta || b.visto - a.visto);
  const juntos: Tramo[] = [];
  for (const t of crudos) {
    const ultimo = juntos[juntos.length - 1];
    if (ultimo && t.desde < ultimo.hasta) {
      ultimo.hasta = Math.max(ultimo.hasta, t.hasta);
    } else {
      juntos.push({ ...t });
    }
  }
  return juntos;
}

/** El texto con cada dato personal cambiado por su marcador. Un texto sin datos sale igual. */
export function taparDatosPersonales(texto: string): string {
  let salida = "";
  let cursor = 0;
  for (const t of tramos(texto)) {
    salida += texto.slice(cursor, t.desde) + MARCADORES[t.tipo];
    cursor = t.hasta;
  }
  return salida + texto.slice(cursor);
}

/** Los mensajes con el texto tapado. El rol no cambia; nada más se toca. */
export function taparMensajes(mensajes: readonly MensajeLeido[]): MensajeLeido[] {
  return mensajes.map((m) => ({ ...m, texto: taparDatosPersonales(m.texto) }));
}

/** Un marcador con dígitos pegados detrás: un número que se tapó a medias («[cédula].345.678»). */
const COLA_DE_NUMERO = new RegExp(
  `(?:${Object.values(MARCADORES)
    .map((m) => m.replace(/[[\]]/g, "\\$&"))
    .join("|")})[.\\-/]?\\d`,
);

/**
 * ¿Queda algo después de tapar? El detector todavía ve un dato, o un marcador tiene la cola de un número pegada. Si es
 * así, no se llama al modelo.
 */
export function quedanDatos(mensajes: readonly MensajeLeido[]): boolean {
  return mensajes.some((m) => detectorDelCable(m.texto) || COLA_DE_NUMERO.test(m.texto));
}
