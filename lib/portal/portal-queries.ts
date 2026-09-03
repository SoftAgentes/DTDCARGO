/**
 * Queries del Portal del Cliente (SDD-0042). Funciones puras que reciben un
 * `SupabaseClient`.
 *
 * AISLAMIENTO (defensa en profundidad): además de la RLS del portal, estas
 * queries resuelven el MARKBOX del cliente logueado vía
 * `get_portal_client_markbox()` y filtran EXPLÍCITO por `client_markbox`. Sin ese
 * filtro, un principal que sea a la vez user de equipo y cliente del portal
 * (tiene row en `user_tenants` Y en `client_users`) recibiría TODO el tenant: la
 * policy "<tabla> by tenant" es permissive (OR) y, sola, no aísla. Mismo criterio
 * que el hardening de `getPortalClient` (resolver el principal del portal primero,
 * filtrar explícito por su identificador).
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
  type InvoiceCurrency,
  type ShipmentService,
  type ShipmentStatus,
} from "./portal-types";

/**
 * MARKBOX del cliente del portal logueado (helper aislada
 * `get_portal_client_markbox`), o null si el principal no es un cliente del
 * portal. Punto único de resolución para las queries que filtran por markbox.
 */
async function portalMarkbox(supabase: SupabaseClient): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_portal_client_markbox");
  if (error || !data) return null;
  return data as string;
}

/**
 * El cliente vinculado al `auth.uid()` actual (su propio registro `clients`).
 * Devuelve null si la sesión no está habilitada como portal.
 *
 * Resuelve el `client_id` del portal vía la helper AISLADA PRIMERO. Si es null,
 * el principal NO es un cliente del portal (p.ej. un user de equipo): cortamos.
 * El filtro explícito por id previene que la policy "clients by tenant" le
 * devuelva un cliente cualquiera del tenant a un user de equipo.
 */
