/**
 * SDD-0557 · Controles del libro, PUROS y seguros para el cliente.
 *
 *  - Balance de comprobación a una fecha de corte (Σ debe = Σ haber y
 *    Σ saldos deudores = Σ saldos acreedores).
 *  - Cruce documento ↔ asiento: qué facturas, recibos, CxP y pagos vivos no
 *    tienen asiento vivo, y qué anulados conservan uno.
 *  - Filas y CSV del diario completo.
 *  - CSV de pantalla, enlaces y avisos de Contabilidad.
 *
 * Las definiciones del cruce son las canónicas de la SDD-0559 (radiografía),
 * para que el Studio y la radiografía den el mismo número:
 *  - asiento vivo = `status = 'asentado'` y `deleted_at` nulo;
 *  - el vínculo vale en los dos sentidos (`journal_entries.<doc>_id = doc.id`
 *    o `doc.journal_entry_id = journal_entries.id`);
 *  - el origen se toma por `source`: un `referral_credit` también guarda
 *    `invoice_id` y NO es el asiento de venta.
 *
 * Sin Supabase y sin los módulos de posting (que arrastran el cliente admin):
 * lo importa `PorContabilizarTab`, que es de cliente. El cuadre del subdiario,
 * que sí necesita la regla de conversión del asiento de CxP, vive en
 * `subdiario.ts`.
 */

import {
  compareCodes,
  parentCode,
  type Account,
} from "@/lib/studio/account-types";
import type { AccountBalanceMap } from "@/lib/studio/account-queries";
import {
  entrySourceLabel,
  type EntrySource,
  type JournalEntry,
  type JournalLine,
} from "@/lib/studio/journal-types";
import type { BalanceSheet, ProfitAndLoss } from "./reports";
import { rangoDesdeParams, type IngresoPeriodo, type RangoFechas } from "./ingreso-periodo";
import { isIsoDate } from "@/lib/studio/bitacora/dates";
import {
  reportFilename,
  rowsToCsv,
  type CsvValue,
  type ViewCsv,
} from "@/lib/studio/reports/export-csv";

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Cuenta de control de clientes (`SALES_AR_CODE`, invoice-posting.ts). */
export const CUENTA_CLIENTES = "1.1.2";
/** Cuenta de control de proveedores (`PAYABLE_AP_CODE`, bill-posting.ts). */
export const CUENTA_PROVEEDORES = "2.1.1";

// ── Balance de comprobación ────────────────────────────────────

export type FilaComprobacion = {
  accountId: string;
  code: string;
  name: string;
  type: Account["type"];
  /** Movimientos DIRECTOS de la cuenta (sin el rollup de sus hijas). */
  debe: number;
  haber: number;
  saldoDeudor: number;
  saldoAcreedor: number;
};

export type BalanceComprobacion = {
  corte: string;
  filas: FilaComprobacion[];
  totalDebe: number;
  totalHaber: number;
  totalDeudor: number;
  totalAcreedor: number;
  cuadra: boolean;
  /** totalDebe − totalHaber. */
  diferencia: number;
};

/**
 * Balance de comprobación al corte. `saldos` viene de `accountBalances`, que ya
 * hace rollup hacia los padres: sumar los grupos duplicaría los totales. Por eso
 * cada fila toma lo DIRECTO de la cuenta = su acumulado menos el de sus hijas
 * directas (las cuentas cuyo código padre es el suyo, igual que el rollup de
 * `computeBalances`). Solo entran cuentas con movimiento. Va antes del cierre:
 * las cuentas de resultado están incluidas.
 */
