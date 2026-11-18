/**
 * SDD-0626 §3.2 · Webhook de Chatwoot → bandeja del cable (`event_inbox`).
 *
 * Delgado a propósito: guardar y salir. Sin repartidor, sin modelo, sin herramientas y sin responder
 * nada en Chatwoot. Orden de las puertas; cada una corta y ninguna escribe antes de la última:
 *   1. Interruptor `OFICINA_WEBHOOK_ACTIVO`. Apagado → 200 `ignorado: apagado`, sin leer el cuerpo ni
 *      crear el almacén (no toca la base).
 *   2. Configuración: sin secreto, sin bandeja de prueba o sin `OFICINA_CHATWOOT_ACCOUNT_ID` → 503, se rechaza todo
 *      (Paso 3a: la cuenta es obligatoria; un aviso de otra cuenta se ignora en el paso 5).
 *   3. Tope de tamaño (256 KiB) ANTES de la firma → 413.
 *   4. Firma HMAC de Chatwoot 4.19.1 sobre el cuerpo crudo, con anti-replay y comparación en tiempo
 *      constante (`verificarFirmaChatwoot`, la de la Bandeja). Inválida → 401 y no se guarda nada.
 *   5. JSON → 400. Solo `message_created`; de otra cuenta, de otra bandeja, saliente o nota interna →
 *      200 `ignorado` (Chatwoot no debe reintentar lo que no nos interesa).
 *   6. La fila: `clave_dedupe` = conversación + mensaje; `payload_ref` = una REFERENCIA
 *      (`chatwoot:conversations/<id>/messages/<id>`), NUNCA el texto del mensaje (R5). El texto no sale
 *      de `interpretarEvento`, que no lo lleva, ni de aquí.
 *   7. `exigirTextosDelCable` revisa lo que se va a escribir; si lo rechaza, no se guarda y el log dice
 *      por qué sin repetir el dato → 422.
 *   8. Se guarda con ON CONFLICT DO NOTHING (AC-4: la misma clave no entra dos veces, llegue cuando llegue).
 *
 * Con la oficina pausada el aviso se guarda igual (no se pierden mensajes): quien no avanza es el
 * filtro, que con `office_esta_pausada()` no mueve nada.
 *
 * Sin la 0541 (la tabla no existe) no falla en voz alta: responde 200 `omitido` y lo anota UNA vez.
 * No se registra el cuerpo, ni cabeceras de firma, ni el texto del mensaje, ni valores de configuración.
 */
import { interpretarEvento } from "@/lib/studio/chatwoot/webhook-events";
import { leerCuerpoAcotado } from "@/lib/studio/chatwoot/webhook-body";
import { verificarFirmaChatwoot } from "@/lib/studio/chatwoot/webhook-signature";

import { type ConfigWebhookOficina } from "./config";
import { avisarUnaVez, escribirEnElCable } from "./escritura";
import { type Prioridad, prioridadDelEvento } from "./filtro-nivel1";

/** Una fila de la bandeja, tal como la escribe el webhook (service_role no escribe id ni ts). */
export interface FilaBandeja {
  tipo: string;
  origen: string;
  clave_dedupe: string;
  prioridad: Prioridad;
  payload_ref: string;
}

export type ResultadoGuardado = "guardado" | "duplicado" | "sin_migracion";

export interface BandejaStore {
  /** Inserta con ON CONFLICT DO NOTHING sobre `clave_dedupe`. */
  guardar(fila: FilaBandeja): Promise<ResultadoGuardado>;
}

export interface RespuestaWebhook {
  status: number;
  cuerpo: Record<string, unknown>;
}

const responder = (status: number, cuerpo: Record<string, unknown>): RespuestaWebhook => ({ status, cuerpo });
const ignorado = (motivo: string) => responder(200, { ok: true, ignorado: motivo });

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : null);

export const TIPO_EVENTO = "chatwoot.message_created";
export const ORIGEN_EVENTO = "chatwoot";

