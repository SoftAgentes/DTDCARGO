/**
 * SDD-0608 · El comando `/cliente` de Discord: definición y lectura de la
 * interacción.
 *
 * La definición vive en `comando-cliente.json` para que el script que la
 * registra en Discord (`scripts/discord/registrar-comando-cliente.mjs`, un .mjs
 * sin TypeScript) y la ruta lean el MISMO archivo.
 *
 * `default_member_permissions: "0"` = nadie lo ve hasta que Sam lo habilite en
 * Ajustes del servidor › Integraciones para el rol «Equipo» y los canales de
 * Operación. `contexts: [0]` = sólo dentro de un servidor, nunca por mensaje
 * directo.
 */

import definicion from "./comando-cliente.json";

export const COMANDO_CLIENTE = definicion;

/** Servidor «DTD Cargo» de Sam. No es un secreto: es el ID público del servidor. */
export const DTD_DISCORD_GUILD_ID = "1534936818951262390";

/** Coincidencias que se muestran. Se piden una más para saber si hay más. */
export const MAX_RESULTADOS = 10;

/** Consultas por persona y por minuto (cuenta también las rechazadas). */
export const TOPE_POR_MINUTO = 6;

export const TERMINO_MIN = definicion.options[0].min_length;
export const TERMINO_MAX = definicion.options[0].max_length;

const SNOWFLAKE = /^[0-9]{17,20}$/;

export function esSnowflake(valor: unknown): valor is string {
  return typeof valor === "string" && SNOWFLAKE.test(valor);
}

/** Tipos de interacción y de respuesta de Discord que usa esta ruta. */
export const INTERACCION_PING = 1;
export const INTERACCION_COMANDO = 2;
export const RESPUESTA_PONG = 1;
export const RESPUESTA_MENSAJE = 4;
/** `EPHEMERAL`: sólo lo ve quien ejecutó el comando. */
export const FLAG_EFIMERO = 64;

/** Lo que esta ruta lee de una interacción. El resto se ignora. */
export interface InteraccionDiscord {
  type?: number;
  guild_id?: string;
  member?: { user?: { id?: string } };
  user?: { id?: string };
  data?: {
    name?: string;
    options?: Array<{ name?: string; type?: number; value?: unknown }>;
  };
}

export type LecturaComando =
  | { ok: true; discordUserId: string; termino: string }
  | { ok: false; motivo: "otro_comando" | "fuera_del_servidor" | "termino_invalido" };

/**
 * Valida lo que llegó firmado: comando, servidor, persona y término. El
 * término se normaliza (espacios) y se acota; NO se escapa acá: los comodines
 * se escapan en la base (`discord_buscar_clientes`, migración 0516).
 */
export function leerComandoCliente(interaccion: InteraccionDiscord): LecturaComando {
  if (interaccion.data?.name !== COMANDO_CLIENTE.name) {
    return { ok: false, motivo: "otro_comando" };
  }
  // Sólo desde el servidor de DTD Cargo, y con `member` (no mensaje directo).
  const discordUserId = interaccion.member?.user?.id;
  if (interaccion.guild_id !== DTD_DISCORD_GUILD_ID || !esSnowflake(discordUserId)) {
    return { ok: false, motivo: "fuera_del_servidor" };
  }
  const opcion = interaccion.data.options?.find((o) => o.name === "nombre");
  const crudo = typeof opcion?.value === "string" ? opcion.value : "";
  const termino = crudo.replace(/\s+/g, " ").trim();
  if (termino.length < TERMINO_MIN || termino.length > TERMINO_MAX) {
    return { ok: false, motivo: "termino_invalido" };
  }
  return { ok: true, discordUserId, termino };
}
