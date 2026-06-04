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
  "id, tenant_id, client_markbox, supplier_id, code, description, tracking_cn, boxes, est_value_usd, status, received_at, shipment_id, deleted_at, created_at, updated_at";

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
