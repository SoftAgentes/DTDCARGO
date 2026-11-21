/**
 * SDD-0700 (hijo de SDD-0626, punto (a) de privacidad) · Tapar los datos personales ANTES de la llamada al modelo.
 *
 * El despachador de la Oficina_Virtual manda la conversación al agente, y el agente la pasa a un proveedor de
 * fuera (Z.AI y, de respaldo, DeepSeek). Desde este cambio, en cada mensaje se cambian los correos, teléfonos,
 * cédulas, RIF y direcciones por un marcador estable: «[correo]», «[teléfono]», «[cédula]», «[RIF]» y
 * «[dirección]». El agente no los necesita para redactar: los guiones no usan datos del cliente.
 *
 * Las expresiones son las MISMAS que detectan los datos en la salida (`detectorDelCable`, que usa
 * `revisarRespuesta` en eval-automatico.ts): la lista `PATRONES_DATOS_PERSONALES` de la regla de noticias y el
 * teléfono internacional agrupado del cable. Aquí no hay ninguna expresión de datos nueva.
 *
 * Cómo se tapa:
 *   - Se busca sobre el texto normalizado (minúsculas, sin tildes), como el detector, y cada hallazgo se lleva de
 *     vuelta a su lugar en el texto original con un mapa de posiciones. Así «Urbanización» y «URB.» se tapan igual.
 *   - Si dos hallazgos se pisan (un RIF «V-12345678-9» también parece una cédula), se juntan en uno con el tipo del
 *     que empieza antes o es más largo.
 *   - Un hallazgo se estira sobre los dígitos que le siguen pegados, para que no quede la cola de un número.
 *   - Una dirección se estira hasta el final de la frase (salto de línea, «?», «!», «;» o un punto que no sea de una
 *     abreviatura como «Av.»), con un tope de 120 caracteres, y hacia atrás hasta la primera palabra de calle de la
 *     misma frase (60 caracteres como mucho): el detector solo ve la palabra y el primer número, y el resto de la
 *     dirección también es dato personal. Se tapa de más a propósito.
 *
 * Después de tapar, `quedanDatos` vuelve a pasar el detector: si todavía ve algo, el despachador escala sin llamar
 * al modelo (conservador: ante la duda, el texto no sale).
 */
import { PATRONES_DATOS_PERSONALES, type TipoDatoPersonal, normalizarTexto } from "@/lib/news/autopublicar/control";

import { TELEFONO_INTERNACIONAL, detectorDelCable } from "./cable-textos";
import type { MensajeLeido } from "./chatwoot-lectura";

export const MARCADORES: Readonly<Record<TipoDatoPersonal, string>> = {
  correo: "[correo]",
  telefono: "[teléfono]",
  cedula: "[cédula]",
  rif: "[RIF]",
  direccion: "[dirección]",
};

/** Las expresiones del detector, en modo global para encontrar todos los hallazgos. */
const PATRONES: ReadonlyArray<{ tipo: TipoDatoPersonal; re: RegExp }> = [
  ...PATRONES_DATOS_PERSONALES,
  { tipo: "telefono" as const, re: TELEFONO_INTERNACIONAL },
].map(({ tipo, re }) => ({ tipo, re: new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`) }));

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
}

function estirarDigitos(texto: string, hasta: number): number {
  while (hasta < texto.length && /\d/.test(texto[hasta])) hasta += 1;
  return hasta;
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
 * Las palabras de calle de la MISMA expresión de dirección (`calle|avenida|av\.|…`), sacadas de su código. Sirven
 * para tapar también lo que va antes del hallazgo en la misma frase: en «Av. Bolívar, Edif. Torre Sur, piso 3» la
 * expresión solo ve «Edif. … 3» (pide el número a menos de 30 caracteres de la palabra) y «Av. Bolívar» quedaría a
 * la vista. Si la expresión cambia de forma y no se puede leer, no se estira hacia atrás (la prueba lo detecta).
 */
export const PALABRAS_DE_CALLE: RegExp | null = (() => {
  const dir = PATRONES_DATOS_PERSONALES.find((p) => p.tipo === "direccion")?.re.source ?? "";
  const m = /^\\b\(\?:([^)]+)\)/.exec(dir);
  return m ? new RegExp(`\\b(?:${m[1]})`, "g") : null;
})();

/** Desde dónde empieza la dirección: la primera palabra de calle de la misma frase, hasta 60 caracteres antes. */
function inicioDeDireccion(normal: string, desde: number): number {
  if (!PALABRAS_DE_CALLE) return desde;
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
      crudos.push({ desde, hasta, tipo });
    }
  }
  crudos.sort((a, b) => a.desde - b.desde || b.hasta - b.desde - (a.hasta - a.desde));
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

/** ¿El detector todavía ve un dato personal en algún mensaje ya tapado? Si es así, no se llama al modelo. */
export function quedanDatos(mensajes: readonly MensajeLeido[]): boolean {
  return mensajes.some((m) => detectorDelCable(m.texto));
}
