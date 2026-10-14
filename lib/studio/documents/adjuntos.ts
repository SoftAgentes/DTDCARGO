/**
 * Adjuntos visibles en el Studio (SDD-0507) · tipos y funciones PURAS.
 *
 * Un «adjunto» es lo que hoy muestran las fichas, y nada más:
 *
 *  - en la ficha del cliente, los documentos del hub con `entity_type = 'client'`;
 *  - en la ficha del embarque, los del hub con `entity_type = 'shipment'`
 *    («internos») y los de `shipment_documents` («portal»: el cliente los ve).
 *
 * Las lecturas viven en `adjuntos-queries.ts`. Acá están los conteos, los
 * textos que se pintan y la agrupación de «Todos los adjuntos», sin I/O, para
 * que se prueben solos.
 */

/** Dónde se guarda el archivo. Es también el bucket que hay que firmar. */
export type BucketAdjunto = "documents" | "shipment-docs";

/** Quién lo ve: el equipo («interno») o también el cliente en su portal. */
export type VisibilidadAdjunto = "interno" | "portal";

/** Conteo de un embarque: sus documentos internos y los del portal. */
export type ConteoEmbarque = {
  internos: number;
  portal: number;
  total: number;
};

/** Conteo de un cliente: los de su ficha más los de sus embarques vivos. */
export type ConteoCliente = {
  ficha: number;
  internosEmbarques: number;
  portal: number;
  total: number;
};

export function conteoEmbarque(internos: number, portal: number): ConteoEmbarque {
  return { internos, portal, total: internos + portal };
}

export function conteoCliente(
  ficha: number,
  internosEmbarques: number,
  portal: number,
): ConteoCliente {
  return { ficha, internosEmbarques, portal, total: ficha + internosEmbarques + portal };
}

const plural = (n: number, uno: string, varios: string) => (n === 1 ? uno : varios);

/** «1 adjunto», «5 adjuntos». Con cero, el texto lo decide quien pinta. */
export function textoAdjuntos(total: number): string {
  return `${total} ${plural(total, "adjunto", "adjuntos")}`;
}

/**
 * Desglose de un cliente, para el `title` del indicador:
 * «5 adjuntos: 2 en su ficha · 3 en sus embarques (2 los ve el cliente en el portal)».
 */
export function desgloseCliente(c: ConteoCliente): string {
  if (c.total === 0) return "Sin adjuntos en su ficha ni en sus embarques";
  const partes: string[] = [];
  if (c.ficha > 0) partes.push(`${c.ficha} en su ficha`);
  const embarques = c.internosEmbarques + c.portal;
  if (embarques > 0) {
    const portal =
      c.portal === 0
        ? ""
        : c.portal === embarques
          ? ` (${plural(c.portal, "lo ve", "los ve")} el cliente en el portal)`
          : ` (${c.portal} ${plural(c.portal, "lo ve", "los ve")} el cliente en el portal)`;
    partes.push(`${embarques} en sus embarques${portal}`);
  }
  return `${textoAdjuntos(c.total)}: ${partes.join(" · ")}`;
}

/** Desglose de un embarque: «2 adjuntos: 1 interno · 1 lo ve el cliente en el portal». */
export function desgloseEmbarque(c: ConteoEmbarque): string {
  if (c.total === 0) return "Sin adjuntos";
  const partes: string[] = [];
  if (c.internos > 0) partes.push(`${c.internos} ${plural(c.internos, "interno", "internos")}`);
  if (c.portal > 0) {
    partes.push(`${c.portal} ${plural(c.portal, "lo ve", "los ve")} el cliente en el portal`);
  }
  return `${textoAdjuntos(c.total)}: ${partes.join(" · ")}`;
}

// ── Filtro «con / sin adjuntos» (Embarques y Tracking) ──────────────────

export type FiltroAdjuntos = "todos" | "con" | "sin";

export const FILTRO_ADJUNTOS_OPCIONES: { value: FiltroAdjuntos; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "con", label: "Con adjuntos" },
  { value: "sin", label: "Sin adjuntos" },
];

/**
 * Conteos tal como cruzan de un componente de servidor a uno de cliente: un
 * objeto plano por id. `null` = no se pudo contar.
 */
export type ConteosPorId<C extends { total: number }> = Readonly<Record<string, C>> | null;

export function conteosPorId<C extends { total: number }>(
  mapa: ReadonlyMap<string, C> | null,
): ConteosPorId<C> {
  return mapa === null ? null : Object.fromEntries(mapa);
}

/**
 * ¿La fila pasa el filtro? Un id ausente cuenta como cero: los conteos sólo
 * los arma quien SÍ pudo contar, y traen una entrada por cada id pedido (si no
 * pudo, son `null` y el filtro ni se pinta). Ver `contarAdjuntosDeEmbarques`.
 */
