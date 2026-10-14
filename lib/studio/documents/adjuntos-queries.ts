/**
 * Adjuntos visibles en el Studio (SDD-0507) · LECTURAS.
 *
 * Una sola definición de «adjunto vivo» para los tres listados y la ficha del
 * cliente, así el número de una fila no puede decir una cosa y la ficha otra:
 *
 *  - de un embarque: `documents` con `entity_type = 'shipment'`, vigente y no
 *    borrado, más `shipment_documents` no borrados;
 *  - de un cliente: `documents` con `entity_type = 'client'`, vigente y no
 *    borrado, más lo de cada embarque NO eliminado con su `client_markbox`.
 *
 * Son los mismos filtros que `listDocumentsByEntity` y `listShipmentDocuments`
 * (lo que pintan las fichas). Todo se lee con el cliente que recibe la función,
 * que en el Studio es el de la sesión: la RLS decide qué se ve, y lo que no se
 * ve no se cuenta. Nunca un cliente admin.
 *
 * Sin migración a propósito: el servidor propio todavía no tiene procedimiento
 * para aplicarlas (`docs/runbooks/servidor-contabo.md` §4). Si el volumen
 * crece, el plan B es una vista `security_invoker` + RPC de conteo; las firmas
 * de estas funciones no cambiarían.
 *
 * Contrato de error: si cualquier lectura falla o no se pudo leer completa,
 * la función devuelve `null`. Quien pinta dice «no se pudo contar»; nunca
 * «Ninguno» sin haber contado. No se registra nada: ni nombres de archivo ni
 * rutas de Storage llegan a un log desde acá.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllByIds } from "@/lib/db/paginate";
import {
  agruparAdjuntos,
  conteoCliente,
  conteoEmbarque,
  type Adjunto,
  type AdjuntosDelCliente,
  type ConteoCliente,
  type ConteoEmbarque,
  type EmbarqueDelCliente,
} from "./adjuntos";

/**
 * Ids por `.in(...)`. 100 UUID son ~3,7 KB de URL: lejos de cualquier tope de
 * línea de petición del gateway. El default de `fetchAllByIds` (500) arma
 * URLs de ~19 KB.
 */
export const IDS_POR_LOTE_ADJUNTOS = 100;

type PageResult = { data: unknown; error: { message: string } | null };

/** Lee todas las filas de unos ids, en lotes y paginado. `null` si quedó incompleta. */
async function leerPorIds<T>(
  ids: readonly string[],
  page: (lote: string[], from: number, to: number) => PromiseLike<PageResult>,
): Promise<T[] | null> {
  if (ids.length === 0) return [];
  const { rows, complete } = await fetchAllByIds<T>(ids, page, {
    idsPerBatch: IDS_POR_LOTE_ADJUNTOS,
  });
  return complete ? rows : null;
}

const unicos = (xs: readonly string[]) => [...new Set(xs.filter((x) => !!x))];

/** Documentos vigentes y no borrados del hub, de entidades de un tipo. */
function docsDelHub<T>(
  supabase: SupabaseClient,
  entityType: "client" | "shipment",
  ids: readonly string[],
  columns: string,
): Promise<T[] | null> {
  return leerPorIds<T>(ids, (lote, from, to) =>
    supabase
      .from("documents")
      .select(columns)
      .eq("entity_type", entityType)
      .eq("is_current", true)
      .is("deleted_at", null)
      .in("entity_id", lote)
      .order("id", { ascending: true })
      .range(from, to),
  );
}

/** Documentos del portal (los ve el cliente) no borrados, de unos embarques. */
function docsDelPortal<T>(
  supabase: SupabaseClient,
  shipmentIds: readonly string[],
  columns: string,
): Promise<T[] | null> {
  return leerPorIds<T>(shipmentIds, (lote, from, to) =>
    supabase
      .from("shipment_documents")
      .select(columns)
      .is("deleted_at", null)
      .in("shipment_id", lote)
      .order("id", { ascending: true })
      .range(from, to),
  );
}

/** Embarques NO eliminados de unos Shipping Marks. */
function embarquesVivosDe<T>(
  supabase: SupabaseClient,
  markboxes: readonly string[],
  columns: string,
): Promise<T[] | null> {
  return leerPorIds<T>(markboxes, (lote, from, to) =>
    supabase
      .from("shipments")
      .select(columns)
      .is("deleted_at", null)
      .in("client_markbox", lote)
      .order("id", { ascending: true })
      .range(from, to),
  );
}

/**
 * Conteo de adjuntos por embarque. Devuelve una entrada por CADA id pedido
 * (cero incluido), o `null` si no se pudo contar.
 */
export async function contarAdjuntosDeEmbarques(
  supabase: SupabaseClient,
  shipmentIds: readonly string[],
): Promise<Map<string, ConteoEmbarque> | null> {
  const ids = unicos(shipmentIds);
  try {
    const [internos, portal] = await Promise.all([
      docsDelHub<{ id: string; entity_id: string }>(supabase, "shipment", ids, "id, entity_id"),
      docsDelPortal<{ id: string; shipment_id: string }>(supabase, ids, "id, shipment_id"),
    ]);
    if (internos === null || portal === null) return null;

    const n = new Map(ids.map((id) => [id, { internos: 0, portal: 0 }]));
    for (const d of internos) {
      const c = n.get(d.entity_id);
      if (c) c.internos += 1;
    }
    for (const d of portal) {
      const c = n.get(d.shipment_id);
      if (c) c.portal += 1;
    }
    return new Map([...n].map(([id, c]) => [id, conteoEmbarque(c.internos, c.portal)]));
  } catch {
    return null;
  }
}

