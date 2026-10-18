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
import { fetchAllPaged } from "@/lib/db/paginate";
import {
  type Prealerta,
  type PrealertaDocType,
  type PrealertaDocument,
  type PrealertaStatus,
  type PredeclaredBox,
  type Supplier,
  PREALERTA_STATUSES,
} from "./types";
import {
  type PrealertaAddon,
  type PrealertaAddonCode,
  type PrealertaAddonRow,
  type PrealertaServiceRequest,
  type PrealertaServiceRequestStatus,
  type PrealertaServiceRequestTiming,
  mergePrealertaAddons,
} from "./addons";
import {
  type PackingListCurrency,
  type PackingListRow,
  type PackingListSubmission,
  isPackingListCurrency,
} from "./packlist-form";

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
  "id, tenant_id, client_markbox, supplier_id, code, description, tracking_cn, client_note, boxes, est_value_usd, status, received_at, shipment_id, share_token, sales_order_id, deleted_at, created_at, updated_at";

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
    client_note: (r.client_note as string | null) ?? null,
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
  // Paginado: los proveedores se acumulan por cliente y esta lista alimenta el
  // selector de la prealerta — uno que no aparece no se puede elegir.
  const { rows: data, complete } = await fetchAllPaged<Record<string, unknown>>(
    (d, h) => {
      let query = supabase
        .from("suppliers_cn")
        .select(SUPPLIER_COLUMNS)
        .is("deleted_at", null)
        .order("supplier_seq", { ascending: true })
        .order("id", { ascending: true });
      if (opts.markbox) query = query.eq("client_markbox", opts.markbox);
      return query.range(d, h);
    },
  );
  if (!complete) {
    throw new Error("Los proveedores superan el tope de lectura; filtra por cliente.");
  }
  return data.map(coerceSupplier);
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
    .order("id", { ascending: true });
  if (opts.markbox) query = query.eq("client_markbox", opts.markbox);
  if (opts.status) query = query.eq("status", opts.status);

  // Paginado: las prealertas se acumulan con los meses.
  const { rows: data, complete } = await fetchAllPaged<Record<string, unknown>>(
    (d, h) => query.range(d, h),
  );
  if (!complete) {
    throw new Error("Las prealertas superan el tope de lectura; filtra por estado o cliente.");
  }
  return data.map(coercePrealerta);
}

/**
 * CBM real por prealerta (recepciones CN · migr 0127): suma `total_cbm` de las
 * warehouse_receipts_cn atadas a cada prealerta vía `prealerta_id`. La
 * prealerta NO pide CBM al anunciarse — se mide al recibir en el almacén CN;
 * antes de eso la UI muestra "—". RLS scopea al tenant del operador.
 */
export async function cbmByPrealerta(
  supabase: SupabaseClient,
): Promise<Record<string, number>> {
  // Paginado: acá se SUMA el CBM por prealerta. Con `.limit(4000)` PostgREST
  // devolvía 1.000 y la prealerta mostraba menos volumen del recibido — con eso
  // se factura de menos.
  const { rows: data, complete } = await fetchAllPaged<Record<string, unknown>>(
    (d, h) =>
      supabase
        .from("warehouse_receipts_cn")
        .select("id, prealerta_id, total_cbm")
        .not("prealerta_id", "is", null)
        .is("deleted_at", null)
        .order("id", { ascending: true })
        .range(d, h),
  );
  if (!complete) {
    throw new Error(
      "Las recepciones CN superan el tope de lectura; el CBM por prealerta no se puede totalizar.",
    );
  }
  const map: Record<string, number> = {};
  for (const r of (data ?? []) as {
    prealerta_id: string | null;
    total_cbm: unknown;
  }[]) {
    if (!r.prealerta_id) continue;
    const n = Number(r.total_cbm);
    if (!Number.isFinite(n) || n <= 0) continue;
    map[r.prealerta_id] = (map[r.prealerta_id] ?? 0) + n;
  }
  return map;
}

