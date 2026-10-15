/**
 * Fan-out de avisos al cliente para las MÁQUINAS PARALELAS del journey
 * (SDD-0156 · Slice D).
 *
 * `transitionShipment` dispara un evento por UN envío. Pero consolidar, fijar el
 * ETA de la naviera o recibir en Venezuela son operaciones que tocan un
 * CONTENEDOR o un RECIBO que agrupan N envíos. Estos helpers resuelven la lista
 * de envíos afectados y llaman `scheduleClientNotifications` uno por uno
 * (idempotente por sí mismo). Best-effort: nunca throwean — un fallo acá no
 * rompe la operación de naviera/recepción.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  scheduleClientNotifications,
  type AnclaDelAviso,
  type MotivoProgramacion,
  type ScheduleResult,
} from "./schedule-client-notifications";

/** Un envío alcanzado por el fan-out, con lo mínimo para programar el aviso. */
interface FanoutTarget {
  shipmentId: string;
  shipmentCode: string;
  clientMarkbox: string | null;
  clientName: string | null;
}

async function scheduleForTargets(
  admin: SupabaseClient,
  tenantId: string,
  event: string,
  targets: FanoutTarget[],
  eventTime: Date,
): Promise<number> {
  let scheduled = 0;
  for (const t of targets) {
    if (!t.clientMarkbox) continue;
    const res = await scheduleClientNotifications(admin, tenantId, {
      ancla: {
        kind: "shipment",
        shipmentId: t.shipmentId,
        shipmentCode: t.shipmentCode,
      },
      clientMarkbox: t.clientMarkbox,
      clientName: t.clientName,
      event,
      eventTime,
    });
    scheduled += res.scheduled;
  }
  return scheduled;
}

/**
 * Programa un evento de contenedor (`consolidated`, `eta_set`) para todos los
 * envíos asignados a una consolidación. Resuelve los envíos por
 * `consolidation_items` (que ya guarda shipment_id + el Shipping Mark snapshot) y
 * completa el código real desde `shipments`.
 */
export async function scheduleConsolidationEvent(
  admin: SupabaseClient,
  tenantId: string,
  consolidationId: string,
  event: string,
  eventTime: Date = new Date(),
): Promise<number> {
  try {
    const { data: items } = await admin
      .from("consolidation_items")
      .select("shipment_id, client_markbox, client_name")
      .eq("tenant_id", tenantId)
      .eq("consolidation_id", consolidationId)
      .not("shipment_id", "is", null);

    const rows = (items ?? []) as Array<{
      shipment_id: string;
      client_markbox: string | null;
      client_name: string | null;
    }>;
    if (rows.length === 0) return 0;

    // Código real de cada envío (consolidation_items no lo guarda).
    //
    // SDD-0511 · solo envíos VIVOS. Eliminar un envío pone `deleted_at` y no lo
    // saca del contenedor; este cliente es admin, así que la RLS no filtra
    // nada. El envío que no vuelve vivo de esta lectura no recibe el aviso: un
    // aviso sobre un envío eliminado no sale.
    const ids = rows.map((r) => r.shipment_id);
    const { data: shipments, error: shipmentsErr } = await admin
      .from("shipments")
      .select("id, code, client_markbox, client_name")
      .in("id", ids)
      .is("deleted_at", null);
    if (shipmentsErr) {
      // Sin saber cuáles siguen vivos, no se avisa a ciegas.
      console.error(
        `[client-notif] scheduleConsolidationEvent no pudo leer los envíos:`,
        shipmentsErr.message,
      );
      return 0;
    }
    const byId = new Map(
      ((shipments ?? []) as Array<{
        id: string;
        code: string;
        client_markbox: string | null;
        client_name: string | null;
      }>).map((s) => [s.id, s]),
    );

    const targets: FanoutTarget[] = [];
    for (const r of rows) {
      const s = byId.get(r.shipment_id);
      if (!s) continue; // eliminado
      targets.push({
        shipmentId: r.shipment_id,
        shipmentCode: s.code,
        clientMarkbox: s.client_markbox ?? r.client_markbox,
        clientName: s.client_name ?? r.client_name,
      });
    }

    return await scheduleForTargets(admin, tenantId, event, targets, eventTime);
  } catch (err) {
    console.error(`[client-notif] scheduleConsolidationEvent falló:`, err);
    return 0;
  }
}

