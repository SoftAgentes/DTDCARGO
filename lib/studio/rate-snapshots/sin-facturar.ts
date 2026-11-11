/**
 * «Embarques sin facturar» (SDD-0574, 4.5 del plan contable).
 *
 * Hasta la 4.2 el envío por cliente no existe: el contenedor `C-` mezcla
 * clientes. Por eso la unidad es la RECEPCIÓN en Yiwu (por cliente, con su CBM y
 * su tarifa congelada, SDD-0571), y la factura que la cubre se busca por su
 * envío y su Shipping Mark.
 *
 * Una recepción está FACTURADA si hay una factura viva del mismo envío y del
 * mismo Shipping Mark (comparado con `upper(btrim())`) en emitida, parcial,
 * pagada o vencida. Un borrador es la pre-factura informativa de la decisión 9:
 * no cuenta como facturada, pero se dice. Una anulada no cuenta.
 *
 * Los estados de lo que NO está facturado, de lo más urgente a lo menos:
 *   · `llego_sin_factura` — el envío llegó a Venezuela: la decisión 9 dice que
 *     la factura sale al llegar, con vencimiento inmediato. Es lo que hay que
 *     facturar ya.
 *   · `sin_tarifa`        — no tiene tarifa congelada: no se puede facturar bien.
 *   · `en_camino`         — tiene tarifa y todavía no llegó: es lo esperado.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllByIds, fetchAllPaged } from "@/lib/db/paginate";
import { listLiveRatesForReceipts } from "./queries";
import { clave } from "./propuesta";

export type EstadoSinFacturar = "llego_sin_factura" | "sin_tarifa" | "en_camino";

export const ESTADOS_SIN_FACTURAR: readonly EstadoSinFacturar[] = [
  "llego_sin_factura",
  "sin_tarifa",
  "en_camino",
];

export const ESTADO_SIN_FACTURAR_LABEL: Record<EstadoSinFacturar, string> = {
  llego_sin_factura: "Llegó sin factura",
  sin_tarifa: "Sin tarifa",
  en_camino: "En camino, con tarifa",
};

/** Estados de factura que cuentan como facturado (los mismos de SDD-0557/0558). */
export const ESTADOS_FACTURADA = ["emitida", "parcial", "pagada", "vencida"] as const;

/** Estados del envío que ya están en Venezuela o más allá. */
export const ESTADOS_LLEGADO = ["arrived_destination", "out_for_delivery", "last_mile", "delivered"] as const;

export type RecepcionReporte = {
  id: string;
  receipt_code: string;
  client_markbox: string | null;
  received_at: string;
  status: string;
  total_cbm: number | null;
  shipment_id: string | null;
};

export type EnvioReporte = {
  id: string;
  code: string;
  status: string;
  arrived_destination_at: string | null;
};

export type FacturaReporte = {
  id: string;
  invoice_code: string | null;
  shipment_id: string | null;
  client_markbox: string | null;
  status: string;
};

export type TarifaReporte = {
  amount_to_invoice: number;
  per_cbm: number;
  cbm: number;
  min_charge: number;
};

/** Decimal no negativo con dos decimales, sin agrupación ni exponente. */
export type ImporteUsdExacto = string;

export type TotalesSinFacturar = {
  /** Recepciones elegibles observadas, no facturas. */
  cantidad: number;
  subtotalConocido: ImporteUsdExacto;
  /** Recepciones observadas sin tarifa disponible, incluidas las llegadas. */
  sinTarifa: number;
  /** Solo es total si no falta tarifa y la lectura está completa. */
  aFacturar: ImporteUsdExacto | null;
};

export type FilaSinFacturar = {
  receiptId: string;
  receiptCode: string;
  markbox: string;
  receivedAt: string;
  /** Volumen actual de la recepción; no determina el importe congelado. */
  cbm: number | null;
  cbmCongelado: number | null;
  minimo: number | null;
  shipmentCode: string | null;
  shipmentStatus: string | null;
  estado: EstadoSinFacturar;
  /** Monto a facturar de la tarifa congelada; null si no tiene. */
  aFacturar: number | null;
  perCbm: number | null;
  /** Código de la pre-factura (borrador), si la hay. */
  preFactura: string | null;
  /** Días desde la llegada (si llegó) o desde la recepción. */
  dias: number;
};

export type ResumenSinFacturar = Record<EstadoSinFacturar, TotalesSinFacturar>;

