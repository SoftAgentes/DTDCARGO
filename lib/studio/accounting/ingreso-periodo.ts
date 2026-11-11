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
 * La conversión es la canónica (`invoiceUsdAmount` sobre `toUsd`, SDD-0572): USD y
 * USDT 1:1, VES y CNY entre la tasa de la factura. Sin tasa NO suman: se cuentan
 * aparte como «sin convertir». El IVA es un pasivo (2.1.5), no ingreso.
 *
 * El mayor queda como CONTROL, contra las líneas de la cuenta 4.5 de los
 * asientos de FACTURA (`source = 'invoice'`, la que acredita el asiento de
 * cada factura), no contra todas las cuentas 4. Todo lo demás que el mayor
 * tiene en ingresos (el 4.6 del Socio China, los asientos manuales, también
 * los que van a la propia 4.5, y cualquier otro origen) son «otros ingresos
 * del mayor»: van aparte y no cuentan como diferencia.
 *
 * SDD-0573 I2 añade el puente documental sin cambiar esa cifra oficial:
 * oficial + ajuste por anulaciones = base comparada. Integridad, unidad y
 * actividad son ejes independientes. Una cabecera sola no acredita moneda.
 * «No comparable» requiere movimiento nominal VES/CNY acreditado; puede
 * coexistir con incidencias. Sin esa evidencia y sin integridad, «requiere
 * revisión», nunca Cuadra ni USD por un contador cero. Sólo con contexto
 * completo, unidad USD y base conocida se compara. Mayor realmente vacío
 * contra facturas sin asiento conserva B3; una cabecera huérfana requiere
 * revisión. Neto cero íntegro con movimiento conserva actividad y puente.
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
  /** Identidad documental para el contexto y el control del período. */
  id: string;
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
  /**
   * Ids de las facturas con un asiento `invoice` vivo (asentado y sin borrar)
   * en el rango, por `journal_entries.invoice_id`: los MISMOS asientos que
   * forman `ventas`. Las facturas no tienen `journal_entry_id`, así que el
   * vínculo solo existe de ese lado. Es metadata heredada del saldo, no un
   * certificado de integridad ni de unidad para I2.
   */
  facturasConAsiento: ReadonlySet<string>;
};

export type IngresoPeriodo = {
  /** Puente documental; null significa que no se pudo certificar, nunca cero supuesto. */
  ajusteAnulacionesUsd: number | null;
  baseComparacionUsd: number | null;
  controlI2: ControlI2;
  rango: RangoFechas;
  /** Facturado sin IVA convertido a USD; subtotal si sinConvertir > 0. */
  facturado: { propio: number; terceros: number; total: number };
  /** Facturas que suman. */
  facturas: number;
  /** Facturas del período que NO suman: VES o CNY sin tasa (SDD-0572). */
  sinConvertir: number;
  /**
   * Documentos distintos con movimiento nominal VES/CNY relevante acreditado
   * por metadata/tenant/cuentas/líneas, incluidos reversos de una emisión fuera
   * del rango. Cabeceras sin líneas no cuentan. Cero no certifica USD: la
   * unidad y la verificación están en controlI2. Sin mayor es0/no_leida.
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
   * baseComparacionUsd − mayor.ventas sólo con contexto íntegro, unidad USD
   * acreditada, base conocida y mayor coherente con neto/movimiento raw.
   * Una cabecera huérfana, unidad nominal/desconocida o contradicción del
   * mayor mantiene null; un saldo cero por sí solo no certifica comparación.
   * SDD-0572: con alguna factura sin convertir la base no se conoce y es null.
   */
  diferenciaUsd: number | null;
};

/** Contexto interno de lectura. No forma parte del DTO enviado a las pantallas. */
export type FilaControlI2 = Readonly<Record<string, unknown>>;
export type ContextoControlI2 = {
  completo: boolean;
  documentos: readonly FilaControlI2[];
  asientos: readonly FilaControlI2[];
  lineas: readonly FilaControlI2[];
  cuentas: readonly FilaControlI2[];
};