/**
 * Programa un evento de itinerario para TODAS las consolidaciones de un sailing
 * (`eta_set` cuando la naviera fija/actualiza el ETA). Fan-out sailing →
 * consolidations → consolidation_items → envíos.
 */
export async function scheduleSailingEvent(
  admin: SupabaseClient,
  tenantId: string,
  sailingId: string,
  event: string,
  eventTime: Date = new Date(),
): Promise<number> {
  try {
    const { data: consols } = await admin
      .from("consolidations")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("sailing_id", sailingId)
      .is("deleted_at", null);

    const rows = (consols ?? []) as Array<{ id: string }>;
    let scheduled = 0;
    for (const c of rows) {
      scheduled += await scheduleConsolidationEvent(
        admin,
        tenantId,
        c.id,
        event,
        eventTime,
      );
    }
    return scheduled;
  } catch (err) {
    console.error(`[client-notif] scheduleSailingEvent falló:`, err);
    return 0;
  }
}

/**
 * Programa `received_ve` para los envíos de las cajas de un recibo VE — el aviso
 * «tu carga llegó a Venezuela». Desde el 2026-07-19 es el disparador CANÓNICO
 * del arribo: en ese cambio se quitó el mail `shipment_arrived` que mandaba la
 * transición de status, para no duplicarlo.
 *
 * Las cajas no guardan shipment_id → se resuelve el envío por el Shipping Mark
 * (el envío no terminal más reciente de ese cliente).
 *
 * 🔴 **Sin envío resoluble, el cliente se queda sin el aviso que más espera.**
 * Hasta SDD-0311 eso era un `continue` mudo: el recibo se creaba, la pantalla
 * decía que todo salió bien, y nadie se enteraba de que a ese cliente no se le
 * escribió. Es exactamente el hueco que SDD-0282 le cerró a la recepción en
 * China y que acá quedó abierto — en el lado que más importa, porque «llegó a
 * Yiwu» se puede esperar y «llegó a Venezuela» es la llamada que el cliente
 * hace al día siguiente.
 *
 * Ahora sale en `sinDestino` para que el llamador lo asiente y el operador de
 * oficina pueda escribirle a mano.
 *
 * Best-effort: nunca throwea. Un fallo acá no rompe la recepción del contenedor.
 */
export async function scheduleReceiptVeReceived(
  admin: SupabaseClient,
  tenantId: string,
  markboxes: Array<string | null | undefined>,
  eventTime: Date = new Date(),
): Promise<FanoutResultado> {
  const vacio: FanoutResultado = { scheduled: 0, sinDestino: [] };
  try {
    const marks = Array.from(
      new Set(
        markboxes
          .map((m) => (m ?? "").trim())
          .filter((m): m is string => m.length > 0),
      ),
    );
    if (marks.length === 0) return vacio;

    let scheduled = 0;
    const sinDestino: string[] = [];
    for (const markbox of marks) {
      // SDD-0511 · `deleted_at is null`: un envío eliminado más reciente que el
      // vivo se llevaba el aviso, y si era el único, el cliente no salía en
      // `sinDestino`. Cliente admin: la RLS no lo filtra.
      const { data: shipment } = await admin
        .from("shipments")
        .select("id, code, client_markbox, client_name")
        .eq("tenant_id", tenantId)
        .eq("client_markbox", markbox)
        .not("status", "in", "(delivered,cancelled)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<{
          id: string;
          code: string;
          client_markbox: string | null;
          client_name: string | null;
        }>();

      if (!shipment) {
        // El caso que antes se perdía. No se inventa un destino: mal-notificar
        // a otro cliente sería peor que no notificar.
        sinDestino.push(markbox);
        continue;
      }

      scheduled += await scheduleForTargets(
        admin,
        tenantId,
        "received_ve",
        [
          {
            shipmentId: shipment.id,
            shipmentCode: shipment.code,
            clientMarkbox: shipment.client_markbox,
            clientName: shipment.client_name,
          },
        ],
        eventTime,
      );
    }
    return { scheduled, sinDestino };
  } catch (err) {
    console.error(`[client-notif] scheduleReceiptVeReceived falló:`, err);
    return vacio;
  }
}

