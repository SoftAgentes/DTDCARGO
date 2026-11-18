/**
 * SDD-0629 · El equivalente en bolívares, solo como vista.
 *
 * Decisión de Sam (2026-11-13): todo el sistema trabaja en dólares. El bolívar
 * es una vista: al lado de un monto en USD se puede ver cuánto sería en Bs y a
 * qué tasa (valor, fecha y fuente). No cambia nada contable: no hay columnas en
 * Bs, ni asientos, ni recibos en Bs.
 *
 * Reglas (falla cerrado, como `toUsd`):
 *  - solo aplica a montos en USD o USDT (USDT = USD 1:1). Un monto en VES ya
 *    está en Bs y uno en CNY no se encadena: «no-aplica»;
 *  - sin tasa, con una tasa inválida o con una tasa de un día POSTERIOR al
 *    pedido, «sin-tasa»: la pantalla dice «tasa no disponible», nunca un cero;
 *  - si la tasa es de un día anterior al pedido (`fx_rate_on` toma la última
 *    tasa anterior), se muestra igual pero con su fecha y un aviso.
 *
 * Es puro y sin dependencias del ERP: lo usan el Studio y el portal.
 */

import { fmtAmount } from "@/lib/money";
import { deUsdAMoneda, normalizarMoneda, tasaValida } from "./fx";

export type FuenteTasaReferencial = "bcv" | "manual" | "operacion";

/** La tasa VES por 1 USD que devolvió `fx_rate_on` (o null si no hay). */
export type TasaReferencial = {
  rate: number | string;
  source: FuenteTasaReferencial;
  /** AAAA-MM-DD: el día de valor de la tasa. */
  validOn: string;
};

export type EquivalenteBs =
  | { estado: "no-aplica" }
  | { estado: "sin-tasa"; fechaPedida: string }
  | {
      estado: "ok";
      bs: number;
      rate: number;
      source: FuenteTasaReferencial;
      validOn: string;
      fechaPedida: string;
      /** La tasa es de un día anterior al pedido. */
      anterior: boolean;
    };

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * El equivalente en Bs de `amount` (en `currency`) con la tasa `tasa`, pedida
 * para el día `fechaPedida` (AAAA-MM-DD).
 */
export function equivalenteEnBs(input: {
  amount: number | string | null | undefined;
  currency: string | null | undefined;
  tasa: TasaReferencial | null | undefined;
  fechaPedida: string;
}): EquivalenteBs {
  const moneda = normalizarMoneda(input.currency);
  if (moneda !== "USD" && moneda !== "USDT") return { estado: "no-aplica" };
  const amount = input.amount == null || input.amount === "" ? null : Number(input.amount);
  if (amount === null || !Number.isFinite(amount)) return { estado: "no-aplica" };
  const fechaPedida = input.fechaPedida.slice(0, 10);
  const tasa = input.tasa;
  const rate = tasa ? tasaValida(tasa.rate) : null;
  if (!tasa || rate === null || !FECHA.test(tasa.validOn ?? "") || tasa.validOn > fechaPedida) {
    return { estado: "sin-tasa", fechaPedida };
  }
  const bs = deUsdAMoneda(input.amount as number | string, tasa.rate);
  if (bs === null) return { estado: "sin-tasa", fechaPedida };
  return {
    estado: "ok",
    bs,
    rate,
    source: tasa.source,
    validOn: tasa.validOn,
    fechaPedida,
    anterior: tasa.validOn < fechaPedida,
  };
}

const FUENTE: Record<FuenteTasaReferencial, string> = {
  bcv: "BCV",
  manual: "manual",
  operacion: "de operación",
};

/** «BCV», «manual» o «de operación». */
export function etiquetaFuente(source: FuenteTasaReferencial): string {
  return FUENTE[source] ?? source;
}

/** `36.5000` — la tasa con 4 decimales, en el formato del ERP. */
export function fmtTasa(rate: number): string {
  return rate.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

/** El texto fijo que dice que el monto en Bs es referencial. */
export const LEYENDA_BS_REFERENCIAL =
  "Equivalente referencial en bolívares. La cuenta se lleva en USD: este monto no es una factura ni un saldo en Bs.";

export type TextoEquivalenteBs = {
  /** «≈ Bs 3,650.00» o «Bs: tasa no disponible». */
  monto: string;
  /** «Tasa BCV 36.5000 Bs/USD del 2026-11-13». */
  detalle: string;
  /** Solo si la tasa es de un día anterior al pedido, o si falta. */
  aviso: string | null;
};

/** Quién lee: el Studio puede cargar la tasa; el cliente del portal no. */
export type AudienciaBs = "studio" | "portal";

/** El texto de la vista. null cuando no aplica (el monto no es USD/USDT). */
export function textoEquivalenteBs(
  eq: EquivalenteBs,
  audiencia: AudienciaBs = "studio",
): TextoEquivalenteBs | null {
  if (eq.estado === "no-aplica") return null;
  if (eq.estado === "sin-tasa") {
    return {
      monto: "Bs: tasa no disponible",
      detalle: `No hay una tasa de bolívares para el ${eq.fechaPedida}.`,
      aviso:
        audiencia === "studio"
          ? "Cárgala en Admin › Tasas para ver el equivalente."
          : null,
    };
  }
  return {
    monto: `≈ Bs ${fmtAmount(eq.bs)}`,
    detalle: `Tasa ${etiquetaFuente(eq.source)} ${fmtTasa(eq.rate)} Bs/USD del ${eq.validOn}`,
    aviso: eq.anterior
      ? `No hay tasa del ${eq.fechaPedida}: es la última cargada, del ${eq.validOn}.`
      : null,
  };
}
