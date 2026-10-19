/**
 * Queries del Portal del Cliente (SDD-0042). Funciones puras que reciben un
 * `SupabaseClient`.
 *
 * AISLAMIENTO (defensa en profundidad): además de la RLS del portal, estas
 * queries resuelven el principal Portal de la sesión (`getPortalClientPrincipal`)
 * y filtran EXPLÍCITO por su `tenant_id` y su `client_markbox`. Sin ese filtro,
 * un principal que sea a la vez user de equipo y cliente del portal (tiene row en
 * `user_tenants` Y en `client_users`) recibiría TODO el tenant: la policy
 * "<tabla> by tenant" es permissive (OR) y, sola, no aísla. Y el Shipping Mark
 * es único POR tenant (0006): sin el tenant, la sesión híbrida recibía además
 * las filas del otro tenant con el mismo Shipping Mark (SDD-0552).
 *
 * FACTURAS (SDD-0462): el Shipping Mark es único POR TENANT y la policy Portal de
 * `invoices` (0085) compara sólo el Shipping Mark. Por eso los lectores de facturas
 * no usan la RPC: resuelven el principal vivo y coherente
 * (`getPortalClientPrincipal`) y filtran por su `tenant_id` y su Shipping Mark.
 * Sin principal cortan antes de consultar.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PortalActivation,
  PortalAdvisor,
  PortalClient,
  PortalDashboardKpis,
  PortalDocument,
  PortalEstimateRow,
  PortalInvoiceDetail,
  PortalInvoiceRow,
  PortalNextArrival,
  PortalShipmentDetail,
  PortalShipmentRow,
  ProfileCompleteness,
} from "./portal-types";
import {
  estimatePortalEta,
  isActiveShipmentStatus,
  type ShipmentService,
  type ShipmentStatus,
} from "./portal-types";
import { fetchAllPaged } from "@/lib/db/paginate";
import { esAnuladaSinEmitir, resumenDeCuenta } from "./saldo-de-cuenta";

/**
 * Tenant, Shipping Mark e id de cliente del principal Portal de la sesión, o null
 * si la sesión no tiene un principal vivo y coherente. Punto único de resolución
 * para envíos, documentos, activación y próximo arribo (SDD-0552).
 *
 * Reemplaza a la RPC `get_portal_client_markbox`: devolvía sólo el Shipping Mark,
 * y filtrar sólo por él dejaba pasar las filas de otro tenant con el mismo valor.
 */
async function portalScope(
  supabase: SupabaseClient,
): Promise<{ tenantId: string; markbox: string; clientId: string } | null> {
  const principal = await getPortalClientPrincipal(supabase);
  if (!principal) return null;
  return {
    tenantId: principal.tenantId,
    markbox: principal.client.markbox,
    clientId: principal.client.id,
  };
}

export type PortalClientPrincipal = {
  userId: string;
  tenantId: string;
  client: PortalClient;
};

/**
 * Principal Portal resuelto desde la sesión y su vínculo activo. A diferencia
 * de las helpers históricas, comprueba la coherencia tenant/cliente aun cuando
 * una sesión híbrida tenga policies de equipo adicionales.
 */
