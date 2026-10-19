/**
 * SDD-0557 · La cifra oficial de ingreso del período — UNA sola regla.
 *
 * Antes había cuatro cifras de «ingreso» y cada pantalla calculaba la suya:
 * Contabilidad leía el mayor acumulado sin fecha, Dirección el mayor del mes,
 * Reportes el mayor del período elegido y el Dashboard el `total_amount` crudo
 * (con IVA y sin convertir moneda). Hoy el mayor está incompleto (B3): una cifra
 * sacada de él da 0 aunque haya facturas emitidas.
 *
 * La cifra oficial (gestión) es el **ingreso facturado del período**:
 *
 *   Σ base sin IVA, en USD, de las facturas no borradas en
 *   `emitida | parcial | pagada | vencida`, con `issued_at` en [desde, hasta]
 *   (los dos extremos entran).
 *
 * La conversión es la vigente (`invoiceUsdAmount`): USD y USDT 1:1, VES entre
 * la tasa de la factura. VES sin tasa y CNY NO suman: se cuentan aparte como
 * «sin convertir». El IVA es un pasivo (2.1.5), no ingreso.
 *
 * El mayor queda como CONTROL, contra las líneas de la cuenta 4.5 de los
 * asientos de FACTURA (`source = 'invoice'`, la que acredita el asiento de
 * cada factura), no contra todas las cuentas 4. Todo lo demás que el mayor
 * tiene en ingresos (el 4.6 del Socio China, los asientos manuales, también
 * los que van a la propia 4.5, y cualquier otro origen) son «otros ingresos
 * del mayor»: van aparte y no cuentan como diferencia.
 *
 * Estados del control (`describirIngreso`):
 *  - «no comparable» (regla E1 de la SDD-0559): con alguna factura no borrador
 *    del período en VES o CNY, convertida o no. Hoy esas facturas se asientan
 *    en 4.5 por el NOMINAL en bolívares o yuanes (B2), así que la diferencia
 *    no dice nada; vuelve con la tarea 2.3 del plan contable;
 *  - «sin movimiento»: sin facturas que sumen, sin facturas sin convertir y
 *    sin debe ni haber de asientos de factura en 4.5. Un 0 contra 0 no es una
 *    verificación;
 *  - «cuadra», «el mayor tiene menos», «el mayor tiene más», «sin cuenta 4.5».
 *
 * El desglose propio/terceros sale de `fund_class` (0122): la cifra INCLUYE
 * los fondos de terceros y cada pantalla lo dice. La decisión de si son
 * ingreso (B10) no se toma acá: el día que se tome se cambia un filtro, no la
 * tubería.
 *
 * Archivo PURO: sin Supabase. Lo usan el lector `ingresoDelPeriodo`
 * (Contabilidad, Reportes, Dirección) y el bundle del Dashboard.
 */

import { invoiceUsdAmount } from "@/lib/studio/fidelizacion/types";
import { isIsoDate } from "@/lib/studio/bitacora/dates";
import { fmtUsd } from "@/lib/money";
import type { AccountBalanceMap } from "@/lib/studio/account-queries";
import type { InvoiceCurrency } from "@/lib/studio/invoice-types";
import { profitAndLoss, type AccountLike } from "./reports";

/** Rango de fechas `YYYY-MM-DD`, los dos extremos inclusive. */
export type RangoFechas = { from: string; to: string };

/**
 * Estados que cuentan como ingreso: facturas emitidas en cualquier fase de
 * cobro. Igual que `SALE_STATUSES` del libro fiscal (anti-deriva en la prueba).
 */
export const ESTADOS_DE_INGRESO = ["emitida", "parcial", "pagada", "vencida"] as const;

/**
 * Cuenta que acredita el asiento de venta por la base (invoice-posting.ts,
 * `SALES_INCOME_CODE`). Se repite acá para no arrastrar el cliente admin de
 * ese módulo a las pantallas; la prueba exige que sean iguales.
 */
export const CUENTA_VENTAS = "4.5";