export function balanceDeComprobacion(
  accounts: Pick<Account, "id" | "code" | "name" | "type">[],
  saldos: AccountBalanceMap,
  corte: string,
): BalanceComprobacion {
  const hijas = new Map<string, string[]>();
  for (const a of accounts) {
    const pc = parentCode(a.code);
    if (!pc) continue;
    const lista = hijas.get(pc) ?? [];
    lista.push(a.id);
    hijas.set(pc, lista);
  }

  const filas: FilaComprobacion[] = [];
  for (const a of accounts) {
    const propio = saldos[a.id] ?? { debit: 0, credit: 0, balance: 0 };
    let debe = propio.debit;
    let haber = propio.credit;
    for (const id of hijas.get(a.code) ?? []) {
      debe -= saldos[id]?.debit ?? 0;
      haber -= saldos[id]?.credit ?? 0;
    }
    debe = round2(debe);
    haber = round2(haber);
    if (debe === 0 && haber === 0) continue;
    filas.push({
      accountId: a.id,
      code: a.code,
      name: a.name,
      type: a.type,
      debe,
      haber,
      saldoDeudor: round2(Math.max(debe - haber, 0)),
      saldoAcreedor: round2(Math.max(haber - debe, 0)),
    });
  }
  filas.sort((x, y) => compareCodes(x.code, y.code));

  const suma = (k: keyof Pick<FilaComprobacion, "debe" | "haber" | "saldoDeudor" | "saldoAcreedor">) =>
    round2(filas.reduce((s, f) => s + f[k], 0));
  const totalDebe = suma("debe");
  const totalHaber = suma("haber");
  const totalDeudor = suma("saldoDeudor");
  const totalAcreedor = suma("saldoAcreedor");
  const diferencia = round2(totalDebe - totalHaber);

  return {
    corte,
    filas,
    totalDebe,
    totalHaber,
    totalDeudor,
    totalAcreedor,
    cuadra:
      Math.abs(diferencia) < 0.005 &&
      Math.abs(totalDeudor - totalAcreedor) < 0.005,
    diferencia,
  };
}

// ── Documentos sin asiento ─────────────────────────────────────

export type TipoDocumento = "factura" | "recibo" | "cxp" | "pago_proveedor";

export const TIPOS_DE_DOCUMENTO: readonly TipoDocumento[] = [
  "factura",
  "recibo",
  "cxp",
  "pago_proveedor",
];

/** El `source` del asiento que le corresponde a cada documento. */
export const ORIGEN_POR_TIPO: Record<TipoDocumento, string> = {
  factura: "invoice",
  recibo: "receipt",
  cxp: "supplier_bill",
  pago_proveedor: "supplier_payment",
};

export const ETIQUETA_TIPO: Record<TipoDocumento, string> = {
  factura: "Factura",
  recibo: "Recibo",
  cxp: "CxP",
  pago_proveedor: "Pago a proveedor",
};

export type DocumentoContable = {
  tipo: TipoDocumento;
  id: string;
  codigo: string;
  fecha: string | null;
  moneda: string;
  /** Monto nominal del documento, en su moneda. */
  monto: number;
  /** false = anulado (factura/CxP anulada, recibo/pago con `deleted_at`). */
  vivo: boolean;
  /** Vínculo del lado del documento (las facturas no lo tienen). */
  journal_entry_id?: string | null;
};

export type AsientoDeDocumento = {
  id: string;
  status: string;
  source: string;
  deleted_at?: string | null;
  invoice_id: string | null;
  receipt_id: string | null;
  bill_id: string | null;
  supplier_payment_id: string | null;
};

export type MotivoHallazgo =
  | "sin_asiento"
  | "asiento_anulado"
  | "sin_monto"
  | "anulado_con_asiento_vivo";

export const ETIQUETA_MOTIVO: Record<MotivoHallazgo, string> = {
  sin_asiento: "Sin asiento",
  asiento_anulado: "Asiento anulado",
  sin_monto: "Sin monto",
  anulado_con_asiento_vivo: "Anulado con asiento vivo",
};

export type HallazgoAsiento = {
  tipo: TipoDocumento;
  codigo: string;
  fecha: string | null;
  moneda: string;
  monto: number;
  motivo: MotivoHallazgo;
  enlace: string;
};

export type ConteoDocumentos = Record<
  TipoDocumento,
  {
    /** vivos + anulados: todo lo que se leyó. */
    revisados: number;
    /** El denominador de «X sin asiento de N»: los anulados van aparte. */
    vivos: number;
    anulados: number;
    sinAsiento: number;
    sinMonto: number;
    anuladosConAsiento: number;
  }
>;

export type DocumentosSinAsiento = {
  /** Vivos sin asiento vivo (motivo sin_asiento, asiento_anulado o sin_monto). */
  sinAsiento: HallazgoAsiento[];
  /** Anulados que conservan un asiento vivo de su origen. */
  anuladosConAsiento: HallazgoAsiento[];
  conteo: ConteoDocumentos;
};

