/**
 * SDD-0643 · Embarques por contenedor (lógica pura, sin I/O).
 *
 * La vista Embarques del Studio empieza por contenedores (nivel 1), después
 * los clientes de cada contenedor (nivel 2) y después los embarques de cada
 * cliente (nivel 3). Este módulo arma esos tres niveles y decide:
 *
 *  - Si un contenedor es un consolidado («DDP 64») o un FCL («FCL 63»).
 *    No hay una columna que lo diga: se deduce de los servicios de los
 *    embarques que lleva (ver `tipoDeContenedor`).
 *  - El número DTD del contenedor («64»). Tampoco hay columna: el cargador de
 *    la SDD-0543 lo escribe en `consolidations.notes` como
 *    «… contenedor DTD #64 …». Sin ese texto, no hay número (no se inventa).
 *  - Los embarques que no van en ningún contenedor van al grupo «Sin contenedor».
 */

import { roundCbm } from "@/lib/shared/cbm";
import {
  groupShipmentsByClient,
  type ClientShipmentGroup,
  type ShipmentListRow,
} from "./shipment-queries";
import type { ShipmentService } from "./shipment-types";

/** Un contenedor tal como lo necesita la vista. Sin datos de clientes. */
export type ContenedorDeEmbarques = {
  id: string;
  /** `DTD-CONSOL-NNNN`. */
  ref: string;
  /** Número ISO del contenedor (`TLLU7792550`), si se cargó. */
  containerNo: string | null;
  /** Número DTD («64»), leído de las notas del contenedor. */
  numeroDtd: number | null;
  /** `consolidations.status` (consolidando/cerrado/zarpado/arribado…). */
  status: string;
  naviera: string | null;
  /** ETA del zarpe (YYYY-MM-DD). */
  eta: string | null;
  createdAt: string;
};

/**
 * Lo que la página le pasa a la vista. `porEmbarque` dice en qué contenedor va
 * cada embarque (la asignación más reciente gana).
 */
export type ContenedoresDeEmbarques = {
  contenedores: ContenedorDeEmbarques[];
  porEmbarque: Record<string, string>;
  /**
   * SDD-0661: cajas de cada embarque en su contenedor vigente
   * (`consolidation_items.pieces`, lo que escribe la carga de consolidados).
   * Sin dato para un embarque, ese embarque suma 0.
   */
  cajasPorEmbarque?: Record<string, number>;
  /**
   * SDD-0661: cajas recibidas por contenedor y Shipping Mark. Un contenedor sin
   * entrada = sin recepción todavía: la vista dice «Sin recepción», no 0.
   */
  recibidasPorContenedor?: Record<string, Record<string, number>>;
};

/** SDD-0661: un cliente dentro de un contenedor, con sus cajas. */
export type ClienteDeContenedor = ClientShipmentGroup & {
  /** Suma de cajas de sus embarques. `null` en «Sin contenedor» (no hay carga). */
  cajas: number | null;
  /** Cajas recibidas. `null` = el contenedor no tiene recepción (o es «Sin contenedor»). */
  recibidas: number | null;
  /** SDD-0665: envíos suyos sin peso cargado (`weight_kg` nulo); no suman. */
  enviosSinPeso: number;
};

/**
 * SDD-0661 → SDD-0690 (versión B de Sam, 2026-11-20) · Dinero de unos embarques: facturas vivas no
 * anuladas, emitidas y pre-órdenes (`borrador`), cuyo `shipment_id` es uno de ellos.
 *  - `totalUsd` («Total del embarque») suma `total_amount`; `pagadoUsd` («Pagado») suma `paid_amount`;
 *    el «Saldo» es la resta ({@link saldoUsd}). Sólo facturas en USD; `otraMoneda` cuenta las que no
 *    se sumaron. El bolívar es solo una vista.
 *  - `sinFacturarUsd` («Sin facturar») es la parte del total que todavía son pre-órdenes.
 *  - `facturas === 0` → no hay precio cargado: la vista no inventa un 0.
 */
export type MontoAcumulado = {
  facturas: number;
  totalUsd: number;
  pagadoUsd: number;
  otraMoneda: number;
  /** SDD-0689: pre-órdenes (estado `borrador`: precio cargado, todavía sin emitir). */
  borradores: number;
  /** SDD-0689: USD de las pre-órdenes: el «Sin facturar» del encabezado. */
  sinFacturarUsd: number;
  /** SDD-0690: los documentos, para el enlace a la factura o a la pre-orden y para «Facturar». */
  documentos: DocumentoDeEmbarque[];
};