async function resolvePortalClientPrincipal(
  supabase: SupabaseClient,
): Promise<PortalClientPrincipal | null> {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user?.id) return null;
  const userId = auth.user.id;

  const { data, error } = await supabase
    .from("client_users")
    .select(
      "client_id, tenant_id, clients!inner(id, tenant_id, markbox, name, email, phone, address, rif, doc_kind, city, state, deleted_at)",
    )
    .eq("auth_user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (error || !data || typeof data !== "object" || Array.isArray(data)) return null;

  const row = data as Record<string, unknown>;
  const embedded = row.clients;
  const rawClient = Array.isArray(embedded)
    ? (embedded.length === 1 ? embedded[0] : null)
    : embedded;
  if (!rawClient || typeof rawClient !== "object" || Array.isArray(rawClient)) return null;
  const client = rawClient as Record<string, unknown>;
  if (
    typeof row.client_id !== "string" || !row.client_id.trim() ||
    typeof row.tenant_id !== "string" || !row.tenant_id.trim() ||
    client.id !== row.client_id || client.tenant_id !== row.tenant_id ||
    client.deleted_at !== null || typeof client.markbox !== "string" ||
    !client.markbox.trim() || typeof client.name !== "string" || !client.name.trim()
  ) return null;

  const rawDocKind = (client.doc_kind as string | null) ?? null;
  return {
    userId,
    tenantId: row.tenant_id,
    client: {
      id: client.id as string,
      markbox: client.markbox,
      name: client.name,
      email: (client.email as string | null) ?? null,
      phone: (client.phone as string | null) ?? null,
      address: (client.address as string | null) ?? null,
      docKind:
        rawDocKind === "persona" || rawDocKind === "empresa" ? rawDocKind : null,
      rif: (client.rif as string | null) ?? null,
      city: (client.city as string | null) ?? null,
      state: (client.state as string | null) ?? null,
    },
  };
}

export async function getPortalClientPrincipal(
  supabase: SupabaseClient,
): Promise<PortalClientPrincipal | null> {
  try {
    return await resolvePortalClientPrincipal(supabase);
  } catch {
    return null;
  }
}

/**
 * El cliente de la sesión Portal, con vínculo activo y tenant coherente.
 * Una sesión de equipo sin principal Portal válido no hereda un cliente.
 */
export async function getPortalClient(
  supabase: SupabaseClient,
): Promise<PortalClient | null> {
  return (await getPortalClientPrincipal(supabase))?.client ?? null;
}

/**
 * El asesor ASIGNADO al cliente (ERP→Norte · clients.advisor_id). Reemplaza la
 * degradación al contacto público en la card "Tu asesor" de /portal/mensajes.
 *
 * La RPC no recibe `clientId`: deriva el cliente desde `auth.uid()`, verifica que
 * el asesor siga activo en el mismo tenant y devuelve sólo sus datos públicos de
 * contacto. Así la página no construye `service_role` para esta lectura.
 *
 * Degrada a null (→ fallback público) si: no hay asesor asignado, el asesor ya no
 * es miembro activo del tenant, o el asesor no tiene nombre cargado en su perfil.
 */
export async function getPortalAdvisor(
  db: SupabaseClient,
): Promise<PortalAdvisor | null> {
  const { data, error } = await db.rpc("get_portal_advisor");
  if (error) return null;

  const row = Array.isArray(data) ? data[0] : data;
  const name = String((row as { name?: unknown } | null)?.name ?? "").trim();
  if (!row || !name) return null;

  return {
    name,
    phone: (row.phone as string | null) ?? null,
    avatarUrl: (row.avatar_url as string | null) ?? null,
    positionLabel: (row.position_label as string | null) ?? null,
  };
}

/**
 * Envíos del cliente logueado (filtrados EXPLÍCITO por el tenant y el markbox
 * del principal), recientes primero. Hasta 100; paginación real en una fase
 * siguiente si hace falta.
 */
export async function listMyShipments(
  supabase: SupabaseClient,
): Promise<PortalShipmentRow[]> {
  const scope = await portalScope(supabase);
  if (!scope) return [];

  const { data, error } = await supabase
    .from("shipments")
    .select("id, code, shipment_service, status, origin, destination, updated_at")
    .eq("tenant_id", scope.tenantId)
    .eq("client_markbox", scope.markbox)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error || !data) return [];

  return data.map((r) => ({
    id: r.id as string,
    code: r.code as string,
    service: r.shipment_service as PortalShipmentRow["service"],
    status: r.status as PortalShipmentRow["status"],
    origin: (r.origin as string | null) ?? null,
    destination: (r.destination as string | null) ?? null,
    updatedAt: r.updated_at as string,
  }));
}

