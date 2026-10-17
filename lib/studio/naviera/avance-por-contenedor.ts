/**
 * SDD-0530 · Al zarpar o arribar un contenedor en Naviera, sus envíos avanzan y
 * a sus clientes se les avisa.
 *
 * Antes, marcar «zarpado» sólo cambiaba `consolidations.status`: cada envío del
 * contenedor había que avanzarlo a mano en Tracking, uno por uno, y el aviso
 * `status:shipped` salía sólo si alguien se acordaba. Ahora el cambio del
 * contenedor y el de sus envíos son UNA transacción en la base
 * (`advance_consolidation_governed`, migración 0477), con su evento en
 * `shipment_events` y su auditoría AUD-01; después se programan los avisos por
 * el mismo camino que usa Tracking.
 *
 * Qué pasa con cada envío lo decide `decidirAvance`, y la base decide LO MISMO
 * con `naviera_avance_decision` (0477). La prueba
 * `lib/studio/__tests__/naviera-zarpe-avanza-envios.migration.test.ts` compara
 * las dos para cada servicio × estado × destino: si cambia la máquina de estados
 * (`shipment-state-machine.ts`) o el flujo canónico (`tracking-progress.ts`),
 * la prueba se pone roja y hace falta una migración hermana.
 *
 * Este módulo es PURO (lo usa también la pantalla): la RPC y los avisos viven
 * en `avance-por-contenedor-queries.ts`.
 */
import { isValidStatusForService } from "@/lib/studio/shipment-state-machine";
import { STATUS_FLOW_ORDER } from "@/lib/studio/tracking-progress";
import {
  SHIPMENT_SERVICES,
  STATUS_LABELS,
  type ShipmentService,
  type ShipmentStatus,
} from "@/lib/studio/shipment-types";

/** Los dos cambios del contenedor que arrastran a sus envíos. */
export type AvanceContenedor = "zarpado" | "arribado";

export const AVANCES_CONTENEDOR: readonly AvanceContenedor[] = ["zarpado", "arribado"];

export function esAvanceContenedor(status: string): status is AvanceContenedor {
  return (AVANCES_CONTENEDOR as readonly string[]).includes(status);
}

/**
 * Desde qué estado del contenedor se hace cada avance y a qué estado pasan sus
 * envíos.
 *
 * - **Zarpe → `shipped`** («Embarcado»): el evento `status:shipped` dice «Zarpó
 *   de China» (`client-notification-types.ts`).
 * - **Arribo → `in_customs`** («En aduana»). No `arrived_destination`: ese es
 *   «En bodega VE», y al arribar el contenedor al país todavía faltan el puerto
 *   y el traslado (SDD-0311 §4). `in_customs` es el paso siguiente del flujo en
 *   los cuatro servicios marítimos, y es desde donde trabaja Almacén VE
 *   (`markCustomsReleasedAction`: `in_customs → arrived_destination`).
 */
export const AVANCE: Record<
  AvanceContenedor,
  { desde: "cerrado" | "zarpado"; destino: ShipmentStatus }
> = {
  zarpado: { desde: "cerrado", destino: "shipped" },
  arribado: { desde: "zarpado", destino: "in_customs" },
};

/** Por qué un envío del contenedor no avanzó. */
export type MotivoSalto =
  | "eliminado"
  | "entregado"
  | "cancelado"
  | "excepcion"
  | "servicio_sin_estado"
  | "ya_en_estado"
  | "mas_avanzado"
  | "estado_desconocido";

export const MOTIVOS_SALTO: readonly MotivoSalto[] = [
  "eliminado",
  "entregado",
  "cancelado",
  "excepcion",
  "servicio_sin_estado",
  "ya_en_estado",
  "mas_avanzado",
  "estado_desconocido",
];

/** Texto para el resumen de la pantalla. Tuteo, sin voseo. */
export const MOTIVO_SALTO_TEXTO: Record<MotivoSalto, string> = {
  eliminado: "El envío está eliminado",
  entregado: "Ya está entregado",
  cancelado: "Está cancelado",
  excepcion: "Está en excepción: resuélvela en Tracking",
  servicio_sin_estado: "Su servicio no pasa por ese estado",
  ya_en_estado: "Ya estaba en ese estado",
  mas_avanzado: "Ya va más adelante en su recorrido",
  estado_desconocido: "Tiene un estado que no se reconoce",
};