/** SDD-0690: una factura o pre-orden, tal como la enlaza y la emite Embarques. */
export type DocumentoDeEmbarque = {
  invoiceId: string;
  invoiceCode: string;
  /** `true` = pre-orden (estado `borrador`). */
  preorden: boolean;
  /** `null` si no está en USD (no suma ni se emite desde Embarques). */
  totalUsd: number | null;
};

/** SDD-0690 · «Saldo» = total menos lo pagado. */
export function saldoUsd(m: Pick<MontoAcumulado, "totalUsd" | "pagadoUsd">): number {
  return redondear(m.totalUsd - m.pagadoUsd);
}

/**
 * SDD-0690 · El documento al que lleva el monto en color: la factura si hay una emitida; si no, la
 * pre-orden. `null` si no hay ninguno.
 */
export function documentoDeEnlace(m: Pick<MontoAcumulado, "documentos">): DocumentoDeEmbarque | null {
  return m.documentos.find((d) => !d.preorden) ?? m.documentos[0] ?? null;
}

/**
 * SDD-0690 §3.5 · Un cliente está facturado si tiene al menos una factura emitida viva y ninguna
 * pre-orden pendiente. Sin documentos (sin precio) no está facturado.
 */
export function clienteFacturado(m: Pick<MontoAcumulado, "documentos">): boolean {
  return m.documentos.some((d) => !d.preorden) && !m.documentos.some((d) => d.preorden);
}

/**
 * SDD-0690 §3.5 · «Facturado»: todos los clientes del contenedor ENTERO (sin filtro) tienen su factura
 * emitida viva. Uno sin precio o con la pre-orden pendiente basta para que no lo esté.
 */
export function contenedorFacturado(
  g: Pick<GrupoContenedor, "completo">,
  porEmbarque: Readonly<Record<string, MontoAcumulado>>,
): boolean {
  const clientes = g.completo.clientes;
  return (
    clientes.length > 0 && clientes.every((cl) => clienteFacturado(sumarMontos(cl.shipments, porEmbarque)))
  );
}

/**
 * Lo que la página le pasa a la vista SOLO si la persona ve Facturación.
 * Por embarque, para sumarlo igual por cliente y por contenedor (y respetar
 * los filtros). `no_disponible` = la lectura falló.
 */
export type MontosDeContenedores =
  | { estado: "lista"; porEmbarque: Record<string, MontoAcumulado> }
  | { estado: "no_disponible" };

/** Una factura tal como la necesita la suma (sin cliente, sin líneas). */
export type FacturaDeEmbarque = {
  /** SDD-0690: para el enlace y para emitir la pre-orden. */
  id?: string | null;
  invoice_code?: string | null;
  shipment_id: string | null;
  currency: string | null;
  total_amount: number | string | null;
  paid_amount: number | string | null;
  status: string | null;
};

function montoVacio(): MontoAcumulado {
  return {
    facturas: 0,
    totalUsd: 0,
    pagadoUsd: 0,
    otraMoneda: 0,
    borradores: 0,
    sinFacturarUsd: 0,
    documentos: [],
  };
}

function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Agrupa las facturas por embarque. Excluye anuladas (la consulta ya excluye
 * las borradas); los borradores cuentan, son lo que se va a cobrar.
 */
export function montosPorEmbarque(
  facturas: readonly FacturaDeEmbarque[],
): Record<string, MontoAcumulado> {
  const out: Record<string, MontoAcumulado> = {};
  for (const f of facturas) {
    if (!f.shipment_id || f.status === "anulada") continue;
    const m = (out[f.shipment_id] ??= montoVacio());
    m.facturas += 1;
    const total = Number(f.total_amount);
    const pagado = Number(f.paid_amount ?? 0);
    const preorden = f.status === "borrador";
    const enUsd = f.currency === "USD" && Number.isFinite(total);
    if (preorden) m.borradores += 1;
    if (enUsd) {
      m.totalUsd = redondear(m.totalUsd + total);
      if (preorden) m.sinFacturarUsd = redondear(m.sinFacturarUsd + total);
      if (Number.isFinite(pagado)) m.pagadoUsd = redondear(m.pagadoUsd + pagado);
    } else {
      m.otraMoneda += 1;
    }
    if (f.id && f.invoice_code) {
      m.documentos.push({
        invoiceId: f.id,
        invoiceCode: f.invoice_code,
        preorden,
        totalUsd: enUsd ? redondear(total) : null,
      });
    }
  }
  return out;
}

