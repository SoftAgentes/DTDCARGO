/**
 * Queries del Hub de Documentos (DMS · SDD-0049 Slice A). Funciones PURAS que
 * reciben un `SupabaseClient`. La visibilidad la decide la RLS de tabla
 * (`documents by tenant`): estas funciones NO agregan filtro de tenant, confían
 * en la RLS — igual que el resto del Studio.
 *
 * Slice A es read-only. El upload/delete (que escribe + firma signed URLs) es
 * Slice B (server actions).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  FOLDERS,
  subIds,
  type DocumentEntityType,
  type DocumentRow,
} from "./types";

const COLUMNS =
  "id, tenant_id, entity_type, entity_id, folder, doc_type, name, storage_path, content_type, size_bytes, status, valid_until, uploaded_by, created_at, updated_at, deleted_at";

/**
 * Documentos adjuntos a una entidad concreta (el panel embebible de Slice B),
 * recientes primero. `none` no aplica acá (un documento sin entidad no se
 * consulta por entidad).
 */
export async function listDocumentsByEntity(
  supabase: SupabaseClient,
  entityType: DocumentEntityType,
  entityId: string,
): Promise<DocumentRow[]> {
  const { data, error } = await supabase
    .from("documents")
    .select(COLUMNS)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data as DocumentRow[];
}

/**
 * Todos los documentos del tenant (la tabla del hub). Filtros opcionales:
 *  - `folder`: id de subcarpeta (match exacto) o id de grupo top-level
 *    (expande a todas sus subcarpetas).
 *  - `q`: texto libre, busca en name + doc_type (ilike).
 */
export async function listAllDocuments(
  supabase: SupabaseClient,
  opts: { folder?: string; q?: string } = {},
): Promise<DocumentRow[]> {
  let query = supabase
    .from("documents")
    .select(COLUMNS)
    .is("deleted_at", null);

  if (opts.folder && opts.folder !== "all") {
    const group = FOLDERS.find((g) => g.id === opts.folder);
    if (group) {
      query = query.in("folder", subIds(opts.folder));
    } else {
      query = query.eq("folder", opts.folder);
    }
  }

  const q = opts.q?.trim();
  if (q) {
    const safe = q.replace(/[%,()]/g, " ");
    query = query.or(`name.ilike.%${safe}%,doc_type.ilike.%${safe}%`);
  }

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as DocumentRow[];
}

/**
 * Conteo de documentos por subcarpeta + el total `all`. Devuelve un mapa
 * { folderId: count }. El conteo por grupo top-level lo deriva el consumidor
 * (sumando sus subcarpetas) — acá guardamos las hojas + `all`.
 */
export async function folderCounts(
  supabase: SupabaseClient,
): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("documents")
    .select("folder")
    .is("deleted_at", null);

  const counts: Record<string, number> = { all: 0 };
  if (error || !data) return counts;

  for (const row of data as { folder: string }[]) {
    counts.all += 1;
    counts[row.folder] = (counts[row.folder] ?? 0) + 1;
  }
  return counts;
}

/**
 * Documentos con vencimiento dentro de los próximos `windowDays` (default 30)
 * o ya vencidos — el filtro "por vencer / vencido" del hub. Devuelve recientes
 * de vencimiento primero (los más urgentes arriba). `today` se inyecta para
 * testear (YYYY-MM-DD).
 */
export async function expiringDocuments(
  supabase: SupabaseClient,
  today: string,
  windowDays = 30,
): Promise<DocumentRow[]> {
  const limit = addDays(today, windowDays);

  const { data, error } = await supabase
    .from("documents")
    .select(COLUMNS)
    .is("deleted_at", null)
    .not("valid_until", "is", null)
    .lte("valid_until", limit)
    .order("valid_until", { ascending: true });

  if (error || !data) return [];
  return data as DocumentRow[];
}

/** Documentos en estado `pendiente` (el filtro "pendientes" del hub). */
export async function pendingDocuments(
  supabase: SupabaseClient,
): Promise<DocumentRow[]> {
  const { data, error } = await supabase
    .from("documents")
    .select(COLUMNS)
    .eq("status", "pendiente")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data as DocumentRow[];
}

/** Documentos sin transacción asociada (entity_type = 'none'). */
export async function unlinkedDocuments(
  supabase: SupabaseClient,
): Promise<DocumentRow[]> {
  const { data, error } = await supabase
    .from("documents")
    .select(COLUMNS)
    .eq("entity_type", "none")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data as DocumentRow[];
}

/** Suma N días a una fecha ISO (YYYY-MM-DD) → ISO (YYYY-MM-DD). */
function addDays(iso: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return iso;
  const base = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(base + days * 24 * 60 * 60 * 1000);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