/**
 * Posición de cada estado en el recorrido. `draft` va antes del flujo canónico
 * y `delayed_warehouse` está al mismo nivel que `arrived_destination`, como
 * dice `tracking-progress.ts`. `exception` y `cancelled` no tienen posición: se
 * resuelven antes.
 */
const POSICION: ReadonlyMap<string, number> = (() => {
  const m = new Map<string, number>([["draft", 0]]);
  STATUS_FLOW_ORDER.forEach((s, i) => m.set(s, i + 1));
  const bodegaVe = m.get("arrived_destination");
  if (bodegaVe !== undefined) m.set("delayed_warehouse", bodegaVe);
  return m;
})();

/**
 * ¿Avanza este envío al `destino`? PURA. La base aplica la misma regla en
 * `naviera_avance_decision` (0477).
 *
 * Orden de las reglas:
 * 1. Cancelado, entregado y en excepción no se tocan nunca.
 * 2. Si el servicio no tiene el estado destino (el terrestre no zarpa ni pasa
 *    por aduana), no se toca.
 * 3. Si ya está en el destino, no se toca (y no se le vuelve a avisar).
 * 4. Si ya va más adelante, no retrocede.
 * 5. Si no, avanza: `draft`, `in_warehouse` y `consolidating` pasan a
 *    `shipped`; además `shipped` e `in_transit` pasan a `in_customs`.
 */
export function decidirAvance(
  service: string,
  status: string,
  destino: ShipmentStatus,
): "avanza" | MotivoSalto {
  if (status === "cancelled") return "cancelado";
  if (status === "delivered") return "entregado";
  if (status === "exception") return "excepcion";
  if (
    !(SHIPMENT_SERVICES as readonly string[]).includes(service) ||
    !isValidStatusForService(service as ShipmentService, destino)
  ) {
    return "servicio_sin_estado";
  }
  if (status === destino) return "ya_en_estado";
  const actual = POSICION.get(status);
  const meta = POSICION.get(destino);
  if (actual === undefined || meta === undefined) return "estado_desconocido";
  if (actual > meta) return "mas_avanzado";
  return "avanza";
}

// ── Resultado de la RPC ─────────────────────────────────────────

export interface EnvioAvanzado {
  shipmentId: string;
  code: string;
  from: string;
  clientMarkbox: string | null;
  clientName: string | null;
}

export interface EnvioSaltado {
  shipmentId: string;
  code: string;
  status: string;
  clientMarkbox: string | null;
  motivo: MotivoSalto;
}

export interface ResultadoAvance {
  /** `already`: el contenedor ya estaba en ese estado y no se tocó nada. */
  outcome: "transitioned" | "already";
  tenantId: string;
  consolidationRef: string | null;
  to: AvanceContenedor;
  destino: ShipmentStatus;
  avanzados: EnvioAvanzado[];
  saltados: EnvioSaltado[];
  /** Piezas del contenedor cargadas a mano, sin envío: no hay a quién avanzar. */
  piezasSinEnvio: number;
}

function texto(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

/**
 * Lee el jsonb de `advance_consolidation_governed`. Devuelve `null` si no tiene
 * la forma esperada: la acción lo trata como error y no programa avisos sobre
 * un resultado que no entiende.
 */
export function leerResultadoAvance(data: unknown): ResultadoAvance | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const outcome = d.outcome;
  const to = d.to;
  const destino = d.shipment_status;
  const tenantId = texto(d.tenant_id);
  if (outcome !== "transitioned" && outcome !== "already") return null;
  if (typeof to !== "string" || !esAvanceContenedor(to)) return null;
  if (destino !== AVANCE[to].destino || !tenantId) return null;
  if (!Array.isArray(d.advanced) || !Array.isArray(d.skipped)) return null;

  const avanzados: EnvioAvanzado[] = [];
  for (const raw of d.advanced) {
    const a = (raw ?? {}) as Record<string, unknown>;
    const shipmentId = texto(a.shipment_id);
    const code = texto(a.code);
    const from = texto(a.from);
    if (!shipmentId || !code || !from) return null;
    avanzados.push({
      shipmentId,
      code,
      from,
      clientMarkbox: texto(a.client_markbox),
      clientName: texto(a.client_name),
    });
  }

  const saltados: EnvioSaltado[] = [];
  for (const raw of d.skipped) {
    const s = (raw ?? {}) as Record<string, unknown>;
    const shipmentId = texto(s.shipment_id);
    const code = texto(s.code);
    const status = texto(s.status);
    const motivo = s.reason;
    if (!shipmentId || !code || !status) return null;
    if (typeof motivo !== "string" || !(MOTIVOS_SALTO as readonly string[]).includes(motivo)) {
      return null;
    }
    saltados.push({
      shipmentId,
      code,
      status,
      clientMarkbox: texto(s.client_markbox),
      motivo: motivo as MotivoSalto,
    });
  }

  const piezas = Number(d.pieces_without_shipment ?? 0);
  return {
    outcome,
    tenantId,
    consolidationRef: texto(d.consolidation_ref),
    to,
    destino: AVANCE[to].destino,
    avanzados,
    saltados,
    piezasSinEnvio: Number.isInteger(piezas) && piezas > 0 ? piezas : 0,
  };
}

