/**
 * SDD-0558 · El saldo de un cliente: reglas y fórmulas PURAS.
 *
 * La definición del saldo por cliente vive en SQL, en
 * `public.client_outstanding(uuid[])` (migración 0492). Este módulo no la
 * recalcula: valida las filas que devuelve (`coerceClientOutstandingRows`), las
 * resume para la ficha (`resumirCuentaCliente`) y para Kommo
 * (`tieneSaldoAbierto`), y decide quién ve qué (`puedeVerSaldoCliente`,
 * `puedeVerEstadoDeCuenta`). La lectura (I/O) está en `client-queries.ts`.
 *
 * Es puro a propósito: sin red, sin Supabase y sin el reloj (ninguna fórmula
 * llama a `new Date()` ni a `Date.now()`; la fecha de corte llega en la fila).
 * Lo importan un componente de servidor (la cabecera de la ficha), el job de
 * Kommo y Conversaciones, y varias pruebas mockean `client-queries.ts` entero.
 */

import { classifyAging, type AgingBucket } from "./reports/types";
import { canAccessModule, type RoleModuleOverrides } from "./rbac";
import type { InvoiceCurrency } from "./invoice-types";
import type { StudioUserRole } from "./user-types";

/**
 * Estados de factura que cuentan para el saldo: emitida, parcial, pagada y
 * vencida. Borrador y anulada no son deuda. Es la definición canónica de
 * «facturas abiertas» de SDD-0559 y SDD-0557 (`vencida` va por defensa: hoy
 * nadie la escribe). La MISMA lista está en la 0492; una prueba anti-deriva
 * compara las dos y las demás copias del repo.
 */
export const ESTADOS_FACTURA_CON_SALDO = ["emitida", "parcial", "pagada", "vencida"] as const;

/** ¿Una factura en este estado cuenta para el saldo? */
export function cuentaParaSaldo(status: string | null | undefined): boolean {
  return (ESTADOS_FACTURA_CON_SALDO as readonly string[]).includes(String(status ?? ""));
}

/** Monedas en el orden en que se muestran. */
export const ORDEN_MONEDAS: readonly InvoiceCurrency[] = ["USD", "VES", "USDT", "CNY"];

/** Una fila de `client_outstanding`: un cliente en una moneda. */
export type ClientOutstandingRow = {
  client_id: string;
  /** Códigos del cliente: el vigente primero, después historial y fichas fusionadas. */
  markboxes: string[];
  /** `null` en la fila semilla de un cliente sin facturas que cuenten ni pagos. */
  currency: InvoiceCurrency | null;
  open_amount: number;
  overdue_amount: number;
  open_invoices: number;
  overdue_invoices: number;
  /** `YYYY-MM-DD` o null. */
  oldest_overdue_due_date: string | null;
  /** `YYYY-MM-DD` o null. Solo la fecha: nunca el monto. */
  last_payment_on: string | null;
  /** La fecha de corte, en Caracas (`YYYY-MM-DD`). */
  as_of: string;
};

/** El error de una lectura del saldo. `code` es el SQLSTATE o el de PostgREST. */
export class SaldoClienteError extends Error {
  readonly code: string | null;
  constructor(message: string, code: string | null = null) {
    super(message);
    this.name = "SaldoClienteError";
    this.code = code;
  }
}

/** ¿El error es un rechazo por permiso (42501)? */
export function esSinPermiso(error: unknown): boolean {
  return error instanceof SaldoClienteError && error.code === "42501";
}

const FECHA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** ¿`YYYY-MM-DD` con una fecha real? Sin `Date` local: se valida en UTC. */
function esFechaIso(v: unknown): v is string {
  if (typeof v !== "string") return false;
  const m = FECHA_ISO.exec(v);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1
    && d.getUTCDate() === Number(m[3]);
}

function monto(v: unknown, campo: string): number {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  if (!Number.isFinite(n) || n < 0) throw new SaldoClienteError(`saldo: ${campo} inválido`);
  return n;
}

