/**
 * `dtd-bot` · modo comprobado antes de enviar y falla cerrada (SDD-NNNN §3, fila 7.6). Puro.
 *
 * El trabajador junta una FOTO del estado (releída de la base y de Chatwoot) dos veces:
 * antes de llamar al motor y justo antes de enviar. Esta función decide con esa foto.
 *
 * **Falla cerrada:** todo dato que no se pudo leer viene como `null`, y un `null` donde
 * hace falta saber nunca deja enviar: el turno pasa a humano con su motivo (y el Studio
 * avisa). Es lo contrario del kit de Basdonax, que contesta igual si no logra consultar
 * a Chatwoot (v3, V3-6).
 *
 * Lo que es una decisión de una persona (apagar, resolver, escribir) CANCELA en silencio:
 * no es una falla y no hace falta avisar.
 */

import { dentroDelPresupuesto, dentroDelTopeConversacion, FRENOS_POR_DEFECTO, type ConfigFrenos } from "./frenos";

export type ModoBandeja = "apagado" | "sugerir" | "contesta_solo";
export const MODOS: readonly ModoBandeja[] = ["apagado", "sugerir", "contesta_solo"];

export type EstadoConversacionBot = "open" | "pending" | "snoozed" | "resolved";

export interface FotoTurno {
  /** El lease del trabajador sigue vigente (nadie más tomó el turno). */
  leaseVigente: boolean;
  /** Flag `chatwoot_bot` del tenant. */
  flagEncendido: boolean | null;
  modo: ModoBandeja | null;
  /** La excepción IA-01 acotada (7.2) está aprobada y vigente. */
  ia01Aprobada: boolean | null;
  /** Dentro del horario del bot en esa bandeja. */
  enHorario: boolean | null;
  estadoConversacion: EstadoConversacionBot | null;
  /** «Resolver calla al bot»: la conversación quedó callada. */
  callada: boolean | null;
  /** La conversación está asignada a una persona. */
  asignadaAPersona: boolean | null;
  /** Una persona escribió en la conversación después del mensaje que abrió el turno. */
  personaEscribio: boolean | null;
  /** Llegó otro mensaje del cliente después del último que vio el turno. */
  mensajeNuevo: boolean | null;
  /** Opción «solo el primer mensaje» de la bandeja. */
  soloPrimerMensaje: boolean | null;
  /** Respuestas del bot que ya tuvo la conversación (todas, para «solo el primer mensaje»). */
  respuestasPrevias: number | null;
  /** Respuestas del bot en las últimas 24 h (tope por conversación). */
  respuestas24h: number | null;
  /** El mensaje es texto sin adjuntos (hasta 7.5, lo demás va a humano). */
  formatoAdmitido: boolean | null;
  /** Gasto de IA del mes en USD, o null si no se pudo sumar. */
  gastoMesUsd: number | null;
  /** Lo más que puede costar la llamada que viene. Antes de enviar va 0: el gasto del mes ya la incluye. */
  costoMaximoLlamada: number;
}

export type MotivoCancelar =
  | "flag_apagado"
  | "modo_apagado"
  | "resuelta"
  | "callada"
  | "escribio_una_persona"
  | "asignada_a_persona"
  | "fuera_de_horario"
  | "solo_primer_mensaje";

export type MotivoHumano =
  | "lease_vencido"
  | "estado_desconocido"
  | "contesta_solo_sin_ia01"
  | "formato_no_admitido"
  | "tope_conversacion"
  | "presupuesto";

export type Decision =
  | { accion: "seguir"; modo: Exclude<ModoBandeja, "apagado"> }
  | { accion: "esperar"; motivo: "mensaje_nuevo" }
  | { accion: "cancelar"; motivo: MotivoCancelar }
  | { accion: "humano"; motivo: MotivoHumano };

const desconocido = (...v: unknown[]) => v.some((x) => x === null || x === undefined);

/**
 * Qué hacer con el turno según la foto. `seguir` es el único camino que deja llamar al
 * motor o enviar; cualquier otro cierra el turno (o lo deja esperar otro mensaje).
 */
export function decidirTurno(f: FotoTurno, frenos: ConfigFrenos = FRENOS_POR_DEFECTO): Decision {
  // 1. Otro trabajador pudo tomarlo: no se sabe qué hizo, así que nada más se toca.
  if (!f.leaseVigente) return { accion: "humano", motivo: "lease_vencido" };

  // 2. Apagado gana a todo lo demás, aunque falten datos.
  if (f.flagEncendido === false) return { accion: "cancelar", motivo: "flag_apagado" };
  if (f.modo === "apagado") return { accion: "cancelar", motivo: "modo_apagado" };

  // 3. Sin la foto completa, no se envía.
  if (
    desconocido(
      f.flagEncendido,
      f.modo,
      f.ia01Aprobada,
      f.enHorario,
      f.estadoConversacion,
      f.callada,
      f.asignadaAPersona,
      f.personaEscribio,
      f.mensajeNuevo,
      f.soloPrimerMensaje,
      f.respuestasPrevias,
      f.respuestas24h,
      f.formatoAdmitido,
    ) ||
    (f.modo !== null && !MODOS.includes(f.modo))
  ) {
    return { accion: "humano", motivo: "estado_desconocido" };
  }
  const modo = f.modo as Exclude<ModoBandeja, "apagado">;

  // 4. Decisiones de una persona: se respetan en silencio.
  if (f.estadoConversacion === "resolved") return { accion: "cancelar", motivo: "resuelta" };
  if (f.callada) return { accion: "cancelar", motivo: "callada" };
  if (f.personaEscribio) return { accion: "cancelar", motivo: "escribio_una_persona" };
  if (modo === "contesta_solo" && f.asignadaAPersona) return { accion: "cancelar", motivo: "asignada_a_persona" };

  // 5. El cliente sigue escribiendo: el turno espera (lo extiende el webhook).
  if (f.mensajeNuevo) return { accion: "esperar", motivo: "mensaje_nuevo" };

  // 6. Opciones de la bandeja.
  if (!f.enHorario) return { accion: "cancelar", motivo: "fuera_de_horario" };
  if (f.soloPrimerMensaje && (f.respuestasPrevias as number) > 0) return { accion: "cancelar", motivo: "solo_primer_mensaje" };

  // 7. Contesta solo sin la excepción IA-01: la base no debería dejarlo; si pasa, a humano.
  if (modo === "contesta_solo" && f.ia01Aprobada !== true) return { accion: "humano", motivo: "contesta_solo_sin_ia01" };

  // 8. Frenos.
  if (!f.formatoAdmitido) return { accion: "humano", motivo: "formato_no_admitido" };
  if (!dentroDelTopeConversacion(f.respuestas24h as number, frenos)) return { accion: "humano", motivo: "tope_conversacion" };
  if (!dentroDelPresupuesto(f.gastoMesUsd, f.costoMaximoLlamada, frenos)) return { accion: "humano", motivo: "presupuesto" };

  return { accion: "seguir", modo };
}

/** Cómo sale la respuesta en cada modo: Sugerir nunca le escribe al cliente. */
export function canalDeSalida(modo: Exclude<ModoBandeja, "apagado">): "nota_privada" | "mensaje" {
  return modo === "contesta_solo" ? "mensaje" : "nota_privada";
}
