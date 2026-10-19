/**
 * SDD-0557 · Subdiario contra mayor (puro, lado servidor).
 *
 * Compara el saldo abierto de los documentos con el saldo de su cuenta de
 * control, a hoy y con el mayor sin rango:
 *
 *  - Clientes: Σ (total − pagado), con signo, de las facturas emitidas,
 *    parciales, pagadas o vencidas (sin borradores ni anuladas) contra 1.1.2.
 *    Convierte con `invoiceUsdAmount`: VES sin tasa y CNY no suman.
 *    Regla «no comparable» de la SDD-0559 (E1): hoy la factura se asienta al
 *    NOMINAL (B2) y el recibo convierte, así que con una factura no borrador
 *    en VES o CNY CON su asiento `invoice` vivo, o un recibo vivo en esas
 *    monedas con su asiento `receipt` vivo, la diferencia no significa nada y
 *    no se muestra. Una VES o CNY sin asiento no cuenta: ya sale en
 *    «sin asiento» (decisión 7 del Director, 2026-10-19, revisable por Sam).
 *  - Proveedores: Σ (total − pagado) de las CxP no anuladas contra 2.1.1, con
 *    la MISMA regla del asiento (`billAmountUsd`: cualquier moneda con tasa se
 *    convierte, sin tasa va al nominal). Así una CxP en yuanes con tasa no
 *    fabrica una diferencia que el libro no tiene. Las CxP con saldo en otra
 *    moneda y SIN tasa se cuentan (`sinTasa`): suman su nominal, igual que su
 *    asiento, y entonces el saldo ya no está en USD; la pantalla y el CSV lo
 *    dicen.
 *  - El mayor vacío gana, en los dos lados (decisión 6 del Director,
 *    2026-10-19, revisable por Sam): si la cuenta de control no tiene debe ni
 *    haber y hay documentos con saldo, el estado es «sin movimiento en el
 *    mayor», sin diferencia y sin «no comparable»: esos documentos no tienen
 *    asiento. Es el caso real de hoy (5 facturas sin asiento, el mayor en 0).
 *
 * No reusa `receivablesQueue` ni `payablesQueue`: la primera incluye
 * borradores con saldo (que no se asientan por diseño) y las dos descartan
 * saldos negativos. Las dos cosas fabricarían diferencias.
 *
 * Vive aparte de `libro-control.ts` porque importa `bill-posting.ts`, que trae
 * el cliente admin: ese archivo no debe llegar al bundle del navegador.
 */

import { invoiceUsdAmount } from "@/lib/studio/fidelizacion/types";
import type { InvoiceCurrency } from "@/lib/studio/invoice-types";
import { billAmountUsd } from "./bill-posting";
import { ESTADOS_DE_INGRESO } from "./ingreso-periodo";
import {
  CUENTA_CLIENTES,
  CUENTA_PROVEEDORES,
  type EstadoCuadre,
  type LadoCuadre,
  type SubdiarioContraMayor,
} from "./libro-control";

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export type SaldoDocumento = {
  status: string;
  currency: string;
  fx_rate: number | string | null;
  total_amount: number | string | null;
  paid_amount: number | string | null;
};

/** Una factura del subdiario y si tiene su asiento `invoice` vivo (canónico, 0559). */
export type FacturaDelSubdiario = SaldoDocumento & { asientoVivo: boolean };

/** Saldo de la cuenta en el mayor, con sus movimientos para saber si los hay. */
export type SaldoDeCuenta = { saldo: number; debe: number; haber: number };

export type EntradaSubdiario = {
  fecha: string;
  /** Facturas no borradas y no borrador (ESTADOS_DE_INGRESO + anulada). */
  facturas: readonly FacturaDelSubdiario[];
  /** CxP no borradas (incluye anuladas: se descartan acá). */
  cxp: readonly SaldoDocumento[];
  /** Recibos vivos en VES o CNY que tienen asiento vivo (regla E1). */
  recibosNoUsdConAsiento: number;
  mayorClientes: SaldoDeCuenta | null;
  mayorProveedores: SaldoDeCuenta | null;
};

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const esDeIngreso = (s: string) => (ESTADOS_DE_INGRESO as readonly string[]).includes(s);

function convertibleCliente(currency: string, fx: unknown): boolean {
  if (currency === "USD" || currency === "USDT") return true;
  if (currency === "VES") return num(fx) > 0;
  return false;
}

/** Otra moneda sin tasa: `billAmountUsd` la deja en su nominal. */
function sinTasaProveedor(currency: string, fx: unknown): boolean {
  if (currency === "USD" || currency === "USDT") return false;
  return !(num(fx) > 0);
}