export type ReporteSinFacturar = {
  filas: FilaSinFacturar[];
  resumen: ResumenSinFacturar;
  total: TotalesSinFacturar;
  /** false = alguna lectura se cortó en el tope de páginas: los números no son todo. */
  completo: boolean;
  /** false = la 0496 no está aplicada: no se sabe qué tiene tarifa. */
  tarifasDisponibles: boolean;
};

const DIA_MS = 24 * 60 * 60 * 1000;

type Acumulado = { cantidad: number; centavos: bigint; sinTarifa: number };

/**
 * La fuente es numeric(14,2) de 0496. Cada fila cabe por debajo de 10^12:
 * la separación entre Number representables es menor que un centavo y sus
 * dos decimales se recuperan sin ambigüedad. La suma sí puede exceder ese
 * límite: desde aquí solo se acumulan enteros BigInt, nunca Number.
 */
function centavosSnapshot(importe: number): bigint {
  if (typeof importe !== "number" || !Number.isFinite(importe) || importe < 0 || importe > 999_999_999_999.99) {
    throw new Error("El importe congelado no cumple el formato monetario de la lectura.");
  }
  const decimal = importe.toFixed(2);
  if (Number(decimal) !== importe) {
    throw new Error("El importe congelado no cumple el formato monetario de la lectura.");
  }
  return BigInt(decimal.replace(".", ""));
}

function proyectarTotal(acumulado: Acumulado, lecturaCompleta: boolean): TotalesSinFacturar {
  const subtotalConocido = `${acumulado.centavos / 100n}.${(acumulado.centavos % 100n).toString().padStart(2, "0")}`;
  return {
    cantidad: acumulado.cantidad,
    subtotalConocido,
    sinTarifa: acumulado.sinTarifa,
    aFacturar: lecturaCompleta && acumulado.sinTarifa === 0 ? subtotalConocido : null,
  };
}

function llego(envio: EnvioReporte | undefined): boolean {
  if (!envio) return false;
  return envio.arrived_destination_at != null || (ESTADOS_LLEGADO as readonly string[]).includes(envio.status);
}

/**
 * Regla pura: de las recepciones, sus envíos, sus facturas y sus tarifas, las
 * filas que NO están facturadas, ordenadas por urgencia y antigüedad, y el
 * resumen por estado. `hoy` entra para que la prueba no dependa del reloj.
 */
export function clasificarSinFacturar(input: {
  recepciones: RecepcionReporte[];
  envios: EnvioReporte[];
  facturas: FacturaReporte[];
  tarifas: Record<string, TarifaReporte>;
  hoy: Date;
  lecturaCompleta?: boolean;
}): { filas: FilaSinFacturar[]; resumen: ResumenSinFacturar; total: TotalesSinFacturar } {
  const envios = new Map(input.envios.map((e) => [e.id, e]));
  // Por (envío, Shipping Mark): la factura fiscal viva o, si no, la pre-factura.
  const facturada = new Set<string>();
  const preFactura = new Map<string, string>();
  for (const f of input.facturas) {
    if (!f.shipment_id) continue;
    const k = `${f.shipment_id}|${clave(f.client_markbox)}`;
    if ((ESTADOS_FACTURADA as readonly string[]).includes(f.status)) facturada.add(k);
    else if (f.status === "borrador" && !preFactura.has(k)) preFactura.set(k, f.invoice_code ?? "borrador");
  }

  const filas: FilaSinFacturar[] = [];
  const porEstado = Object.fromEntries(
    ESTADOS_SIN_FACTURAR.map((e) => [e, { cantidad: 0, centavos: 0n, sinTarifa: 0 }]),
  ) as Record<EstadoSinFacturar, Acumulado>;
  const global: Acumulado = { cantidad: 0, centavos: 0n, sinTarifa: 0 };
  for (const r of input.recepciones) {
    const markbox = clave(r.client_markbox);
    if (!markbox) continue;
    const envio = r.shipment_id ? envios.get(r.shipment_id) : undefined;
    if (envio?.status === "cancelled") continue;
    const k = r.shipment_id ? `${r.shipment_id}|${markbox}` : null;
    if (k && facturada.has(k)) continue;

    const tarifa = input.tarifas[r.id];
    const llegada = llego(envio);
    const estado: EstadoSinFacturar = llegada ? "llego_sin_factura" : tarifa ? "en_camino" : "sin_tarifa";
    const desde = llegada && envio?.arrived_destination_at ? envio.arrived_destination_at : r.received_at;
    const dias = Math.max(0, Math.floor((input.hoy.getTime() - new Date(desde).getTime()) / DIA_MS));

    // Un snapshot inválido es un error de lectura, no una tarifa ausente.
    const centavos = tarifa ? centavosSnapshot(tarifa.amount_to_invoice) : null;
    for (const acumulado of [porEstado[estado], global]) {
      acumulado.cantidad += 1;
      if (centavos === null) acumulado.sinTarifa += 1;
      else acumulado.centavos += centavos;
    }

    filas.push({
      receiptId: r.id,
      receiptCode: r.receipt_code,
      markbox,
      receivedAt: r.received_at,
      cbm: r.total_cbm == null ? null : Number(r.total_cbm),
      cbmCongelado: tarifa ? tarifa.cbm : null,
      minimo: tarifa ? tarifa.min_charge : null,
      shipmentCode: envio?.code ?? null,
      shipmentStatus: envio?.status ?? null,
      estado,
      aFacturar: tarifa ? tarifa.amount_to_invoice : null,
      perCbm: tarifa ? Number(tarifa.per_cbm) : null,
      preFactura: k ? (preFactura.get(k) ?? null) : null,
      dias,
    });
  }

  const orden = new Map(ESTADOS_SIN_FACTURAR.map((e, i) => [e, i]));
  filas.sort((a, b) => (orden.get(a.estado)! - orden.get(b.estado)!) || b.dias - a.dias || a.receiptCode.localeCompare(b.receiptCode));

  const lecturaCompleta = input.lecturaCompleta ?? true;
  const resumen = Object.fromEntries(
    ESTADOS_SIN_FACTURAR.map((e) => [e, proyectarTotal(porEstado[e], lecturaCompleta)]),
  ) as ResumenSinFacturar;
  return { filas, resumen, total: proyectarTotal(global, lecturaCompleta) };
}

