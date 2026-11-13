/**
 * Avisos al cliente por hito del seguimiento estimado (SDD-0627).
 *
 * «Cuando salga el envío, estimamos los tiempos y sobre eso le vamos avisando
 * al cliente» (Sam, 2026-11-13). Dos ganchos, los dos APAGADOS detrás de
 * `AVISOS_POR_HITO_LIVE`:
 *
 * 1. Al zarpar el contenedor (Naviera → «zarpado», RPC de la 0477), un aviso
 *    `carga_en_camino` por cliente y contenedor, anclado al primer envío del
 *    cliente en ese contenedor (decisión de la SDD-0543: «un aviso por
 *    cliente, no por envío»).
 * 2. Las reglas ancladas en `eta` (por ejemplo «va llegando», tres días antes)
 *    usan la ETA estimada desde el zarpe cuando no hay ninguna fuente mejor
 *    (`resolveShipmentEta`, cuarta fuente).
 *
 * Con la bandera en false ninguno de los dos lee ni escribe nada. El ensayo en
 * seco (`ensayarAvisosCargaEnCamino`) funciona con la bandera apagada: lee y
 * CUENTA destinatarios, sin insertar en la agenda ni enviar. Devuelve sólo
 * números: ningún Shipping Mark, nombre ni correo sale del ensayo.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { scheduleClientNotifications } from "./schedule-client-notifications";

/**
 * 🔴 Cambia lo que recibe el cliente. En false (estado de entrega) no sale
 * ningún aviso por hito. Encenderla es decisión de Sam, con el ensayo en seco
 * corrido antes sobre el contenedor real. Declarada en
 * scripts/feature-constants.json.
 */
export const AVISOS_POR_HITO_LIVE = false;

export const EVENTO_CARGA_EN_CAMINO = "carga_en_camino";

/** Un envío vivo del contenedor, con lo mínimo para decidir el destinatario. */
export type EnvioDelContenedor = {
  shipmentId: string;
  shipmentCode: string;
  clientMarkbox: string | null;
  clientName: string | null;
};

/** Un aviso por cliente: anclado al primer envío (por código) del cliente. */
export type DestinatarioHito = {
  clientMarkbox: string;
  clientName: string | null;
  ancla: { shipmentId: string; shipmentCode: string };
  envios: number;
};

export type PlanAvisosHito = {
  destinatarios: DestinatarioHito[];
  /** Envíos sin Shipping Mark: no hay a quién avisar. */
  sinMarkbox: number;
};

/**
 * Agrupa los envíos del contenedor por cliente. PURA. Un cliente con tres
 * envíos recibe un aviso, anclado al de código menor (estable entre corridas:
 * la idempotencia de la agenda es por envío + evento + regla).
 */
export function planAvisosCargaEnCamino(envios: EnvioDelContenedor[]): PlanAvisosHito {
  const porCliente = new Map<string, EnvioDelContenedor[]>();
  let sinMarkbox = 0;
  for (const e of envios) {
    const mark = e.clientMarkbox?.trim();
    if (!mark) {
      sinMarkbox++;
      continue;
    }
    const lista = porCliente.get(mark);
    if (lista) lista.push(e);
    else porCliente.set(mark, [e]);
  }
  const destinatarios: DestinatarioHito[] = [];
  for (const [mark, lista] of porCliente) {
    const orden = [...lista].sort((a, b) => a.shipmentCode.localeCompare(b.shipmentCode));
    destinatarios.push({
      clientMarkbox: mark,
      clientName: orden[0].clientName,
      ancla: { shipmentId: orden[0].shipmentId, shipmentCode: orden[0].shipmentCode },
      envios: lista.length,
    });
  }
  destinatarios.sort((a, b) => a.ancla.shipmentCode.localeCompare(b.ancla.shipmentCode));
  return { destinatarios, sinMarkbox };
}

/**
 * Envíos VIVOS del contenedor (`consolidation_items` → `shipments` sin
 * `deleted_at`, SDD-0511). null si no se pudo leer: sin saber cuáles siguen
 * vivos no se avisa ni se cuenta a ciegas.
 */
export async function leerEnviosDelContenedor(
  admin: SupabaseClient,
  tenantId: string,
  consolidationId: string,
): Promise<EnvioDelContenedor[] | null> {
  const { data: items, error: itemsErr } = await admin
    .from("consolidation_items")
    .select("shipment_id, client_markbox, client_name")
    .eq("tenant_id", tenantId)
    .eq("consolidation_id", consolidationId)
    .not("shipment_id", "is", null);
  if (itemsErr) return null;
  const filas = (items ?? []) as Array<{
    shipment_id: string;
    client_markbox: string | null;
    client_name: string | null;
  }>;
  if (filas.length === 0) return [];

  const { data: shipments, error: shipErr } = await admin
    .from("shipments")
    .select("id, code, client_markbox, client_name")
    .eq("tenant_id", tenantId)
    .in("id", [...new Set(filas.map((f) => f.shipment_id))])
    .is("deleted_at", null);
  if (shipErr) return null;
  const vivos = new Map(
    ((shipments ?? []) as Array<{
      id: string;
      code: string;
      client_markbox: string | null;
      client_name: string | null;
    }>).map((s) => [s.id, s]),
  );

  const vistos = new Set<string>();
  const envios: EnvioDelContenedor[] = [];
  for (const f of filas) {
    const s = vivos.get(f.shipment_id);
    if (!s || vistos.has(s.id)) continue;
    vistos.add(s.id);
    envios.push({
      shipmentId: s.id,
      shipmentCode: s.code,
      clientMarkbox: s.client_markbox ?? f.client_markbox,
      clientName: s.client_name ?? f.client_name,
    });
  }
  return envios;
}