/**
 * Resultado de un fan-out que puede quedarse sin destino.
 *
 * SDD-0282: antes esto devolvía sólo un número y el salto era INVISIBLE. Un
 * `scheduled: 0` puede significar dos cosas opuestas —"no había nadie a quien
 * avisar" o "había un cliente esperando y no se le avisó"— y sin separarlas
 * nadie se entera nunca de la segunda.
 */
export interface FanoutResultado {
  /** Avisos efectivamente programados. */
  scheduled: number;
  /** Shipping Marks que NO se pudieron notificar por falta de envío abierto. */
  sinDestino: string[];
}

/**
 * Una recepción a notificar. La compra es opcional: la recepción manual de la
 * oficina puede no tener una detrás (mercancía que nadie pre-declaró).
 */
export interface RecepcionANotificar {
  markbox: string | null | undefined;
  /** La compra que materializa esta caja, si se conoce. */
  prealertaId?: string | null;
  prealertaCode?: string | null;
}

/**
 * SDD-0524 · por qué un cliente se quedó sin el aviso de llegada a bodega.
 * Cada motivo tiene su frase en la bitácora (`notaSinAvisoBodega`): la nota
 * vieja decía «no tiene un envío abierto» para todo, y con un envío abierto eso
 * era falso.
 */
export type MotivoSinAviso =
  /** Ni compra conocida ni envío abierto donde colgar el aviso. */
  | "sin_destino"
  /** Esa ancla ya tenía un aviso de llegada (índice único de la 0389). */
  | "ya_avisado"
  /** La regla está anclada a ETA/ETD, y una compra no tiene esa fecha. */
  | "regla_sin_fecha"
  /** El aviso no se pudo programar por un error. */
  | "fallo";

export interface SinAviso {
  markbox: string;
  motivo: MotivoSinAviso;
  /** El código de la compra o del envío en juego, si lo hubo. */
  ancla: string | null;
}

/** El resultado del fan-out de la recepción en Yiwu, con el porqué de cada olvido. */
export interface FanoutBodega extends FanoutResultado {
  /** Uno por Shipping Mark de `sinDestino`, en el mismo orden. */
  detalle: SinAviso[];
}

/**
 * El motivo, aunque quien armó el resultado no lo haya puesto (dobles de
 * prueba viejos). Sin motivo y sin nada programado se toma como fallo: ante la
 * duda, el cliente cuenta como sin aviso y se anota.
 */
function motivoDe(res: ScheduleResult): MotivoProgramacion {
  if (res.motivo) return res.motivo;
  return res.scheduled > 0 ? "programado" : "error";
}

/**
 * Lo que se hace con el resultado de UN intento de programar.
 *  - `listo`: o se programó, o el tenant no quiere el aviso (sin regla o regla
 *    apagada), que es una decisión y no un cliente olvidado.
 *  - `sin_aviso`: el cliente se queda sin aviso y hay que decirlo.
 *  - `seguir`: este intento no aplica (falta la 0389); probar el siguiente.
 */
type Desenlace =
  | { kind: "listo"; scheduled: number }
  | { kind: "sin_aviso"; motivo: MotivoSinAviso }
  | { kind: "seguir" };

function desenlace(res: ScheduleResult): Desenlace {
  switch (motivoDe(res)) {
    case "programado":
      return { kind: "listo", scheduled: res.scheduled };
    case "sin_regla":
    case "regla_apagada":
      return { kind: "listo", scheduled: 0 };
    case "duplicado":
      return { kind: "sin_aviso", motivo: "ya_avisado" };
    case "sin_fecha":
      return { kind: "sin_aviso", motivo: "regla_sin_fecha" };
    case "falta_migracion":
      return { kind: "seguir" };
    case "sin_markbox":
    case "error":
      return { kind: "sin_aviso", motivo: "fallo" };
  }
}

function programarEnBodega(
  admin: SupabaseClient,
  tenantId: string,
  markbox: string,
  ancla: AnclaDelAviso,
  clientName: string | null,
  eventTime: Date,
): Promise<ScheduleResult> {
  return scheduleClientNotifications(admin, tenantId, {
    ancla,
    clientMarkbox: markbox,
    clientName,
    event: "status:in_warehouse",
    eventTime,
  });
}

