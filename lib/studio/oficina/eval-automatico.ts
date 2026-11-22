/**
 * SDD-0626 Anexo A §A.7 · Lo automatizable de eval.md, antes de guardar un borrador.
 *
 * - `sin_acuse`: el texto no empieza con el acuse (la primera frase que confirma lo que se entendió). Se comparan
 *   las palabras, sin signos ni tildes (`empiezaConAcuse`). Es el único código que el despachador deja reintentar,
 *   una vez: los demás escalan al momento.
 * - `guion_desconocido`: el guion no es uno de los aprobados (guiones-soporte.ts).
 * - `dato_inventado`: aparece una cifra, un monto, una fecha o un plazo, un estado de envío o una promesa que
 *   no está en el texto del guion usado. En el Paso 3a el agente no ve el sistema de envíos, así que la única
 *   fuente permitida es el guion. Conservador a propósito: ante la duda, se escala.
 * - `datos_personales`: el texto trae un correo, teléfono, cédula, RIF o dirección (la regla del cable).
 * - `enlace` (Paso 3b): el texto trae una URL o un dominio que no está en el guion usado (`enlacesAjenos`).
 * - `marcador` (SDD-0700): el texto trae un marcador de dato tapado («[teléfono]», «[correo]»…). La entrada del agente
 *   llega tapada; un borrador con un marcador le diría al cliente «[teléfono]» en vez de responderle.
 *
 * Cualquier código → el despachador escala en vez de guardar la respuesta. Lo que eval.md pide y no se puede
 * automatizar (cierre en ≤ 3 intercambios, tono) lo revisa Sam en la aprobación.
 */
import { detectorDelCable } from "./cable-textos";
import { tieneMarcador } from "./datos-personales";
import type { Guion } from "./guiones-soporte";
import type { SalidaAgente } from "./salida-agente";

export type CodigoEval = "sin_acuse" | "guion_desconocido" | "dato_inventado" | "datos_personales" | "enlace" | "marcador";

function normal(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const MESES = "enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre";
const DIAS = "lunes|martes|miercoles|jueves|viernes|sabado|domingo";

/** Lo que solo puede venir del sistema o de un guion. Se busca sobre el texto normalizado (sin tildes). */
const PATRONES: readonly RegExp[] = [
  /\d+(?:[.,:/-]\d+)*/g, // cifras, montos, fechas, horas, guías
  /(?:us)?\$|\bbs\.?(?=\s|$)|\bbolivares?\b|\bdolares?\b|\busd\b|\beuros?\b|\byuan(?:es)?\b/g, // dinero
  new RegExp(`\\b(?:${MESES}|${DIAS}|manana|pasado manana|esta semana|la proxima semana|el proximo mes|hoy mismo)\\b`, "g"),
  /\b(?:uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|quince|veinte|treinta)\s+(?:dias?|horas?|semanas?|meses?)\b/g,
  /\b(?:entregad[oa]s?|en transito|en camino|despachad[oa]s?|en aduanas?|retenid[oa]s?|liberad[oa]s?|recibid[oa]s? en (?:el )?almacen|en almacen|embarcad[oa]s?|zarp[oó]|lleg[oó]|ya salio|salio de|esta listo para retirar|listo para retirar|extraviad[oa]s?|perdid[oa]s?)\b/g,
  /\b(?:te garantizo|garantizado|te prometo|seguro que llega|llegara|llega el|estara listo|sin costo|gratis|reembolso|descuento|te devolvemos)\b/g,
];

/** Solo letras y números, en minúsculas y sin tildes: «¡Hola! Gracias…» y «Hola, gracias…» son la misma frase. */
function soloPalabras(s: string): string {
  return normal(s)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * ¿El texto EMPIEZA con el acuse? Se comparan las palabras, no los signos: una coma o un «¡» de diferencia entre los
 * dos campos no es «sin acuse» (etapa 1, 18/11/2026: un saludo simple escaló por eso). Sigue fallando si el acuse va
 * vacío, si solo trae signos, si el texto empieza con otra cosa o si el acuse aparece más adelante y no al inicio.
 */
export function empiezaConAcuse(texto: string, acuse: string): boolean {
  const a = soloPalabras(acuse);
  const t = soloPalabras(texto);
  return a.length > 0 && (t === a || t.startsWith(`${a} `));
}

export function revisarRespuesta(
  r: Extract<SalidaAgente, { tipo: "respuesta" }>,
  guiones: readonly Guion[],
): CodigoEval[] {
  const codigos: CodigoEval[] = [];
  const texto = normal(r.texto);
  if (!empiezaConAcuse(r.texto, r.acuse)) codigos.push("sin_acuse");

  const guion = guiones.find((g) => g.id === r.guion);
  if (!guion) codigos.push("guion_desconocido");

  const permitido = guion ? normal(guion.texto) : "";
  const inventado = PATRONES.some((patron) =>
    [...texto.matchAll(new RegExp(patron.source, patron.flags))].some((m) => !permitido.includes(m[0].trim())),
  );
  if (inventado) codigos.push("dato_inventado");

  if (detectorDelCable(r.texto)) codigos.push("datos_personales");
  if (enlacesAjenos(r.texto, guion?.texto ?? "").length > 0) codigos.push("enlace");
  if (tieneMarcador(r.texto)) codigos.push("marcador");
  return codigos;
}

/**
 * Paso 3b (pendiente del 3a): URLs y dominios del borrador que NO vienen del guion usado. Un enlace que el agente
 * inventa puede llevar al cliente a cualquier lado (phishing, un sitio que no es de DTD), así que escala.
 * Mira `http(s)://…`, `www.…` y todo `nombre.tld` (también `dtdcargo.com`): ningún guion de la etapa 1 trae uno.
 */
const ENLACE = /\b(?:https?:\/\/|www\.)[^\s<>"')]+|\b[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,24}\b(?:\/[^\s<>"')]*)?/gi;

export function enlacesAjenos(texto: string, permitido: string): string[] {
  const delGuion = new Set([...permitido.toLowerCase().matchAll(ENLACE)].map((m) => m[0]));
  return [...texto.toLowerCase().matchAll(ENLACE)].map((m) => m[0]).filter((e) => !delGuion.has(e));
}
