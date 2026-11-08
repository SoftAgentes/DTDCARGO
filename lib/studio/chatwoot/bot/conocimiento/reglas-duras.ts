/**
 * `dtd-bot` · reglas duras (SDD-0618 §3.5, fila 7.4 de SDD-0582). Puro.
 *
 * NO son instrucciones al modelo: son comprobaciones deterministas sobre el texto que el
 * motor propone. Si una falla, la respuesta no sale y el turno pasa a una persona (falla
 * cerrada). Un falso positivo cuesta una respuesta manual; un falso negativo puede costar
 * un compromiso con un cliente, por eso los patrones prefieren pasarse de estrictos.
 *
 * Cada regla cita de dónde sale (base v7 y runbooks de Kommo, en el repo). El resultado
 * lleva solo los nombres de las reglas, nunca el texto: va a la base y a los avisos.
 *
 * `disparadoresDeEntrada` mira el mensaje del CLIENTE (ya recortado) y decide pasar a
 * humano sin llamar al motor: pedir una persona, cambiar el destinatario de un envío.
 */

export type ReglaSalida =
  | "vacia"
  | "direccion_completa"
  | "termino_retirado"
  | "anos_fijos"
  | "monto"
  | "estado_de_carga"
  | "pide_dato_sensible"
  | "documento_de_identidad"
  | "enlace_no_permitido"
  | "telefono_no_permitido";

export type DisparadorEntrada = "pide_persona" | "cambio_de_destinatario";

/** Dominios que el bot puede nombrar (los de DTD y sus redes, `lib/design-tokens.ts` y FAQ #12 y #20). */
export const DOMINIOS_PERMITIDOS: readonly string[] = [
  "dtdcargo.com",
  "wa.me",
  "api.whatsapp.com",
  "instagram.com",
  "tiktok.com",
  "youtube.com",
  "maps.app.goo.gl",
];

const PATRONES: readonly [ReglaSalida, RegExp][] = [
  // FAQ #28 y kommo-reconfig.md:73-76: la dirección completa (con el detalle de cargo, el
  // teléfono y el contacto de bodega) no la da el bot; FAQ #4: la de referencia sí.
  ["direccion_completa", /货\s*7|cargo\s*7\s*[-–]\s*(货\s*)?11|林冠|lin\s+guan|义乌港|邮编|322000/iu],
  // FAQ «Cambio 2026-08-03»: DDP como nombre, «Financiamiento 100 %», «prepago», «desde 2008».
  [
    "termino_retirado",
    /\bDDP\b|financiamiento\s+(del\s+)?100\s*%|\bpre-?pago\b|opera(mos)?\s+desde\s+(el\s+)?(año\s+)?2008|fundad[ao]s?\s+en\s+(el\s+)?(año\s+)?(2008|2010)/iu,
  ],
  // kommo-reconfig.md:378: nunca un total fijo de años de experiencia.
  ["anos_fijos", /\b(más\s+de\s+)?\d{1,3}\s+años\s+(de\s+(experiencia|trayectoria)|en\s+el\s+(mercado|negocio|comercio))/iu],
  // FAQ #2 y #29-#33: el bot no cotiza ni da precios; los números salen de la calculadora.
  [
    "monto",
    /(US\s?\$|\$|€|¥|\bUSD\b|\bUSDT\b|\bBs\.?S?\b|\bVES\b|\bRMB\b|\bCNY\b|\bEUR\b)\s?\d|\d[\d.,]*\s?(US\s?\$|\$|€|¥|\bUSD\b|\bUSDT\b|\bBs\.?S?\b|\bVES\b|\bRMB\b|\bCNY\b|\bEUR\b|dólares|bolívares|yuanes|euros)/iu,
  ],
  // SDD-0579: el seguimiento está en construcción; el bot no afirma estados ni fechas de llegada.
  [
    "estado_de_carga",
    /\btu\s+(carga|envío|mercancía|paquete|contenedor|caja)\s+(ya\s+)?(está|esta|salió|llegó|zarpó|se\s+encuentra|fue\s+(despachad|entregad|recibid))|\b(llega|llegará|estará|la\s+recibes)\s+(el|para\s+el|antes\s+del)\s+\d/iu,
  ],
  // Datos que no se piden por chat (revisar-datos-ve; el registro va por la web).
  [
    "pide_dato_sensible",
    /(envíame|enviame|mándame|mandame|pásame|pasame|dime|indícame|indicame|compárteme|compartime|escríbeme|escribeme|necesito|requiero)\s+(tu|la|el|una|un|los|las)\s+((foto|copia|número|numero)\s+de\s+(tu|la|el)\s+)?(contraseña|clave|pin|tarjeta|cvv|código\s+de\s+(verificación|seguridad)|cédula|cedula|rif|pasaporte|datos\s+bancarios|cuenta\s+bancaria)/iu,
  ],
  // Un número de cédula o RIF repetido en la respuesta.
  ["documento_de_identidad", /\b[VEJPG][-\s.]?\d{1,2}\.?\d{3}\.?\d{3}(-?\d)?\b/u],
];