/**
 * El estado de un lado, en este orden: sin cuenta; el mayor vacío con
 * documentos abiertos (decisión 6: gana sobre «no comparable» y no da
 * diferencia); no comparable; 0 contra 0 sin movimiento; cuadra o no.
 * `abiertos` cuenta los documentos con saldo, también los que no suman.
 */
function estadoDe(
  subdiario: number,
  abiertos: number,
  mayor: SaldoDeCuenta | null,
  noComparable: boolean,
): { estado: EstadoCuadre; diferencia: number | null } {
  if (!mayor) return { estado: "sin_cuenta", diferencia: null };
  const sinMovimiento = mayor.debe === 0 && mayor.haber === 0;
  if (sinMovimiento && abiertos > 0) return { estado: "mayor_sin_movimiento", diferencia: null };
  if (noComparable) return { estado: "no_comparable", diferencia: null };
  const diferencia = round2(subdiario - mayor.saldo);
  // Sin movimiento y sin documentos abiertos: 0 contra 0, no una verificación.
  if (sinMovimiento) return { estado: "sin_movimiento", diferencia };
  return { estado: Math.abs(diferencia) < 0.005 ? "cuadra" : "no_cuadra", diferencia };
}

export function cuadreSubdiario(e: EntradaSubdiario): SubdiarioContraMayor {
  // Clientes.
  let subClientes = 0;
  let docsClientes = 0;
  let sinConvertir = 0;
  let enOtraMoneda = false;
  for (const f of e.facturas) {
    // Abiertas = emitidas, parciales, pagadas o vencidas: sin borradores (no
    // se asientan por diseño) ni anuladas.
    const abierta = esDeIngreso(f.status);
    // Solo con su asiento vivo mete el nominal en 1.1.2 (decisión 7).
    if (f.status !== "borrador" && f.asientoVivo && (f.currency === "VES" || f.currency === "CNY")) {
      enOtraMoneda = true;
    }
    if (!abierta) continue;
    const saldo = round2(num(f.total_amount) - num(f.paid_amount));
    if (saldo === 0) continue;
    if (!convertibleCliente(f.currency, f.fx_rate)) {
      sinConvertir += 1;
      continue;
    }
    docsClientes += 1;
    subClientes += invoiceUsdAmount({
      currency: f.currency as InvoiceCurrency,
      total_amount: saldo,
      fx_rate: f.fx_rate == null ? null : num(f.fx_rate),
    });
  }
  subClientes = round2(subClientes);
  const noComparable = enOtraMoneda || e.recibosNoUsdConAsiento > 0;
  const clientes = estadoDe(subClientes, docsClientes + sinConvertir, e.mayorClientes, noComparable);

  // Proveedores: la regla del asiento.
  let subProv = 0;
  let docsProv = 0;
  let sinTasa = 0;
  for (const b of e.cxp) {
    if (b.status === "anulada") continue;
    const saldo = round2(num(b.total_amount) - num(b.paid_amount));
    if (saldo === 0) continue;
    docsProv += 1;
    if (sinTasaProveedor(b.currency, b.fx_rate)) sinTasa += 1;
    subProv += billAmountUsd(saldo, b.currency, b.fx_rate == null ? null : num(b.fx_rate));
  }
  subProv = round2(subProv);
  // Sin «no comparable»: el lado de CxP convierte con la regla del asiento (G8).
  const proveedores = estadoDe(subProv, docsProv, e.mayorProveedores, false);

  const lado = (
    cuenta: string,
    nombre: string,
    sub: number,
    mayor: SaldoDeCuenta | null,
    r: { estado: EstadoCuadre; diferencia: number | null },
    documentos: number,
    sinConv: number,
    alNominal: number,
  ): LadoCuadre => ({
    cuenta,
    nombre,
    subdiarioUsd: sub,
    mayorUsd: mayor ? round2(mayor.saldo) : null,
    diferenciaUsd: r.diferencia,
    documentos,
    sinConvertir: sinConv,
    sinTasa: alNominal,
    estado: r.estado,
  });

  return {
    fecha: e.fecha,
    clientes: lado(CUENTA_CLIENTES, "Clientes", subClientes, e.mayorClientes, clientes, docsClientes, sinConvertir, 0),
    proveedores: lado(CUENTA_PROVEEDORES, "Proveedores", subProv, e.mayorProveedores, proveedores, docsProv, 0, sinTasa),
  };
}