/**
 * UNA compra del cliente del portal por su `code`. Filtra por code + tenant +
 * markbox del principal Portal: si el code no es suyo (o no existe) → null → la
 * página llama `notFound()`. Misma defensa en profundidad que el resto del portal
 * (tenant y markbox explícitos + RLS).
 *
 * `tenantId` es obligatorio (SDD-0552). El código y el Shipping Mark son únicos
 * POR tenant (0105, 0006) y la policy de equipo «by tenant» es permisiva: sin el
 * tenant, una sesión híbrida recibía la compra del otro tenant (o las dos, y
 * `maybeSingle` fallaba con la propia). Todos los llamadores son del Portal y ya
 * resolvieron el principal; hacerlo opcional dejaría olvidarlo en silencio.
 */
export async function getPrealertaByCode(
  supabase: SupabaseClient,
  code: string,
  opts: { markbox: string; tenantId: string },
): Promise<Prealerta | null> {
  const { data, error } = await supabase
    .from("prealertas")
    .select(PREALERTA_COLUMNS)
    .eq("code", code)
    .eq("tenant_id", opts.tenantId)
    .eq("client_markbox", opts.markbox)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data) return null;
  return coercePrealerta(data as Record<string, unknown>);
}

// ── Link público del proveedor (share_token · migr 0119) ────────

/** Datos que ve el proveedor en la página pública /p/{token} (sin login). */
export type ProviderShareData = {
  tenantId: string;
  code: string;
  description: string;
  boxes: number;
  markbox: string;
  clientName: string | null;
  supplierName: string | null;
  supplierWechat: string | null;
  /** SDD-0153: cajas pre-declaradas de esta compra (para el QR escaneable por caja). */
  predeclaredBoxes: PredeclaredBox[];
};

/**
 * SDD-0153: las cajas pre-declaradas de una compra (`warehouse_boxes`), ordenadas
 * por seq. En el portal las trae la RLS `warehouse_boxes portal self read` (el
 * cliente ve solo las suyas); en la ruta pública del proveedor las trae el admin
 * client. Devuelve `[]` si la compra no tiene cajas todavía → el consumidor cae al
 * fallback `buildLabels` (etiqueta por cliente, sin código de caja).
 */