function conteo(v: unknown, campo: string): number {
  const n = monto(v, campo);
  if (!Number.isInteger(n)) throw new SaldoClienteError(`saldo: ${campo} inválido`);
  return n;
}

function fechaOpcional(v: unknown, campo: string): string | null {
  if (v == null) return null;
  if (!esFechaIso(v)) throw new SaldoClienteError(`saldo: ${campo} inválido`);
  return v;
}

/**
 * Valida las filas de `client_outstanding`. Falla CERRADO: un número que no
 * es finito o es negativo, una moneda fuera del enum o una fecha inválida
 * lanzan, y quien llama muestra «no se pudo calcular» en vez de un saldo falso.
 */
export function coerceClientOutstandingRows(data: unknown): ClientOutstandingRow[] {
  if (data == null) return [];
  if (!Array.isArray(data)) throw new SaldoClienteError("saldo: respuesta inválida");
  return data.map((raw) => {
    if (!raw || typeof raw !== "object") throw new SaldoClienteError("saldo: fila inválida");
    const r = raw as Record<string, unknown>;
    if (typeof r.client_id !== "string" || r.client_id === "") {
      throw new SaldoClienteError("saldo: cliente inválido");
    }
    if (!Array.isArray(r.markboxes) || !r.markboxes.every((m) => typeof m === "string")) {
      throw new SaldoClienteError("saldo: códigos inválidos");
    }
    const currency = r.currency == null ? null : String(r.currency);
    if (currency !== null && !(ORDEN_MONEDAS as readonly string[]).includes(currency)) {
      throw new SaldoClienteError("saldo: moneda inválida");
    }
    if (!esFechaIso(r.as_of)) throw new SaldoClienteError("saldo: fecha de corte inválida");
    return {
      client_id: r.client_id,
      markboxes: [...(r.markboxes as string[])],
      currency: currency as InvoiceCurrency | null,
      open_amount: monto(r.open_amount, "abierto"),
      overdue_amount: monto(r.overdue_amount, "vencido"),
      open_invoices: conteo(r.open_invoices, "facturas abiertas"),
      overdue_invoices: conteo(r.overdue_invoices, "facturas vencidas"),
      oldest_overdue_due_date: fechaOpcional(r.oldest_overdue_due_date, "vencimiento"),
      last_payment_on: fechaOpcional(r.last_payment_on, "último pago"),
      as_of: r.as_of,
    };
  });
}

/** Días entre dos fechas `YYYY-MM-DD` (positivo si `hasta` es posterior). */
export function diasEntre(desde: string, hasta: string): number {
  const ms = (iso: string) => {
    const m = FECHA_ISO.exec(iso);
    return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : NaN;
  };
  return Math.round((ms(hasta) - ms(desde)) / 86_400_000);
}

/** El saldo de un cliente en UNA moneda. */
export type SaldoPorMoneda = {
  currency: InvoiceCurrency;
  abierto: number;
  vencido: number;
  facturasAbiertas: number;
  facturasVencidas: number;
  vencimientoMasAntiguo: string | null;
  /** Días del vencimiento más antiguo contra la fecha de corte; null sin vencido. */
  diasVencido: number | null;
  /** Tramo del aging de Reportes (`classifyAging`); null sin vencido. */
  tramo: AgingBucket["id"] | null;
  ultimoPago: string | null;
};

/** La cuenta de un cliente para la ficha. */
export type ClientAccountSummary = {
  clientId: string;
  /** Códigos del cliente, el vigente primero. */
  markboxes: string[];
  /** Fecha de corte, en Caracas. */
  asOf: string;
  /** Una entrada por moneda, en el orden USD, VES, USDT, CNY. Sin la fila semilla. */
  saldos: SaldoPorMoneda[];
  /** El más reciente entre monedas. */
  ultimoPago: string | null;
  /** Embarques sin entregar, cancelar ni en borrador; null si no se pudo contar. */
  embarquesEnCurso: number | null;
};