/** Canónico (SDD-0559): asentado y sin borrar. */
export function asientoVivo(a: Pick<AsientoDeDocumento, "status" | "deleted_at">): boolean {
  return a.status === "asentado" && a.deleted_at == null;
}

function fkDelAsiento(a: AsientoDeDocumento, tipo: TipoDocumento): string | null {
  if (tipo === "factura") return a.invoice_id;
  if (tipo === "recibo") return a.receipt_id;
  if (tipo === "cxp") return a.bill_id;
  return a.supplier_payment_id;
}

const clave = (tipo: TipoDocumento, id: string) => `${tipo}:${id}`;

/**
 * Cuántos asientos vivos y anulados tiene cada documento, con su origen y por
 * cualquiera de los dos lados del vínculo. Clave `tipo:id`.
 */
export function asientosPorDocumento(
  docs: readonly DocumentoContable[],
  asientos: readonly AsientoDeDocumento[],
): Map<string, { vivos: number; anulados: number }> {
  const porId = new Map<string, AsientoDeDocumento>();
  for (const a of asientos) porId.set(a.id, a);

  const out = new Map<string, { vivos: number; anulados: number }>();
  const contados = new Map<string, Set<string>>();
  const sumar = (doc: DocumentoContable, a: AsientoDeDocumento) => {
    if (a.source !== ORIGEN_POR_TIPO[doc.tipo]) return;
    const k = clave(doc.tipo, doc.id);
    const vistos = contados.get(k) ?? new Set<string>();
    if (vistos.has(a.id)) return;
    vistos.add(a.id);
    contados.set(k, vistos);
    const slot = out.get(k) ?? { vivos: 0, anulados: 0 };
    if (asientoVivo(a)) slot.vivos += 1;
    else if (a.status === "anulado") slot.anulados += 1;
    out.set(k, slot);
  };

  // Lado del asiento: journal_entries.<doc>_id = doc.id.
  const docsPorClave = new Map<string, DocumentoContable>();
  for (const d of docs) docsPorClave.set(clave(d.tipo, d.id), d);
  // El origen lo filtra `sumar`, en un solo lugar.
  for (const a of asientos) {
    for (const tipo of TIPOS_DE_DOCUMENTO) {
      const fk = fkDelAsiento(a, tipo);
      const doc = fk ? docsPorClave.get(clave(tipo, fk)) : undefined;
      if (doc) sumar(doc, a);
    }
  }
  // Lado del documento: doc.journal_entry_id = journal_entries.id.
  for (const d of docs) {
    const a = d.journal_entry_id ? porId.get(d.journal_entry_id) : undefined;
    if (a) sumar(d, a);
  }
  return out;
}

const ORDEN_TIPO: Record<TipoDocumento, number> = {
  factura: 0,
  recibo: 1,
  cxp: 2,
  pago_proveedor: 3,
};

function ordenarHallazgos(a: HallazgoAsiento, b: HallazgoAsiento): number {
  if (a.tipo !== b.tipo) return ORDEN_TIPO[a.tipo] - ORDEN_TIPO[b.tipo];
  const fa = a.fecha ?? "";
  const fb = b.fecha ?? "";
  if (fa !== fb) return fa < fb ? -1 : 1;
  return a.codigo < b.codigo ? -1 : a.codigo > b.codigo ? 1 : 0;
}

/**
 * El cruce. Un documento vivo sin asiento vivo va a `sinAsiento`: con motivo
 * «asiento anulado» si tiene uno anulado, «sin monto» si su monto es ≤ 0 (el
 * posting no asienta montos en cero, invoice-posting.ts y bill-posting.ts) y
 * «sin asiento» si no. Un anulado con asiento vivo va a `anuladosConAsiento`:
 * es lo que infla el mayor (B1).
 */