// Sin «@» ni «/» delante: un usuario de red (@dtdcargo.ve) o un trozo de ruta
// (instagram.com/dtdcargo.ve/) no es un dominio; el correo se mira aparte.
const DOMINIO_RE = /(?<![@/\w.-])(?:https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z]{2,})(?=[/\s.,;:!?)»"']|$)/giu;
const CORREO_RE = /[a-z0-9._%+-]+@((?:[a-z0-9-]+\.)+[a-z]{2,})/giu;
const FECHA_ISO_RE = /^\d{4}-\d{2}-\d{2}$/u;
const TELEFONO_RE = /\+?\d[\d\s().-]{7,}\d/gu;

function dominioPermitido(dominio: string): boolean {
  const d = dominio.toLowerCase().replace(/^www\./, "");
  return DOMINIOS_PERMITIDOS.some((p) => d === p || d.endsWith(`.${p}`));
}

/**
 * Comprueba la salida del motor. `telefonosPermitidos`: los números de DTD, en dígitos
 * (por ejemplo `CONTACT.ve.whatsappRaw`); cualquier otro número largo bloquea.
 */
export function comprobarSalida(
  texto: string,
  telefonosPermitidos: readonly string[] = [],
): { ok: true } | { ok: false; reglas: ReglaSalida[] } {
  const reglas: ReglaSalida[] = [];
  if (texto.trim() === "") reglas.push("vacia");
  for (const [regla, patron] of PATRONES) if (patron.test(texto)) reglas.push(regla);

  // Las negritas de Markdown parten los dominios (www.dtdcargo**.com**).
  const plano = texto.replace(/\*+/g, "");
  const dominios = [...plano.matchAll(DOMINIO_RE), ...plano.matchAll(CORREO_RE)].map((m) => m[1]);
  for (const d of dominios) {
    if (!dominioPermitido(d)) {
      reglas.push("enlace_no_permitido");
      break;
    }
  }

  const permitidos = new Set(telefonosPermitidos.map((t) => t.replace(/\D/g, "")).filter((t) => t.length >= 7));
  for (const m of plano.matchAll(TELEFONO_RE)) {
    if (FECHA_ISO_RE.test(m[0].trim())) continue;
    const digitos = m[0].replace(/\D/g, "");
    if (digitos.length < 8) continue;
    if (![...permitidos].some((p) => p.endsWith(digitos) || digitos.endsWith(p))) {
      reglas.push("telefono_no_permitido");
      break;
    }
  }
  return reglas.length === 0 ? { ok: true } : { ok: false, reglas };
}

const DISPARADORES: readonly [DisparadorEntrada, RegExp][] = [
  [
    "pide_persona",
    /\b(hablar|comunicarme|conversar|atender(me)?)\s+(con\s+)?(una\s+persona|un\s+humano|alguien\s+real|un\s+asesor|una\s+asesora|un\s+agente|el\s+encargado|la\s+encargada)\b|\b(eres|es)\s+(un\s+)?(bot|robot)\b|\b(quiero|necesito)\s+(un|una)\s+(asesor|asesora|persona|humano)\b/iu,
  ],
  // agentes-ia-configuracion.md:85-99: el Reenganche aceptaba cambiar el destinatario por chat.
  [
    "cambio_de_destinatario",
    /\bcambi(ar|o|e|en)\s+(el|la|los|las|de)?\s*(destinatario|dirección\s+de\s+entrega|direccion\s+de\s+entrega|persona\s+que\s+recibe|quien\s+recibe|nombre\s+del\s+que\s+recibe|consignatario)/iu,
  ],
];

/** Pases a humano por lo que escribió el cliente, sin llamar al motor. */
export function disparadoresDeEntrada(texto: string): DisparadorEntrada[] {
  return DISPARADORES.filter(([, p]) => p.test(texto)).map(([d]) => d);
}