/**
 * UN envío del cliente logueado por su `code` (Fase 2 · detalle read-only).
 * Filtra por code + tenant + markbox del principal: si el `code` no es suyo (o
 * no existe) → null → la página llama `notFound()`. El código es único POR
 * tenant (0002): sin el tenant, el mismo código en otro tenant con el mismo
 * Shipping Mark devolvía dos filas y el envío propio daba 404 (SDD-0552).
 */
export async function getMyShipment(
  supabase: SupabaseClient,
  code: string,
): Promise<PortalShipmentDetail | null> {
  const scope = await portalScope(supabase);
  if (!scope) return null;

  const { data, error } = await supabase
    .from("shipments")
    .select(
      "id, code, shipment_service, status, origin, destination, volume_m3, weight_kg, arrived_destination_at, created_at, updated_at",
    )
    .eq("code", code)
    .eq("tenant_id", scope.tenantId)
    .eq("client_markbox", scope.markbox)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id as string,
    code: data.code as string,
    service: data.shipment_service as PortalShipmentDetail["service"],
    status: data.status as PortalShipmentDetail["status"],
    origin: (data.origin as string | null) ?? null,
    destination: (data.destination as string | null) ?? null,
    volumeM3: (data.volume_m3 as number | null) ?? null,
    weightKg: (data.weight_kg as number | null) ?? null,
    arrivedDestinationAt: (data.arrived_destination_at as string | null) ?? null,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  };
}

/**
 * Las facturas del cliente no se pudieron leer completas (SDD-0556). Antes la
 * lista volvía vacía y el saldo en 0 —«al día»— ante un error, y se cortaba en
 * 100 facturas sin avisar: el mismo dato falso con otra cara. Ahora el lector
 * lanza este error y quien lo llama decide: las páginas caen en `error.tsx`, el
 * PDF responde 503 e Inicio marca sus KPIs de facturas como no disponibles.
 *
 * El mensaje es fijo y no trae nada de la base (ni el detalle de PostgREST).
 */
export class PortalInvoicesUnavailableError extends Error {
  readonly motivo: "lectura" | "incompleta";
  constructor(motivo: "lectura" | "incompleta") {
    super("PORTAL_FACTURAS_NO_DISPONIBLES");
    this.name = "PortalInvoicesUnavailableError";
    this.motivo = motivo;
  }
}

type InvoiceListRow = {
  id: string;
  invoice_code: string;
  status: string;
  currency: string;
  total_amount: number | string | null;
  paid_amount: number | string | null;
  issued_at: string | null;
  due_date: string | null;
  shipment_code: string | null;
};

/**
 * Facturas del cliente logueado (SDD-0042 · Fase 3), recientes primero. La RLS
 * del portal ya excluye borradores; filtramos EXPLÍCITO por tenant y Shipping
 * Mark del principal y por `borrador` igualmente (defensa en profundidad,
 * SDD-0462). Lee TODAS, sin tope (SDD-0556); ver
 * `listMyInvoicesForPrincipal`. Sin principal devuelve [] sin consultar.
 */
export async function listMyInvoices(
  supabase: SupabaseClient,
): Promise<PortalInvoiceRow[]> {
  const principal = await getPortalClientPrincipal(supabase);
  if (!principal) return [];
  return listMyInvoicesForPrincipal(supabase, principal);
}

/**
 * `listMyInvoices` para quien ya resolvió el principal (SDD-0556): el PDF del
 * estado de cuenta usa UNA sola resolución para las facturas y el emisor.
 *
 * - Pagina con `fetchAllPaged` (orden estable hasta `id`): el ledger y los KPIs
 *   suman estas filas, y una suma sobre una lista cortada miente.
 * - Si la lectura falla o queda incompleta, lanza
 *   `PortalInvoicesUnavailableError`. Nunca devuelve una lista vacía inventada.
 * - Saca, después de leer, las anuladas que nunca se emitieron: eran borradores
 *   anulados y el cliente nunca las recibió.
 */