/**
 * Programa `status:in_warehouse` («Recibido en bodega China») para los Shipping
 * Mark recibidos en Yiwu (SDD-0162, puente 0154↔0156).
 *
 * **De qué cuelga el aviso, en orden (SDD-0524):**
 *
 *   1. **La compra, si el llamador la conoce.** Es la mercancía que acaba de
 *      llegar: la caja escaneada (`/m/cn/recibir`) o la recepción vinculada a
 *      su compra (Studio y `/m/cn/nueva`). El correo lleva a
 *      `/portal/compras/[code]`, donde el cliente ve esa llegada.
 *   2. **Si no, el envío abierto más reciente del Shipping Mark** (SDD-0162).
 *
 * Hasta SDD-0524 el orden era el inverso, y con un cliente recurrente eso
 * perdía el aviso: su envío abierto es el de una compra anterior, que ya tuvo
 * su `in_warehouse`; el índice único de la 0389 (`client_notif_sched_idem_
 * envio_uniq`) descartaba el aviso nuevo y nadie se enteraba. Y si salía, el
 * correo enlazaba a un envío que no era el de esta mercancía.
 *
 * **Un cliente sin aviso nunca es silencioso.** Sale en `sinDestino`, con su
 * motivo en `detalle`, para que el llamador lo deje en la bitácora de la
 * recepción (SDD-0282). Eso incluye el duplicado: la segunda recepción de la
 * misma compra, o una recepción sin compra cuyo envío ya tuvo su aviso. No se
 * «compensa» por la otra ancla: sería un segundo correo por la misma llegada.
 *
 * Si falta la migración 0389 (no se puede colgar de una compra), se cae al
 * envío como antes de ella.
 *
 * Best-effort: nunca throwea. Un fallo acá no rompe la recepción.
 */
export async function scheduleReceiptInWarehouse(
  admin: SupabaseClient,
  tenantId: string,
  recepciones: RecepcionANotificar[],
  eventTime: Date = new Date(),
): Promise<FanoutBodega> {
  // Dedup por Shipping Mark, quedándose con la primera entrada que traiga
  // compra: si el mismo cliente aparece dos veces y sólo una sabe de qué
  // compra viene, esa es la útil.
  const porMark = new Map<string, RecepcionANotificar>();
  for (const r of recepciones) {
    const mark = (r.markbox ?? "").trim();
    if (!mark) continue;
    const previo = porMark.get(mark);
    if (!previo || (!previo.prealertaId && r.prealertaId)) {
      porMark.set(mark, { ...r, markbox: mark });
    }
  }

  let scheduled = 0;
  const detalle: SinAviso[] = [];
  for (const [markbox, rec] of porMark) {
    // Un fallo inesperado con un cliente no calla a los demás, y tampoco a él:
    // queda como `fallo` en la bitácora.
    try {
      // ── 1 · La compra, si se conoce ──
      if (rec.prealertaId && rec.prealertaCode) {
        const d = desenlace(
          await programarEnBodega(
            admin,
            tenantId,
            markbox,
            { kind: "prealerta", prealertaId: rec.prealertaId, prealertaCode: rec.prealertaCode },
            null,
            eventTime,
          ),
        );
        if (d.kind === "listo") {
          scheduled += d.scheduled;
          continue;
        }
        if (d.kind === "sin_aviso") {
          detalle.push({ markbox, motivo: d.motivo, ancla: rec.prealertaCode });
          continue;
        }
        // `seguir`: falta la 0389 → el envío, como antes de ella.
      }

      // ── 2 · El envío abierto más reciente ──
      // SDD-0511 · `deleted_at is null`: un envío eliminado no recibe avisos.
      const { data: shipment, error: shipmentErr } = await admin
        .from("shipments")
        .select("id, code, client_markbox, client_name")
        .eq("tenant_id", tenantId)
        .eq("client_markbox", markbox)
        .not("status", "in", "(delivered,cancelled)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<{
          id: string;
          code: string;
          client_markbox: string | null;
          client_name: string | null;
        }>();

      if (shipmentErr) {
        // Sin saber si hay envío, no se afirma que no lo hay.
        detalle.push({ markbox, motivo: "fallo", ancla: null });
        continue;
      }
      if (!shipment) {
        // No se inventa un destino: mal-notificar a otro cliente sería peor.
        detalle.push({ markbox, motivo: "sin_destino", ancla: null });
        continue;
      }

      const d = desenlace(
        await programarEnBodega(
          admin,
          tenantId,
          shipment.client_markbox ?? markbox,
          { kind: "shipment", shipmentId: shipment.id, shipmentCode: shipment.code },
          shipment.client_name,
          eventTime,
        ),
      );
      if (d.kind === "listo") {
        scheduled += d.scheduled;
      } else {
        // `seguir` no ocurre con un envío (la 0389 sólo agrega la compra);
        // si ocurriera, sigue siendo un cliente sin aviso.
        detalle.push({
          markbox,
          motivo: d.kind === "sin_aviso" ? d.motivo : "fallo",
          ancla: shipment.code,
        });
      }
    } catch (err) {
      console.error(`[client-notif] scheduleReceiptInWarehouse falló con ${markbox}:`, err);
      detalle.push({ markbox, motivo: "fallo", ancla: null });
    }
  }
  return { scheduled, sinDestino: detalle.map((x) => x.markbox), detalle };
}

