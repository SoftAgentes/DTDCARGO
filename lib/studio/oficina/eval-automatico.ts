/**
 * SDD-0626 Anexo A §A.7 · Lo automatizable de eval.md, antes de guardar un borrador.
 *
 * - `sin_acuse`: el texto no empieza con el acuse (la primera frase que confirma lo que se entendió).
 * - `guion_desconocido`: el guion no es uno de los aprobados (guiones-soporte.ts).
 * - `dato_inventado`: aparece una cifra, un monto, una fecha o un plazo, un estado de envío o una promesa que
 *   no está en el texto del guion usado. En el Paso 3a el agente no ve el sistema de envíos, así que la única
 *   fuente permitida es el guion. Conservador a propósito: ante la duda, se escala.
 * - `datos_personales`: el texto trae un correo, teléfono, cédula, RIF o dirección (la regla del cable).
 *
 * Cualquier código → el despachador escala en vez de guardar la respuesta. Lo que eval.md pide y no se puede
 * automatizar (cierre en ≤ 3 intercambios, tono) lo revisa Sam en la aprobación.
 */
import { detectorDelCable } from "./cable-textos";
import type { Guion } from "./guiones-soporte";
import type { SalidaAgente } from "./salida-agente";

export type CodigoEval = "sin_acuse" | "guion_desconocido" | "dato_inventado" | "datos_personales";

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

export function revisarRespuesta(
  r: Extract<SalidaAgente, { tipo: "respuesta" }>,
  guiones: readonly Guion[],
): CodigoEval[] {
  const codigos: CodigoEval[] = [];
  const texto = normal(r.texto);
  const acuse = normal(r.acuse);
  if (!acuse || !texto.startsWith(acuse)) codigos.push("sin_acuse");

  const guion = guiones.find((g) => g.id === r.guion);
  if (!guion) codigos.push("guion_desconocido");

  const permitido = guion ? normal(guion.texto) : "";
  const inventado = PATRONES.some((patron) =>
    [...texto.matchAll(new RegExp(patron.source, patron.flags))].some((m) => !permitido.includes(m[0].trim())),
  );
  if (inventado) codigos.push("dato_inventado");

  if (detectorDelCable(r.texto)) codigos.push("datos_personales");
  return codigos;
}