export async function listMyInvoicesForPrincipal(
  supabase: SupabaseClient,
  principal: PortalClientPrincipal,
): Promise<PortalInvoiceRow[]> {
  let leidas: { rows: InvoiceListRow[]; complete: boolean };
  try {
    leidas = await fetchAllPaged<InvoiceListRow>((from, to) =>
      supabase
        .from("invoices")
        .select(
          "id, invoice_code, status, currency, total_amount, paid_amount, issued_at, due_date, shipment_code",
        )
        .eq("tenant_id", principal.tenantId)
        .eq("client_markbox", principal.client.markbox)
        .neq("status", "borrador")
        .is("deleted_at", null)
        .order("issued_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to),
    );
  } catch {
    throw new PortalInvoicesUnavailableError("lectura");
  }
  if (!leidas.complete) throw new PortalInvoicesUnavailableError("incompleta");

  return leidas.rows
    .map((r) => ({
      id: r.id,
      code: r.invoice_code,
      status: r.status as PortalInvoiceRow["status"],
      currency: r.currency as PortalInvoiceRow["currency"],
      total: Number(r.total_amount ?? 0),
      paid: Number(r.paid_amount ?? 0),
      issuedAt: r.issued_at ?? null,
      dueDate: r.due_date ?? null,
      shipmentCode: r.shipment_code ?? null,
    }))
    .filter((inv) => !esAnuladaSinEmitir(inv));
}

/**
 * UNA factura del cliente logueado por su `invoice_code`. Filtra por code +
 * tenant + Shipping Mark del principal + no-borrador: si no es suya (o es
 * borrador interno) → null → la página llama `notFound()`. El código es único
 * POR TENANT: sin el tenant, el mismo código en otra empresa con el mismo
 * Shipping Mark devolvía dos filas y la factura propia daba 404 (SDD-0462).
 */
export async function getMyInvoice(
  supabase: SupabaseClient,
  code: string,
): Promise<PortalInvoiceDetail | null> {
  const principal = await getPortalClientPrincipal(supabase);
  if (!principal) return null;
  return getMyInvoiceForPrincipal(supabase, principal, code);
}

/**
 * `getMyInvoice` para quien ya resolvió el principal con
 * `getPortalClientPrincipal`: la ruta del PDF usa UNA sola resolución para la
 * factura y para los datos del emisor (SDD-0462).
 */
export async function getMyInvoiceForPrincipal(
  supabase: SupabaseClient,
  principal: PortalClientPrincipal,
  code: string,
): Promise<PortalInvoiceDetail | null> {
  const { data, error } = await supabase
    .from("invoices")
    .select(
      "id, tenant_id, invoice_code, client_name, client_rif, client_doc_kind, status, currency, fx_rate, iva_rate, base_amount, iva_amount, total_amount, paid_amount, issued_at, due_date, lines, notes, shipment_id, shipment_code, created_at",
    )
    .eq("invoice_code", code)
    .eq("tenant_id", principal.tenantId)
    .eq("client_markbox", principal.client.markbox)
    .neq("status", "borrador")
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data) return null;
  // SDD-0556: una anulada que nunca se emitió es un borrador anulado; el
  // cliente nunca la recibió. Mismo 404 que un borrador, igual que en la lista.
  if (
    esAnuladaSinEmitir({
      status: data.status as PortalInvoiceDetail["status"],
      issuedAt: (data.issued_at as string | null) ?? null,
    })
  ) {
    return null;
  }

  return {
    id: data.id as string,
    // SDD-0298: tenant emisor. Coincide con el del principal por el filtro;
    // la ruta del PDF igual lee los datos del emisor con `principal.tenantId`
    // (SDD-0462), nunca con este campo.
    tenantId: data.tenant_id as string,
    clientRif: (data.client_rif as string | null) ?? null,
    clientDocKind: (data.client_doc_kind as string | null) ?? null,
    code: data.invoice_code as string,
    clientName: data.client_name as string,
    status: data.status as PortalInvoiceDetail["status"],
    currency: data.currency as PortalInvoiceDetail["currency"],
    fxRate: (data.fx_rate as number | null) ?? null,
    ivaRate: Number(data.iva_rate ?? 0),
    base: Number(data.base_amount ?? 0),
    ivaAmount: Number(data.iva_amount ?? 0),
    total: Number(data.total_amount ?? 0),
    paid: Number(data.paid_amount ?? 0),
    issuedAt: (data.issued_at as string | null) ?? null,
    dueDate: (data.due_date as string | null) ?? null,
    lines: Array.isArray(data.lines)
      ? (data.lines as PortalInvoiceDetail["lines"])
      : [],
    notes: (data.notes as string | null) ?? null,
    shipmentId: (data.shipment_id as string | null) ?? null,
    shipmentCode: (data.shipment_code as string | null) ?? null,
    createdAt: data.created_at as string,
  };
}