export function cruzarDocumentosConAsientos(
  docs: readonly DocumentoContable[],
  asientos: readonly AsientoDeDocumento[],
): DocumentosSinAsiento {
  const estado = asientosPorDocumento(docs, asientos);
  const conteo = Object.fromEntries(
    TIPOS_DE_DOCUMENTO.map((t) => [
      t,
      { revisados: 0, vivos: 0, anulados: 0, sinAsiento: 0, sinMonto: 0, anuladosConAsiento: 0 },
    ]),
  ) as ConteoDocumentos;

  const sinAsiento: HallazgoAsiento[] = [];
  const anuladosConAsiento: HallazgoAsiento[] = [];

  for (const d of docs) {
    const e = estado.get(clave(d.tipo, d.id)) ?? { vivos: 0, anulados: 0 };
    const c = conteo[d.tipo];
    c.revisados += 1;
    if (d.vivo) c.vivos += 1;
    else c.anulados += 1;
    const base = {
      tipo: d.tipo,
      codigo: d.codigo,
      fecha: d.fecha,
      moneda: d.moneda,
      monto: round2(d.monto),
      enlace: enlaceDelDocumento(d.tipo, d.codigo),
    };
    if (d.vivo) {
      if (e.vivos > 0) continue;
      let motivo: MotivoHallazgo;
      if (e.anulados > 0) motivo = "asiento_anulado";
      else if (!(d.monto > 0)) motivo = "sin_monto";
      else motivo = "sin_asiento";
      if (motivo === "sin_monto") c.sinMonto += 1;
      else c.sinAsiento += 1;
      sinAsiento.push({ ...base, motivo });
    } else if (e.vivos > 0) {
      c.anuladosConAsiento += 1;
      anuladosConAsiento.push({ ...base, motivo: "anulado_con_asiento_vivo" });
    }
  }

  sinAsiento.sort(ordenarHallazgos);
  anuladosConAsiento.sort(ordenarHallazgos);
  return { sinAsiento, anuladosConAsiento, conteo };
}

/** Género de cada tipo para «viva/vivo» y «anulada/anulado». */
const FEMENINO: Record<TipoDocumento, boolean> = {
  factura: true,
  recibo: false,
  cxp: true,
  pago_proveedor: false,
};

/**
 * «Factura: X sin asiento de N vivas»: el denominador son los documentos
 * VIVOS, que son los que deberían tener asiento. Los anulados se leen para la
 * lista inversa y se cuentan aparte, sin inflar la cobertura.
 */
export function textoDelConteo(tipo: TipoDocumento, c: ConteoDocumentos[TipoDocumento]): string {
  const a = FEMENINO[tipo] ? "a" : "o";
  const plural = (n: number, base: string) => `${base}${a}${n === 1 ? "" : "s"}`;
  let t = `${ETIQUETA_TIPO[tipo]}: ${c.sinAsiento} sin asiento de ${c.vivos} ${plural(c.vivos, "viv")}`;
  if (c.sinMonto > 0) t += ` · ${c.sinMonto} sin monto`;
  if (c.anulados > 0) t += ` · ${c.anulados} ${plural(c.anulados, "anulad")} aparte`;
  return t;
}

// ── Subdiario contra mayor (tipos; el cálculo vive en subdiario.ts) ──

export type EstadoCuadre =
  | "cuadra"
  | "no_cuadra"
  | "no_comparable"
  | "sin_cuenta"
  | "sin_movimiento"
  /** La cuenta sin debe ni haber y documentos con saldo (decisión 6). */
  | "mayor_sin_movimiento";

export const ETIQUETA_CUADRE: Record<EstadoCuadre, string> = {
  cuadra: "Cuadra",
  no_cuadra: "No cuadra",
  no_comparable: "No comparable",
  sin_cuenta: "Cuenta no encontrada",
  sin_movimiento: "Sin movimiento",
  mayor_sin_movimiento: "Sin movimiento en el mayor",
};

export type LadoCuadre = {
  cuenta: string;
  nombre: string;
  /** Σ (total − pagado) en USD de los documentos abiertos. */
  subdiarioUsd: number;
  /** Saldo natural de la cuenta en el mayor; null si no está en el plan. */
  mayorUsd: number | null;
  /**
   * subdiario − mayor; null si no es comparable, falta la cuenta o la cuenta
   * no tiene movimiento y hay documentos abiertos (decisión 6).
   */
  diferenciaUsd: number | null;
  /** Documentos con saldo distinto de cero. */
  documentos: number;
  /** Documentos con saldo que no suman (VES sin tasa o CNY). */
  sinConvertir: number;
  /**
   * Documentos con saldo en otra moneda y SIN tasa que suman su nominal, como
   * su asiento (solo proveedores: `billAmountUsd`). Con alguno, el saldo del
   * lado no está en USD.
   */
  sinTasa: number;
  estado: EstadoCuadre;
};

