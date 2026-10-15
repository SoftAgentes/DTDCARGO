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

// ── El cliente que vuelve y cae en «Leads Entrantes» ────────────────────────
//
// Medido el 2026-10-15 en el servidor: cuando un cliente que ya pasó vuelve a
// escribir y Kommo le abre un trato nuevo, el aviso llega como `unsorted[add]`
// (1.864 en 5 días), nunca como `leads[add]`. Por eso el enrutador de SDD-0244
// no se disparó ni una vez: la cola no tiene un solo `patch_stage` a Recontacto.
//
// Un trato en la bandeja no se mueve con PATCH: se ACEPTA en una etapa
// (`POST /api/v4/leads/unsorted/{uid}/accept` con `status_id`). Forma del
// evento, leída de los logs del webhook (solo claves, sin valores):
//   unsorted[add][0][uid] · [lead_id] · [pipeline_id] · [category]

/** Una entrada nueva de la bandeja, lo justo para aceptarla. */
export interface EntradaBandeja {
  uid: string;
  leadId: number;
  pipelineId: number | null;
  category: string | null;
}

/**
 * Extrae las entradas nuevas de la bandeja del cuerpo del webhook. PURA.
 *
 * Solo `uid`, `lead_id`, `pipeline_id` y `category`: el resto del evento trae el
 * nombre, el teléfono y el texto del cliente, y no se lee. Sin `uid` o sin un
 * `lead_id` válido la entrada se ignora: no hay qué aceptar ni dónde estampar.
 */
export function parseEntradasBandeja(formBody: string | URLSearchParams): EntradaBandeja[] {
  const params = typeof formBody === "string" ? new URLSearchParams(formBody) : formBody;
  const re = /^unsorted\[add\]\[(\d+)\]\[(uid|lead_id|pipeline_id|category)\]$/;
  const crudos = new Map<string, Record<string, string>>();
  for (const [key, val] of params.entries()) {
    const m = re.exec(key.trim());
    if (!m) continue;
    const prev = crudos.get(m[1]) ?? {};
    prev[m[2]] = String(val ?? "").trim();
    crudos.set(m[1], prev);
  }

  const vistos = new Set<string>();
  const out: EntradaBandeja[] = [];
  for (const c of crudos.values()) {
    const uid = c.uid ?? "";
    const leadId = Math.trunc(Number(c.lead_id));
    if (!uid || vistos.has(uid) || !Number.isFinite(leadId) || leadId <= 0) continue;
    vistos.add(uid);
    const pipelineId = Math.trunc(Number(c.pipeline_id));
    out.push({
      uid,
      leadId,
      pipelineId: Number.isFinite(pipelineId) && pipelineId > 0 ? pipelineId : null,
      category: c.category ? c.category : null,
    });
  }
  return out;
}

/**
 * Cuerpo del `accept` para dejar la entrada en Recontacto, o `null` si no
 * corresponde. PURA.
 *
 * Solo se acepta dentro del embudo de Recontacto: aceptar una entrada de otro
 * embudo con una etapa ajena es una orden que Kommo rechaza o, peor, que muda el
 * trato de embudo sin que nadie lo haya pedido.
 */
export function cuerpoAceptarEnRecontacto(
  entrada: EntradaBandeja,
  destino: DestinoEtapa | null,
): { status_id: number } | null {
  if (!destino) return null;
  if (entrada.pipelineId !== Math.trunc(Number(destino.pipeline_id))) return null;
  return { status_id: Math.trunc(Number(destino.status_id)) };
}

/** Token de la tarea de una entrada aceptada: una por entrada de la bandeja. */
export function tokenEntrada(uid: string): string {
  return `volvio:entrada:${uid}`;
}

/** Quién escribió, resuelto contra `clients` con el `decideRoute` de SDD-0244. */
export interface ClienteResuelto {
  esCliente: boolean;
  contactId: number | null;
  markbox: string | null;
}

/**
 * Lo que el orquestador necesita del mundo. El index de la Edge Function pasa
 * las implementaciones reales (Kommo, Supabase); Vitest pasa dobles.
 */