/**
 * Lee lo que el reporte necesita, con el cliente de SESIÓN bajo RLS:
 *   · recepciones vivas, no huérfanas;
 *   · sus envíos (código, estado, llegada);
 *   · sus tarifas congeladas vivas (SDD-0571);
 *   · las facturas vivas de esos envíos — `invoices_accounting_select` (0414)
 *     deja leer a accounting y admin, que son quienes ven Reportes y Dirección.
 * Solo lectura. Las lecturas paginan y dicen si se cortaron.
 */
export async function reporteSinFacturar(
  supabase: SupabaseClient,
  hoy: Date = new Date(),
): Promise<ReporteSinFacturar> {
  const recepciones = await fetchAllPaged<RecepcionReporte>((from, to) =>
    supabase
      .from("warehouse_receipts_cn")
      .select("id, receipt_code, client_markbox, received_at, status, total_cbm, shipment_id")
      .is("deleted_at", null)
      .eq("is_orphan", false)
      .order("received_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  );

  const envioIds = Array.from(
    new Set(recepciones.rows.map((r) => r.shipment_id).filter((x): x is string => !!x)),
  );
  const envios = await fetchAllByIds<EnvioReporte>(envioIds, (lote, from, to) =>
    supabase
      .from("shipments")
      .select("id, code, status, arrived_destination_at")
      .in("id", lote)
      .order("id", { ascending: true })
      .range(from, to),
  );
  // SDD-0574 · lector de `invoices` justificado en el BASELINE de
  // scripts/__tests__/invoice-read-boundary.test.mjs.
  const facturas = await fetchAllByIds<FacturaReporte>(envioIds, (lote, from, to) =>
    supabase
      .from("invoices")
      .select("id, invoice_code, shipment_id, client_markbox, status")
      .in("shipment_id", lote)
      .is("deleted_at", null)
      .order("id", { ascending: true })
      .range(from, to),
  );

  const vivas = await listLiveRatesForReceipts(
    supabase,
    recepciones.rows.map((r) => r.id),
  );
  const tarifas: Record<string, TarifaReporte> = {};
  if (vivas.disponible) {
    for (const [id, s] of Object.entries(vivas.porRecepcion)) {
      tarifas[id] = {
        amount_to_invoice: s.amount_to_invoice,
        per_cbm: s.per_cbm,
        cbm: s.cbm,
        min_charge: s.min_charge,
      };
    }
  }

  const completo = recepciones.complete && envios.complete && facturas.complete;
  const { filas, resumen, total } = clasificarSinFacturar({
    recepciones: recepciones.rows,
    envios: envios.rows,
    facturas: facturas.rows,
    tarifas,
    hoy,
    lecturaCompleta: completo,
  });
  return {
    filas,
    resumen,
    total,
    completo,
    tarifasDisponibles: vivas.disponible,
  };
}
