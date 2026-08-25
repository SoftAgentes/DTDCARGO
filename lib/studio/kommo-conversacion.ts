/**
 * SDD-0288 rebanada 1 · el semáforo de la conversación.
 *
 * Traduce las dos fechas que guarda el espejo (`last_inbound_at` /
 * `last_outbound_at`, migración 0391) al estado que ve el asesor en la tarjeta.
 *
 * ── Por qué se deriva y no se guarda ────────────────────────────────────────
 *
 * El estado se calcula al pintar, no se persiste. Una columna `estado` habría
 * que recalcularla con cada mensaje y quedaría mintiendo en cuanto alguien
 * conteste desde Kommo y el webhook tarde. Las fechas son hechos; el estado es
 * una opinión sobre esos hechos, y las opiniones no se guardan.
 *
 * ── La regla, en la voz del founder ─────────────────────────────────────────
 *
 * *"Ver qué cliente está activo. A qué cliente le estoy escribiendo y de quién
 * estoy esperando una respuesta."* Son tres estados, no un booleano:
 *
 *   TE ESCRIBIÓ  el último mensaje es del cliente → le debemos respuesta  🔴
 *   ESPERANDO    el último mensaje es nuestro → la pelota la tiene él     ⚪
 *   SIN CHAT     nunca hubo mensaje                                       ·
 *
 * ⚠️ **"Esperando" NO es rojo, y no es un detalle de estilo.** Si los dos
 * estados comparten el color, la columna se vuelve un muro rojo y el indicador
 * muere — es el riesgo que el doc de Kommo dejó anotado el 11-ago y nunca se
 * midió. El rojo se reserva para lo único accionable ahora mismo: **te deben
 * una respuesta**.
 */

export type EstadoConversacion = "te-escribio" | "esperando" | "sin-chat";

export interface Conversacion {
  estado: EstadoConversacion;
  /** Hace cuánto fue el último mensaje, en ms. `null` si no hay conversación. */
  desdeMs: number | null;
}

/** Fila de `kommo_leads` — sólo lo que el semáforo necesita. */
export interface LeadConMensajes {
  last_inbound_at: string | null;
  last_outbound_at: string | null;
}

/** Parsea una fecha ISO a epoch ms, o `null` si es basura. */
function ms(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const n = Date.parse(iso);
  return Number.isFinite(n) ? n : null;
}

/**
 * Estado de la conversación de un lead. PURA — recibe `ahoraMs`, no lee el
 * reloj global: "hace cuánto" es exactamente la clase de cosa que hay que poder
 * probar con el tiempo congelado.
 */
export function conversacionDe(
  lead: LeadConMensajes,
  ahoraMs: number,
): Conversacion {
  const dentro = ms(lead.last_inbound_at);
  const fuera = ms(lead.last_outbound_at);

  if (dentro == null && fuera == null) {
    return { estado: "sin-chat", desdeMs: null };
  }

  // Sin saliente, o el entrante es más nuevo → le debemos respuesta.
  //
  // El `>=` del empate importa: si las dos fechas coinciden al segundo —pasa
  // cuando el agente de IA contesta en el mismo tick— gana el ENTRANTE. Preferimos
  // un rojo de más en un empate que dar por contestado algo que quizá no lo está.
  if (dentro != null && (fuera == null || dentro >= fuera)) {
    return { estado: "te-escribio", desdeMs: Math.max(0, ahoraMs - dentro) };
  }

  return { estado: "esperando", desdeMs: Math.max(0, ahoraMs - (fuera as number)) };
}

/**
 * Rótulo del tiempo transcurrido: *"3 h"*, *"2 d"*.
 *
 * Redondea hacia ABAJO a propósito: decir "2 h" cuando van 2 h 50 min es
 * preferible a decir "3 h" cuando van 2 h 10 min. Un semáforo que exagera se
 * deja de mirar.
 */
export function etiquetaDesde(desdeMs: number): string {
  const min = Math.floor(desdeMs / 60_000);
  if (min < 1) return "recién";
  if (min < 60) return `${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `${horas} h`;
  return `${Math.floor(horas / 24)} d`;
}

/** Texto completo para el `title` de la tarjeta y para lectores de pantalla. */
export function rotuloConversacion(c: Conversacion): string {
  if (c.estado === "sin-chat") return "Sin conversación";
  const cuando = c.desdeMs == null ? "" : ` · hace ${etiquetaDesde(c.desdeMs)}`;
  return c.estado === "te-escribio"
    ? `Te escribió${cuando}`
    : `Esperando respuesta${cuando}`;
}

/** Color del punto. `null` = no se pinta nada. */
export function colorConversacion(c: Conversacion): string | null {
  if (c.estado === "te-escribio") return "var(--danger)";
  if (c.estado === "esperando") return "var(--ink-mute)";
  return null;
}
