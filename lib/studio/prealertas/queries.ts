/**
 * Queries del módulo Portal · Compras (prealertas) + Proveedores
 * (SDD-0057, Slice A).
 *
 * Funciones PURAS que reciben un SupabaseClient. La RLS doble (migr 0105) decide
 * qué filas vuelven según el principal:
 *  - cliente del portal → SUS filas (por markbox). Pasar `markbox` igual = defensa
 *    en profundidad (el principal puede ser team + portal a la vez; la policy
 *    by-tenant del equipo es permissive OR y, sola, mostraría todo el tenant).
 *  - operador del tenant → todas las del tenant (filtro por status opcional).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type Prealerta,
  type PrealertaDocType,
  type PrealertaDocument,
  type PrealertaStatus,
  type Supplier,
  PREALERTA_STATUSES,
} from "./types";

// ── Coerción + columnas ────────────────────────────────────────

function numOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

const SUPPLIER_COLUMNS =
  "id, tenant_id, client_markbox, supplier_seq, name, city, wechat, contact, notes, deleted_at, created_at, updated_at";

const PREALERTA_COLUMNS =
  "id, tenant_id, client_markbox, supplier_id, code, description, tracking_cn, boxes, est_value_usd, status, received_at, shipment_id, share_token, sales_order_id, deleted_at, created_at, updated_at";

function coerceSupplier(r: Record<string, unknown>): Supplier {
  return {
    id: String(r.id),
    tenant_id: String(r.tenant_id),
    client_markbox: String(r.client_markbox ?? ""),
    supplier_seq: Math.round(num(r.supplier_seq)),
    name: String(r.name ?? ""),
    city: (r.city as string | null) ?? null,
    wechat: (r.wechat as string | null) ?? null,
    contact: (r.contact as string | null) ?? null,
    notes: (r.notes as string | null) ?? null,
    deleted_at: (r.deleted_at as string | null) ?? null,
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  };
}

function coercePrealerta(r: Record<string, unknown>): Prealerta {
  return {
    id: String(r.id),
    tenant_id: String(r.tenant_id),
    client_markbox: String(r.client_markbox ?? ""),
    supplier_id: (r.supplier_id as string | null) ?? null,
    code: String(r.code ?? ""),
    description: String(r.description ?? ""),
    tracking_cn: (r.tracking_cn as string | null) ?? null,
    boxes: Math.round(num(r.boxes)),
    est_value_usd: numOrNull(r.est_value_usd),
    status: (r.status as PrealertaStatus) ?? "anunciada",
    received_at: (r.received_at as string | null) ?? null,
    shipment_id: (r.shipment_id as string | null) ?? null,
    share_token: (r.share_token as string | null) ?? null,
    sales_order_id: (r.sales_order_id as string | null) ?? null,
    deleted_at: (r.deleted_at as string | null) ?? null,
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  };
}

// ── Suppliers ──────────────────────────────────────────────────

/**
 * Lista los proveedores (vivos). Para el cliente del portal pasar `markbox` (sus
 * proveedores). El operador llama sin markbox → todos los del tenant (RLS).
 */
export async function listSuppliers(
  supabase: SupabaseClient,
  opts: { markbox?: string } = {},
): Promise<Supplier[]> {
  let query = supabase
    .from("suppliers_cn")
    .select(SUPPLIER_COLUMNS)
    .is("deleted_at", null)
    .order("supplier_seq", { ascending: true })
    .limit(2000);
  if (opts.markbox) query = query.eq("client_markbox", opts.markbox);

  const { data, error } = await query;
  if (error) throw error;
  return ((data as Record<string, unknown>[] | null) ?? []).map(coerceSupplier);
}

// ── Prealertas ─────────────────────────────────────────────────

/**
 * Lista las prealertas/compras (vivas), más recientes primero. Para el cliente
 * del portal pasar `markbox` (las suyas). El operador llama sin markbox → todas
 * las del tenant. Filtro por `status` opcional.
 */