export type SubdiarioContraMayor = {
  fecha: string;
  clientes: LadoCuadre;
  proveedores: LadoCuadre;
};

/** Las notas que acompañan la tabla del subdiario (pantalla y prueba). */
export function notasDelSubdiario(s: SubdiarioContraMayor): string[] {
  const notas: string[] = [];
  if (s.clientes.estado === "mayor_sin_movimiento") {
    notas.push(
      `Sin movimiento en el mayor (cuenta ${s.clientes.cuenta}): las facturas abiertas no llegaron al mayor.`,
    );
  }
  if (s.proveedores.estado === "mayor_sin_movimiento") {
    notas.push(
      `Sin movimiento en el mayor (cuenta ${s.proveedores.cuenta}): las CxP abiertas no llegaron al mayor.`,
    );
  }
  if (s.clientes.estado === "no_comparable") {
    notas.push(
      "Clientes no es comparable: hay facturas o recibos en bolívares o yuanes con su asiento vivo; hoy la factura se asienta por su monto nominal y el cobro la convierte.",
    );
  }
  const sinConv = s.clientes.sinConvertir;
  if (sinConv > 0) {
    notas.push(
      sinConv === 1
        ? "1 factura con saldo no suma: está en bolívares sin tasa o en yuanes."
        : `${sinConv} facturas con saldo no suman: están en bolívares sin tasa o en yuanes.`,
    );
  }
  const sinTasa = s.proveedores.sinTasa;
  if (sinTasa > 0) {
    notas.push(
      sinTasa === 1
        ? "1 CxP sin tasa va al nominal, como su asiento: el saldo no está en USD."
        : `${sinTasa} CxP sin tasa van al nominal, como su asiento: el saldo no está en USD.`,
    );
  }
  return notas;
}

// ── Diario completo ────────────────────────────────────────────

export type FilaDiario = {
  fecha: string;
  asiento: string;
  origen: string;
  concepto: string;
  cuenta: string;
  nombreCuenta: string;
  debe: number;
  haber: number;
  detalle: string;
};

/** Lo que el diario necesita de un asiento y sus líneas. */
export type AsientoDelDiario = Pick<JournalEntry, "id" | "entry_code" | "entry_date" | "memo"> & {
  /** Texto libre en la base: hay más orígenes que los de `EntrySource`. */
  source: string;
  lines?: Pick<JournalLine, "id" | "account_id" | "debit" | "credit" | "line_memo">[];
};

/**
 * Rótulo del origen. `entrySourceLabel` colapsa todo lo que no conoce a
 * «Manual»; un `claim` o un `referral_credit` NO son manuales, así que en ese
 * caso se devuelve el `source` crudo.
 */
export function origenDelAsiento(source: string): string {
  const label = entrySourceLabel(source as EntrySource);
  if (label === "Manual" && source !== "manual") return source;
  return label;
}

/**
 * Una fila por línea, en orden de fecha, código de asiento y, dentro del
 * asiento, el debe antes que el haber y luego el código de cuenta. PURA: el
 * orden se prueba acá, no a través del lector.
 */