/** Suma el dinero de unos embarques (un cliente, un contenedor). */
export function sumarMontos(
  filas: readonly Pick<ShipmentListRow, "id">[],
  porEmbarque: Readonly<Record<string, MontoAcumulado>>,
): MontoAcumulado {
  const t = montoVacio();
  for (const r of filas) {
    const m = porEmbarque[r.id];
    if (!m) continue;
    t.facturas += m.facturas;
    t.totalUsd = redondear(t.totalUsd + m.totalUsd);
    t.pagadoUsd = redondear(t.pagadoUsd + m.pagadoUsd);
    t.otraMoneda += m.otraMoneda;
    t.borradores += m.borradores;
    t.sinFacturarUsd = redondear(t.sinFacturarUsd + m.sinFacturarUsd);
    t.documentos.push(...(m.documentos ?? []));
  }
  return t;
}

export type TipoContenedor = "fcl" | "consolidado";

export const SIN_CONTENEDOR_KEY = "__sin_contenedor";

export type GrupoContenedor = {
  /** id del contenedor, o `SIN_CONTENEDOR_KEY`. */
  key: string;
  /** `null` para el grupo «Sin contenedor». */
  contenedor: ContenedorDeEmbarques | null;
  /** `null` para el grupo «Sin contenedor». */
  tipo: TipoContenedor | null;
  /** «DDP 64», «FCL 63» o «Sin contenedor». */
  nombre: string;
  clientes: ClienteDeContenedor[];
  embarques: number;
  totalCbm: number;
  /** SDD-0661: suma de las cajas de sus clientes. `null` en «Sin contenedor». */
  cajas: number | null;
  /** SDD-0661: suma de las recibidas de sus clientes; `null` sin recepción. */
  recibidas: number | null;
  /** SDD-0665: suma de `shipments.weight_kg` de sus clientes (kg). */
  pesoKg: number;
  /** SDD-0665: envíos sin peso cargado; no suman al peso. */
  enviosSinPeso: number;
  alertas: number;
  /**
   * SDD-0689: el contenedor entero, sin la pestaña ni la búsqueda. El encabezado suma el peso y el
   * «Sin facturar» sobre esto, para que el total no cambie según la pestaña abierta.
   */
  completo: {
    envios: readonly ShipmentListRow[];
    /**
     * SDD-0690: los clientes del contenedor entero. «Facturar», «Facturar todo» y «Facturado» se
     * calculan sobre esto: con un filtro puesto no se ofrece teclear a quien tiene pre-orden.
     */
    clientes: ClienteDeContenedor[];
    pesoKg: number;
    enviosSinPeso: number;
  };
};

const SERVICIOS_FCL: ReadonlySet<ShipmentService> = new Set<ShipmentService>([
  "fcl_directo",
  "fcl_bodega",
]);

