// SDD-0535 · el cliente que vuelve a escribir en un trato CERRADO — NÚCLEO PURO.
//
// Medido en la cuenta real el 2026-10-15: cuando alguien con el trato en
// `Ventas Perdidos` vuelve a escribir, Kommo NO crea un trato nuevo. El mensaje
// se cuelga del trato cerrado (57 de 57 casos en 30 días, ninguno con un trato
// posterior), así que nunca llega un `leads[add]` y el enrutador de SDD-0244
// no se entera. El cliente escribe y la tarjeta se queda escondida en Perdidos.
//
// La señal que sí llega es el `message[add]` entrante. Con él, el webhook pide el
// trato a Kommo y esta función decide:
//
//   Perdido (143) → volver a Recontacto + tarea vencida («rojo»)
//   Ganado  (142) → sólo la tarea: un trato ganado no se reabre (SDD-0244 §5)
//   Abierto       → nada: ya está a la vista
//
// TS puro, sin globals de Deno ni imports: lo importan la Edge Function
// `kommo-webhook` y Vitest. La I/O (GET del lead, encolado) vive en el index de
// la función.

/** Estados de cierre fijos de Kommo: valen igual en todos los embudos. */
export const KOMMO_STATUS_GANADO = 142;
export const KOMMO_STATUS_PERDIDO = 143;

/** Texto de la tarea. Es lo que el asesor lee en la tarjeta roja. */
export const TEXTO_TAREA_VOLVIO = "El cliente volvió a escribir. Responder.";

/** Lo que hace falta de un `KommoMensaje` (`kommo-webhook-parse.ts`). */
export interface MensajeLike {
  leadId: number;
  entrante: boolean;
}

/** Sub-forma del lead de Kommo que la decisión necesita. */
export interface LeadCerradoLike {
  id: number;
  status_id?: number | null;
  closed_at?: number | null;
  responsible_user_id?: number | null;
}

export interface DestinoEtapa {
  pipeline_id: number;
  status_id: number;
}

export type DecisionReapertura =
  | { kind: "nada"; motivo: "sin-lead" | "abierto" | "sin-destino" }
  | {
    kind: "reabrir";
    /** Payload del `patch_stage`: Kommo exige status_id + pipeline_id. */
    etapa: { status_id: number; pipeline_id: number };
    tarea: Record<string, unknown>;
    dedupeToken: string;
  }
  | {
    kind: "avisar";
    tarea: Record<string, unknown>;
    dedupeToken: string;
  };

/**
 * Leads distintos con al menos un mensaje del CLIENTE en este POST. PURO.
 *
 * Sólo entrantes: un saliente nuestro o del bot sobre un trato cerrado no es
 * alguien que volvió. El orden de llegada se conserva para que el log se lea igual
 * que el cuerpo.
 */
export function leadsConMensajeEntrante(mensajes: readonly MensajeLike[]): number[] {
  const vistos = new Set<number>();
  const out: number[] = [];
  for (const m of mensajes) {
    if (!m.entrante) continue;
    const id = Math.trunc(Number(m.leadId));
    if (!Number.isFinite(id) || id <= 0 || vistos.has(id)) continue;
    vistos.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Token de idempotencia de la tarea: uno por EPISODIO de cierre.
 *
 * El cliente suele mandar varios mensajes seguidos y cada uno trae su webhook.
 * Con el token atado a `closed_at`, todos los de un mismo cierre caen en la misma
 * fila de la cola (0377: un POST por token, para siempre) y sale una sola tarea.
 * Si el trato se vuelve a cerrar más adelante, el `closed_at` nuevo abre un
 * episodio nuevo y una tarea nueva.
 */
export function tokenVolvio(closedAt: number | null | undefined): string {
  const n = Math.trunc(Number(closedAt));
  return Number.isFinite(n) && n > 0 ? `volvio:${n}` : "volvio:sin-cierre";
}

/**
 * Tarea vencida sobre el lead (`POST /api/v4/tasks`). PURO.
 *
 * Gemelo de `buildTaskPayload` (`lib/studio/kommo-writeback.ts`): el bundle de la
 * Edge Function no puede importar desde `lib/`. El test de contrato compara las
 * dos salidas para que no se separen en silencio.
 *
 * ⚠️ `complete_till` en epoch de SEGUNDOS. En milisegundos el vencimiento cae en
 * el año 57.000 y la tarjeta no se pone roja nunca.
 */
export function buildTareaVolvioPayload(input: {
  leadId: number;
  completeTillIso: string;
  responsibleUserId?: number | null;
}): Record<string, unknown> | null {
  const leadId = Math.trunc(Number(input.leadId));
  if (!Number.isFinite(leadId) || leadId <= 0) return null;

  const ms = Date.parse(String(input.completeTillIso ?? ""));
  if (!Number.isFinite(ms)) return null;

  // Sin `task_type_id`, igual que el gemelo: Kommo usa `Seguimiento` por defecto.
  const payload: Record<string, unknown> = {
    text: TEXTO_TAREA_VOLVIO,
    complete_till: Math.floor(ms / 1000),
    entity_id: leadId,
    entity_type: "leads",
  };

  const responsable = Math.trunc(Number(input.responsibleUserId));
  if (Number.isFinite(responsable) && responsable > 0) {
    payload.responsible_user_id = responsable;
  }
  return payload;
}

/**
 * ¿Qué hacer con el trato donde el cliente acaba de escribir? PURO.
 *
 * `destino` es `stage_map.recontacto` (el mismo interruptor del enrutador de
 * SDD-0244): sin él la función queda inerte y no se encola nada.
 *
 * La tarea vence en `ahoraIso`: nace vencida y la tarjeta se pone roja apenas
 * llega a Kommo. Es la misma semántica que tenía la acción de los agentes de IA
 * («Agregar tarea · Ahora»), que dejó de correr cuando se apagaron.
 */
export function decidirReapertura(
  lead: LeadCerradoLike | null | undefined,
  destino: DestinoEtapa | null,
  ahoraIso: string,
): DecisionReapertura {
  if (!lead || !Number.isFinite(Number(lead.id)) || Number(lead.id) <= 0) {
    return { kind: "nada", motivo: "sin-lead" };
  }
  const estado = Math.trunc(Number(lead.status_id));
  if (estado !== KOMMO_STATUS_PERDIDO && estado !== KOMMO_STATUS_GANADO) {
    return { kind: "nada", motivo: "abierto" };
  }
  if (!destino) return { kind: "nada", motivo: "sin-destino" };

  const tarea = buildTareaVolvioPayload({
    leadId: lead.id,
    completeTillIso: ahoraIso,
    responsibleUserId: lead.responsible_user_id,
  });
  if (!tarea) return { kind: "nada", motivo: "sin-lead" };

  const dedupeToken = tokenVolvio(lead.closed_at);

  // Un trato ganado es el histórico de una venta: reabrirlo la borra de los
  // reportes de Kommo. Se avisa con la tarea y se deja donde está.
  if (estado === KOMMO_STATUS_GANADO) {
    return { kind: "avisar", tarea, dedupeToken };
  }

  return {
    kind: "reabrir",
    etapa: {
      status_id: Math.trunc(Number(destino.status_id)),
      pipeline_id: Math.trunc(Number(destino.pipeline_id)),
    },
    tarea,
    dedupeToken,
  };
}