/**
 * Resume las filas de UN cliente. PURA. `null` si no hay ninguna fila suya: la
 * ficha no existe, está borrada o es de otro tenant. Las filas de otros
 * clientes se ignoran y las monedas nunca se suman entre sí.
 */
export function resumirCuentaCliente(
  rows: readonly ClientOutstandingRow[],
  clientId: string,
): ClientAccountSummary | null {
  const propias = rows.filter((r) => r.client_id === clientId);
  if (propias.length === 0) return null;
  const asOf = propias[0].as_of;
  const saldos = propias
    .filter((r): r is ClientOutstandingRow & { currency: InvoiceCurrency } => r.currency !== null)
    .map((r) => {
      const diasVencido =
        r.overdue_amount > 0 && r.oldest_overdue_due_date
          ? diasEntre(r.oldest_overdue_due_date, r.as_of)
          : null;
      return {
        currency: r.currency,
        abierto: r.open_amount,
        vencido: r.overdue_amount,
        facturasAbiertas: r.open_invoices,
        facturasVencidas: r.overdue_invoices,
        vencimientoMasAntiguo: r.oldest_overdue_due_date,
        diasVencido,
        tramo: diasVencido === null ? null : classifyAging(diasVencido),
        ultimoPago: r.last_payment_on,
      };
    })
    .sort((a, b) => ORDEN_MONEDAS.indexOf(a.currency) - ORDEN_MONEDAS.indexOf(b.currency));
  const ultimoPago = saldos.reduce<string | null>(
    (max, s) => (s.ultimoPago && (!max || s.ultimoPago > max) ? s.ultimoPago : max),
    null,
  );
  return {
    clientId,
    markboxes: [...propias[0].markboxes],
    asOf,
    saldos,
    ultimoPago,
    embarquesEnCurso: null,
  };
}

/** ¿Alguna moneda tiene algo abierto? Es el «Sí/No» de Kommo. */
export function tieneSaldoAbierto(rows: readonly ClientOutstandingRow[]): boolean {
  return rows.some((r) => r.currency !== null && r.open_amount > 0);
}

/**
 * ¿El rol ve el saldo, el vencido y el último pago del cliente? Es el MISMO
 * criterio que la 0492 (decisión 14 de Sam: «Todo el que ve clientes»): admin o
 * accounting, o la vista efectiva de `clients` con sus overrides. Una prueba
 * anti-deriva lo compara con la función SQL en PGlite.
 */
export function puedeVerSaldoCliente(
  role: StudioUserRole | null | undefined,
  overrides?: RoleModuleOverrides,
): boolean {
  if (role === "admin" || role === "accounting") return true;
  return canAccessModule(role, "clients", overrides);
}

/**
 * ¿El rol abre el estado de cuenta? El detalle de facturas sigue solo para
 * finanzas: es el módulo `invoices`, que es LOCKED (sin overrides).
 */
export function puedeVerEstadoDeCuenta(role: StudioUserRole | null | undefined): boolean {
  return canAccessModule(role, "invoices");
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/**
 * `2026-10-15` → `15 oct 2026`, sin `Date`: una fecha sin hora formateada con
 * `Date` corre un día en un servidor con zona negativa. Si no es una fecha
 * ISO, la devuelve tal cual.
 */
export function fechaCorta(iso: string): string {
  const m = FECHA_ISO.exec(iso);
  if (!m) return iso;
  const mes = MESES[Number(m[2]) - 1];
  if (!mes) return iso;
  return `${Number(m[3])} ${mes} ${m[1]}`;
}

/** El estado de la cuenta que pinta la cabecera de la ficha. */
export type EstadoCuentaCliente =
  | { tipo: "ok"; cuenta: ClientAccountSummary }
  /** Sin permiso para el saldo: la cabecera no pinta dinero (ERR-01, seguridad). */
  | { tipo: "sin-permiso"; markboxes: string[]; embarquesEnCurso: number | null }
  /** Falló el cálculo: mensaje recuperable con referencia (ERR-01, sistema). */
  | { tipo: "error"; referencia: string; markboxes: string[]; embarquesEnCurso: number | null };
