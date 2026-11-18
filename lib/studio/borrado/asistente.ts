/**
 * SDD-0560 · Asistente de borrado de embarques: el PLAN, sin I/O.
 *
 * Cuando un embarque no se puede eliminar (SDD-0522), el asistente le muestra
 * a quien borra (admin) los pasos en orden, uno a la vez, hasta poder
 * eliminarlo. Este archivo decide ese plan a partir de:
 *
 *   · QUÉ BLOQUEA, que lo decide la base: los conteos de
 *     `shipment_delete_blockers` (migr 0476), la MISMA función que usa el
 *     borrado. Acá no se recalcula ninguna guarda;
 *   · el detalle de cada dependencia (código, estado, cobros, asiento), que
 *     lee `asistente-servidor.ts` sólo para nombrar los pasos.
 *
 * Reglas que esta función hace cumplir (y que las pruebas defienden):
 *
 *   1. FALLA CERRADO. Si una lista leída no cuadra EXACTO con el conteo de la
 *      base, si una dependencia es desconocida o si algo no se pudo comprobar,
 *      el plan queda bloqueado y no ofrece ningún paso.
 *   2. SI ALGO NO SE PUEDE RESOLVER, NO SE OFRECE NADA. Un embarque con un
 *      reclamo, entregado, con aduana, costeo o Financiero China no se va a
 *      poder eliminar: anular sus facturas o gastos sólo dejaría documentos
 *      anulados sin ningún beneficio.
 *   3. ORDEN. Primero lo que se resuelve en su módulo (fuera del asistente),
 *      después lo reversible (borrador de factura, P2), después lo que no se
 *      deshace (anular gasto, CxP y factura, P3), y al final el embarque. Así
 *      el asistente nunca anula algo mientras quede otra cosa pendiente.
 *   4. FACTURA CON ASIENTO VIVO: NO SE ANULA. Anular una factura no revierte
 *      su asiento de venta (hallazgo B1 del diagnóstico contable del
 *      2026-10-18). Hasta que esa reparación esté integrada, la factura con
 *      asiento vivo bloquea el plan.
 *   5. FACTURA O CxP CON COBROS/PAGOS: se resuelve en Cobranzas/Tesorería.
 *
 * Sin imports de Supabase ni de React: se prueba sola.
 */

import { isInvoiceStatus, statusLabel } from "@/lib/studio/invoice-types";
import {
  shipmentDeleteWarningsSummary,
  type BloqueoEmbarque,
  type InfoBorradoEmbarque,
} from "./reglas";

// ─── Clasificación de cada guarda de la 0476 ─────────────────────────────────

export type Resolucion = "asistente" | "modulo" | "bloquea";

/**
 * Cómo se resuelve cada guarda del embarque (SDD-0560, tabla «Guardas → paso o
 * bloqueo»). `already_deleted` no está: un embarque eliminado no tiene plan.
 *
 * Facturas y CxP son «asistente» en su caso normal; según su estado pueden
 * pasar a su módulo (con cobros o pagos) o bloquear (factura con asiento vivo).
 */
export const RESOLUCION_DE_GUARDA: Record<Exclude<BloqueoEmbarque, "already_deleted">, Resolucion> = {
  delivered: "bloquea",
  invoices: "asistente",
  expenses: "asistente",
  supplier_bills: "asistente",
  shipment_costs: "bloquea",
  china_finance: "bloquea",
  customs_filings: "bloquea",
  tms_routes: "modulo",
  client_claims: "bloquea",
  naviera_consolidations: "modulo",
  cn_receipts: "modulo",
  purchases: "modulo",
  otro: "bloquea",
};

/**
 * Las guardas que tienen un manejador propio en `calcularPlan` (paso del
 * asistente o de su módulo). TODA otra guarda con conteo bloquea, aunque no
 * tenga texto propio: así una guarda nueva de la base nunca queda abierta por
 * olvido. La prueba exige que esta lista y `RESOLUCION_DE_GUARDA` digan lo mismo.
 */