export async function listPredeclaredBoxes(
  supabase: SupabaseClient,
  prealertaId: string,
): Promise<PredeclaredBox[]> {
  const { data, error } = await supabase
    .from("warehouse_boxes")
    .select("code, seq")
    .eq("prealerta_id", prealertaId)
    .is("deleted_at", null)
    .order("seq", { ascending: true });
  if (error || !data) return [];
  return data.map((b) => ({ code: b.code as string, seq: b.seq as number }));
}

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
      .select("id, tenant_id, code, boxes, client_markbox, supplier_id")
      .eq("share_token", token)
      .is("deleted_at", null)
      .is("share_disabled_at", null) // PORT-4: link desactivado → notFound
      .maybeSingle<{
        id: string;
        code: string;
        description: string;
        tenant_id: string;
        boxes: number;
        client_markbox: string;
        supplier_id: string | null;
      }>();
    if (error || !p) return null;

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

    const predeclaredBoxes = await listPredeclaredBoxes(supabase, p.id);

    return {
      tenantId: p.tenant_id,
      code: p.code,
      description: "", // Customer-entered free text is not part of the supplier projection.
      boxes: Math.round(num(p.boxes)),
      markbox: p.client_markbox,
      clientName: null, // Private supplier projection never reads client identity.
      supplierName,
      supplierWechat,
      predeclaredBoxes,
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
      .is("share_disabled_at", null) // PORT-4: link desactivado → notFound
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
    // Paginado: esto CUENTA prealertas por estado. Truncar no muestra menos
    // filas: da un conteo equivocado en el tablero.
    const { rows, complete } = await fetchAllPaged<{ id: string; status: string }>(
      (d, h) =>
        supabase
          .from("prealertas")
          .select("id, status")
          .is("deleted_at", null)
          .order("id", { ascending: true })
          .range(d, h),
    );
    if (!complete) throw new Error("Prealertas: lectura incompleta para el conteo.");
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

// ── Add-ons / servicios de recepción (SDD-0098 · migr 0150) ─────

/**
 * Servicios ACTIVOS del menú de recepción para el tenant (merge "DB pisa, código
 * respalda"). Lee `prealerta_addons` (RLS: equipo o cliente del portal del tenant)
 * y lo combina con los DEFAULTS de código. Los callers Portal que ya derivaron
 * principal pasan tenant explícito. Defensivo: si la tabla no existe (0150 sin
 * aplicar en un env) cae a los 7 defaults activos.
 */
export async function listActivePrealertaAddons(
  supabase: SupabaseClient,
  opts: { tenantId?: string } = {},
): Promise<PrealertaAddon[]> {
  try {
    const query = supabase
      .from("prealerta_addons")
      .select(
        "code, label, description, notas_placeholder, consent_text, video_url, multi_tracking, sort, is_active",
      );
    const scoped = opts.tenantId ? query.eq("tenant_id", opts.tenantId) : query;
    const { data, error } = await scoped
      .limit(50);
    if (error) throw error;
    return mergePrealertaAddons(
      (data as PrealertaAddonRow[] | null) ?? [],
    ).filter((a) => a.isActive);
  } catch {
    return mergePrealertaAddons([]).filter((a) => a.isActive);
  }
}

/**
 * TODOS los add-ons (activos e inactivos) para el editor de config del Studio
 * (SDD-0098 · PORT-6). Merge "DB pisa, código respalda" sin filtrar por activo.
 * Defensivo: los 7 defaults si la tabla no existe.
 */
export async function listPrealertaAddonsConfig(
  supabase: SupabaseClient,
): Promise<PrealertaAddon[]> {
  try {
    const { data, error } = await supabase
      .from("prealerta_addons")
      .select(
        "code, label, description, notas_placeholder, consent_text, video_url, multi_tracking, sort, is_active",
      )
      .limit(50);
    if (error) throw error;
    return mergePrealertaAddons((data as PrealertaAddonRow[] | null) ?? []);
  } catch {
    return mergePrealertaAddons([]);
  }
}

// ── Solicitudes de servicio (prealerta_service_requests · migr 0150) ─────

const PSR_COLUMNS =
  "id, tenant_id, prealerta_id, client_markbox, addon_code, status, timing, trackings, consent_accepted, notes, quoted_amount_usd, processed_at, created_at, updated_at";

function coercePsr(r: Record<string, unknown>): PrealertaServiceRequest {
  return {
    id: String(r.id),
    tenant_id: String(r.tenant_id),
    prealerta_id: String(r.prealerta_id),
    client_markbox: String(r.client_markbox ?? ""),
    addon_code: r.addon_code as PrealertaAddonCode,
    status: (r.status as PrealertaServiceRequestStatus) ?? "solicitada",
    timing: (r.timing as PrealertaServiceRequestTiming) ?? "a_tiempo",
    trackings: Array.isArray(r.trackings) ? (r.trackings as string[]) : null,
    consent_accepted: Boolean(r.consent_accepted),
    notes: (r.notes as string | null) ?? null,
    quoted_amount_usd: numOrNull(r.quoted_amount_usd),
    processed_at: (r.processed_at as string | null) ?? null,
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  };
}

/**
 * Solicitudes de servicio de UNA compra (o todas las del cliente por `markbox`).
 * SDD0381: enviar markbox activa ámbito Portal verificado (tenant+cliente),
 * incluso con permisos Studio adicionales. Sin esa propiedad conserva Studio.
 * No reutilizar este contexto para cambiar otros consumidores. Defensivo:
 * [] si la tabla aún no existe (0150 sin aplicar) → no rompe la página.
 */
async function portalServiceRequestTenant(
  supabase: SupabaseClient,
  markbox: string,
): Promise<string | null> {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user?.id) return null;
  const { data, error } = await supabase
    .from("client_users")
    .select("client_id, tenant_id, clients!inner(id, tenant_id, markbox, deleted_at)")
    .eq("auth_user_id", auth.user.id)
    .eq("status", "active")
    .maybeSingle();
  if (error || !data || typeof data !== "object" || Array.isArray(data)) return null;
  const row = data as Record<string, unknown>;
  const embedded = row.clients;
  const client = Array.isArray(embedded)
    ? (embedded.length === 1 ? embedded[0] : null)
    : embedded;
  if (!client || typeof client !== "object" || Array.isArray(client)) return null;
  const c = client as Record<string, unknown>;
  if (typeof row.tenant_id !== "string" || !row.tenant_id.trim() ||
      typeof row.client_id !== "string" || !row.client_id.trim() ||
      c.id !== row.client_id || c.tenant_id !== row.tenant_id ||
      c.deleted_at !== null || c.markbox !== markbox) return null;
  return row.tenant_id;
}