export type IncidenciaI2 =
  | "contexto_ausente" | "lectura_incompleta" | "identidad_incompatible"
  | "documento_no_disponible" | "cabecera_invalida" | "par_incompleto"
  | "lineas_invalidas" | "cuenta_no_disponible" | "moneda_desconocida"
  | "importe_sin_convertir" | "mayor_inconsistente";
export type ControlI2 = {
  verificacion: "no_leida" | "completa" | "requiere_revision";
  unidadMayor: "usd" | "nominal_mixto" | "sin_verificar";
  hayActividad: boolean;
  contribucionesAjuste: number;
  incidencias: readonly { codigo: IncidenciaI2; cantidad: number }[];
};

const CAUSA_I2: Record<IncidenciaI2, string> = {
  contexto_ausente: "No se leyó el contexto documental del control.",
  lectura_incompleta: "La lectura del control está incompleta.",
  identidad_incompatible: "Hay identidades duplicadas con datos incompatibles.",
  documento_no_disponible: "Falta metadata de un documento relacionado.",
  cabecera_invalida: "Hay un asiento con estado, fecha, origen o pertenencia inválidos.",
  par_incompleto: "No se pudo acreditar el par de anulación y su vínculo.",
  lineas_invalidas: "Las líneas del asiento o su espejo requieren revisión.",
  cuenta_no_disponible: "No se pudo resolver una cuenta y su ascendencia.",
  moneda_desconocida: "No se conoce la unidad de un movimiento del mayor.",
  importe_sin_convertir: "Falta un monto o una tasa válida para el ajuste de anulación.",
  mayor_inconsistente: "El saldo recibido del mayor no coincide con las líneas leídas.",
};

export function causaDelControlI2(i: IngresoPeriodo): string | null {
  const causas = i.controlI2.incidencias.map(({ codigo, cantidad }) =>
    `${CAUSA_I2[codigo]} (${cantidad})`);
  return causas.length ? causas.join(" ") : null;
}

