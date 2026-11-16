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
};

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
  clientes: ClientShipmentGroup[];
  embarques: number;
  totalCbm: number;
  alertas: number;
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
 * («Contenedor 64» y «DDP 64»); se usa «DDP» cuando el contenedor lleva carga
 * puerta a puerta (DDP) y «Contenedor» si no (p. ej., sólo LCL). Pendiente de
 * confirmar por el DG (spec §3.3).
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
    const clientes = groupShipmentsByClient(lista).map((g) => ({
      ...g,
      // La misma persona puede estar en dos contenedores: la llave del
      // acordeón del cliente tiene que ser única en toda la pantalla.
      groupKey: `${key}::${g.groupKey}`,
    }));
    let totalCbm = 0;
    let alertas = 0;
    for (const g of clientes) {
      totalCbm += g.stats.totalCbm;
      alertas += g.stats.alertCount;
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
      totalCbm: Math.round(totalCbm * 1000) / 1000,
      alertas,
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
