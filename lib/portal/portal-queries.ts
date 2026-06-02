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
  PortalClient,
  PortalDocument,
  PortalInvoiceDetail,
  PortalInvoiceRow,
  PortalShipmentDetail,
  PortalShipmentRow,
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
    .select("id, markbox, name, email, phone, address")
    .eq("id", portalClientId as string)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id as string,
    markbox: data.markbox as string,
    name: data.name as string,
    email: (data.email as string | null) ?? null,
    phone: (data.phone as string | null) ?? null,
    address: (data.address as string | null) ?? null,
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
      "id, invoice_code, client_name, status, currency, fx_rate, iva_rate, base_amount, iva_amount, total_amount, paid_amount, issued_at, due_date, lines, notes, shipment_id, shipment_code, created_at",
    )
    .eq("invoice_code", code)
    .eq("client_markbox", markbox)
    .neq("status", "borrador")
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id as string,
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