export async function listPrealertaServiceRequests(
  supabase: SupabaseClient,
  opts: { tenantId?: string; prealertaId?: string; markbox?: string } = {},
): Promise<PrealertaServiceRequest[]> {
  try {
    let portalTenant: string | null = null;
    if ("markbox" in opts) {
      if (typeof opts.markbox !== "string" || !opts.markbox.trim()) return [];
      portalTenant = await portalServiceRequestTenant(supabase, opts.markbox);
      if (!portalTenant) return [];
      if (opts.tenantId && opts.tenantId !== portalTenant) return [];
    }
    let query = supabase
      .from("prealerta_service_requests")
      .select(PSR_COLUMNS)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(500);
    if (portalTenant) query = query.eq("tenant_id", portalTenant);
    if (opts.prealertaId) query = query.eq("prealerta_id", opts.prealertaId);
    if (opts.markbox) query = query.eq("client_markbox", opts.markbox);

    const { data, error } = await query;
    if (error) throw error;
    return ((data as Record<string, unknown>[] | null) ?? []).map(coercePsr);
  } catch {
    return [];
  }
}

/**
 * IDs de prealertas cuyo link público del proveedor está DESACTIVADO
 * (share_disabled_at no null), del tenant del operador (SDD-0096 · PORT-4).
 * DEFENSIVO: si la columna aún no existe (migr 0225 sin aplicar) devuelve []
 * → el Studio trata todos los links como activos (no rompe la pantalla).
 */
export async function listDisabledSharePrealertaIds(
  supabase: SupabaseClient,
): Promise<string[]> {
  try {
    // Paginado: es la lista de prealertas con el enlace REVOCADO. Si se trunca,
    // un enlace revocado se trata como vigente — se muestra data que se quiso
    // cerrar. Otra vez: truncar acá muestra de MÁS.
    const { rows, complete } = await fetchAllPaged<{ id: string }>((d, h) =>
      supabase
        .from("prealertas")
        .select("id")
        .not("share_disabled_at", "is", null)
        .is("deleted_at", null)
        .order("id", { ascending: true })
        .range(d, h),
    );
    if (!complete) {
      throw new Error("No se pudo leer completa la lista de enlaces revocados.");
    }
    return rows.map((r) => String(r.id));
  } catch {
    return [];
  }
}

// ── Packing lists enviados por el proveedor (submissions · migr 0147) ─────

const PACKING_LIST_COLUMNS =
  "id, prealerta_id, client_markbox, version_no, is_current, supplier_company, supplier_contact, supplier_email, supplier_wechat, supplier_phone, currency, doc_date, folio, supplier_note, rows, total_ctns, total_qty, total_amount, total_weight, total_cbm, created_at";