export function pasaFiltroAdjuntos(
  filtro: FiltroAdjuntos,
  conteos: ConteosPorId<{ total: number }>,
  id: string,
): boolean {
  if (filtro === "todos" || conteos === null) return true;
  const total = conteos[id]?.total ?? 0;
  return filtro === "con" ? total > 0 : total === 0;
}

// ── «Todos los adjuntos» de la ficha del cliente ───────────────────────

/** Una fila de la sección. Mismos campos que pinta `DocsPanel`, normalizados. */
export type Adjunto = {
  id: string;
  bucket: BucketAdjunto;
  visibilidad: VisibilidadAdjunto;
  nombre: string;
  /** `doc_type` del hub (texto libre) o del portal (bl/pod/otro). */
  tipo: string | null;
  /** Carpeta del hub; el portal no tiene. */
  carpeta: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  storagePath: string;
  createdAt: string;
  /** Versión vigente en el hub; el portal no versiona. */
  version: number | null;
  /** null = de la ficha del cliente. */
  embarqueId: string | null;
};

export type EmbarqueDelCliente = {
  id: string;
  code: string;
  origin: string | null;
  destination: string | null;
};

export type GrupoAdjuntos =
  | { origen: "cliente"; adjuntos: Adjunto[] }
  | { origen: "embarque"; embarque: EmbarqueDelCliente; adjuntos: Adjunto[] };

export type AdjuntosDelCliente = {
  total: number;
  grupos: GrupoAdjuntos[];
};

const masReciente = (a: Adjunto, b: Adjunto) =>
  b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id);

/**
 * Agrupa por origen: primero la ficha del cliente, después un grupo por
 * embarque ordenado por su adjunto más reciente. Los grupos vacíos no salen.
 * Un adjunto de un embarque que no está en `embarques` se descarta: no hay
 * dónde mostrarlo sin inventar el origen (y la lectura no lo trae).
 */
export function agruparAdjuntos(
  adjuntos: readonly Adjunto[],
  embarques: readonly EmbarqueDelCliente[],
): AdjuntosDelCliente {
  const porEmbarque = new Map(embarques.map((e) => [e.id, [] as Adjunto[]]));
  const ficha: Adjunto[] = [];
  for (const a of adjuntos) {
    if (a.embarqueId === null) ficha.push(a);
    else porEmbarque.get(a.embarqueId)?.push(a);
  }

  const grupos: GrupoAdjuntos[] = [];
  if (ficha.length > 0) {
    grupos.push({ origen: "cliente", adjuntos: [...ficha].sort(masReciente) });
  }
  const deEmbarques = embarques
    .map((embarque) => ({
      origen: "embarque" as const,
      embarque,
      adjuntos: [...(porEmbarque.get(embarque.id) ?? [])].sort(masReciente),
    }))
    .filter((g) => g.adjuntos.length > 0)
    .sort(
      (a, b) =>
        b.adjuntos[0].createdAt.localeCompare(a.adjuntos[0].createdAt) ||
        a.embarque.code.localeCompare(b.embarque.code),
    );
  grupos.push(...deEmbarques);

  const total = grupos.reduce((n, g) => n + g.adjuntos.length, 0);
  return { total, grupos };
}

// ── Firma de «Ver» ─────────────────────────────────────────────────────

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const ARCHIVO = "[A-Za-z0-9._-]{1,200}";

/**
 * Formas de ruta que arman las subidas de hoy:
 *  - hub (`buildDocumentStoragePath`): `{tenant}/{entity_type}/{entity_id}/{uuid}.{ext}`,
 *    y aquí sólo caben cliente y embarque;
 *  - portal (`uploadShipmentDocumentAction`): `{tenant}/{shipment_id}/{uuid}.{ext}`.
 * Cualquier otra cosa se rechaza antes de tocar Storage.
 */
const RUTA_HUB = new RegExp(`^${UUID}/(client|shipment)/${UUID}/${ARCHIVO}$`, "i");
const RUTA_PORTAL = new RegExp(`^${UUID}/${UUID}/${ARCHIVO}$`, "i");

/**
 * Qué módulo hace falta para firmar esta ruta, además de `clients`. `null` si
 * la ruta o el bucket no tienen una forma conocida.
 */
export function moduloDeRutaAdjunto(
  bucket: string,
  storagePath: string,
): "clients" | "tracking" | null {
  if (storagePath.includes("..")) return null;
  if (bucket === "documents") {
    const m = RUTA_HUB.exec(storagePath);
    if (!m) return null;
    return m[1].toLowerCase() === "client" ? "clients" : "tracking";
  }
  if (bucket === "shipment-docs") {
    return RUTA_PORTAL.test(storagePath) ? "tracking" : null;
  }
  return null;
}