export const GUARDAS_CON_PASO: ReadonlySet<BloqueoEmbarque> = new Set<BloqueoEmbarque>([
  "invoices",
  "expenses",
  "supplier_bills",
  "tms_routes",
  "naviera_consolidations",
  "cn_receipts",
  "purchases",
]);

// ─── Entrada ─────────────────────────────────────────────────────────────────

export interface EmbarqueRef {
  id: string;
  codigo: string;
}

export interface FacturaDep {
  id: string;
  codigo: string;
  estado: string;
  /** `paid_amount`. Cualquier cosa distinta de 0 cuenta como cobrada. */
  pagado: number;
  /** ¿Tiene un asiento no anulado y no borrado? `null` = no se pudo comprobar. */
  asientoVivo: boolean | null;
}

export interface CxpDep {
  id: string;
  codigo: string;
  estado: string;
  pagado: number;
}

export interface RutaDep {
  id: string;
  codigo: string;
  estado: string;
}

export interface RefDep {
  id: string;
  codigo: string;
}

export interface EntradaPlan {
  embarque: EmbarqueRef;
  /**
   * Lo que dice la 0476 de este embarque. `"fallo"` = no se pudo leer;
   * `"no_encontrado"` = no vino la fila (no existe o no es del tenant).
   */
  info: InfoBorradoEmbarque | "fallo" | "no_encontrado";
  /** Cada lista: `null` = no se pudo leer. */
  facturas: FacturaDep[] | null;
  gastos: RefDep[] | null;
  cxp: CxpDep[] | null;
  rutas: RutaDep[] | null;
  consolidaciones: RefDep[] | null;
  recepciones: RefDep[] | null;
  compras: RefDep[] | null;
}

// ─── Salida ──────────────────────────────────────────────────────────────────

export interface Enlace {
  href: string;
  etiqueta: string;
}

export type AccionAsistente =
  | "eliminar_borrador_factura"
  | "anular_factura"
  | "anular_gasto"
  | "anular_cxp"
  | "eliminar_embarque";

interface PasoComun {
  /** Identidad del paso: el servidor sólo ejecuta el paso cuya clave es la del siguiente. */
  clave: string;
  titulo: string;
  queEs: string;
  consecuencia: string;
  modulo: string;
  enlace: Enlace | null;
}

/** Se hace en su módulo, fuera del asistente. */
export interface PasoModulo extends PasoComun {
  tipo: "modulo";
}

/** Lo ejecuta el asistente con la acción gobernada del módulo dueño. */
export interface PasoAsistente extends PasoComun {
  tipo: "asistente";
  accion: AccionAsistente;
  objetivoId: string;
  codigo: string;
  permanencia: "P2" | "P3";
  friccion: "R2" | "R3";
  pideMotivo: boolean;
  /** Botón del paso: «Anular factura…». */
  boton: string;
  /** Botón del diálogo de confirmación: «Anular factura». */
  confirmar: string;
  /** Lo que se anuncia cuando terminó: «Factura F-2026-0007 anulada.». */
  hecho: string;
}

export type Paso = PasoModulo | PasoAsistente;

export interface Bloqueo {
  clave: string;
  titulo: string;
  detalle: string;
  enlace: Enlace | null;
}

export type PlanBorrado =
  | { estado: "no_disponible"; embarque: EmbarqueRef }
  | { estado: "no_encontrado"; embarque: EmbarqueRef }
  | { estado: "ya_eliminado"; embarque: EmbarqueRef }
  | { estado: "bloqueado"; embarque: EmbarqueRef; bloqueos: Bloqueo[] }
  | { estado: "en_curso"; embarque: EmbarqueRef; pasos: Paso[]; siguiente: Paso };

// ─── Textos ──────────────────────────────────────────────────────────────────

const plural = (n: number, uno: string, varios: string) => (n === 1 ? `1 ${uno}` : `${n} ${varios}`);