/** Lo mínimo que la regla necesita de una factura. */
export type FacturaDeIngreso = {
  status: string;
  issued_at: string | null;
  currency: string;
  fx_rate: number | string | null;
  base_amount: number | string | null;
  /** `local_revenue` = propio; cualquier otro valor = terceros (default de la 0122). */
  fund_class?: string | null;
  /** Viaja para que la regla vuelva a filtrar borradas aunque el lector traiga de más. */
  deleted_at?: string | null;
};

/** Lo que el mayor dice del mismo período. */
export type ControlDelMayor = {
  /**
   * Saldo de 4.5 (con sus subcuentas) en el rango, SOLO de los asientos de
   * factura (`source = 'invoice'`); null si el plan no tiene 4.5.
   */
  ventas: number | null;
  /** ¿Esas líneas de 4.5 tienen algún debe o haber en el rango? */
  ventasConMovimiento: boolean;
  /** Total de las cuentas de ingreso (raíz tipo I) en el rango, de cualquier origen. */
  ingresos: number;
};

export type IngresoPeriodo = {
  rango: RangoFechas;
  /** Facturado sin IVA en USD: propio (`local_revenue`), terceros y total. */
  facturado: { propio: number; terceros: number; total: number };
  /** Facturas que suman. */
  facturas: number;
  /** Facturas del período que NO suman: VES sin tasa o CNY. */
  sinConvertir: number;
  /**
   * Facturas no borrador del período (también las anuladas) en VES o CNY,
   * convertidas o no. Con alguna, el control es «no comparable» (E1, B2).
   */
  enOtraMoneda: number;
  /** Control del mayor; null cuando la pantalla no lo lee (Dashboard). */
  mayor: {
    ventas: number | null;
    ventasConMovimiento: boolean;
    ingresos: number;
    /** ingresos − ventas: 4.6, manuales (también a 4.5) y otros orígenes. */
    otrosIngresos: number;
  } | null;
  /**
   * facturado.total − mayor.ventas; null si no hay mayor, no hay cuenta 4.5 o
   * no es comparable (alguna factura del período en VES o CNY).
   */
  diferenciaUsd: number | null;
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Mes en curso hasta hoy: `{ YYYY-MM-01, hoy }`. `hoy` en UTC, como se graba. */
export function mesEnCurso(hoy: string): RangoFechas {
  return { from: `${hoy.slice(0, 7)}-01`, to: hoy };
}

export type FiltroDeRango = {
  /** Rango válido, o null si lo tecleado no sirve. */
  rango: RangoFechas | null;
  /** Mensaje para mostrar junto al formulario (DAT-01), o null. */
  error: string | null;
  /** Lo que se muestra en los campos: lo tecleado, nunca una corrección. */
  valores: { desde: string; hasta: string };
};

/**
 * Lee `?desde=&hasta=` (DAT-01). Sin ninguno de los dos, el mes en curso. Con
 * una fecha inválida, una sola fecha o el rango al revés, NO cae en silencio a
 * otro rango: devuelve el error y conserva lo tecleado.
 */
export function rangoDesdeParams(
  desde: string | undefined,
  hasta: string | undefined,
  hoy: string,
): FiltroDeRango {
  const d = (desde ?? "").trim();
  const h = (hasta ?? "").trim();
  if (!d && !h) {
    const rango = mesEnCurso(hoy);
    return { rango, error: null, valores: { desde: rango.from, hasta: rango.to } };
  }
  const valores = { desde: d, hasta: h };
  if (!d || !h) {
    return {
      rango: null,
      error: "Indica las dos fechas del período: desde y hasta.",
      valores,
    };
  }
  for (const f of [d, h]) {
    if (!isIsoDate(f)) {
      return {
        rango: null,
        error: `La fecha «${f}» no es válida. Usa el formato AAAA-MM-DD.`,
        valores,
      };
    }
  }
  if (d > h) {
    return {
      rango: null,
      error: `El rango está al revés: «desde» (${d}) es posterior a «hasta» (${h}).`,
      valores,
    };
  }
  return { rango: { from: d, to: h }, error: null, valores };
}

/**
 * Control del mayor sobre un rango.
 *  - `balances`: los saldos del rango con TODOS los orígenes → el total de
 *    ingresos del P&L.
 *  - `deFacturas`: los saldos del mismo rango con SOLO las líneas de los
 *    asientos de factura → el saldo de 4.5 (con rollup de subcuentas) y si
 *    tiene movimiento. Un manual a 4.5 no está acá: queda en «otros ingresos».
 */
export function controlDelMayor(
  accounts: AccountLike[],
  balances: AccountBalanceMap,
  deFacturas: AccountBalanceMap,
): ControlDelMayor {
  const cuenta = accounts.find((a) => a.code === CUENTA_VENTAS);
  const s = cuenta ? deFacturas[cuenta.id] : undefined;
  return {
    ventas: cuenta ? round2(s?.balance ?? 0) : null,
    ventasConMovimiento: !!s && (s.debit !== 0 || s.credit !== 0),
    ingresos: profitAndLoss(accounts, balances).income,
  };
}

function esDeIngreso(status: string): boolean {
  return (ESTADOS_DE_INGRESO as readonly string[]).includes(status);
}

/** ¿La regla vigente sabe pasar esta moneda a USD? */
function convertible(currency: string, fxRate: number | string | null): boolean {
  if (currency === "USD" || currency === "USDT") return true;
  if (currency === "VES") {
    const fx = Number(fxRate);
    return Number.isFinite(fx) && fx > 0;
  }
  return false;
}

/** VES o CNY: la factura se asienta hoy por el nominal en esa moneda (B2). */
function enOtraMonedaDelAsiento(currency: string): boolean {
  return currency === "VES" || currency === "CNY";
}

/**
 * LA regla. Vuelve a filtrar borradas, estado y fecha en memoria, así que da
 * lo mismo aunque el lector traiga de más. Cuenta además las facturas no
 * borrador del período en VES o CNY (también las anuladas, que pueden
 * conservar su asiento): con alguna, la comparación contra 4.5 no vale (E1).
 */
export function resumirIngreso(
  facturas: readonly FacturaDeIngreso[],
  rango: RangoFechas,
  mayor: ControlDelMayor | null,
): IngresoPeriodo {
  let propio = 0;
  let terceros = 0;
  let cuenta = 0;
  let sinConvertir = 0;
  let enOtraMoneda = 0;

  for (const f of facturas) {
    if (f.deleted_at != null) continue;
    if (!f.issued_at) continue;
    const dia = f.issued_at.slice(0, 10);
    if (dia < rango.from || dia > rango.to) continue;
    if (f.status !== "borrador" && enOtraMonedaDelAsiento(f.currency)) enOtraMoneda += 1;
    if (!esDeIngreso(f.status)) continue;
    if (!convertible(f.currency, f.fx_rate)) {
      sinConvertir += 1;
      continue;
    }
    const base = Number(f.base_amount);
    const usd = round2(
      invoiceUsdAmount({
        currency: f.currency as InvoiceCurrency,
        total_amount: Number.isFinite(base) ? base : 0,
        fx_rate: f.fx_rate == null ? null : Number(f.fx_rate),
      }),
    );
    cuenta += 1;
    if (f.fund_class === "local_revenue") propio += usd;
    else terceros += usd;
  }

  const total = round2(propio + terceros);
  const control = mayor
    ? {
        ventas: mayor.ventas,
        ventasConMovimiento: mayor.ventasConMovimiento,
        ingresos: round2(mayor.ingresos),
        otrosIngresos: round2(mayor.ingresos - (mayor.ventas ?? 0)),
      }
    : null;
  const comparable = enOtraMoneda === 0;

  return {
    rango,
    facturado: { propio: round2(propio), terceros: round2(terceros), total },
    facturas: cuenta,
    sinConvertir,
    enOtraMoneda,
    mayor: control,
    diferenciaUsd:
      control && control.ventas != null && comparable
        ? round2(total - control.ventas)
        : null,
  };
}

export type EstadoDelIngreso =
  | "cuadra"
  | "mayor_menor"
  | "mayor_mayor"
  | "no_comparable"
  | "sin_movimiento"
  | "sin_cuenta"
  | "sin_mayor";

/** Rótulo corto del estado del control (CSV, insignias). */
export const ETIQUETA_ESTADO_INGRESO: Record<EstadoDelIngreso, string> = {
  cuadra: "Cuadra",
  mayor_menor: "El mayor tiene menos",
  mayor_mayor: "El mayor tiene más",
  no_comparable: "No comparable",
  sin_movimiento: "Sin movimiento",
  sin_cuenta: "Sin cuenta 4.5",
  sin_mayor: "Sin mayor",
};

export type DescripcionIngreso = {
  estado: EstadoDelIngreso;
  /** Comparación con 4.5, o null sin mayor. */
  diferenciaTexto: string | null;
  /** «N factura(s) no suman…», o null. */
  avisoSinConvertir: string | null;
  /** «Incluye $X de fondos de terceros.», o null si no hay. */
  avisoTerceros: string | null;
  /** Otros ingresos del mayor (no salen del asiento de una factura), o null si no hay. */
  otrosIngresosTexto: string | null;
};

/**
 * Los textos del control que muestran Contabilidad › Reportes y Reportes ›
 * Estado de resultados (`IngresoDelPeriodoCard`), y el estado que usan
 * Dirección (`textosFinancieros`) y el CSV del P&L. El Dashboard no lee el
 * mayor: arma su subtítulo en `financeInvoiceKpis`.
 */
export function describirIngreso(i: IngresoPeriodo): DescripcionIngreso {
  let estado: EstadoDelIngreso = "sin_mayor";
  let diferenciaTexto: string | null = null;
  if (i.mayor) {
    if (i.mayor.ventas == null) {
      estado = "sin_cuenta";
      diferenciaTexto = `La cuenta ${CUENTA_VENTAS} no está en el plan de cuentas: no hay con qué comparar.`;
    } else if (i.enOtraMoneda > 0) {
      estado = "no_comparable";
      const n = i.enOtraMoneda;
      diferenciaTexto =
        `No comparable: ${n === 1 ? "1 factura del período está" : `${n} facturas del período están`}` +
        ` en bolívares o yuanes y hoy ${n === 1 ? "se asienta" : "se asientan"} en la cuenta ${CUENTA_VENTAS}` +
        " por su nominal en esa moneda, no en USD. La comparación vuelve con la tarea 2.3 del plan" +
        " contable (moneda funcional en el mayor).";
    } else if (i.facturas === 0 && i.sinConvertir === 0 && !i.mayor.ventasConMovimiento) {
      estado = "sin_movimiento";
      diferenciaTexto = `Sin movimiento: no hay facturas del período ni asientos de factura en la cuenta ${CUENTA_VENTAS}. No hay nada que comparar.`;
    } else {
      // Con 4.5 en el plan y comparable, `resumirIngreso` siempre la calcula.
      const dif = i.diferenciaUsd ?? 0;
      if (Math.abs(dif) < 0.005) {
        estado = "cuadra";
        diferenciaTexto = `Cuadra con el mayor (cuenta ${CUENTA_VENTAS}).`;
      } else if (dif > 0) {
        estado = "mayor_menor";
        diferenciaTexto = `El mayor (cuenta ${CUENTA_VENTAS}) tiene ${fmtUsd(dif)} menos que lo facturado.`;
      } else {
        estado = "mayor_mayor";
        diferenciaTexto = `El mayor (cuenta ${CUENTA_VENTAS}) tiene ${fmtUsd(-dif)} más que lo facturado.`;
      }
    }
  }

  const n = i.sinConvertir;
  const avisoSinConvertir =
    n === 0
      ? null
      : n === 1
        ? "1 factura no suma: está en bolívares sin tasa o en yuanes."
        : `${n} facturas no suman: están en bolívares sin tasa o en yuanes.`;

  const avisoTerceros =
    i.facturado.terceros > 0
      ? `Incluye ${fmtUsd(i.facturado.terceros)} de fondos de terceros.`
      : null;

  const otrosIngresosTexto =
    i.mayor && Math.abs(i.mayor.otrosIngresos) >= 0.005
      ? `Otros ingresos del mayor que no salen del asiento de una factura (4.6 y asientos manuales, también a ${CUENTA_VENTAS}): ${fmtUsd(i.mayor.otrosIngresos)}. No cuentan como diferencia.`
      : null;

  return { estado, diferenciaTexto, avisoSinConvertir, avisoTerceros, otrosIngresosTexto };
}