/** Lee el número DTD que el cargador (SDD-0543) deja en las notas. */
export function numeroDtdDeNotas(notes: string | null | undefined): number | null {
  if (!notes) return null;
  const m = /contenedor\s+DTD\s*#\s*(\d{1,4})\b/i.exec(notes);
  if (!m) return null;
  const n = Number.parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * `YYYY-MM-DD` → «12 dic. 2026». Se formatea en UTC sobre la fecha UTC, así la
 * zona de quien mira no corre el día (en Caracas, UTC-4, «2026-12-12» como
 * `new Date("2026-12-12")` saldría el 11).
 */
export function formatFecha(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (!m) return ymd;
  return new Intl.DateTimeFormat("es-VE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

/** Llave de cliente: Shipping Mark o, si falta, el nombre (como SDD-0012). */
function llaveCliente(r: Pick<ShipmentListRow, "client_markbox" | "client_name">): string {
  return r.client_markbox?.trim() || `__name:${(r.client_name ?? "").trim().toLowerCase()}`;
}

/**
 * FCL = contenedor de un solo dueño. Se reconoce de dos maneras:
 *  - todos sus embarques son de servicio FCL (`fcl_directo` o `fcl_bodega`), o
 *  - lleva al menos un embarque FCL y todos sus embarques son del mismo
 *    cliente (Sam, 2026-11-16: «el 63 es de un solo cliente… varios
 *    embarques adentro de un solo contenedor»).
 * Con embarques de otro cliente (DDP o LCL), es un consolidado: así quedan
 * las modalidades `ddp` y `mixto`. Sin embarques: consolidado.
 */
export function tipoDeContenedor(
  filas: readonly Pick<ShipmentListRow, "shipment_service" | "client_markbox" | "client_name">[],
): TipoContenedor {
  if (filas.length === 0) return "consolidado";
  const fcl = filas.filter((r) => SERVICIOS_FCL.has(r.shipment_service));
  if (fcl.length === filas.length) return "fcl";
  if (fcl.length > 0 && new Set(filas.map(llaveCliente)).size === 1) return "fcl";
  return "consolidado";
}

/**
 * Prefijo del rótulo. Sam usó dos formas para el consolidado el 2026-11-16
 * («Contenedor 64» y «DDP 64»); el DG confirmó ese día «DDP 64» para los
 * consolidados propios y «FCL 63» para los FCL (spec §1 y §3.3). Se usa «DDP»
 * cuando el contenedor lleva carga puerta a puerta (DDP) y «Contenedor» si no
 * (p. ej., sólo LCL), porque llamarlo DDP sería falso.
 */
export function prefijoDeContenedor(
  tipo: TipoContenedor,
  servicios: readonly ShipmentService[],
): "FCL" | "DDP" | "Contenedor" {
  if (tipo === "fcl") return "FCL";
  return servicios.includes("puerta_a_puerta_DDP") ? "DDP" : "Contenedor";
}

/** Nombre visible: «DDP 64» o «FCL 63». Sin número, el ISO o la ref. */
export function nombreDeContenedor(
  c: ContenedorDeEmbarques,
  prefijo: "FCL" | "DDP" | "Contenedor",
): string {
  const ident = c.numeroDtd != null ? String(c.numeroDtd) : c.containerNo?.trim() || c.ref;
  return `${prefijo} ${ident}`;
}

function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Filtro «Contenedor»: número DTD exacto («64», «#64», «DDP 64», «contenedor 64»,
 * «FCL 63»; de 1 a 4 cifras) o parte del número ISO o de la ref (`TLLU779`,
 * `7792550`, `CONSOL-0012`).
 * Vacío = todos.
 */
export function contenedorCoincide(c: ContenedorDeEmbarques | null, consulta: string): boolean {
  const q = normalizar(consulta);
  if (!q) return true;
  if (!c) return false;
  const soloNumero = /^(?:contenedor|fcl|ddp)?\s*#?\s*(\d{1,4})$/.exec(q);
  // Un número corto es el número DTD y nada más: «64» no debe traer un ISO
  // que por casualidad tenga «64» adentro.
  if (soloNumero) return c.numeroDtd != null && Number(soloNumero[1]) === c.numeroDtd;
  const compacto = q.replace(/\s+/g, "");
  return (
    (c.containerNo ?? "").toLowerCase().replace(/\s+/g, "").includes(compacto) ||
    c.ref.toLowerCase().includes(compacto)
  );
}

/** Filtro «Cliente»: nombre (sin acentos ni mayúsculas) o Shipping Mark. */
export function clienteCoincide(r: ShipmentListRow, consulta: string): boolean {
  const q = normalizar(consulta);
  if (!q) return true;
  return (
    normalizar(r.client_name ?? "").includes(q) ||
    normalizar(r.client_markbox ?? "").includes(q)
  );
}

/** SDD-0661: cajas de unos embarques; sin dato, el embarque suma 0. */
export function sumarCajas(
  filas: readonly Pick<ShipmentListRow, "id">[],
  cajasPorEmbarque: Readonly<Record<string, number>>,
): number {
  let total = 0;
  for (const r of filas) total += cajasPorEmbarque[r.id] ?? 0;
  return total;
}

/**
 * Arma los tres niveles. Orden de los contenedores: los que tienen alertas
 * primero; después por número DTD descendente (el más nuevo arriba); los que
 * no tienen número, por fecha de creación descendente. «Sin contenedor» va
 * siempre al final. Un contenedor sin embarques en `rows` no aparece.
 *
 * `todas` son los embarques SIN filtrar (tabs, servicio, búsqueda): el tipo y
 * el rótulo de cada contenedor salen de ahí, no de lo que dejó el filtro. Si
 * no, un mixto como el 64 filtrado por «Servicio = FCL» diría «FCL 64».
 */
export function agruparPorContenedor(
  rows: readonly ShipmentListRow[],
  datos: ContenedoresDeEmbarques,
  todas: readonly ShipmentListRow[] = rows,
): GrupoContenedor[] {
  const porId = new Map(datos.contenedores.map((c) => [c.id, c]));
  const llaveDe = (r: ShipmentListRow): string => {
    const cid = datos.porEmbarque[r.id];
    return cid && porId.has(cid) ? cid : SIN_CONTENEDOR_KEY;
  };
  const porContenedor = (lista: readonly ShipmentListRow[]) => {
    const m = new Map<string, ShipmentListRow[]>();
    for (const r of lista) {
      const key = llaveDe(r);
      const l = m.get(key);
      if (l) l.push(r);
      else m.set(key, [r]);
    }
    return m;
  };
  const filas = porContenedor(rows);
  const completas = porContenedor(todas);

  const grupos: GrupoContenedor[] = [];
  for (const [key, lista] of filas) {
    const contenedor = key === SIN_CONTENEDOR_KEY ? null : porId.get(key) ?? null;
    // `lista` siempre es un subconjunto de `completas`, salvo que el caller
    // pase un `todas` que no la contenga; entonces se cae a `lista`.
    const base = completas.get(key) ?? lista;
    const tipo = contenedor ? tipoDeContenedor(base) : null;
    const cajasDe = datos.cajasPorEmbarque ?? {};
    const recibidasDe = contenedor ? datos.recibidasPorContenedor?.[contenedor.id] : undefined;
    const clientesDe = (l: readonly ShipmentListRow[]): ClienteDeContenedor[] =>
      groupShipmentsByClient([...l]).map((g) => ({
        ...g,
        // La misma persona puede estar en dos contenedores: la llave del
        // acordeón del cliente tiene que ser única en toda la pantalla.
        groupKey: `${key}::${g.groupKey}`,
        // SDD-0661: «Sin contenedor» no tiene carga de la que salgan cajas.
        cajas: contenedor ? sumarCajas(g.shipments, cajasDe) : null,
        recibidas: recibidasDe ? recibidasDe[g.clientMarkbox?.trim() ?? ""] ?? 0 : null,
        // SDD-0665: el peso sale de la misma fila que el CBM (`shipments`).
        enviosSinPeso: g.shipments.filter((r) => r.weight_kg == null).length,
      }));
    const clientes = clientesDe(lista);
    let totalCbm = 0;
    let alertas = 0;
    let cajas = 0;
    let recibidas = 0;
    let pesoKg = 0;
    let enviosSinPeso = 0;
    for (const g of clientes) {
      pesoKg += g.stats.totalWeight;
      enviosSinPeso += g.enviosSinPeso;
      totalCbm += g.stats.totalCbm;
      alertas += g.stats.alertCount;
      cajas += g.cajas ?? 0;
      recibidas += g.recibidas ?? 0;
    }
    grupos.push({
      key,
      contenedor,
      tipo,
      nombre:
        contenedor && tipo
          ? nombreDeContenedor(
              contenedor,
              prefijoDeContenedor(tipo, base.map((r) => r.shipment_service)),
            )
          : "Sin contenedor",
      clientes,
      embarques: lista.length,
      totalCbm: roundCbm(totalCbm),
      cajas: contenedor ? cajas : null,
      recibidas: recibidasDe ? recibidas : null,
      pesoKg: Math.round(pesoKg * 100) / 100,
      enviosSinPeso,
      alertas,
      completo: {
        envios: base,
        clientes: base === lista ? clientes : clientesDe(base),
        pesoKg:
          Math.round(base.reduce((s, r) => s + (r.weight_kg != null ? Number(r.weight_kg) : 0), 0) * 100) /
          100,
        enviosSinPeso: base.filter((r) => r.weight_kg == null).length,
      },
    });
  }

  grupos.sort((a, b) => {
    if (!a.contenedor) return 1;
    if (!b.contenedor) return -1;
    if (b.alertas !== a.alertas) return b.alertas - a.alertas;
    const na = a.contenedor.numeroDtd;
    const nb = b.contenedor.numeroDtd;
    if (na != null && nb != null && na !== nb) return nb - na;
    if (na != null && nb == null) return -1;
    if (na == null && nb != null) return 1;
    return b.contenedor.createdAt.localeCompare(a.contenedor.createdAt);
  });
  return grupos;
}
