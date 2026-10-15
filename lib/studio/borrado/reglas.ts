/**
 * SDD-0522 · Regla pura del borrado de embarques y recepciones del Almacén CN.
 *
 * QUÉ BLOQUEA lo decide la base: `shipment_delete_blockers_internal` y
 * `warehouse_receipt_cn_delete_blockers_internal` (migr 0476) devuelven un
 * jsonb tipo → conteo, y las RPC de borrado usan ESA misma función. Acá vive lo
 * que la UI y la server action necesitan decidir igual:
 *
 *   · leer ese jsonb sin abrir de más: una clave desconocida (una guarda que
 *     agregue una migración futura) cuenta como «otro» y bloquea igual;
 *   · el motivo de bloqueo por fila, con el mismo texto en la casilla
 *     deshabilitada y en el error del servidor (patrón `quoteDeleteBlockReason`
 *     de SDD-0300);
 *   · el lote (1 a 100 ids uuid distintos) y el resultado todo o nada.
 *
 * Sin imports de Supabase ni de React: se prueba sola.
 */

import type { I18nKey } from "@/lib/i18n";

/** Tope de un lote, el mismo que exige la base (`soft_delete_ids_internal`). */
export const MAX_LOTE_BORRADO = 100;

export const BLOQUEOS_EMBARQUE = [
  "already_deleted",
  "delivered",
  "invoices",
  "expenses",
  "supplier_bills",
  "shipment_costs",
  "china_finance",
  "customs_filings",
  "tms_routes",
  "client_claims",
  "naviera_consolidations",
  "cn_receipts",
  "purchases",
] as const;
export type BloqueoEmbarque = (typeof BLOQUEOS_EMBARQUE)[number] | "otro";

export const AVISOS_EMBARQUE = [
  "documents",
  "sent_notifications",
  "scheduled_notifications",
  "converted_quotes",
] as const;
export type AvisoEmbarque = (typeof AVISOS_EMBARQUE)[number];

export const BLOQUEOS_RECEPCION = [
  "already_deleted",
  "consolidated",
  "dispatch_orders",
  "purchase",
  "sales_order",
  "ve_receipts",
  "stowed_boxes",
] as const;
export type BloqueoRecepcion = (typeof BLOQUEOS_RECEPCION)[number] | "otro";

export const AVISOS_RECEPCION = ["boxes"] as const;
export type AvisoRecepcion = (typeof AVISOS_RECEPCION)[number];

export type Conteos<K extends string> = Partial<Record<K, number>>;

export interface InfoBorrado<B extends string, A extends string> {
  bloqueos: Conteos<B>;
  avisos: Conteos<A>;
}
export type InfoBorradoEmbarque = InfoBorrado<BloqueoEmbarque, AvisoEmbarque>;
export type InfoBorradoRecepcion = InfoBorrado<BloqueoRecepcion, AvisoRecepcion>;

function esObjeto(raw: unknown): raw is Record<string, unknown> {
  return typeof raw === "object" && raw !== null && !Array.isArray(raw);
}

function conteoValido(v: unknown): number | null {
  return typeof v === "number" && Number.isInteger(v) && v > 0 ? v : null;
}

/**
 * jsonb de bloqueos → conteos. FALLA CERRADO: lo que no se entiende bloquea.
 * Una clave desconocida suma a «otro»; un valor que no es un entero positivo
 * cuenta 1; algo que no es un objeto es «otro».
 */
export function parseBloqueos<K extends string>(
  raw: unknown,
  conocidos: readonly K[],
): Conteos<K | "otro"> {
  if (!esObjeto(raw)) return { otro: 1 } as Conteos<K | "otro">;
  const out: Conteos<K | "otro"> = {};
  for (const [clave, valor] of Object.entries(raw)) {
    const n = conteoValido(valor) ?? 1;
    const k = (conocidos as readonly string[]).includes(clave) ? (clave as K) : "otro";
    out[k] = (out[k] ?? 0) + n;
  }
  return out;
}