/**
 * Conteo de adjuntos por cliente: su ficha + sus embarques vivos. Devuelve una
 * entrada por CADA cliente pedido (cero incluido), o `null` si no se pudo.
 *
 * Los embarques se cuentan con `contarAdjuntosDeEmbarques`: el total de un
 * cliente no puede usar otra regla que la de la fila de su embarque.
 */
export async function contarAdjuntosDeClientes(
  supabase: SupabaseClient,
  clientes: readonly { id: string; markbox: string }[],
): Promise<Map<string, ConteoCliente> | null> {
  const ids = unicos(clientes.map((c) => c.id));
  const markboxes = unicos(clientes.map((c) => c.markbox));
  try {
    const [ficha, embarques] = await Promise.all([
      docsDelHub<{ id: string; entity_id: string }>(supabase, "client", ids, "id, entity_id"),
      embarquesVivosDe<{ id: string; client_markbox: string }>(
        supabase,
        markboxes,
        "id, client_markbox",
      ),
    ]);
    if (ficha === null || embarques === null) return null;

    const porEmbarque = await contarAdjuntosDeEmbarques(
      supabase,
      embarques.map((e) => e.id),
    );
    if (porEmbarque === null) return null;

    const enFicha = new Map<string, number>();
    for (const d of ficha) enFicha.set(d.entity_id, (enFicha.get(d.entity_id) ?? 0) + 1);

    const porMarkbox = new Map<string, { internos: number; portal: number }>();
    for (const e of embarques) {
      const c = porEmbarque.get(e.id);
      if (!c) continue;
      const acc = porMarkbox.get(e.client_markbox) ?? { internos: 0, portal: 0 };
      acc.internos += c.internos;
      acc.portal += c.portal;
      porMarkbox.set(e.client_markbox, acc);
    }

    const out = new Map<string, ConteoCliente>();
    for (const c of clientes) {
      const emb = porMarkbox.get(c.markbox) ?? { internos: 0, portal: 0 };
      out.set(c.id, conteoCliente(enFicha.get(c.id) ?? 0, emb.internos, emb.portal));
    }
    return out;
  } catch {
    return null;
  }
}

const DOC_COLUMNS =
  "id, entity_id, name, doc_type, folder, content_type, size_bytes, storage_path, created_at, version_no";
const PORTAL_COLUMNS =
  "id, shipment_id, doc_type, file_name, content_type, size_bytes, storage_path, created_at";
const SHIPMENT_COLUMNS = "id, code, origin, destination, client_markbox";

type DocHub = {
  id: string;
  entity_id: string;
  name: string;
  doc_type: string | null;
  folder: string | null;
  content_type: string | null;
  size_bytes: number | null;
  storage_path: string;
  created_at: string;
  version_no: number | null;
};

type DocPortal = {
  id: string;
  shipment_id: string;
  doc_type: string | null;
  file_name: string;
  content_type: string | null;
  size_bytes: number | null;
  storage_path: string;
  created_at: string;
};

function desdeHub(d: DocHub, embarqueId: string | null): Adjunto {
  return {
    id: d.id,
    bucket: "documents",
    visibilidad: "interno",
    nombre: d.name,
    tipo: d.doc_type,
    carpeta: d.folder,
    contentType: d.content_type,
    sizeBytes: d.size_bytes,
    storagePath: d.storage_path,
    createdAt: d.created_at,
    version: d.version_no,
    embarqueId,
  };
}

function desdePortal(d: DocPortal): Adjunto {
  return {
    id: d.id,
    bucket: "shipment-docs",
    visibilidad: "portal",
    nombre: d.file_name,
    tipo: d.doc_type,
    carpeta: null,
    contentType: d.content_type,
    sizeBytes: d.size_bytes,
    storagePath: d.storage_path,
    createdAt: d.created_at,
    version: null,
    embarqueId: d.shipment_id,
  };
}

/**
 * «Todos los adjuntos» de un cliente: los de su ficha y los de sus embarques
 * vivos, agrupados por origen. `null` si no se pudo leer completo.
 */
export async function listarAdjuntosDelCliente(
  supabase: SupabaseClient,
  cliente: { id: string; markbox: string },
): Promise<AdjuntosDelCliente | null> {
  try {
    const [ficha, embarques] = await Promise.all([
      docsDelHub<DocHub>(supabase, "client", [cliente.id], DOC_COLUMNS),
      embarquesVivosDe<EmbarqueDelCliente & { client_markbox: string }>(
        supabase,
        [cliente.markbox],
        SHIPMENT_COLUMNS,
      ),
    ]);
    if (ficha === null || embarques === null) return null;

    const ids = embarques.map((e) => e.id);
    const [internos, portal] = await Promise.all([
      docsDelHub<DocHub>(supabase, "shipment", ids, DOC_COLUMNS),
      docsDelPortal<DocPortal>(supabase, ids, PORTAL_COLUMNS),
    ]);
    if (internos === null || portal === null) return null;

    const adjuntos: Adjunto[] = [
      ...ficha.map((d) => desdeHub(d, null)),
      ...internos.map((d) => desdeHub(d, d.entity_id)),
      ...portal.map(desdePortal),
    ];
    return agruparAdjuntos(
      adjuntos,
      embarques.map(({ id, code, origin, destination }) => ({ id, code, origin, destination })),
    );
  } catch {
    return null;
  }
}