export interface DepsEntradas {
  /** `stage_map.recontacto`. Sin él, inerte. */
  destino: DestinoEtapa | null;
  /** `writeback_enabled && !writeback_dry_run`: el mismo gate de la cola. */
  escribe: boolean;
  resolverCliente(leadId: number): Promise<ClienteResuelto>;
  /** `POST /api/v4/leads/unsorted/{uid}/accept`. Lanza con `.status` si Kommo dice que no. */
  aceptar(uid: string, cuerpo: { status_id: number }): Promise<void>;
  encolarMarcas(leadId: number, contactId: number, markbox: string): Promise<void>;
  encolarTarea(leadId: number, tarea: Record<string, unknown>, dedupeToken: string): Promise<void>;
  ahoraIso(): string;
}

export interface ResumenEntradas {
  revisadas: number;
  aceptadas: number;
  desconocidas: number;
  otroEmbudo: number;
  enEnsayo: number;
  /** El accept dio 404: la entrada ya no estaba (alguien la aceptó, o el evento se repitió). */
  yaNoEstaban: number;
  /** El accept dio 400: Kommo la rechazó. Se registra y se sigue. */
  rechazadas: number;
  fallidas: number;
  inerte?: string;
}

function estadoDe(e: unknown): number | null {
  const s = Number((e as { status?: unknown } | null)?.status);
  return Number.isFinite(s) && s > 0 ? s : null;
}

/**
 * Acepta en Recontacto las entradas nuevas de la bandeja que son de un cliente
 * que ya pasó. Nunca lanza: el espejado es lo principal del webhook.
 *
 * Orden y por qué:
 *   1. Sin destino → inerte, ni una llamada.
 *   2. Otro embudo → no se toca.
 *   3. Cliente desconocido → se queda en Leads Entrantes: es un lead nuevo de
 *      verdad y lo atiende la bandeja como siempre.
 *   4. Gate apagado → se cuenta en ensayo y no se escribe.
 *   5. Accept. Un 404 o un 400 NO se reintenta y NO genera tarea: la entrada ya no
 *      está o Kommo no la quiso. El evento se repite (`unsorted[add]` llega
 *      varias veces por entrada) y el segundo accept cae acá.
 *   6. Solo con el accept hecho: Shipping Mark y tarea vencida, con token por
 *      entrada para que dos eventos no dejen dos tareas.
 */
export async function procesarEntradasBandeja(
  entradas: readonly EntradaBandeja[],
  deps: DepsEntradas,
): Promise<ResumenEntradas> {
  const r: ResumenEntradas = {
    revisadas: entradas.length,
    aceptadas: 0,
    desconocidas: 0,
    otroEmbudo: 0,
    enEnsayo: 0,
    yaNoEstaban: 0,
    rechazadas: 0,
    fallidas: 0,
  };
  if (!deps.destino) return { ...r, inerte: "sin stage_map.recontacto" };

  for (const entrada of entradas) {
    try {
      const cuerpo = cuerpoAceptarEnRecontacto(entrada, deps.destino);
      if (!cuerpo) {
        r.otroEmbudo++;
        continue;
      }

      const quien = await deps.resolverCliente(entrada.leadId);
      if (!quien.esCliente) {
        r.desconocidas++;
        continue;
      }

      if (!deps.escribe) {
        r.enEnsayo++;
        continue;
      }

      try {
        await deps.aceptar(entrada.uid, cuerpo);
      } catch (e) {
        const estado = estadoDe(e);
        if (estado === 404) r.yaNoEstaban++;
        else if (estado === 400) r.rechazadas++;
        else r.fallidas++;
        continue;
      }
      r.aceptadas++;

      const markbox = (quien.markbox ?? "").trim();
      if (markbox && quien.contactId) {
        await deps.encolarMarcas(entrada.leadId, quien.contactId, markbox);
      }
      const tarea = buildTareaVolvioPayload({
        leadId: entrada.leadId,
        completeTillIso: deps.ahoraIso(),
      });
      if (tarea) await deps.encolarTarea(entrada.leadId, tarea, tokenEntrada(entrada.uid));
    } catch {
      r.fallidas++;
    }
  }
  return r;
}

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