/**
 * TODOS los documentos del cliente logueado (sección GLOBAL "Documentos" del
 * portal · SDD-0042 Fase 3b), recientes primero, con el código del envío al que
 * pertenecen (embed `shipments(code)`). Filtra EXPLÍCITO por tenant y markbox
 * del principal (defensa en profundidad, como el resto del portal). Hasta 200.
 */
export async function listMyDocuments(
  supabase: SupabaseClient,
): Promise<PortalDocument[]> {
  const scope = await portalScope(supabase);
  if (!scope) return [];

  const { data, error } = await supabase
    .from("shipment_documents")
    .select(
      "id, doc_type, storage_path, file_name, content_type, size_bytes, created_at, shipment_id, shipments(code)",
    )
    .eq("tenant_id", scope.tenantId)
    .eq("client_markbox", scope.markbox)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error || !data) return [];

  return data.map((r) => {
    const ship = Array.isArray(r.shipments)
      ? (r.shipments[0] as { code: string | null } | undefined)
      : (r.shipments as { code: string | null } | null);
    return {
      id: r.id as string,
      docType: r.doc_type as PortalDocument["docType"],
      storagePath: r.storage_path as string,
      fileName: r.file_name as string,
      contentType: (r.content_type as string | null) ?? null,
      sizeBytes: (r.size_bytes as number | null) ?? null,
      createdAt: r.created_at as string,
      shipmentCode: ship?.code ?? null,
    };
  });
}

/**
 * Quotes del cliente logueado por TIPO (portal read-only), recientes primero.
 * Split del Norte (founder 2026-06-21): el cliente ve por separado sus
 *   - **estimados** (`source='web'`): la primera salida, lo que generó él en la
 *     calculadora pública (etapa lead), y
 *   - **cotizaciones** (`source!='web'`): lo formal — lo que le armó un asesor o
 *     lo que pidió él mismo desde el portal ("Nueva cotización").
 * SDD0380: principal Portal vivo/coherente y filtro explícito tenant+markbox,
 * además de la policy "quotes portal self read" (0428). Hasta 100.
 */
type PortalQuoteKind = "estimado" | "cotizacion";
type PortalQuoteScope = { tenantId: string; markbox: string };

/** No reutilizar un Shipping Mark aislado como autoridad. Tampoco heredar el
 * ámbito Studio de una sesión híbrida: este contexto pertenece sólo al Portal. */
async function portalQuoteScope(supabase: SupabaseClient): Promise<PortalQuoteScope | null> {
  try {
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
        c.deleted_at !== null || typeof c.markbox !== "string" || !c.markbox.trim()) return null;
    return { tenantId: row.tenant_id, markbox: c.markbox };
  } catch {
    // Transporte/identidad no verificable: no consultar cotizaciones ni usar admin.
    return null;
  }
}