export async function getPortalClient(
  supabase: SupabaseClient,
): Promise<PortalClient | null> {
  const { data: portalClientId, error: idErr } =
    await supabase.rpc("get_portal_client_id");
  if (idErr || !portalClientId) return null;

  const { data, error } = await supabase
    .from("clients")
    .select("id, markbox, name, email, phone, address, rif, doc_kind, city, state")
    .eq("id", portalClientId as string)
    .maybeSingle();

  if (error || !data) return null;

  // `doc_kind` es texto libre en DB (migr 0092); sólo aceptamos los canónicos.
  const rawDocKind = (data.doc_kind as string | null) ?? null;

  return {
    id: data.id as string,
    markbox: data.markbox as string,
    name: data.name as string,
    email: (data.email as string | null) ?? null,
    phone: (data.phone as string | null) ?? null,
    address: (data.address as string | null) ?? null,
    docKind:
      rawDocKind === "persona" || rawDocKind === "empresa" ? rawDocKind : null,
    rif: (data.rif as string | null) ?? null,
    city: (data.city as string | null) ?? null,
    state: (data.state as string | null) ?? null,
  };
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
 * Envíos del cliente logueado (filtrados EXPLÍCITO por su markbox), recientes
 * primero. Hasta 100; paginación real en una fase siguiente si hace falta.
 */
export async function listMyShipments(
  supabase: SupabaseClient,
): Promise<PortalShipmentRow[]> {
  const markbox = await portalMarkbox(supabase);
  if (!markbox) return [];

  const { data, error } = await supabase
    .from("shipments")
    .select("id, code, shipment_service, status, origin, destination, updated_at")
    .eq("client_markbox", markbox)
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
 * Filtra por code + markbox del cliente: si el `code` no es suyo (o no existe)
 * → null → la página llama `notFound()`.
 */
export async function getMyShipment(
  supabase: SupabaseClient,
  code: string,
): Promise<PortalShipmentDetail | null> {
  const markbox = await portalMarkbox(supabase);
  if (!markbox) return null;

  const { data, error } = await supabase
    .from("shipments")
    .select(
      "id, code, shipment_service, status, origin, destination, volume_m3, weight_kg, arrived_destination_at, created_at, updated_at",
    )
    .eq("code", code)
    .eq("client_markbox", markbox)
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
 * Facturas del cliente logueado (SDD-0042 · Fase 3), recientes primero. La RLS
 * del portal ya excluye borradores; filtramos EXPLÍCITO por markbox y `borrador`
 * igualmente (defensa en profundidad). Hasta 100.
 */
export async function listMyInvoices(
  supabase: SupabaseClient,
): Promise<PortalInvoiceRow[]> {
  const markbox = await portalMarkbox(supabase);
  if (!markbox) return [];

  const { data, error } = await supabase
    .from("invoices")
    .select(
      "id, invoice_code, status, currency, total_amount, paid_amount, issued_at, due_date, shipment_code",
    )
    .eq("client_markbox", markbox)
    .neq("status", "borrador")
    .is("deleted_at", null)
    .order("issued_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(100);

  if (error || !data) return [];

  return data.map((r) => ({
    id: r.id as string,
    code: r.invoice_code as string,
    status: r.status as PortalInvoiceRow["status"],
    currency: r.currency as PortalInvoiceRow["currency"],
    total: Number(r.total_amount ?? 0),
    paid: Number(r.paid_amount ?? 0),
    issuedAt: (r.issued_at as string | null) ?? null,
    dueDate: (r.due_date as string | null) ?? null,
    shipmentCode: (r.shipment_code as string | null) ?? null,
  }));
}

/**
 * UNA factura del cliente logueado por su `invoice_code`. Filtra por code +
 * markbox + no-borrador: si no es suya (o es borrador interno) → null → la
 * página llama `notFound()`.
 */
export async function getMyInvoice(
  supabase: SupabaseClient,
  code: string,
): Promise<PortalInvoiceDetail | null> {
  const markbox = await portalMarkbox(supabase);
  if (!markbox) return null;

  const { data, error } = await supabase
    .from("invoices")
    .select(
      "id, tenant_id, invoice_code, client_name, client_rif, client_doc_kind, status, currency, fx_rate, iva_rate, base_amount, iva_amount, total_amount, paid_amount, issued_at, due_date, lines, notes, shipment_id, shipment_code, created_at",
    )
    .eq("invoice_code", code)
    .eq("client_markbox", markbox)
    .neq("status", "borrador")
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id as string,
    // SDD-0298: lo necesita la ruta del PDF para leer los datos del emisor con
    // el cliente admin — el del portal no ve `tenants` (no está en
    // `user_tenants`).
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
 * pertenecen (embed `shipments(code)`). Filtra EXPLÍCITO por markbox (defensa en
 * profundidad, como el resto del portal). Hasta 200.
 */
export async function listMyDocuments(
  supabase: SupabaseClient,
): Promise<PortalDocument[]> {
  const markbox = await portalMarkbox(supabase);
  if (!markbox) return [];

  const { data, error } = await supabase
    .from("shipment_documents")
    .select(
      "id, doc_type, storage_path, file_name, content_type, size_bytes, created_at, shipment_id, shipments(code)",
    )
    .eq("client_markbox", markbox)
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
 * Resuelve el client_id del portal vía la helper AISLADA (`get_portal_client_id`)
 * para leer `portal_approved_at`, y cuenta envíos por markbox (filtrado EXPLÍCITO,
 * como el resto del archivo). Si el principal no es cliente del portal → no activado.
 */
export async function getPortalActivation(
  supabase: SupabaseClient,
): Promise<PortalActivation> {
  const { data: portalClientId, error: idErr } =
    await supabase.rpc("get_portal_client_id");
  if (idErr || !portalClientId) return { activated: false, reason: null };

  // ¿Aprobado por un asesor?
  const { data: clientRow } = await supabase
    .from("clients")
    .select("portal_approved_at")
    .eq("id", portalClientId as string)
    .maybeSingle();

  if (clientRow && (clientRow.portal_approved_at as string | null)) {
    return { activated: true, reason: "approved" };
  }

  // ¿Tiene al menos 1 envío? (auto-desbloqueo por primera carga real)
  const markbox = await portalMarkbox(supabase);
  if (!markbox) return { activated: false, reason: null };

  const { count, error: countErr } = await supabase
    .from("shipments")
    .select("id", { count: "exact", head: true })
    .eq("client_markbox", markbox)
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
 * `listMyShipments` / `listMyInvoices` (filtrado por markbox), pero agregando.
 * Reusa esas queries para no duplicar el filtrado de aislamiento.
 *
 * - Envíos activos: status NO terminal.
 * - Entregados YTD: `delivered` con `updated_at` en el año actual.
 * - Facturado: Σ total_amount de facturas no-borrador (en la moneda dominante).
 * - Saldo pendiente: Σ (total − paid) de facturas no-borrador (moneda dominante).
 *
 * Sumar montos cruzando monedas sería incorrecto → agregamos por moneda y
 * reportamos la DOMINANTE (mayor total), igual criterio que la página de facturas.
 */
export async function getDashboardKpis(
  supabase: SupabaseClient,
  now: Date = new Date(),
): Promise<PortalDashboardKpis> {
  const [shipments, invoices] = await Promise.all([
    listMyShipments(supabase),
    listMyInvoices(supabase),
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

  // Agregar montos por moneda → elegir dominante.
  const byCurrency = new Map<
    InvoiceCurrency,
    { total: number; balance: number }
  >();
  let pendingInvoiceCount = 0;
  for (const inv of invoices) {
    const e = byCurrency.get(inv.currency) ?? { total: 0, balance: 0 };
    e.total += inv.total;
    const bal = Math.max(0, inv.total - inv.paid);
    e.balance += bal;
    if (bal > 0) pendingInvoiceCount += 1;
    byCurrency.set(inv.currency, e);
  }
  const currencies = [...byCurrency.keys()];
  const currency =
    currencies
      .slice()
      .sort(
        (a, b) => (byCurrency.get(b)?.total ?? 0) - (byCurrency.get(a)?.total ?? 0),
      )[0] ?? ("USD" as InvoiceCurrency);
  const agg = byCurrency.get(currency) ?? { total: 0, balance: 0 };

  return {
    activeShipments,
    deliveredYtd,
    invoicedTotal: agg.total,
    outstandingBalance: agg.balance,
    currency,
    mixedCurrencies: currencies.length > 1,
    pendingInvoiceCount,
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
 * arrived_destination_at y estimar honestamente. Filtrado EXPLÍCITO por markbox.
 */
export async function getNextArrival(
  supabase: SupabaseClient,
): Promise<PortalNextArrival | null> {
  const markbox = await portalMarkbox(supabase);
  if (!markbox) return null;

  const { data, error } = await supabase
    .from("shipments")
    .select(
      "id, code, shipment_service, status, origin, destination, arrived_destination_at, created_at",
    )
    .eq("client_markbox", markbox)
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