const texto = (v: unknown): string => typeof v === "string" ? v : "";
const fechaI2 = (v: unknown): string | null => {
  const s = texto(v).slice(0, 10);
  return isIsoDate(s) ? s : null;
};
const centavosI2 = (v: unknown): number | null => {
  if ((typeof v !== "number" && typeof v !== "string") || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && Math.abs(n * 100 - Math.round(n * 100)) < 0.00001
    && Number.isSafeInteger(Math.round(n * 100)) ? Math.round(n * 100) : null;
};

/** Valida evidencia cruda, sin inferir integridad del neto ni del saldo del mayor. */
function puenteDelPeriodo(
  rango: RangoFechas, mayor: ControlDelMayor, contexto: ContextoControlI2 | undefined,
  facturas: readonly FacturaDeIngreso[],
): { ajuste: number | null; nominales: ReadonlySet<string>; control: ControlI2 } {
  const incidencias = new Map<IncidenciaI2, number>();
  const avisar = (c: IncidenciaI2) => incidencias.set(c, (incidencias.get(c) ?? 0) + 1);
  const dentro = (v: unknown) => { const f = fechaI2(v); return f != null && f >= rango.from && f <= rango.to; };
  const nominales = new Set<string>();
  let unidadDesconocida = false;
  let actividad = mayor.ventasConMovimiento;
  let contribuciones = 0;
  let ajusteCentavos = 0;
  let ventasCentavos = 0;
  let movimientoVentasAcreditado = false;
  const salida = (noLeida = false) => ({
    ajuste: incidencias.size ? null : round2(ajusteCentavos / 100), nominales,
    control: {
      verificacion: noLeida ? "no_leida" : incidencias.size ? "requiere_revision" : "completa",
      unidadMayor: nominales.size ? "nominal_mixto"
        : unidadDesconocida || noLeida || incidencias.has("lectura_incompleta")
          || incidencias.has("cuenta_no_disponible") || incidencias.has("documento_no_disponible")
          || incidencias.has("identidad_incompatible") ? "sin_verificar" : "usd",
      hayActividad: actividad, contribucionesAjuste: contribuciones,
      incidencias: [...incidencias].map(([codigo, cantidad]) => ({ codigo, cantidad })),
    } as ControlI2,
  });
  if (!contexto) { avisar("contexto_ausente"); return salida(true); }
  if (!contexto.completo) avisar("lectura_incompleta");

  // La misma fila puede llegar por fecha y por identidad. Sólo colapsa si sus
  // campos seleccionados coinciden; no elige una versión ante una carrera.
  function indexar(filas: readonly FilaControlI2[]): Map<string, FilaControlI2> {
    const mapa = new Map<string, FilaControlI2>();
    for (const fila of filas) {
      const id = texto(fila.id);
      if (!id) { avisar("identidad_incompatible"); continue; }
      const anterior = mapa.get(id);
      const firma = (f: FilaControlI2) => JSON.stringify(Object.keys(f).sort().map(k => [k, f[k]]));
      if (anterior && firma(anterior) !== firma(fila)) avisar("identidad_incompatible");
      else mapa.set(id, fila);
    }
    return mapa;
  }
  const documentos = indexar(contexto.documentos);
  const asientos = indexar(contexto.asientos);
  const lineas = indexar(contexto.lineas);
  const cuentas = indexar(contexto.cuentas);
  // La primera lectura del oficial y la metadata por identidad tampoco son
  // un snapshot: una versión incompatible impide certificar el puente.
  for (const f of facturas) {
    const d = documentos.get(f.id);
    if (!d) continue;
    const campos = ["status", "issued_at", "currency", "fx_rate", "base_amount", "fund_class", "deleted_at"] as const;
    if (campos.some(k => (f[k] ?? null) !== (d[k] ?? null))) avisar("identidad_incompatible");
  }
  const porAsiento = new Map<string, FilaControlI2[]>();
  for (const l of lineas.values()) {
    const id = texto(l.entry_id);
    if (!asientos.has(id)) { avisar("lineas_invalidas"); continue; }
    const grupo = porAsiento.get(id) ?? [];
    grupo.push(l); porAsiento.set(id, grupo);
  }
  function cuentaValida(id: string, tenant: string): FilaControlI2 | null {
    const vistos = new Set<string>();
    let c = cuentas.get(id);
    const hoja = c;
    while (c) {
      const actual = texto(c.id);
      if (!actual || vistos.has(actual) || c.tenant_id !== tenant || !texto(c.code)
        || !["A", "P", "PT", "I", "CGS", "G"].includes(texto(c.type))
        || c.type !== hoja?.type || !("parent_id" in c) || c.parent_id === undefined) return null;
      vistos.add(actual);
      if (c.parent_id === null) return hoja ?? null;
      c = cuentas.get(texto(c.parent_id));
    }
    return null;
  }
  const esVenta = (c: FilaControlI2) => c.type === "I"
    && (c.code === CUENTA_VENTAS || texto(c.code).startsWith(`${CUENTA_VENTAS}.`));
  const firmas = new Map<string, { ida: string[]; vuelta: string[]; venta: boolean }>();
  const headersValidos = new Set<string>();
  const porDocumento = new Map<string, FilaControlI2[]>();
  for (const [id, a] of asientos) {
    const relacionados = porDocumento.get(texto(a.invoice_id)) ?? [];
    relacionados.push(a); porDocumento.set(texto(a.invoice_id), relacionados);
    const doc = documentos.get(texto(a.invoice_id));
    const tenant = texto(a.tenant_id);
    const ls = porAsiento.get(id) ?? [];
    const relevante = dentro(a.entry_date);
    if (relevante && ls.some(l => (centavosI2(l.debit) ?? 0) > 0 || (centavosI2(l.credit) ?? 0) > 0)) actividad = true;
    let valido = true;
    if (!doc) { avisar("documento_no_disponible"); valido = false; }
    if (!tenant || !doc || doc.tenant_id !== tenant || doc.deleted_at !== null
      || !fechaI2(doc.issued_at) || (doc.status !== "anulada" && !esDeIngreso(texto(doc.status)))) {
      avisar("cabecera_invalida"); valido = false;
    }
    if (a.status !== "asentado" || a.deleted_at !== null || !fechaI2(a.entry_date)
      || (a.source !== "invoice" && a.source !== "invoice_reversal")
      || (a.source === "invoice" && a.reverses_entry_id !== null)
      || (a.source === "invoice_reversal" && !texto(a.reverses_entry_id))) {
      avisar("cabecera_invalida"); valido = false;
    }
    let debe = 0; let haber = 0; let venta = false;
    const ida: string[] = []; const vuelta: string[] = [];
    if (ls.length === 0) { avisar("lineas_invalidas"); unidadDesconocida = true; valido = false; }
    for (const l of ls) {
      const c = cuentaValida(texto(l.account_id), tenant);
      const d = centavosI2(l.debit); const h = centavosI2(l.credit);
      if (!c) { avisar("cuenta_no_disponible"); valido = false; }
      if (d == null || h == null || (d > 0 && h > 0)
        || ("tenant_id" in l && l.tenant_id !== tenant)) {
        avisar("lineas_invalidas"); unidadDesconocida = true; valido = false; continue;
      }
      debe += d; haber += h;
      ida.push(JSON.stringify([l.account_id, d, h]));
      vuelta.push(JSON.stringify([l.account_id, h, d]));
      if (c && esVenta(c) && (d !== 0 || h !== 0)) {
        venta = true;
        if (relevante && a.status === "asentado" && a.deleted_at == null
          && (a.source === "invoice" || a.source === "invoice_reversal")) {
          ventasCentavos += h - d;
          movimientoVentasAcreditado = true;
          if (doc && doc.tenant_id === tenant) {
            if (enOtraMonedaDelAsiento(texto(doc.currency))) nominales.add(texto(doc.id));
            else if (doc.currency !== "USD" && doc.currency !== "USDT") {
              unidadDesconocida = true; avisar("moneda_desconocida");
            }
          } else unidadDesconocida = true;
        }
      }
    }
    if (debe !== haber || !Number.isSafeInteger(debe) || !Number.isSafeInteger(haber)) {
      avisar("lineas_invalidas"); valido = false;
    }
    firmas.set(id, { ida: ida.sort(), vuelta: vuelta.sort(), venta });
    if (valido) headersValidos.add(id);
  }

  for (const doc of documentos.values()) {
    const delDocumento = porDocumento.get(texto(doc.id)) ?? [];
    const originales = delDocumento.filter(a => a.source === "invoice");
    const reversos = delDocumento.filter(a => a.source === "invoice_reversal");
    if (doc.status !== "anulada") {
      if (reversos.length) avisar("par_incompleto");
      continue;
    }
    if (delDocumento.length === 0) continue; // anulación sin evidencia de posting: no-op válido
    if (originales.length !== 1 || reversos.length !== 1) { avisar("par_incompleto"); continue; }
    const original = originales[0]; const reverso = reversos[0];
    const f = firmas.get(texto(original.id)); const r = firmas.get(texto(reverso.id));
    if (!headersValidos.has(texto(original.id)) || !headersValidos.has(texto(reverso.id))
      || reverso.reverses_entry_id !== original.id || original.tenant_id !== reverso.tenant_id
      || !f?.venta || !r?.venta || JSON.stringify(f.ida) !== JSON.stringify(r.vuelta)) {
      avisar("par_incompleto"); continue;
    }
    const suma = dentro(doc.issued_at); const resta = dentro(reverso.entry_date);
    if (!suma && !resta) continue;
    actividad = true;
    contribuciones += Number(suma) + Number(resta);
    const base = doc.base_amount;
    if ((typeof base !== "number" && typeof base !== "string") || base === ""
      || !Number.isFinite(Number(base)) || Number(base) < 0
      || !convertible(texto(doc.currency), doc.fx_rate as number | string | null)) {
      avisar("importe_sin_convertir"); continue;
    }
    // Una sola conversión y redondeo documental: el reverso usa exactamente
    // los mismos centavos, sin importar el nominal registrado en el par.
    const usd = round2(invoiceUsdAmount({ currency: doc.currency as InvoiceCurrency,
      total_amount: Number(base), fx_rate: doc.fx_rate == null ? null : Number(doc.fx_rate) }));
    if (!Number.isFinite(usd) || !Number.isSafeInteger(Math.round(usd * 100))) { avisar("importe_sin_convertir"); continue; }
    ajusteCentavos += (Number(suma) - Number(resta)) * Math.round(usd * 100);
  }
  if (!Number.isSafeInteger(ajusteCentavos) || !Number.isSafeInteger(ventasCentavos)) avisar("importe_sin_convertir");
  if ((mayor.ventas != null && Math.round(mayor.ventas * 100) !== ventasCentavos)
    || (mayor.ventas == null && movimientoVentasAcreditado)
    || mayor.ventasConMovimiento !== movimientoVentasAcreditado) avisar("mayor_inconsistente");
  return salida();
}

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
 *  - `facturasConAsiento`: las facturas de esos mismos asientos (decisión 7).
 */
export function controlDelMayor(
  accounts: AccountLike[],
  balances: AccountBalanceMap,
  deFacturas: AccountBalanceMap,
  facturasConAsiento: ReadonlySet<string>,
): ControlDelMayor {
  const cuenta = accounts.find((a) => a.code === CUENTA_VENTAS);
  const s = cuenta ? deFacturas[cuenta.id] : undefined;
  return {
    ventas: cuenta ? round2(s?.balance ?? 0) : null,
    ventasConMovimiento: !!s && (s.debit !== 0 || s.credit !== 0),
    ingresos: profitAndLoss(accounts, balances).income,
    facturasConAsiento,
  };
}

function esDeIngreso(status: string): boolean {
  return (ESTADOS_DE_INGRESO as readonly string[]).includes(status);
}


/** ¿El conversor canónico (SDD-0572) sabe pasar esta moneda a USD? */
function convertible(currency: string, fxRate: number | string | null): boolean {
  return invoiceUsdAmount({
    currency: currency as InvoiceCurrency,
    total_amount: 1,
    fx_rate: fxRate == null ? null : Number(fxRate),
  }) !== null;
}

/** VES o CNY: la factura se asienta hoy por el nominal en esa moneda (B2). */
function enOtraMonedaDelAsiento(currency: string): boolean {
  return currency === "VES" || currency === "CNY";
}

/**
 * Cifra oficial heredada más control I2. Filtra borradas/estado/fecha del
 * oficial en memoria; el contexto adicional no amplía ese oficial. El puente
 * y su unidad se acreditan con filas crudas, también con mayor precalculado;
 * el Set de cabeceras no establece comparabilidad ni movimiento nominal.
 * SDD-0572: la diferencia solo se cuantifica si se convirtió el conjunto
 * completo; el subtotal conocido conserva la cifra oficial.
 */
export function resumirIngreso(
  facturas: readonly FacturaDeIngreso[],
  rango: RangoFechas,
  mayor: ControlDelMayor | null,
  contexto?: ContextoControlI2,
): IngresoPeriodo {
  let propio = 0;
  let terceros = 0;
  let cuenta = 0;
  let sinConvertir = 0;

  for (const f of facturas) {
    if (f.deleted_at != null) continue;
    if (!f.issued_at) continue;
    const dia = f.issued_at.slice(0, 10);
    if (dia < rango.from || dia > rango.to) continue;
    if (!esDeIngreso(f.status)) continue;
    // SDD-0572: el conversor canónico. VES y CNY por su tasa; sin tasa (o con
    // una moneda que no se convierte), a «sin convertir».
    const base = Number(f.base_amount);
    const enUsd = invoiceUsdAmount({
      currency: f.currency as InvoiceCurrency,
      total_amount: Number.isFinite(base) ? base : 0,
      fx_rate: f.fx_rate == null ? null : Number(f.fx_rate),
    });
    if (enUsd === null) {
      sinConvertir += 1;
      continue;
    }
    const usd = round2(enUsd);
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
  // SDD-0572: con alguna factura sin convertir el facturado es un subtotal y el
  // monto total en USD no se conoce (incluye el caso de 4.5 vacía y nada en USD).
  const sinMontoConocido = sinConvertir > 0;

  const puente = mayor ? puenteDelPeriodo(rango, mayor, contexto, facturas) : null;
  const controlI2: ControlI2 = puente?.control ?? {
    verificacion: "no_leida", unidadMayor: "sin_verificar", hayActividad: false,
    contribucionesAjuste: 0, incidencias: [],
  };
  const enOtraMoneda = puente?.nominales.size ?? 0;
  const ajusteAnulacionesUsd = puente?.ajuste ?? null;
  const baseComparacionUsd = ajusteAnulacionesUsd == null || sinMontoConocido
    ? null : round2(total + ajusteAnulacionesUsd);

  return {
    rango,
    facturado: { propio: round2(propio), terceros: round2(terceros), total },
    facturas: cuenta,
    sinConvertir,
    enOtraMoneda,
    mayor: control,
    ajusteAnulacionesUsd,
    baseComparacionUsd,
    controlI2,
    diferenciaUsd:
      control && control.ventas != null && baseComparacionUsd != null
        && controlI2.verificacion === "completa" && controlI2.unidadMayor === "usd"
        ? round2(baseComparacionUsd - control.ventas)
        : null,
  };
}

export type EstadoDelIngreso =
  | "cuadra"
  | "mayor_menor"
  | "mayor_mayor"
  | "no_comparable"
  | "conversion_incompleta"
  | "sin_movimiento"
  | "sin_cuenta"
  | "sin_mayor"
  | "requiere_revision";

/** Rótulo corto del estado del control (CSV, insignias). */
export const ETIQUETA_ESTADO_INGRESO: Record<EstadoDelIngreso, string> = {
  cuadra: "Cuadra",
  mayor_menor: "El mayor tiene menos",
  mayor_mayor: "El mayor tiene más",
  no_comparable: "No comparable",
  conversion_incompleta: "Conversión incompleta",
  sin_movimiento: "Sin movimiento",
  sin_cuenta: "Sin cuenta 4.5",
  sin_mayor: "Sin mayor",
  requiere_revision: "Requiere revisión",
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
/**
 * La nota del estado de resultados que sale del mayor. Con «no comparable», el
 * mayor tiene facturas en bolívares o yuanes asentadas por su nominal (B2):
 * sus cifras mezclan monedas y la pantalla tiene que decirlo, no presentarlas
 * como USD funcional. `null` si no hace falta.
 */
export function notaDelMayorMezclado(i: IngresoPeriodo): string | null {
  if (i.controlI2.unidadMayor !== "nominal_mixto") return null;
  return (
    "Estas cifras salen del mayor y mezclan el nominal de facturas en bolívares o yuanes " +
    "con montos en USD: no son todas USD. Vuelven a ser comparables cuando el asiento de venta " +
    "se registre en USD (fase 2 del plan de trabajo de contabilidad)."
  );
}

export function describirIngreso(i: IngresoPeriodo): DescripcionIngreso {
  let estado: EstadoDelIngreso = "sin_mayor";
  let diferenciaTexto: string | null = null;
  if (i.mayor) {
    const conAsientos = i.mayor.ventasConMovimiento;
    const hayFacturado = Math.abs(i.facturado.total) >= 0.005;
    if (i.controlI2.verificacion === "no_leida") {
      estado = "requiere_revision";
      diferenciaTexto = "Requiere revisión: no se leyó el contexto documental del control.";
    } else if (i.controlI2.unidadMayor === "nominal_mixto") {
      estado = "no_comparable";
      const n = i.enOtraMoneda;
      diferenciaTexto =
        `No comparable: ${n === 1 ? "1 factura del período está" : `${n} facturas del período están`}` +
        ` en bolívares o yuanes y hoy ${n === 1 ? "se asienta" : "se asientan"} en la cuenta ${CUENTA_VENTAS}` +
        " por su nominal en esa moneda, no en USD. La comparación vuelve cuando el asiento de venta" +
        " se registre en USD (fase 2 del plan de trabajo de contabilidad).";
    } else if (i.controlI2.verificacion !== "completa" || i.controlI2.unidadMayor !== "usd") {
      estado = "requiere_revision";
      diferenciaTexto = "Requiere revisión: no se pudo certificar el puente documental y su comparación con el mayor.";
    } else if (i.mayor.ventas == null) {
      estado = "sin_cuenta";
      diferenciaTexto = `La cuenta ${CUENTA_VENTAS} no está en el plan de cuentas: no hay con qué comparar.`;
    } else if (!conAsientos && (hayFacturado || i.sinConvertir > 0)) {
      // B3 gana sobre «no comparable»: contra 4.5 vacía no hay monedas que mezclar.
      estado = "mayor_menor";
      diferenciaTexto = hayFacturado && i.sinConvertir === 0
        ? `El mayor (cuenta ${CUENTA_VENTAS}) tiene ${fmtUsd(i.facturado.total)} menos que lo facturado: no tiene ningún asiento de factura en el período.`
        : hayFacturado
          ? `El mayor (cuenta ${CUENTA_VENTAS}) no tiene ningún asiento de factura en el período; falta convertir ${i.sinConvertir === 1 ? "1 factura" : `${i.sinConvertir} facturas`} para conocer la diferencia total en USD.`
        : `El mayor (cuenta ${CUENTA_VENTAS}) no tiene ningún asiento de factura en el período; ${
            i.sinConvertir === 1
              ? "la factura del período (en bolívares o yuanes sin tasa) debería tenerlo"
              : `las ${i.sinConvertir} facturas del período (en bolívares o yuanes sin tasa) deberían tenerlo`
          }.`;
    } else if (!conAsientos && i.facturas === 0 && !i.controlI2.hayActividad) {
      estado = "sin_movimiento";
      diferenciaTexto = `Sin movimiento: no hay facturas del período ni asientos de factura en la cuenta ${CUENTA_VENTAS}. No hay nada que comparar.`;
    } else if (i.sinConvertir > 0) {
      estado = "conversion_incompleta";
      diferenciaTexto = `Conversión incompleta: falta convertir ${i.sinConvertir === 1 ? "1 factura" : `${i.sinConvertir} facturas`} con su tasa para comparar el total con el mayor (cuenta ${CUENTA_VENTAS}).`;
    } else {
      // Con 4.5 en el plan y comparable, `resumirIngreso` siempre la calcula.
      const dif = i.diferenciaUsd;
      if (dif == null) {
        estado = "requiere_revision";
        diferenciaTexto = "Requiere revisión: la base de comparación en USD no está disponible.";
      } else if (Math.abs(dif) < 0.005) {
        estado = "cuadra";
        diferenciaTexto = `Cuadra con el mayor (cuenta ${CUENTA_VENTAS}).`;
      } else if (dif > 0) {
        estado = "mayor_menor";
        diferenciaTexto = `El mayor (cuenta ${CUENTA_VENTAS}) tiene ${fmtUsd(dif)} menos que ${i.controlI2.contribucionesAjuste ? "la base comparada" : "lo facturado"}.`;
      } else {
        estado = "mayor_mayor";
        diferenciaTexto = `El mayor (cuenta ${CUENTA_VENTAS}) tiene ${fmtUsd(-dif)} más que ${i.controlI2.contribucionesAjuste ? "la base comparada" : "lo facturado"}.`;
      }
    }
  }

  if (i.mayor && i.controlI2.contribucionesAjuste > 0) {
    diferenciaTexto += " Puente de anulación: facturado oficial + ajuste documental = base comparada con el mayor.";
  }

  const n = i.sinConvertir;
  const avisoSinConvertir =
    n === 0
      ? null
      : n === 1
        ? "1 factura no suma: está en bolívares o yuanes sin tasa."
        : `${n} facturas no suman: están en bolívares o yuanes sin tasa.`;

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