async function listMyQuotes(
  supabase: SupabaseClient,
  kind: PortalQuoteKind,
): Promise<PortalEstimateRow[]> {
  const scope = await portalQuoteScope(supabase);
  if (!scope) return [];

  const base = supabase
    .from("quotes")
    .select(
      "id, quote_code, status, source, service, origin, destination, total_usd, nota, converted_to_shipment_id, created_at, updated_at",
    )
    .eq("tenant_id", scope.tenantId)
    .eq("client_markbox", scope.markbox)
    .is("deleted_at", null);
  const filtered =
    kind === "estimado" ? base.eq("source", "web") : base.neq("source", "web");

  const { data, error } = await filtered
    .order("created_at", { ascending: false })
    .limit(100);

  if (error || !data) return [];

  const rows: PortalEstimateRow[] = data.map((r) => ({
    id: r.id as string,
    code: r.quote_code as string,
    status: r.status as PortalEstimateRow["status"],
    source: r.source as PortalEstimateRow["source"],
    service: r.service as PortalEstimateRow["service"],
    origin: (r.origin as string | null) ?? null,
    destination: (r.destination as string | null) ?? null,
    totalUsd: Number(r.total_usd ?? 0),
    nota: (r.nota as string | null) ?? null,
    convertedToShipmentId: (r.converted_to_shipment_id as string | null) ?? null,
    convertedToShipmentCode: null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  }));

  await attachShipmentCodes(supabase, rows, scope);
  return rows;
}

/**
 * Rellena `convertedToShipmentCode` de las filas ya convertidas (SDD-0075 §1 ·
 * Slice C): `quotes.converted_to_shipment_id` guarda el uuid, pero el portal
 * enlaza por código (`/portal/envios/[code]`).
 *
 * Una sola query extra (`.in`) sobre los ids distintos, con el client de SESIÓN,
 * RLS y ámbito Portal tenant+markbox explícito. Si un envío no es propio, su
 * código queda en null y la fila degrada al texto sin enlace (nunca filtra un
 * envío ajeno). Muta `rows` in-place.
 */
