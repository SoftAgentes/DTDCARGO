/**
 * SDD-0608 · Lo que `/cliente` le contesta a Discord.
 *
 * Toda respuesta es EFÍMERA (sólo la ve quien preguntó) y sin menciones: un
 * nombre de cliente con «@everyone» no avisa a nadie.
 *
 * Por cliente sale exactamente: nombre, código (Shipping Mark) y enlace a su
 * ficha en el Studio. Nunca facturas, montos, teléfonos, correos, direcciones
 * ni estado de envíos: eso se ve entrando al Studio con usuario y permisos.
 *
 * Los nombres vienen en parte del registro público del portal: se escapan los
 * caracteres de formato de Discord para que un nombre como
 * «[Haz clic](https://…)» no se convierta en un enlace disfrazado.
 */

import { FLAG_EFIMERO, MAX_RESULTADOS, RESPUESTA_MENSAJE } from "./comando";

/** Límite de Discord para el texto de un mensaje. */
export const LARGO_MAXIMO = 2000;
const NOMBRE_MAXIMO = 50;

export interface RespuestaInteraccion {
  type: typeof RESPUESTA_MENSAJE;
  data: {
    content: string;
    flags: typeof FLAG_EFIMERO;
    allowed_mentions: { parse: [] };
  };
}

/** Una coincidencia: sólo lo que se puede mostrar. */
export interface ClienteEncontrado {
  markbox: string;
  name: string;
}

export function respuestaEfimera(contenido: string): RespuestaInteraccion {
  return {
    type: RESPUESTA_MENSAJE,
    data: {
      content: contenido.slice(0, LARGO_MAXIMO),
      flags: FLAG_EFIMERO,
      allowed_mentions: { parse: [] },
    },
  };
}

export const MENSAJES = {
  sin_enlace:
    "No autorizado. Tu usuario de Discord no está enlazado a un usuario del Studio. " +
    "Pega tu ID de Discord en tu perfil del Studio (Preferencias) y vuelve a intentar.",
  enlace_ambiguo:
    "No autorizado. Tu ID de Discord aparece en más de un perfil del Studio. " +
    "Pídele a un administrador que lo corrija.",
  sin_permiso:
    "No autorizado. Tu usuario del Studio no tiene permiso para ver clientes.",
  limite: "Hiciste muchas consultas seguidas. Espera un minuto y vuelve a intentar.",
  no_disponible: "La consulta de clientes no está disponible en este momento. Avísale a un administrador.",
  fuera_del_servidor: "Este comando solo funciona en el servidor de DTD Cargo.",
  termino_invalido: "Escribe entre 2 y 60 caracteres: el nombre del cliente o su código.",
  otro_comando: "No conozco ese comando.",
} as const;

/**
 * Quita saltos y el formato de Discord; corta nombres largos. Como cada línea
 * empieza con «• », los marcadores de inicio de línea (`#`, `>`, `-`) no
 * aplican y no se escapan. `//` se parte para que una dirección no se vuelva
 * enlace.
 */
export function textoSeguro(texto: string, maximo = NOMBRE_MAXIMO): string {
  const plano = texto.replace(/\s+/g, " ").trim();
  const corto = plano.length > maximo ? `${plano.slice(0, maximo - 1)}…` : plano;
  return corto
    .replace(/[\\*_~`|[\]()<:@]/g, (c) => `\\${c}`)
    .replace(/\/\//g, "/​/");
}

export function enlaceFicha(baseUrl: string, markbox: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/studio/clientes/${encodeURIComponent(markbox)}`;
}

/**
 * Arma el mensaje con hasta `MAX_RESULTADOS` coincidencias. `encontrados` puede
 * traer una más: si la trae, hay más y se pide afinar. Toma de cada fila SÓLO
 * `markbox` y `name`, aunque la fila traiga otras claves.
 */
export function mensajeDeResultados(
  termino: string,
  encontrados: ReadonlyArray<ClienteEncontrado>,
  baseUrl: string,
): string {
  const buscado = textoSeguro(termino, 60);
  if (encontrados.length === 0) {
    return `No encontré clientes con «${buscado}». Prueba con otra parte del nombre.`;
  }

  let hayMas = encontrados.length > MAX_RESULTADOS;
  const lineas = encontrados.slice(0, MAX_RESULTADOS).map(({ markbox, name }) => {
    return `• ${textoSeguro(name)} · código **${textoSeguro(markbox, 20)}** · <${enlaceFicha(baseUrl, markbox)}>`;
  });

  const pie = "Facturas, montos y datos de contacto se ven en el Studio con tu usuario.";
  const armar = () => {
    const n = lineas.length;
    const cabecera =
      n === 1
        ? `Encontré 1 cliente con «${buscado}»:`
        : `Encontré ${hayMas ? "más de " : ""}${n} clientes con «${buscado}»:`;
    const afinar = hayMas
      ? `\nHay más coincidencias. Escribe el nombre más completo para afinar la búsqueda.`
      : "";
    return `${cabecera}\n${lineas.join("\n")}${afinar}\n${pie}`;
  };

  let texto = armar();
  while (texto.length > LARGO_MAXIMO && lineas.length > 1) {
    lineas.pop();
    hayMas = true;
    texto = armar();
  }
  return texto;
}