/** «a», «a y b», «a, b y c». */
function enumerar(partes: string[]): string {
  if (partes.length <= 1) return partes.join("");
  return `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
}

const codigos = (lista: { codigo: string }[]) => enumerar(lista.map((x) => x.codigo));

export const RUTA = {
  facturacion: "/studio/facturacion",
  cobranzas: "/studio/cobranzas",
  gastos: "/studio/gastos",
  tesoreria: "/studio/tesoreria",
  tms: "/studio/tms",
  naviera: "/studio/naviera",
  cn: "/studio/cn",
  compras: "/studio/ordenes-compra",
  reclamos: "/studio/reclamos",
  aduana: "/studio/seniat",
  costing: "/studio/costing",
  chino: "/studio/financiero-china",
} as const;

const enlaceFactura = (codigo: string): Enlace => ({
  href: `${RUTA.facturacion}/${encodeURIComponent(codigo)}`,
  etiqueta: `Ver la factura ${codigo}`,
});

/** Lo que bloquea siempre, por guarda de la 0476. */
const BLOQUEO_FIJO: Record<
  "delivered" | "client_claims" | "customs_filings" | "shipment_costs" | "china_finance" | "otro",
  (n: number) => Bloqueo
> = {
  delivered: () => ({
    clave: "delivered",
    titulo: "Ya se entregó",
    detalle: "La entrega es un hecho cumplido y no se borra. Un embarque entregado no se puede eliminar.",
    enlace: null,
  }),
  client_claims: (n) => ({
    clave: "client_claims",
    titulo: n === 1 ? "Tiene 1 reclamo" : `Tiene ${n} reclamos`,
    detalle:
      "Un reclamo es evidencia: el asistente no lo anula ni lo elimina. Mientras exista, el embarque no se puede eliminar. Revísalo en Reclamos.",
    enlace: { href: RUTA.reclamos, etiqueta: "Ver en Reclamos" },
  }),
  customs_filings: (n) => ({
    clave: "customs_filings",
    titulo: n === 1 ? "Tiene 1 expediente de Aduana" : `Tiene ${n} expedientes de Aduana`,
    detalle: "Aduana no tiene una acción para retirar un expediente, así que el embarque no se puede eliminar.",
    enlace: { href: RUTA.aduana, etiqueta: "Ver en Aduana" },
  }),
  shipment_costs: () => ({
    clave: "shipment_costs",
    titulo: "Tiene un costeo",
    detalle: "Costing no tiene una acción para retirar el costeo de un embarque, así que el embarque no se puede eliminar.",
    enlace: { href: RUTA.costing, etiqueta: "Ver en Costing" },
  }),
  china_finance: (n) => ({
    clave: "china_finance",
    titulo: `Tiene ${plural(n, "movimiento", "movimientos")} en Financiero China`,
    detalle:
      "Conversiones, libro de socios o compensaciones de reclamos: son hechos financieros y no hay una acción para retirarlos. El embarque no se puede eliminar.",
    enlace: { href: RUTA.chino, etiqueta: "Ver en Financiero China" },
  }),
  otro: (n) => ({
    clave: "otro",
    titulo: `Tiene ${plural(n, "dependencia", "dependencias")} que el asistente no conoce`,
    detalle: "Por seguridad, el asistente no ofrece ningún paso mientras no sepa qué es. Avísale al equipo técnico.",
    enlace: null,
  }),
};

const ORDEN_BLOQUEOS_FIJOS = [
  "delivered",
  "client_claims",
  "customs_filings",
  "shipment_costs",
  "china_finance",
  "otro",
] as const;

type BloqueoFijo = (typeof ORDEN_BLOQUEOS_FIJOS)[number];

const esBloqueoFijo = (k: string): k is BloqueoFijo => (ORDEN_BLOQUEOS_FIJOS as readonly string[]).includes(k);

/** Una guarda sin manejador ni texto propio: bloquea igual (falla cerrado). */
function bloqueoGenerico(k: string, n: number): Bloqueo {
  return {
    clave: `guarda:${k}`,
    titulo: `Tiene ${plural(n, "dependencia", "dependencias")} que el asistente no resuelve`,
    detalle: "Por seguridad, el asistente no ofrece ningún paso mientras exista. Revísalo en su módulo.",
    enlace: null,
  };
}

function sinConfirmar(clave: string, n: number, cosa: string, enlace: Enlace): Bloqueo {
  return {
    clave: `sin_confirmar:${clave}`,
    titulo: `No se pudo comprobar ${cosa}`,
    detalle: `La base cuenta ${n}, pero no se pudieron leer todas con su código. Por seguridad no se ofrece ningún paso. Vuelve a revisar; si sigue igual, revísalo en su módulo.`,
    enlace,
  };
}

// ─── Pasos ───────────────────────────────────────────────────────────────────

function pasoRecepciones(lista: RefDep[]): PasoModulo {
  return {
    tipo: "modulo",
    clave: "modulo:cn_receipts",
    titulo:
      lista.length === 1
        ? `Sacar la recepción ${lista[0].codigo} del contenedor`
        : `Sacar ${lista.length} recepciones del contenedor`,
    queEs: `Este embarque es el contenedor de ${plural(lista.length, "recepción", "recepciones")} del Almacén CN: ${codigos(lista)}.`,
    consecuencia:
      "En Almacén CN, devuelve cada recepción a «Pendiente de consolidación». Salen del contenedor y siguen vivas en el almacén.",
    modulo: "Almacén CN",
    enlace: { href: RUTA.cn, etiqueta: "Abrir Almacén CN" },
  };
}

function pasoConsolidaciones(lista: RefDep[]): PasoModulo {
  return {
    tipo: "modulo",
    clave: "modulo:naviera_consolidations",
    titulo:
      lista.length === 1
        ? `Sacar el embarque de la consolidación ${lista[0].codigo}`
        : `Sacar el embarque de ${lista.length} consolidaciones`,
    queEs: `El embarque está asignado en Naviera a ${plural(lista.length, "consolidación", "consolidaciones")}: ${codigos(lista)}.`,
    consecuencia: "En Naviera, quita la pieza de este embarque. La consolidación sigue existiendo con el resto de su carga.",
    modulo: "Naviera",
    enlace: { href: RUTA.naviera, etiqueta: "Abrir Naviera" },
  };
}

function pasoCompras(lista: RefDep[]): PasoModulo {
  return {
    tipo: "modulo",
    clave: "modulo:purchases",
    titulo:
      lista.length === 1
        ? `Cancelar o desvincular la compra ${lista[0].codigo}`
        : `Cancelar o desvincular ${lista.length} compras`,
    queEs: `${lista.length === 1 ? "Una compra del cliente apunta" : `${lista.length} compras del cliente apuntan`} a este embarque: ${codigos(lista)}.`,
    consecuencia:
      "Si es de prueba, cancélala en Órdenes de compra. Mientras siga viva, el Portal la muestra unida a este embarque.",
    modulo: "Órdenes de compra",
    enlace: { href: RUTA.compras, etiqueta: "Abrir Órdenes de compra" },
  };
}

function pasoRutas(lista: RutaDep[]): PasoModulo {
  return {
    tipo: "modulo",
    clave: "modulo:tms_routes",
    titulo: lista.length === 1 ? `Cancelar la ruta ${lista[0].codigo}` : `Cancelar ${lista.length} rutas`,
    queEs: `${lista.length === 1 ? "Hay una ruta" : `Hay ${lista.length} rutas`} de última milla sin cancelar para este embarque: ${codigos(lista)}.`,
    consecuencia: "En TMS, cancela la ruta con un motivo. El camión y el chofer quedan disponibles.",
    modulo: "TMS",
    enlace: { href: RUTA.tms, etiqueta: "Abrir TMS" },
  };
}

function pasoCobros(f: FacturaDep): PasoModulo {
  return {
    tipo: "modulo",
    clave: `modulo:cobros:${f.id}`,
    titulo: `Anular los cobros de la factura ${f.codigo}`,
    queEs: `La factura ${f.codigo} tiene cobros registrados.`,
    consecuencia:
      "El asistente no anula una factura cobrada. En Cobranzas, anula sus recibos con un motivo; cuando quede sin cobros, el asistente te ofrece anularla.",
    modulo: "Cobranzas",
    enlace: { href: RUTA.cobranzas, etiqueta: "Abrir Cobranzas" },
  };
}

function pasoPagosCxp(c: CxpDep): PasoModulo {
  return {
    tipo: "modulo",
    clave: `modulo:pagos:${c.id}`,
    titulo: `Anular los pagos de la cuenta por pagar ${c.codigo}`,
    queEs: `La cuenta por pagar ${c.codigo} tiene pagos registrados.`,
    consecuencia:
      "Una cuenta por pagar con pagos no se anula. En Tesorería, anula primero sus órdenes de pago; después el asistente te ofrece anularla.",
    modulo: "Tesorería",
    enlace: { href: RUTA.tesoreria, etiqueta: "Abrir Tesorería" },
  };
}

function pasoBorradorFactura(f: FacturaDep): PasoAsistente {
  return {
    tipo: "asistente",
    accion: "eliminar_borrador_factura",
    clave: `eliminar_borrador_factura:${f.id}`,
    objetivoId: f.id,
    codigo: f.codigo,
    titulo: `Eliminar la factura en borrador ${f.codigo}`,
    queEs: "Factura en borrador de Facturación: nunca se emitió.",
    consecuencia:
      "Sale de Facturación. Como nunca se emitió, no entra al libro de ventas ni tiene asiento. Queda registrada en la auditoría de Facturación.",
    modulo: "Facturación",
    enlace: enlaceFactura(f.codigo),
    permanencia: "P2",
    friccion: "R2",
    pideMotivo: false,
    boton: "Eliminar borrador…",
    confirmar: "Eliminar borrador",
    hecho: `Factura en borrador ${f.codigo} eliminada.`,
  };
}

function pasoAnularGasto(g: RefDep): PasoAsistente {
  return {
    tipo: "asistente",
    accion: "anular_gasto",
    clave: `anular_gasto:${g.id}`,
    objetivoId: g.id,
    codigo: g.codigo,
    titulo: `Anular el gasto ${g.codigo}`,
    queEs: "Gasto cargado a este embarque en Gastos.",
    consecuencia:
      "Queda anulado en Gastos y su asiento contable se anula en la misma operación. No se borra: se conserva con tu motivo.",
    modulo: "Gastos",
    enlace: { href: RUTA.gastos, etiqueta: "Ver en Gastos" },
    permanencia: "P3",
    friccion: "R3",
    pideMotivo: true,
    boton: "Anular gasto…",
    confirmar: "Anular gasto",
    hecho: `Gasto ${g.codigo} anulado.`,
  };
}

function pasoAnularCxp(c: CxpDep): PasoAsistente {
  return {
    tipo: "asistente",
    accion: "anular_cxp",
    clave: `anular_cxp:${c.id}`,
    objetivoId: c.id,
    codigo: c.codigo,
    titulo: `Anular la cuenta por pagar ${c.codigo}`,
    queEs: "Cuenta por pagar a un proveedor, sin pagos, en Tesorería.",
    consecuencia:
      "Queda anulada en Tesorería con tu motivo y se anula su asiento de causación. No se borra: se conserva anulada.",
    modulo: "Tesorería",
    enlace: { href: RUTA.tesoreria, etiqueta: "Ver en Tesorería" },
    permanencia: "P3",
    friccion: "R3",
    pideMotivo: true,
    boton: "Anular cuenta por pagar…",
    confirmar: "Anular cuenta por pagar",
    hecho: `Cuenta por pagar ${c.codigo} anulada.`,
  };
}

function pasoAnularFactura(f: FacturaDep): PasoAsistente {
  const estado = isInvoiceStatus(f.estado) ? statusLabel(f.estado).toLowerCase() : f.estado;
  return {
    tipo: "asistente",
    accion: "anular_factura",
    clave: `anular_factura:${f.id}`,
    objetivoId: f.id,
    codigo: f.codigo,
    titulo: `Anular la factura ${f.codigo}`,
    queEs: `Factura ${estado} en Facturación, sin cobros.`,
    consecuencia:
      "Deja de sumar en el libro de ventas, y su asiento de venta se revierte con un contra-asiento en el período abierto. No se borra, porque es un documento fiscal: se conserva anulada, con tu motivo. Si tenía créditos de referido aplicados, vuelven al cliente.",
    modulo: "Facturación",
    enlace: enlaceFactura(f.codigo),
    permanencia: "P3",
    friccion: "R3",
    pideMotivo: true,
    boton: "Anular factura…",
    confirmar: "Anular factura",
    hecho: `Factura ${f.codigo} anulada.`,
  };
}

function pasoEliminarEmbarque(e: EmbarqueRef, info: InfoBorradoEmbarque): PasoAsistente {
  const avisos = shipmentDeleteWarningsSummary([info]);
  return {
    tipo: "asistente",
    accion: "eliminar_embarque",
    clave: `eliminar_embarque:${e.id}`,
    objetivoId: e.id,
    codigo: e.codigo,
    titulo: `Eliminar el embarque ${e.codigo}`,
    queEs: "Ya no queda nada vivo que dependa de él.",
    consecuencia: [
      "Sale de Embarques, Tracking, el Portal del cliente y el calendario, y se cancelan sus avisos pendientes.",
      "El código no se vuelve a usar y solo se recupera desde la base de datos.",
      avisos,
    ]
      .filter(Boolean)
      .join(" "),
    modulo: "Embarques",
    enlace: null,
    permanencia: "P2",
    friccion: "R3",
    pideMotivo: true,
    boton: "Eliminar embarque…",
    confirmar: "Eliminar embarque",
    hecho: `Embarque ${e.codigo} eliminado. Ya no aparece en Embarques, Tracking ni el Portal.`,
  };
}

// ─── El plan ─────────────────────────────────────────────────────────────────

/**
 * La lista sólo vale si cuadra EXACTO con el conteo de la base y no repite
 * ids. Sale ordenada por código: el plan no depende del orden de la lectura.
 */
function confirmada<T extends { id: string; codigo: string }>(lista: T[] | null, n: number): T[] | null {
  if (lista === null || lista.length !== n) return null;
  if (new Set(lista.map((x) => x.id)).size !== n) return null;
  return [...lista].sort((a, b) => a.codigo.localeCompare(b.codigo) || a.id.localeCompare(b.id));
}

/** `paid_amount` distinto de 0 (o ilegible) cuenta como cobrado: falla cerrado. */
const tieneCobros = (pagado: number) => !(Number.isFinite(pagado) && pagado === 0);

/**
 * El plan de borrado de un embarque. Ver la cabecera para las cinco reglas.
 * Lo usan la lectura (para pintar el asistente) y la ejecución de cada paso
 * (para recalcular en el servidor antes de actuar).
 */
export function calcularPlan(e: EntradaPlan): PlanBorrado {
  const embarque = e.embarque;
  if (e.info === "fallo") return { estado: "no_disponible", embarque };
  if (e.info === "no_encontrado") return { estado: "no_encontrado", embarque };
  const info = e.info;
  const b = info.bloqueos;
  if ((b.already_deleted ?? 0) > 0) return { estado: "ya_eliminado", embarque };

  const bloqueos: Bloqueo[] = [];
  const recepciones: PasoModulo[] = [];
  const consolidaciones: PasoModulo[] = [];
  const compras: PasoModulo[] = [];
  const rutas: PasoModulo[] = [];
  const cobros: PasoModulo[] = [];
  const pagos: PasoModulo[] = [];
  const borradores: PasoAsistente[] = [];
  const gastos: PasoAsistente[] = [];
  const cxps: PasoAsistente[] = [];
  const facturas: PasoAsistente[] = [];

  // 1. Lo que no tiene paso bloquea siempre: primero las guardas conocidas, en
  //    orden fijo; después cualquier otra que llegue con conteo.
  for (const k of ORDEN_BLOQUEOS_FIJOS) {
    const n = b[k] ?? 0;
    if (n > 0) bloqueos.push(BLOQUEO_FIJO[k](n));
  }
  for (const [k, n] of Object.entries(b) as [BloqueoEmbarque, number | undefined][]) {
    if ((n ?? 0) > 0 && k !== "already_deleted" && !GUARDAS_CON_PASO.has(k) && !esBloqueoFijo(k)) {
      bloqueos.push(bloqueoGenerico(k, n ?? 1));
    }
  }

  // 2. Lo que se resuelve en su módulo.
  const nRecepciones = b.cn_receipts ?? 0;
  if (nRecepciones > 0) {
    const lista = confirmada(e.recepciones, nRecepciones);
    if (lista) recepciones.push(pasoRecepciones(lista));
    else bloqueos.push(sinConfirmar("cn_receipts", nRecepciones, "las recepciones del contenedor", { href: RUTA.cn, etiqueta: "Abrir Almacén CN" }));
  }

  const nConsolidaciones = b.naviera_consolidations ?? 0;
  if (nConsolidaciones > 0) {
    const lista = confirmada(e.consolidaciones, nConsolidaciones);
    if (lista) consolidaciones.push(pasoConsolidaciones(lista));
    else bloqueos.push(sinConfirmar("naviera_consolidations", nConsolidaciones, "las consolidaciones", { href: RUTA.naviera, etiqueta: "Abrir Naviera" }));
  }

  const nCompras = b.purchases ?? 0;
  if (nCompras > 0) {
    const lista = confirmada(e.compras, nCompras);
    if (lista) compras.push(pasoCompras(lista));
    else bloqueos.push(sinConfirmar("purchases", nCompras, "las compras unidas", { href: RUTA.compras, etiqueta: "Abrir Órdenes de compra" }));
  }

  const nRutas = b.tms_routes ?? 0;
  if (nRutas > 0) {
    const lista = confirmada(e.rutas, nRutas);
    if (!lista) {
      bloqueos.push(sinConfirmar("tms_routes", nRutas, "las rutas de TMS", { href: RUTA.tms, etiqueta: "Abrir TMS" }));
    } else {
      // Una ruta completada es última milla ocurrida: no se deshace.
      const completadas = lista.filter((r) => r.estado === "completado");
      const pendientes = lista.filter((r) => r.estado !== "completado");
      if (completadas.length > 0) {
        bloqueos.push({
          clave: "tms_completada",
          titulo:
            completadas.length === 1
              ? `La ruta ${completadas[0].codigo} ya se completó`
              : `${completadas.length} rutas ya se completaron`,
          detalle: "La última milla ocurrió y eso no se deshace. El embarque no se puede eliminar.",
          enlace: { href: RUTA.tms, etiqueta: "Ver en TMS" },
        });
      }
      if (pendientes.length > 0) rutas.push(pasoRutas(pendientes));
    }
  }

  // 3. Facturas: según su estado, al asistente, a Cobranzas o bloqueo.
  const nFacturas = b.invoices ?? 0;
  if (nFacturas > 0) {
    const lista = confirmada(e.facturas, nFacturas);
    if (!lista) {
      bloqueos.push(sinConfirmar("invoices", nFacturas, "las facturas", { href: RUTA.facturacion, etiqueta: "Abrir Facturación" }));
    } else {
      for (const f of lista) {
        // SDD-0573 (0497): anular una factura emitida revierte su asiento de
        // venta en la misma transacción (B1 resuelto), así que su asiento ya no
        // la bloquea. Un BORRADOR sí: el asistente lo elimina, no lo anula, y
        // eliminarlo no revierte un asiento que no debería tener.
        if (f.estado === "borrador" && f.asientoVivo === null) {
          bloqueos.push({
            clave: `asiento_sin_comprobar:${f.id}`,
            titulo: `No se pudo comprobar el asiento de la factura ${f.codigo}`,
            detalle: "Sin saber si este borrador tiene un asiento vivo, el asistente no ofrece eliminarlo. Vuelve a revisar.",
            enlace: enlaceFactura(f.codigo),
          });
        } else if (f.estado === "borrador" && f.asientoVivo) {
          bloqueos.push({
            clave: `asiento_vivo:${f.id}`,
            titulo: `El borrador ${f.codigo} tiene un asiento vivo`,
            detalle:
              "Un borrador no debería tener asiento, y eliminarlo no lo revierte. El asistente no lo elimina: revisa ese asiento en Contabilidad.",
            enlace: enlaceFactura(f.codigo),
          });
        } else if (tieneCobros(f.pagado) || f.estado === "parcial" || f.estado === "pagada") {
          cobros.push(pasoCobros(f));
        } else if (f.estado === "borrador") {
          borradores.push(pasoBorradorFactura(f));
        } else if (f.estado === "emitida" || f.estado === "vencida") {
          facturas.push(pasoAnularFactura(f));
        } else {
          bloqueos.push({
            clave: `factura_estado:${f.id}`,
            titulo: `La factura ${f.codigo} está en un estado que el asistente no conoce`,
            detalle: "Por seguridad no se ofrece ningún paso. Revísala en Facturación.",
            enlace: enlaceFactura(f.codigo),
          });
        }
      }
    }
  }

  // 4. Gastos: siempre al asistente (la anulación revierte su asiento en la misma transacción).
  const nGastos = b.expenses ?? 0;
  if (nGastos > 0) {
    const lista = confirmada(e.gastos, nGastos);
    if (lista) for (const g of lista) gastos.push(pasoAnularGasto(g));
    else bloqueos.push(sinConfirmar("expenses", nGastos, "los gastos", { href: RUTA.gastos, etiqueta: "Abrir Gastos" }));
  }

  // 5. Cuentas por pagar: sin pagos al asistente; con pagos, a Tesorería.
  const nCxp = b.supplier_bills ?? 0;
  if (nCxp > 0) {
    const lista = confirmada(e.cxp, nCxp);
    if (!lista) {
      bloqueos.push(sinConfirmar("supplier_bills", nCxp, "las cuentas por pagar", { href: RUTA.tesoreria, etiqueta: "Abrir Tesorería" }));
    } else {
      for (const c of lista) {
        if (tieneCobros(c.pagado) || c.estado === "parcial" || c.estado === "pagada") pagos.push(pasoPagosCxp(c));
        else if (c.estado === "pendiente") cxps.push(pasoAnularCxp(c));
        else {
          bloqueos.push({
            clave: `cxp_estado:${c.id}`,
            titulo: `La cuenta por pagar ${c.codigo} está en un estado que el asistente no conoce`,
            detalle: "Por seguridad no se ofrece ningún paso. Revísala en Tesorería.",
            enlace: { href: RUTA.tesoreria, etiqueta: "Abrir Tesorería" },
          });
        }
      }
    }
  }

  // Regla 2: si algo no se puede resolver, no se ofrece nada.
  if (bloqueos.length > 0) return { estado: "bloqueado", embarque, bloqueos };

  // Regla 3: módulo → reversible (P2) → lo que no se deshace (P3) → el embarque.
  const pasos: Paso[] = [
    ...recepciones,
    ...consolidaciones,
    ...compras,
    ...rutas,
    ...cobros,
    ...pagos,
    ...borradores,
    ...gastos,
    ...cxps,
    ...facturas,
    pasoEliminarEmbarque(embarque, info),
  ];
  return { estado: "en_curso", embarque, pasos, siguiente: pasos[0] };
}

// ─── Mensajes de los estados sin pasos ───────────────────────────────────────

export const MENSAJE_PLAN = {
  no_disponible: "No se pudo revisar qué depende de este embarque. Vuelve a intentar en un momento.",
  no_encontrado: "Este embarque ya no existe o no tienes acceso a él. Recarga la lista.",
  ya_eliminado: "Este embarque ya estaba eliminado. Recarga la lista.",
  bloqueado: "Este embarque no se puede eliminar por ahora: hay algo que el asistente no puede resolver.",
  cambio:
    "El plan cambió mientras lo revisabas: alguien más resolvió o agregó algo. Revisa el paso siguiente antes de seguir.",
  en_modulo: "Este paso se hace en su módulo. Cuando lo termines, vuelve a revisar el plan.",
} as const;