/** Coerciona una fila cruda del row jsonb a PackingListRow (saneada server-side). */
function coercePackingRow(r: Record<string, unknown>): PackingListRow {
  const str = (v: unknown): string => (typeof v === "string" ? v : "");
  return {
    brand: str(r.brand),
    code: str(r.code),
    zh: str(r.zh),
    es: str(r.es),
    hs: str(r.hs),
    carton: str(r.carton),
    ctns: num(r.ctns),
    perctn: num(r.perctn),
    unit: num(r.unit),
    wkg: num(r.wkg),
    cbm: num(r.cbm),
    same: Boolean(r.same),
    qtyDirect: num(r.qtyDirect),
    qty: num(r.qty),
    amount: num(r.amount),
    weight: num(r.weight),
    vol: num(r.vol),
    ...(typeof r.uom === "string" ? {uom:r.uom} : {}),
  };
}

function coercePackingSubmission(
  r: Record<string, unknown>,
): PackingListSubmission {
  const rawRows = Array.isArray(r.rows) ? (r.rows as Record<string, unknown>[]) : [];
  return {
    id: String(r.id),
    prealerta_id: String(r.prealerta_id),
    client_markbox: String(r.client_markbox ?? ""),
    version_no: Math.round(num(r.version_no)),
    is_current: Boolean(r.is_current),
    supplier_company: (r.supplier_company as string | null) ?? null,
    supplier_contact: (r.supplier_contact as string | null) ?? null,
    supplier_email: (r.supplier_email as string | null) ?? null,
    supplier_wechat: (r.supplier_wechat as string | null) ?? null,
    supplier_phone: (r.supplier_phone as string | null) ?? null,
    currency: isPackingListCurrency(r.currency)
      ? (r.currency as PackingListCurrency)
      : "USD",
    doc_date: (r.doc_date as string | null) ?? null,
    folio: (r.folio as string | null) ?? null,
    supplier_note: (r.supplier_note as string | null) ?? null,
    rows: rawRows.map(coercePackingRow),
    totals: {
      ctns: num(r.total_ctns),
      qty: r.total_qty === null ? null : num(r.total_qty),
      ...(rawRows.some(row=>typeof row.uom==="string")?{quantitiesByUnit:rawRows.reduce<Record<string,number>>((acc,row)=>{const unit=typeof row.uom==="string"?row.uom:"pcs";acc[unit]=(acc[unit]??0)+num(row.qty);return acc;},{})}:{}),
      amount: num(r.total_amount),
      weight: num(r.total_weight),
      cbm: num(r.total_cbm),
    },
    created_at: String(r.created_at),
  };
}

/**
 * Packing lists que los proveedores enviaron desde /p/{token} (SDD-0096 · PORT-2).
 * Por defecto solo la versión VIGENTE de cada compra (`is_current`); el operador
 * del tenant las ve todas (RLS "packing_list_submissions by tenant"). Defensivo:
 * [] si la tabla aún no existe (0147 sin aplicar) → no rompe la pantalla.
 */
export async function listPackingListSubmissions(
  supabase: SupabaseClient,
  opts: { currentOnly?: boolean; prealertaId?: string } = {},
): Promise<PackingListSubmission[]> {
  const currentOnly = opts.currentOnly ?? true;
  try {
    let query = supabase
      .from("packing_list_submissions")
      .select(PACKING_LIST_COLUMNS)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (currentOnly) query = query.eq("is_current", true);
    if (opts.prealertaId) query = query.eq("prealerta_id", opts.prealertaId);

    const { data, error } = await query;
    if (error) throw error;
    return ((data as Record<string, unknown>[] | null) ?? []).map(
      coercePackingSubmission,
    );
  } catch {
    return [];
  }
}