export async function listPrealertas(
  supabase: SupabaseClient,
  opts: { markbox?: string; status?: string } = {},
): Promise<Prealerta[]> {
  let query = supabase
    .from("prealertas")
    .select(PREALERTA_COLUMNS)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(2000);
  if (opts.markbox) query = query.eq("client_markbox", opts.markbox);
  if (opts.status) query = query.eq("status", opts.status);

  const { data, error } = await query;
  if (error) throw error;
  return ((data as Record<string, unknown>[] | null) ?? []).map(
    coercePrealerta,
  );
}

/**
 * UNA compra del cliente del portal por su `code`. Filtra por code + markbox: si
 * el code no es suyo (o no existe) → null → la página llama `notFound()`. Misma
 * defensa en profundidad que el resto del portal (markbox explícito + RLS).
 */
export async function getPrealertaByCode(
  supabase: SupabaseClient,
  code: string,
  opts: { markbox: string },
): Promise<Prealerta | null> {
  const { data, error } = await supabase
    .from("prealertas")
    .select(PREALERTA_COLUMNS)
    .eq("code", code)
    .eq("client_markbox", opts.markbox)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data) return null;
  return coercePrealerta(data as Record<string, unknown>);
}

// ── Link público del proveedor (share_token · migr 0119) ────────

/** Datos que ve el proveedor en la página pública /p/{token} (sin login). */
export type ProviderShareData = {
  code: string;
  description: string;
  boxes: number;
  markbox: string;
  clientName: string | null;
  supplierName: string | null;
  supplierWechat: string | null;
};

/**
 * Resuelve la compra por `share_token` para la página pública del proveedor.
 * SIEMPRE se llama con admin client (service_role) desde el route público — el
 * visitante es anónimo. Token inválido / inexistente → null → notFound(). Devuelve
 * solo lo que el proveedor necesita (código, descripción, cajas, shipping mark,
 * nombres) — nada sensible. Defensivo ante token mal formado (uuid).
 */
export async function getProviderShareByToken(
  supabase: SupabaseClient,
  token: string,
): Promise<ProviderShareData | null> {
  try {
    const { data: p, error } = await supabase
      .from("prealertas")
      .select("code, description, boxes, client_markbox, supplier_id")
      .eq("share_token", token)
      .is("deleted_at", null)
      .maybeSingle<{
        code: string;
        description: string;
        boxes: number;
        client_markbox: string;
        supplier_id: string | null;
      }>();
    if (error || !p) return null;

    const { data: c } = await supabase
      .from("clients")
      .select("name")
      .eq("markbox", p.client_markbox)
      .maybeSingle<{ name: string }>();

    let supplierName: string | null = null;
    let supplierWechat: string | null = null;
    if (p.supplier_id) {
      const { data: s } = await supabase
        .from("suppliers_cn")
        .select("name, wechat")
        .eq("id", p.supplier_id)
        .maybeSingle<{ name: string; wechat: string | null }>();
      supplierName = s?.name ?? null;
      supplierWechat = s?.wechat ?? null;
    }

    return {
      code: p.code,
      description: p.description,
      boxes: Math.round(num(p.boxes)),
      markbox: p.client_markbox,
      clientName: c?.name ?? null,
      supplierName,
      supplierWechat,
    };
  } catch {
    return null;
  }
}

/**
 * SDD-0096: IDs internos de la compra por `share_token`, para los POST públicos
 * (envío del packing list + subida de adjuntos del proveedor). Devuelve lo
 * mínimo que el route necesita server-side (prealerta_id, tenant_id, markbox) —
 * NUNCA se expone al cliente. Admin client (visitante anónimo). null si el token
 * es inválido / inexistente. Defensivo ante uuid mal formado.
 */