/** jsonb de avisos → conteos. Los avisos no bloquean: lo desconocido se ignora. */
export function parseAvisos<K extends string>(raw: unknown, conocidos: readonly K[]): Conteos<K> {
  const out: Conteos<K> = {};
  if (!esObjeto(raw)) return out;
  for (const [clave, valor] of Object.entries(raw)) {
    const n = conteoValido(valor);
    if (n !== null && (conocidos as readonly string[]).includes(clave)) out[clave as K] = n;
  }
  return out;
}

function hayBloqueos(c: Conteos<string>): boolean {
  return Object.values(c).some((n) => (n ?? 0) > 0);
}

/** «a», «a y b», «a, b y c». */
function enumerar(partes: string[]): string {
  if (partes.length <= 1) return partes.join("");
  return `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
}

const plural = (n: number, uno: string, varios: string) => (n === 1 ? `1 ${uno}` : `${n} ${varios}`);

/** Lo que tiene un embarque, con el módulo donde se resuelve. */
const FRASE_EMBARQUE: Record<Exclude<BloqueoEmbarque, "already_deleted" | "delivered">, (n: number) => string> = {
  invoices: (n) => `${plural(n, "factura sin anular", "facturas sin anular")} (Facturación)`,
  expenses: (n) => `${plural(n, "gasto", "gastos")} (Gastos)`,
  supplier_bills: (n) => `${plural(n, "cuenta por pagar", "cuentas por pagar")} (Tesorería)`,
  shipment_costs: (n) => `${plural(n, "costeo", "costeos")} (Costing)`,
  china_finance: (n) => `${plural(n, "movimiento", "movimientos")} en Financiero China`,
  customs_filings: (n) => `${plural(n, "expediente", "expedientes")} de Aduana`,
  tms_routes: (n) => `${plural(n, "ruta sin cancelar", "rutas sin cancelar")} (TMS)`,
  client_claims: (n) => `${plural(n, "reclamo", "reclamos")} (Reclamos)`,
  naviera_consolidations: (n) => `${plural(n, "consolidación", "consolidaciones")} en Naviera`,
  cn_receipts: (n) => `${plural(n, "recepción", "recepciones")} en Almacén CN`,
  purchases: (n) => `${plural(n, "compra unida", "compras unidas")} (PreAlertas)`,
  otro: (n) => plural(n, "dependencia más", "dependencias más"),
};

export const SIN_DATOS_EMBARQUE =
  "No se pudo comprobar qué depende de este embarque. Recarga la página.";

/**
 * Por qué no se puede eliminar este embarque, o `null` si se puede.
 *
 * Sin información (la lectura falló o la fila no vino) también bloquea: la UI
 * no ofrece lo que no pudo comprobar. Quien decide de verdad es la RPC.
 */
export function shipmentDeleteBlockReason(info: InfoBorradoEmbarque | null | undefined): string | null {
  if (!info) return SIN_DATOS_EMBARQUE;
  const b = info.bloqueos;
  if (!hayBloqueos(b)) return null;
  if (b.already_deleted) return "Ya estaba eliminado. Recarga la lista.";
  if (b.delivered) return "No se puede eliminar: ya se entregó, y la entrega no se borra.";
  const partes: string[] = [];
  for (const k of [...BLOQUEOS_EMBARQUE, "otro"] as BloqueoEmbarque[]) {
    if (k === "already_deleted" || k === "delivered") continue;
    const n = b[k] ?? 0;
    if (n > 0) partes.push(FRASE_EMBARQUE[k](n));
  }
  return `No se puede eliminar: tiene ${enumerar(partes)}. Primero anula, elimina o desvincula eso en su módulo.`;
}

/**
 * Lo que conviene saber antes de confirmar, sumado sobre los embarques
 * elegidos. No bloquea nada. `null` si no hay nada que avisar.
 */
export function shipmentDeleteWarningsSummary(infos: (InfoBorradoEmbarque | null | undefined)[]): string | null {
  const total = (k: AvisoEmbarque) => infos.reduce((s, i) => s + (i?.avisos[k] ?? 0), 0);
  const adjuntos = total("documents");
  const enviados = total("sent_notifications");
  const pendientes = total("scheduled_notifications");
  const estimados = total("converted_quotes");
  const frases: string[] = [];
  const conservan = [
    adjuntos > 0 ? plural(adjuntos, "adjunto", "adjuntos") : null,
    enviados > 0 ? plural(enviados, "aviso ya enviado", "avisos ya enviados") : null,
  ].filter((x): x is string => x !== null);
  if (conservan.length > 0) frases.push(`Se conservan ${enumerar(conservan)}.`);
  if (pendientes > 0) {
    frases.push(pendientes === 1 ? "Se cancela 1 aviso pendiente." : `Se cancelan ${pendientes} avisos pendientes.`);
  }
  if (estimados > 0) {
    frases.push(
      estimados === 1
        ? "1 estimado queda marcado como convertido en un embarque eliminado."
        : `${estimados} estimados quedan marcados como convertidos en un embarque eliminado.`,
    );
  }
  return frases.length > 0 ? frases.join(" ") : null;
}

// ─── Recepciones (bilingüe: la UI traduce cada tipo) ─────────────────────────

export type BloqueoRecepcionVisible = BloqueoRecepcion | "sin_datos";

export interface BloqueoContado<K extends string> {
  kind: K;
  count: number;
}

/**
 * Por qué no se puede eliminar esta recepción: la lista de tipos, en orden
 * fijo, o `[]` si se puede. Sin información también bloquea («sin_datos»).
 */
export function receiptDeleteBlockers(
  info: InfoBorradoRecepcion | null | undefined,
): BloqueoContado<BloqueoRecepcionVisible>[] {
  if (!info) return [{ kind: "sin_datos", count: 1 }];
  const out: BloqueoContado<BloqueoRecepcionVisible>[] = [];
  for (const k of [...BLOQUEOS_RECEPCION, "otro"] as BloqueoRecepcion[]) {
    const n = info.bloqueos[k] ?? 0;
    if (n > 0) out.push({ kind: k, count: n });
  }
  return out;
}

/** La clave i18n del motivo de cada tipo (es-VE y zh-CN). */
export const CLAVE_BLOQUEO_RECEPCION: Record<BloqueoRecepcionVisible, I18nKey> = {
  already_deleted: "warehouse_cn.delete.blocker.already_deleted",
  consolidated: "warehouse_cn.delete.blocker.consolidated",
  dispatch_orders: "warehouse_cn.delete.blocker.dispatch_orders",
  purchase: "warehouse_cn.delete.blocker.purchase",
  sales_order: "warehouse_cn.delete.blocker.sales_order",
  ve_receipts: "warehouse_cn.delete.blocker.ve_receipts",
  stowed_boxes: "warehouse_cn.delete.blocker.stowed_boxes",
  otro: "warehouse_cn.delete.blocker.otro",
  sin_datos: "warehouse_cn.delete.blocker.sin_datos",
};

/** Cajas vivas que se retiran con las recepciones elegidas. */
export function receiptBoxesToRetire(infos: (InfoBorradoRecepcion | null | undefined)[]): number {
  return infos.reduce((s, i) => s + (i?.avisos.boxes ?? 0), 0);
}

// ─── El lote ─────────────────────────────────────────────────────────────────

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type LoteNormalizado =
  | { ok: true; ids: string[] }
  | { ok: false; motivo: "vacio" | "invalido" | "maximo" };

/** 1 a 100 ids uuid distintos, en el orden en que llegaron. */
export function normalizarLote(ids: unknown): LoteNormalizado {
  if (!Array.isArray(ids) || ids.length === 0) return { ok: false, motivo: "vacio" };
  const vistos = new Set<string>();
  for (const id of ids) {
    if (typeof id !== "string" || !UUID.test(id)) return { ok: false, motivo: "invalido" };
    vistos.add(id.toLowerCase());
  }
  if (vistos.size > MAX_LOTE_BORRADO) return { ok: false, motivo: "maximo" };
  return { ok: true, ids: [...vistos] };
}

// ─── El resultado de la RPC (todo o nada) ────────────────────────────────────

export type Outcome = "deleted" | "blocked" | "not_found" | "held";

export interface FilaBorrado<B extends string> {
  id: string;
  codigo: string | null;
  outcome: Outcome;
  bloqueos: Conteos<B>;
}

export type ResultadoBorrado<B extends string> =
  | { estado: "eliminado"; codigos: string[] }
  | { estado: "rechazado"; bloqueadas: FilaBorrado<B>[]; noEncontradas: number }
  | { estado: "error"; tipo: "permiso" | "entrada" | "fallo" | "sin_confirmar" };

const OUTCOMES: readonly Outcome[] = ["deleted", "blocked", "not_found", "held"];

/**
 * Filas de la RPC → resultado. Exige exactamente una fila por id pedido; si no,
 * no se sabe qué pasó y se dice así («sin_confirmar»), nunca «eliminado».
 */
export function interpretarFilas<K extends string>(
  data: unknown,
  idKey: "shipment_id" | "receipt_id",
  idsPedidos: string[],
  conocidos: readonly K[],
): ResultadoBorrado<K | "otro"> {
  if (!Array.isArray(data)) return { estado: "error", tipo: "sin_confirmar" };
  const filas: FilaBorrado<K | "otro">[] = [];
  for (const raw of data) {
    if (!esObjeto(raw)) return { estado: "error", tipo: "sin_confirmar" };
    const id = raw[idKey];
    const outcome = raw.outcome;
    if (typeof id !== "string" || !OUTCOMES.includes(outcome as Outcome)) {
      return { estado: "error", tipo: "sin_confirmar" };
    }
    filas.push({
      id: id.toLowerCase(),
      codigo: typeof raw.code === "string" ? raw.code : null,
      outcome: outcome as Outcome,
      bloqueos: outcome === "blocked" ? parseBloqueos(raw.blockers, conocidos) : {},
    });
  }
  const pedidos = new Set(idsPedidos.map((i) => i.toLowerCase()));
  const devueltos = new Set(filas.map((f) => f.id));
  if (filas.length !== pedidos.size || [...pedidos].some((i) => !devueltos.has(i))) {
    return { estado: "error", tipo: "sin_confirmar" };
  }
  const borradas = filas.filter((f) => f.outcome === "deleted");
  if (borradas.length === filas.length) {
    return { estado: "eliminado", codigos: borradas.map((f) => f.codigo ?? "").filter(Boolean) };
  }
  // Todo o nada: si una se borró y otra no, la base rompió su contrato.
  if (borradas.length > 0) return { estado: "error", tipo: "sin_confirmar" };
  return {
    estado: "rechazado",
    bloqueadas: filas.filter((f) => f.outcome === "blocked"),
    noEncontradas: filas.filter((f) => f.outcome === "not_found").length,
  };
}

/** Error de PostgREST/Postgres → tipo. 42501 permiso, 22023 entrada; el resto, fallo. */
export function tipoDeError(error: { code?: string | null } | null | undefined): "permiso" | "entrada" | "fallo" {
  if (error?.code === "42501") return "permiso";
  if (error?.code === "22023") return "entrada";
  return "fallo";
}

// ─── Mensajes del Studio para embarques (es-VE) ──────────────────────────────

export const MENSAJE_LOTE_EMBARQUES: Record<"vacio" | "invalido" | "maximo", string> = {
  vacio: "Elige al menos un embarque.",
  invalido: "La selección no es válida. Recarga la lista y vuelve a elegir.",
  maximo: `Elige hasta ${MAX_LOTE_BORRADO} embarques por vez.`,
};

const MENSAJE_ERROR_EMBARQUES: Record<"permiso" | "entrada" | "fallo" | "sin_confirmar", string> = {
  permiso: "No tienes permiso para eliminar embarques. Solo un administrador puede hacerlo.",
  entrada: "La selección o el motivo no son válidos. Revísalos y vuelve a intentar.",
  fallo: "No se pudo eliminar. No se borró ningún embarque; intenta de nuevo.",
  sin_confirmar: "No se pudo confirmar el borrado. Recarga la lista para ver cómo quedó.",
};

export type ResultadoAccionEmbarques =
  | { ok: true; deleted: number; codes: string[] }
  | { ok?: false; error: string };

/**
 * El resultado de la RPC en el mensaje que ve el operador. El rechazo usa el
 * MISMO motivo que la casilla deshabilitada (`shipmentDeleteBlockReason`).
 */
export function mensajeResultadoEmbarques(r: ResultadoBorrado<BloqueoEmbarque>): ResultadoAccionEmbarques {
  if (r.estado === "eliminado") return { ok: true, deleted: r.codigos.length, codes: r.codigos };
  if (r.estado === "error") return { error: MENSAJE_ERROR_EMBARQUES[r.tipo] };
  const lineas = r.bloqueadas.map(
    (f) => `${f.codigo ?? "Un embarque"}: ${shipmentDeleteBlockReason({ bloqueos: f.bloqueos, avisos: {} })}`,
  );
  if (r.noEncontradas > 0) {
    lineas.push(
      r.noEncontradas === 1
        ? "1 embarque ya no existe o no tienes acceso a él: recarga la lista."
        : `${r.noEncontradas} embarques ya no existen o no tienes acceso a ellos: recarga la lista.`,
    );
  }
  return { error: `No se eliminó ningún embarque. ${lineas.join(" ")}` };
}

// ─── Resultado para el Almacén CN (bilingüe, por código de error) ────────────

export type DeleteReceiptsErrorCode =
  | "permission_denied"
  | "invalid_input"
  | "cn_bulk_max_exceeded"
  | "cn_delete_reason_short"
  | "cn_delete_reason_long"
  | "cn_delete_blocked"
  | "cn_delete_not_found"
  | "cn_delete_failed"
  | "cn_delete_unconfirmed";

export type ResultadoAccionRecepciones =
  | { ok: true; deleted: number; codes: string[] }
  | {
      ok?: false;
      error?: string;
      errorCode: DeleteReceiptsErrorCode;
      errorParams?: Record<string, string | number>;
      blocked?: { id: string; code: string | null; blockers: BloqueoContado<BloqueoRecepcionVisible>[] }[];
    };

export function codigoResultadoRecepciones(r: ResultadoBorrado<BloqueoRecepcion>): ResultadoAccionRecepciones {
  if (r.estado === "eliminado") return { ok: true, deleted: r.codigos.length, codes: r.codigos };
  if (r.estado === "error") {
    const codigo: Record<typeof r.tipo, DeleteReceiptsErrorCode> = {
      permiso: "permission_denied",
      entrada: "invalid_input",
      fallo: "cn_delete_failed",
      sin_confirmar: "cn_delete_unconfirmed",
    };
    return { errorCode: codigo[r.tipo] };
  }
  if (r.bloqueadas.length === 0) return { errorCode: "cn_delete_not_found" };
  return {
    errorCode: "cn_delete_blocked",
    errorParams: { count: r.bloqueadas.length },
    blocked: r.bloqueadas.map((f) => ({
      id: f.id,
      code: f.codigo,
      blockers: receiptDeleteBlockers({ bloqueos: f.bloqueos, avisos: {} }),
    })),
  };
}