async function attachShipmentCodes(
  supabase: SupabaseClient,
  rows: PortalEstimateRow[],
  scope: PortalQuoteScope,
): Promise<void> {
  const ids = [
    ...new Set(
      rows
        .map((r) => r.convertedToShipmentId)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ];
  if (ids.length === 0) return;

  const { data, error } = await supabase
    .from("shipments")
    .select("id, code")
    .eq("tenant_id", scope.tenantId)
    .eq("client_markbox", scope.markbox)
    .in("id", ids)
    .is("deleted_at", null);
  if (error || !data) return;

  const byId = new Map(
    data.map((s) => [s.id as string, (s.code as string | null) ?? null]),
  );
  for (const r of rows) {
    if (r.convertedToShipmentId) {
      r.convertedToShipmentCode = byId.get(r.convertedToShipmentId) ?? null;
    }
  }
}

/** Estimados (lead, `source='web'`) del cliente. */
export function listMyEstimates(
  supabase: SupabaseClient,
): Promise<PortalEstimateRow[]> {
  return listMyQuotes(supabase, "estimado");
}

/** Cotizaciones (formal, `source!='web'`) del cliente. */
export function listMyCotizaciones(
  supabase: SupabaseClient,
): Promise<PortalEstimateRow[]> {
  return listMyQuotes(supabase, "cotizacion");
}

// ─────────────────────────────────────────────────────────────
// Dashboard de Inicio (SDD-0042 · Fase 5 · Norte PortalHome)
// ─────────────────────────────────────────────────────────────

/**
 * Gate de activación del portal (Fase 5.1). El cliente ve el dashboard si:
 *   - el asesor aprobó su cuenta (`clients.portal_approved_at` != null), O
 *   - ya tiene ≥1 envío con su markbox (prueba de cliente real → auto-desbloqueo).
 *
 * Resuelve el principal Portal UNA vez (SDD-0552): con su `client.id` lee
 * `portal_approved_at`, y cuenta envíos por su tenant y su markbox (filtrado
 * EXPLÍCITO, como el resto del archivo). Sin principal Portal → no activado.
 */
export async function getPortalActivation(
  supabase: SupabaseClient,
): Promise<PortalActivation> {
  const scope = await portalScope(supabase);
  if (!scope) return { activated: false, reason: null };

  // ¿Aprobado por un asesor?
  const { data: clientRow } = await supabase
    .from("clients")
    .select("portal_approved_at")
    .eq("id", scope.clientId)
    .maybeSingle();

  if (clientRow && (clientRow.portal_approved_at as string | null)) {
    return { activated: true, reason: "approved" };
  }

  // ¿Tiene al menos 1 envío? (auto-desbloqueo por primera carga real)
  const { count, error: countErr } = await supabase
    .from("shipments")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", scope.tenantId)
    .eq("client_markbox", scope.markbox)
    .is("deleted_at", null);

  if (!countErr && (count ?? 0) >= 1) {
    return { activated: true, reason: "has_shipments" };
  }

  return { activated: false, reason: null };
}

/**
 * Completitud del perfil del cliente del portal (REGISTRO EXPRESS · founder
 * 2026-06-07). El alta express difiere foto + dirección; acá leemos si ya están
 * cargadas para nudgear "Completa tu perfil" (antes de la 1ª compra).
 *
 * Resuelve el client_id del portal vía la helper AISLADA (`get_portal_client_id`)
 * y lee SU PROPIA fila (la RLS del portal le permite leer su row de clients). Solo
 * deriva booleanos — el `cedula_photo_path` es un puntero a Storage privado, el
 * archivo en sí queda protegido por el bucket. Si el principal no es cliente del
 * portal → todo false (no se le ofrece completar nada).
 */
export async function getProfileCompleteness(
  supabase: SupabaseClient,
): Promise<ProfileCompleteness> {
  const empty: ProfileCompleteness = {
    hasPhoto: false,
    hasAddress: false,
    complete: false,
  };

  const { data: portalClientId, error: idErr } =
    await supabase.rpc("get_portal_client_id");
  if (idErr || !portalClientId) return empty;

  const { data, error } = await supabase
    .from("clients")
    .select("cedula_photo_path, address")
    .eq("id", portalClientId as string)
    .maybeSingle();
  if (error || !data) return empty;

  const hasPhoto = !!String((data.cedula_photo_path as string | null) ?? "").trim();

  // Dirección: la fuente canónica son las direcciones múltiples de SDD-0138
  // (client_delivery_addresses, RLS portal-self por markbox); `clients.address`
  // queda como legacy (pre-0198). Sin este OR, un cliente que cargó sus
  // direcciones en /portal/cuenta seguía viendo "te falta tu dirección".
  let hasAddress = !!String((data.address as string | null) ?? "").trim();
  if (!hasAddress) {
    const { count } = await supabase
      .from("client_delivery_addresses")
      .select("id", { count: "exact", head: true })
      .eq("client_id", portalClientId as string)
      .is("deleted_at", null);
    hasAddress = (count ?? 0) > 0;
  }

  return { hasPhoto, hasAddress, complete: hasPhoto && hasAddress };
}

/** Año calendario (UTC) — para el filtro "Entregados YTD". Aislado para testear. */
function currentYearUtc(now: Date = new Date()): number {
  return now.getUTCFullYear();
}

/**
 * Las 4 KPIs del dashboard (Fase 5.2). Calcula sobre la MISMA data que ya leen
 * `listMyShipments` / `listMyInvoices` (tenant + markbox del principal), pero agregando.
 * Reusa esas queries para no duplicar el filtrado de aislamiento.
 *
 * - Envíos activos: status NO terminal.
 * - Entregados YTD: `delivered` con `updated_at` en el año actual.
 * - Facturado / Saldo pendiente / facturas pendientes: `resumenDeCuenta`
 *   (SDD-0556), la misma definición que Facturas y Finanzas. Las anuladas no
 *   suman y la moneda dominante la deciden las vigentes.
 *
 * Si las facturas no se pueden leer completas, la portada no se cae entera: los
 * KPIs de facturas salen con `invoicesAvailable: false` y la tarjeta dice «No
 * disponible». Nunca un 0 que parezca «al día».
 */
export async function getDashboardKpis(
  supabase: SupabaseClient,
  now: Date = new Date(),
): Promise<PortalDashboardKpis> {
  const [shipments, invoices] = await Promise.all([
    listMyShipments(supabase),
    listMyInvoices(supabase).catch((e: unknown) => {
      if (e instanceof PortalInvoicesUnavailableError) return null;
      throw e;
    }),
  ]);

  const year = currentYearUtc(now);
  const activeShipments = shipments.filter((s) =>
    isActiveShipmentStatus(s.status),
  ).length;
  const deliveredYtd = shipments.filter((s) => {
    if (s.status !== "delivered") return false;
    const t = new Date(s.updatedAt);
    return !Number.isNaN(t.getTime()) && t.getUTCFullYear() === year;
  }).length;

  if (!invoices) {
    return {
      activeShipments,
      deliveredYtd,
      invoicesAvailable: false,
      invoicedTotal: 0,
      outstandingBalance: 0,
      currency: "USD",
      mixedCurrencies: false,
      pendingInvoiceCount: 0,
    };
  }

  const r = resumenDeCuenta(invoices);
  return {
    activeShipments,
    deliveredYtd,
    invoicesAvailable: true,
    invoicedTotal: r.facturado,
    outstandingBalance: r.porPagar,
    currency: r.currency,
    mixedCurrencies: r.mixedCurrencies,
    pendingInvoiceCount: r.facturasPorPagar,
  };
}

/**
 * El "Próximo arribo" del dashboard (Fase 5.2 · DEGRADADO). El envío ACTIVO más
 * reciente del cliente (orden por updated_at desc, ya garantizado por
 * `listMyShipments`), con ETA estimada. Sin contenedor/buque/progreso (Tier 1
 * Naviera, no construido). Null si no hay envío activo → el card se oculta.
 *
 * NOTA: `listMyShipments` no trae `created_at` (la ETA se estima sobre createdAt).
 * Hacemos una lectura puntual del envío elegido para obtener createdAt +
 * arrived_destination_at y estimar honestamente. Filtrado EXPLÍCITO por tenant y
 * markbox del principal (SDD-0552).
 */
export async function getNextArrival(
  supabase: SupabaseClient,
): Promise<PortalNextArrival | null> {
  const scope = await portalScope(supabase);
  if (!scope) return null;

  const { data, error } = await supabase
    .from("shipments")
    .select(
      "id, code, shipment_service, status, origin, destination, arrived_destination_at, created_at",
    )
    .eq("tenant_id", scope.tenantId)
    .eq("client_markbox", scope.markbox)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error || !data) return null;

  const next = data.find((r) =>
    isActiveShipmentStatus(r.status as ShipmentStatus),
  );
  if (!next) return null;

  const service = next.shipment_service as ShipmentService;
  const status = next.status as ShipmentStatus;
  const etaIso = estimatePortalEta({
    status,
    service,
    arrivedDestinationAt:
      (next.arrived_destination_at as string | null) ?? null,
    createdAt: next.created_at as string,
  });

  return {
    id: next.id as string,
    code: next.code as string,
    service,
    status,
    origin: (next.origin as string | null) ?? null,
    destination: (next.destination as string | null) ?? null,
    etaIso,
  };
}