export async function procesarWebhookOficina(
  req: Request,
  deps: {
    config: ConfigWebhookOficina;
    /** El almacén se crea solo después de la firma: una petición inválida no crea ni un cliente de base. */
    crearAlmacen: () => BandejaStore;
    ahoraMs?: number;
    registrar?: (mensaje: string) => void;
  },
): Promise<RespuestaWebhook> {
  const { config } = deps;
  const registrar = deps.registrar ?? ((m: string) => console.error(m));

  if (!config.activo) return ignorado("apagado");
  // Sin OFICINA_CHATWOOT_ACCOUNT_ID (la cuenta propia del cable, nunca la del ERP) no se acepta ningún aviso;
  // con ella, solo los de esa cuenta.
  if (!config.secreto || config.bandejaPrueba === null || config.cuenta === null) {
    return responder(503, { ok: false, error: "no_configurado" });
  }

  const leido = await leerCuerpoAcotado(req);
  if (!leido.ok) return responder(413, { ok: false, error: "tamano" });
  const firma = verificarFirmaChatwoot({
    cuerpo: leido.texto,
    timestamp: req.headers.get("x-chatwoot-timestamp"),
    firma: req.headers.get("x-chatwoot-signature"),
    secreto: config.secreto,
    ahoraMs: deps.ahoraMs,
  });
  if (firma !== "ok") return responder(401, { ok: false, error: "firma" });

  let payload: unknown;
  try {
    payload = JSON.parse(leido.texto);
  } catch {
    return responder(400, { ok: false, error: "json" });
  }

  const evento = interpretarEvento(payload);
  if (!evento || evento.evento !== "message_created" || evento.mensajeId === null) return ignorado("evento");
  if (evento.accountId !== config.cuenta) return ignorado("cuenta");
  // Solo la bandeja de prueba. Cualquier otra se ignora sin mirar nada más.
  if (evento.conversacion.inboxId !== config.bandejaPrueba) return ignorado("bandeja");
  // Solo mensajes entrantes de clientes: ni los propios (salientes) ni las notas internas.
  if (obj(payload)?.private === true) return ignorado("nota_interna");
  if (!evento.avisar) return ignorado("no_entrante");

  const conversacion = evento.conversacion.id;
  const mensaje = evento.mensajeId;
  const fila: FilaBandeja = {
    tipo: TIPO_EVENTO,
    origen: ORIGEN_EVENTO,
    clave_dedupe: `chatwoot:conv:${conversacion}:msg:${mensaje}`,
    prioridad: prioridadDelEvento(evento.conversacion.etiquetas, config.reglas),
    payload_ref: `chatwoot:conversations/${conversacion}/messages/${mensaje}`,
  };

  try {
    // Lo que se escribe pasa por la regla de textos del cable. La fila solo lleva identificadores
    // y referencias: se revisan como `meta_datos` (claves y valores, a cualquier profundidad).
    const r = await escribirEnElCable(
      { metaDatos: { clave_dedupe: fila.clave_dedupe, payload_ref: fila.payload_ref } },
      () => deps.crearAlmacen().guardar(fila),
      registrar,
    );
    if (!r.escrito) return responder(422, { ok: false, error: "texto_rechazado" });
    if (r.valor === "sin_migracion") {
      avisarUnaVez("webhook-sin-migracion", "[oficina-cable] el webhook no guarda nada: falta la 0541 en esta base (SDD-0626)");
      return responder(200, { ok: true, omitido: "sin_migracion" });
    }
    return responder(200, { ok: true, resultado: r.valor });
  } catch (e) {
    // Solo el código del error: nunca el mensaje, que podría traer el valor de una fila.
    const code = obj(e)?.code;
    registrar(`[oficina-cable] el webhook no pudo guardar el aviso (${typeof code === "string" ? code : "error"})`);
    return responder(500, { ok: false, error: "registro" });
  }
}