/**
 * La nota que queda en la bitácora de la recepción cuando un cliente se quedó
 * sin aviso. PURA — la escriben los dos caminos de recepción (el operario en
 * `/m/cn` y la oficina en `/studio/cn`), así que el texto vive en un solo lugar.
 *
 * Devuelve `null` si no hubo nadie sin avisar: así el llamador no escribe una
 * nota vacía en la bitácora.
 */
export function notaSinAviso(sinDestino: readonly string[]): string | null {
  if (sinDestino.length === 0) return null;
  const marks = sinDestino.join(", ");
  return (
    `Aviso al cliente NO enviado (${marks}): no tiene un envío abierto donde ` +
    `colgarlo. Se le avisa al consolidar. Si está esperando respuesta, ` +
    `escríbele.`
  );
}

/**
 * SDD-0524 · la nota de la bitácora de una recepción en Yiwu, con el PORQUÉ de
 * cada cliente que se quedó sin el aviso de llegada. PURA. La escriben los tres
 * caminos de recepción: el escaneo (`/m/cn/recibir`), la recepción manual del
 * móvil (`/m/cn/nueva`) y la de oficina (`/studio/cn`).
 *
 * `notaSinAviso` decía «no tiene un envío abierto» para todo, y desde que el
 * duplicado también se anota eso sería falso: el envío existe y ya tuvo su
 * aviso. Esa nota se conserva para el arribo a Venezuela, donde sí es cierta.
 *
 * Devuelve `null` si nadie se quedó sin aviso: así no se escribe una nota vacía.
 */
export function notaSinAvisoBodega(r: Pick<FanoutBodega, "detalle">): string | null {
  if (r.detalle.length === 0) return null;
  return r.detalle.map(fraseSinAviso).join(" ");
}

function fraseSinAviso(s: SinAviso): string {
  const quien = `Aviso al cliente NO enviado (${s.markbox})`;
  switch (s.motivo) {
    case "sin_destino":
      return (
        `${quien}: no tiene un envío abierto ni una compra vinculada donde ` +
        `colgarlo. Si está esperando respuesta, escríbele.`
      );
    case "ya_avisado":
      return (
        `${quien}: ya existía un aviso de llegada a bodega para ` +
        `${s.ancla ?? "esta mercancía"} y el sistema no lo repite. Si esta ` +
        `mercancía es otra, escríbele.`
      );
    case "regla_sin_fecha":
      return (
        `${quien}: la regla «Recibido en bodega China» está anclada a una fecha ` +
        `(ETA/ETD) que ${s.ancla ?? "esta recepción"} todavía no tiene. Revísala ` +
        `en Administración › Notificaciones. Si está esperando respuesta, ` +
        `escríbele.`
      );
    case "fallo":
      return (
        `${quien}: el aviso falló al programarse. Si está esperando respuesta, ` +
        `escríbele.`
      );
  }
}