/** Qué haría la regla del tenant con el aviso. */
export type EstadoRegla = "sin_regla" | "apagada" | "email" | "push" | "both" | "error";

export type EnsayoAvisosHito = {
  evento: typeof EVENTO_CARGA_EN_CAMINO;
  /** La bandera en este despliegue: el ensayo corre igual con false. */
  encendido: boolean;
  /** false = no se pudo leer el contenedor; los conteos valen 0. */
  leido: boolean;
  envios: number;
  destinatarios: number;
  sinMarkbox: number;
  /** Regla por defecto del tenant para `carga_en_camino`. */
  regla: EstadoRegla;
  /** Avisos que saldrían si se encendiera ahora: 0 si la regla no envía. */
  saldrian: number;
};

/**
 * ENSAYO EN SECO: cuenta a quién se avisaría al zarpar este contenedor. Sólo
 * lee; no inserta en `client_notification_schedule`, no llama al drain, no
 * envía. Devuelve sólo conteos.
 *
 * `saldrian` usa la regla por defecto del tenant; un override por cliente
 * (client_id) puede cambiar el canal de ese cliente y no se cuenta aparte.
 */
export async function ensayarAvisosCargaEnCamino(
  admin: SupabaseClient,
  tenantId: string,
  consolidationId: string,
): Promise<EnsayoAvisosHito> {
  const base: EnsayoAvisosHito = {
    evento: EVENTO_CARGA_EN_CAMINO,
    encendido: AVISOS_POR_HITO_LIVE,
    leido: false,
    envios: 0,
    destinatarios: 0,
    sinMarkbox: 0,
    regla: "error",
    saldrian: 0,
  };
  const envios = await leerEnviosDelContenedor(admin, tenantId, consolidationId).catch(
    () => null,
  );
  if (!envios) return base;
  const plan = planAvisosCargaEnCamino(envios);
  const regla = await leerReglaDelTenant(admin, tenantId);
  const envia = regla === "email" || regla === "push" || regla === "both";
  return {
    ...base,
    leido: true,
    envios: envios.length,
    destinatarios: plan.destinatarios.length,
    sinMarkbox: plan.sinMarkbox,
    regla,
    saldrian: envia ? plan.destinatarios.length : 0,
  };
}

async function leerReglaDelTenant(
  admin: SupabaseClient,
  tenantId: string,
): Promise<EstadoRegla> {
  try {
    const { data, error } = await admin
      .from("client_notification_rules")
      .select("channel")
      .eq("tenant_id", tenantId)
      .eq("trigger_event", EVENTO_CARGA_EN_CAMINO)
      .eq("active", true)
      .is("client_id", null)
      .limit(1)
      .maybeSingle<{ channel: string }>();
    if (error) return "error";
    if (!data) return "sin_regla";
    if (data.channel === "none") return "apagada";
    if (data.channel === "email" || data.channel === "push" || data.channel === "both") {
      return data.channel;
    }
    return "error";
  } catch {
    return "error";
  }
}

export type ResultadoAvisosHito = {
  /** true = la bandera está apagada y no se hizo nada (ni lectura). */
  apagado: boolean;
  programados: number;
  destinatarios: number;
};

/**
 * Al zarpar: programa `carga_en_camino` por cliente. Con la bandera apagada
 * vuelve enseguida sin tocar la base. Best-effort: nunca lanza; un fallo acá
 * no deshace el zarpe (que ya quedó en su transacción).
 */
export async function programarAvisosCargaEnCamino(
  admin: SupabaseClient,
  tenantId: string,
  consolidationId: string,
  live: boolean = AVISOS_POR_HITO_LIVE,
): Promise<ResultadoAvisosHito> {
  if (!live) return { apagado: true, programados: 0, destinatarios: 0 };
  try {
    const envios = await leerEnviosDelContenedor(admin, tenantId, consolidationId);
    if (!envios) return { apagado: false, programados: 0, destinatarios: 0 };
    const plan = planAvisosCargaEnCamino(envios);
    let programados = 0;
    for (const d of plan.destinatarios) {
      const r = await scheduleClientNotifications(admin, tenantId, {
        ancla: { kind: "shipment", ...d.ancla },
        clientMarkbox: d.clientMarkbox,
        clientName: d.clientName,
        event: EVENTO_CARGA_EN_CAMINO,
      });
      programados += r.scheduled;
    }
    return { apagado: false, programados, destinatarios: plan.destinatarios.length };
  } catch (err) {
    console.error("[client-notif] programarAvisosCargaEnCamino falló:", err);
    return { apagado: false, programados: 0, destinatarios: 0 };
  }
}