export function filasDelDiario(
  entries: readonly AsientoDelDiario[],
  cuentas: ReadonlyMap<string, { code: string; name: string }>,
): FilaDiario[] {
  const ordenados = [...entries].sort((a, b) => {
    if (a.entry_date !== b.entry_date) return a.entry_date < b.entry_date ? -1 : 1;
    if (a.entry_code !== b.entry_code) return a.entry_code < b.entry_code ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  const filas: FilaDiario[] = [];
  for (const e of ordenados) {
    const lineas = [...(e.lines ?? [])].sort((x, y) => {
      const ladoX = x.debit > 0 ? 0 : 1;
      const ladoY = y.debit > 0 ? 0 : 1;
      if (ladoX !== ladoY) return ladoX - ladoY;
      const cx = cuentas.get(x.account_id)?.code ?? "";
      const cy = cuentas.get(y.account_id)?.code ?? "";
      if (cx !== cy) return compareCodes(cx, cy);
      return x.id < y.id ? -1 : x.id > y.id ? 1 : 0;
    });
    for (const l of lineas) {
      const cuenta = cuentas.get(l.account_id);
      filas.push({
        fecha: e.entry_date,
        asiento: e.entry_code,
        origen: origenDelAsiento(e.source),
        concepto: e.memo ?? "",
        cuenta: cuenta?.code ?? "",
        nombreCuenta: cuenta?.name ?? "",
        debe: round2(Number(l.debit) || 0),
        haber: round2(Number(l.credit) || 0),
        detalle: l.line_memo ?? "",
      });
    }
  }
  return filas;
}

export const DIARIO_CSV_HEADERS = [
  "Fecha",
  "Asiento",
  "Origen",
  "Concepto",
  "Cuenta",
  "Nombre de la cuenta",
  "Debe",
  "Haber",
  "Detalle",
] as const;

/**
 * El CSV del diario: BOM + CRLF por el MISMO camino que los CSV de Reportes
 * (`rowsToCsv` → `csvCell`, que neutraliza fórmulas). Los conceptos son texto
 * libre de asientos manuales, nombres de trabajadores y Shipping Marks.
 */
export function diarioCsv(filas: readonly FilaDiario[]): string {
  const rows: CsvValue[][] = filas.map((f) => [
    f.fecha,
    f.asiento,
    f.origen,
    f.concepto,
    f.cuenta,
    f.nombreCuenta,
    f.debe,
    f.haber,
    f.detalle,
  ]);
  return "\uFEFF" + rowsToCsv([...DIARIO_CSV_HEADERS], rows);
}

export type RangoDelDiario = { from?: string; to?: string };

/**
 * Valida `?desde=&hasta=` de la exportación. Los dos son opcionales (sin
 * `desde` = desde el primer asiento; sin `hasta` = hasta el último), pero si
 * vienen tienen que ser fechas reales y no estar al revés. Mismo criterio en
 * la pantalla y en la ruta.
 */
export function rangoDelDiario(
  desde: string | null | undefined,
  hasta: string | null | undefined,
): { rango: RangoDelDiario; error: string | null } {
  const d = (desde ?? "").trim();
  const h = (hasta ?? "").trim();
  for (const f of [d, h]) {
    if (f && !isIsoDate(f)) {
      return { rango: {}, error: `La fecha «${f}» no es válida. Usa el formato AAAA-MM-DD.` };
    }
  }
  if (d && h && d > h) {
    return {
      rango: {},
      error: `El rango está al revés: «desde» (${d}) es posterior a «hasta» (${h}).`,
    };
  }
  return { rango: { ...(d ? { from: d } : {}), ...(h ? { to: h } : {}) }, error: null };
}

/** URL de la descarga del diario. */
export function enlaceDelDiario(rango: RangoDelDiario = {}): string {
  const s = new URLSearchParams({ tipo: "diario" });
  if (rango.from) s.set("desde", rango.from);
  if (rango.to) s.set("hasta", rango.to);
  return `/api/studio/contabilidad/export?${s.toString()}`;
}

/** `diario-<desde|inicio>-a-<hasta|hoy>.csv`. */
export function nombreDelDiario(rango: RangoDelDiario, hoy: string): string {
  return `diario-${rango.from ?? "inicio"}-a-${rango.to ?? hoy}.csv`;
}

/** Rótulo del enlace y del botón de descarga del diario (pregunta abierta 3). */
export const ROTULO_DIARIO_CSV = "Descargar el diario asentado (CSV)";

/**
 * Aviso de la pantalla del diario cuando muestra menos asientos de los que hay.
 * null si se ven todos. El total cuenta todos los estados (`countEntries`) y
 * el CSV baja solo los asentados: el aviso dice cuántos trae, para que nadie
 * crea que le faltan los borradores y los anulados.
 */
export function avisoDelDiario(mostrados: number, total: number, asentados: number): string | null {
  if (total <= mostrados) return null;
  const n = (x: number) => x.toLocaleString("es-VE");
  return (
    `Mostrando ${n(mostrados)} de ${n(total)} asientos (los más recientes).` +
    ` El CSV trae solo ${asentados === 1 ? "1 asentado" : `los ${n(asentados)} asentados`}.`
  );
}

// ── Enlaces y CSV de pantalla ──────────────────────────────────

/** A dónde lleva cada documento. Tesorería no tiene ruta de detalle. */
export function enlaceDelDocumento(tipo: TipoDocumento, codigo: string): string {
  if (tipo === "factura") return `/studio/facturacion/${encodeURIComponent(codigo)}`;
  if (tipo === "recibo") return `/studio/cobranzas/recibo/${encodeURIComponent(codigo)}`;
  return "/studio/tesoreria";
}

/** Listado del módulo de cada tipo (para los conteos de anulados). */
export const LISTADO_POR_TIPO: Record<TipoDocumento, string> = {
  factura: "/studio/facturacion",
  recibo: "/studio/cobranzas",
  cxp: "/studio/tesoreria",
  pago_proveedor: "/studio/tesoreria",
};

export function comprobacionCsv(b: BalanceComprobacion, hoy?: Date): ViewCsv | null {
  if (b.filas.length === 0) return null;
  return {
    filename: reportFilename(`contable-balance-comprobacion-${b.corte}`, hoy),
    content: rowsToCsv(
      ["Cuenta", "Nombre", "Tipo", "Debe", "Haber", "Saldo deudor", "Saldo acreedor"],
      b.filas.map((f) => [
        f.code,
        f.name,
        f.type,
        f.debe,
        f.haber,
        f.saldoDeudor,
        f.saldoAcreedor,
      ]),
    ),
  };
}

/** Documentos sin asiento y anulados con asiento vivo, en un solo archivo. */
export function sinAsientoCsv(d: DocumentosSinAsiento, hoy?: Date): ViewCsv | null {
  const todas = [...d.sinAsiento, ...d.anuladosConAsiento];
  if (todas.length === 0) return null;
  return {
    filename: reportFilename("contable-documentos-sin-asiento", hoy),
    content: rowsToCsv(
      ["Tipo", "Documento", "Fecha", "Moneda", "Monto", "Motivo"],
      todas.map((h) => [
        ETIQUETA_TIPO[h.tipo],
        h.codigo,
        h.fecha ?? "",
        h.moneda,
        h.monto,
        ETIQUETA_MOTIVO[h.motivo],
      ]),
    ),
  };
}

export function subdiarioCsv(s: SubdiarioContraMayor, hoy?: Date): ViewCsv {
  const fila = (l: LadoCuadre): CsvValue[] => [
    l.cuenta,
    l.nombre,
    l.subdiarioUsd,
    l.mayorUsd ?? "",
    l.diferenciaUsd ?? "",
    l.documentos,
    l.sinConvertir,
    l.sinTasa,
    ETIQUETA_CUADRE[l.estado],
  ];
  return {
    filename: reportFilename(`contable-subdiario-contra-mayor-${s.fecha}`, hoy),
    content: rowsToCsv(
      [
        "Cuenta",
        "Nombre",
        "Subdiario USD",
        "Mayor USD",
        "Diferencia USD",
        "Documentos",
        "Sin convertir",
        "Sin tasa (al nominal: no USD)",
        "Estado",
      ],
      [fila(s.clientes), fila(s.proveedores)],
    ),
  };
}

// ── Payloads de página ─────────────────────────────────────────

/** Lo que muestra el formulario Desde/Hasta de Reportes (DAT-01). */
export type FiltroReportes = { desde: string; hasta: string; error: string | null };

/**
 * La decisión de la página de Contabilidad › Reportes (DAT-01), pura: lo que
 * muestra el formulario y el rango a calcular. Con un error (fecha inválida,
 * una sola fecha o el rango al revés) el rango es null y NO se calcula nada:
 * ni el mes en curso debajo del error.
 */
export function pedidoDeReportes(
  desde: string | undefined,
  hasta: string | undefined,
  hoy: string,
): { filtro: FiltroReportes; rango: RangoFechas | null } {
  const f = rangoDesdeParams(desde, hasta, hoy);
  return {
    filtro: { ...f.valores, error: f.error },
    rango: f.error ? null : f.rango,
  };
}

export type ReportesDelLibro = {
  rango: RangoFechas;
  /** P&L del período, desde el mayor. */
  pnl: ProfitAndLoss;
  /** Balance general al corte (= rango.to). */
  balance: BalanceSheet;
  /** Balance de comprobación al corte. */
  comprobacion: BalanceComprobacion;
  /** La cifra oficial, con el control del mayor del mismo período. */
  ingreso: IngresoPeriodo;
};

export type CuadreDelLibro = {
  fecha: string;
  subdiario: SubdiarioContraMayor;
  documentos: DocumentosSinAsiento;
};