/** Mensaje para la pantalla según el código de Postgres. Si la RPC falla, nada cambió. */
export function mensajeErrorAvance(code: string): string {
  if (code === "42501") return "No tienes permiso para cambiar el estado de este contenedor.";
  if (code === "40001") {
    return "El contenedor cambió de estado mientras tanto. Actualiza la página y vuelve a intentarlo.";
  }
  if (code === "P0002") return "El contenedor ya no está disponible.";
  if (code === "22023") return "Ese cambio de estado no se puede hacer desde aquí.";
  return "No se pudo cambiar el estado del contenedor. No cambió nada; vuelve a intentarlo.";
}

// ── Resumen para la pantalla ─────────────────────────────────────

/** Lo que la acción le devuelve a la pantalla: códigos y Shipping Mark, sin nombres. */
export interface ResumenAvanceContenedor {
  outcome: "transitioned" | "already";
  to: AvanceContenedor;
  destino: ShipmentStatus;
  destinoTexto: string;
  consolidationRef: string | null;
  avanzados: Array<{ code: string; clientMarkbox: string | null }>;
  saltados: Array<{ code: string; clientMarkbox: string | null; motivo: MotivoSalto; motivoTexto: string }>;
  piezasSinEnvio: number;
  /** Avisos `status:<destino>` que quedaron en la agenda. */
  avisosProgramados: number;
  /** Al arribar: avisos `received_ve` («Tu carga llegó a Venezuela») en la agenda. */
  avisosLlegada?: number;
}

export function resumirAvance(
  resultado: ResultadoAvance,
  avisosProgramados: number,
  avisosLlegada?: number,
): ResumenAvanceContenedor {
  return {
    ...(avisosLlegada === undefined ? {} : { avisosLlegada }),
    outcome: resultado.outcome,
    to: resultado.to,
    destino: resultado.destino,
    destinoTexto: STATUS_LABELS[resultado.destino],
    consolidationRef: resultado.consolidationRef,
    avanzados: resultado.avanzados.map((a) => ({ code: a.code, clientMarkbox: a.clientMarkbox })),
    saltados: resultado.saltados.map((s) => ({
      code: s.code,
      clientMarkbox: s.clientMarkbox,
      motivo: s.motivo,
      motivoTexto: MOTIVO_SALTO_TEXTO[s.motivo],
    })),
    piezasSinEnvio: resultado.piezasSinEnvio,
    avisosProgramados,
  };
}

/** Una línea para el toast. */
export function lineaResumenAvance(r: ResumenAvanceContenedor): string {
  const verbo = r.to === "zarpado" ? "zarpado" : "arribado";
  if (r.outcome === "already") {
    return `El contenedor ya estaba ${verbo}: no se tocó ningún envío`;
  }
  const n = r.avanzados.length;
  const envios =
    n === 0
      ? "ningún envío cambió"
      : n === 1
        ? `1 envío pasó a ${r.destinoTexto}`
        : `${n} envíos pasaron a ${r.destinoTexto}`;
  const saltados = r.saltados.length > 0 ? ` · ${r.saltados.length} sin cambio` : "";
  return `Contenedor ${verbo} · ${envios}${saltados}`;
}