export async function getPrealertaIdsByToken(
  supabase: SupabaseClient,
  token: string,
): Promise<{
  prealertaId: string;
  tenantId: string;
  markbox: string;
  code: string;
} | null> {
  try {
    const { data, error } = await supabase
      .from("prealertas")
      .select("id, tenant_id, client_markbox, code")
      .eq("share_token", token)
      .is("deleted_at", null)
      .maybeSingle<{
        id: string;
        tenant_id: string;
        client_markbox: string;
        code: string;
      }>();
    if (error || !data) return null;
    return {
      prealertaId: data.id,
      tenantId: data.tenant_id,
      markbox: data.client_markbox,
      code: data.code,
    };
  } catch {
    return null;
  }
}

// ── Adjuntos de la compra (prealerta_documents · migr 0118) ─────

const PREALERTA_DOC_COLUMNS =
  "id, tenant_id, prealerta_id, client_markbox, doc_type, storage_path, file_name, content_type, size_bytes, source, created_at";

function coercePrealertaDocument(r: Record<string, unknown>): PrealertaDocument {
  return {
    id: String(r.id),
    tenant_id: String(r.tenant_id),
    prealerta_id: String(r.prealerta_id),
    client_markbox: String(r.client_markbox ?? ""),
    doc_type: (r.doc_type as PrealertaDocType) ?? "foto",
    storage_path: String(r.storage_path ?? ""),
    file_name: String(r.file_name ?? ""),
    content_type: (r.content_type as string | null) ?? null,
    size_bytes: numOrNull(r.size_bytes),
    source: (r.source as PrealertaDocument["source"]) ?? "client",
    created_at: String(r.created_at),
  };
}

/**
 * Adjuntos de UNA compra (más viejos primero). El cliente del portal pasa
 * `markbox` (defensa en profundidad + la policy "portal self read"). Defensivo:
 * si la tabla aún no existe (0118 sin aplicar en un env) devuelve [] en vez de
 * romper la página de etiquetas.
 */
export async function listPrealertaDocuments(
  supabase: SupabaseClient,
  opts: { prealertaId: string; markbox?: string },
): Promise<PrealertaDocument[]> {
  try {
    let query = supabase
      .from("prealerta_documents")
      .select(PREALERTA_DOC_COLUMNS)
      .eq("prealerta_id", opts.prealertaId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(100);
    if (opts.markbox) query = query.eq("client_markbox", opts.markbox);

    const { data, error } = await query;
    if (error) throw error;
    return ((data as Record<string, unknown>[] | null) ?? []).map(
      coercePrealertaDocument,
    );
  } catch {
    return [];
  }
}

// ── Stats del operador ─────────────────────────────────────────

/** Conteo de prealertas por status (para la cola del operador). */
export type PrealertaStats = {
  /** total de prealertas vivas del tenant. */
  total: number;
  /** conteo por cada status del enum (0 si no hay). */
  byStatus: Record<PrealertaStatus, number>;
};

/**
 * Conteo de prealertas por status para el operador del tenant. RLS filtra por
 * tenant. Defensivo: si la tabla aún no existe (0105 sin aplicar en un env),
 * devuelve ceros en vez de romper la pantalla.
 */
export async function prealertaStats(
  supabase: SupabaseClient,
): Promise<PrealertaStats> {
  const empty: PrealertaStats = {
    total: 0,
    byStatus: PREALERTA_STATUSES.reduce(
      (acc, s) => {
        acc[s] = 0;
        return acc;
      },
      {} as Record<PrealertaStatus, number>,
    ),
  };

  try {
    const { data, error } = await supabase
      .from("prealertas")
      .select("status")
      .is("deleted_at", null)
      .limit(20000);
    if (error) throw error;

    const rows = (data as { status: string }[] | null) ?? [];
    const byStatus = { ...empty.byStatus };
    for (const r of rows) {
      if (r.status in byStatus) {
        byStatus[r.status as PrealertaStatus] += 1;
      }
    }
    return { total: rows.length, byStatus };
  } catch {
    return empty;
  }
}
