/**
 * Server actions del módulo Órdenes de venta (SDD-0072) — la OV de DTD.
 *
 * "use server" + parsing manual + validate*Input (sin Zod) + revalidatePath.
 *
 *  - createSalesOrder            · crea la OV manual (sin estimado · B2B/otros).
 *  - convertEstimateToSalesOrder · ⭐ convierte un estimado → OV (snapshot editable
 *                                  del quote + link BIDIRECCIONAL quote_id ↔
 *                                  quotes.sales_order_id).
 *  - updateSalesOrder            · edita el snapshot (solo en estado 'confirmada').
 *  - setSalesOrderStatus         · transición de status (valida el grafo canTransition).
 *  - cancelSalesOrder            · marca 'cancelada' (atajo de transición).
 *  - assignPrealertaToSalesOrder · ata una prealerta (caja física) a la OV.
 *  - unassignPrealertaFromSalesOrder · le quita la prealerta a la OV.
 *
 * Fase 2 (NO acá): la confirmación de Warehouse genera la Factura (0021), parcial
 * por defecto, y setea 'parcial'/'facturada' (estados de motor).
 */

"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/db/admin";
import { createClient } from "@/lib/db/server";
import {
  buildSalesOrderFromQuote,
  canTransition,
  isEditableStatus,
  validateSalesOrderInput,
  type SalesOrderInput,
  type SalesOrderStatus,
} from "./types";

const SO_PATH = "/studio/ordenes-venta";

async function resolveTenantId(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const { data } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  return data?.tenant_id ?? null;
}

async function currentUserId(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/** Best-effort audit con actor_type='user'. No bloquea la mutación. */
async function audit(
  tenantId: string,
  entityId: string,
  actorId: string | null,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("entity_audit_log").insert({
      tenant_id: tenantId,
      entity_type: "sales_order",
      entity_id: entityId,
      actor_type: "user",
      actor_id: actorId,
      event_type: eventType,
      payload,
    });
  } catch (e) {
    // entity_audit_log tiene CHECK de entity_type (0124); si 'sales_order' no
    // está en el CHECK del env, el insert falla pero NO debe bloquear la OV.
    console.error("[sales-orders audit] no se pudo registrar audit:", e);
  }
}

// ── Insertar la OV (común a crear manual / convertir) ──────────

async function insertSalesOrder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  input: SalesOrderInput,
  quoteId: string | null,
): Promise<{ id?: string; salesOrderCode?: string; error?: string }> {
  const { data: codeData, error: codeErr } = await supabase.rpc(
    "next_sales_order_code",
    { p_tenant_id: tenantId },
  );
  if (codeErr || !codeData) {
    return { error: "No se pudo generar el código de la orden de venta." };
  }
  const salesOrderCode = String(codeData);

  const { data: inserted, error: insErr } = await supabase
    .from("sales_orders")
    .insert({
      tenant_id: tenantId,
      sales_order_code: salesOrderCode,
      quote_id: quoteId,
      client_markbox: input.clientMarkbox,
      client_name: input.clientName,
      service: input.service,
      origin: input.origin,
      destination: input.destination,
      subtotal_usd: input.subtotalUsd,
      total_usd: input.totalUsd,
      status: "confirmada",
      notes: input.notes,
    })
    .select("id")
    .single();
  if (insErr || !inserted) {
    return { error: `No se pudo crear la orden de venta: ${insErr?.message}` };
  }
  return { id: inserted.id, salesOrderCode };
}

// ── Crear OV manual ────────────────────────────────────────────

export async function createSalesOrder(
  raw: Partial<SalesOrderInput>,
): Promise<{ ok?: boolean; error?: string; salesOrderCode?: string }> {
  const supabase = await createClient();

  const { input, fieldErrors } = validateSalesOrderInput(raw);
  if (fieldErrors) {
    const first = Object.values(fieldErrors)[0];
    return { error: first ?? "Datos de la orden de venta inválidos." };
  }

  const tenantId = await resolveTenantId(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant." };

  const res = await insertSalesOrder(supabase, tenantId, input!, null);
  if (res.error || !res.id) {
    return { error: res.error ?? "No se pudo crear la orden de venta." };
  }

  await audit(tenantId, res.id, await currentUserId(supabase), "so_created", {
    sales_order_code: res.salesOrderCode,
    total_usd: input!.totalUsd,
    manual: true,
  });

  revalidatePath(SO_PATH);
  return { ok: true, salesOrderCode: res.salesOrderCode };
}

// ── Convertir estimado → OV (snapshot + link bidireccional) ────

/**
 * ⭐ Convierte un estimado (quotes, EST-) en Orden de venta.
 *
 * Pasos:
 *  1. lee el estimado (RLS filtra por tenant) + valida que no esté ya convertido.
 *  2. snapshotea sus datos con buildSalesOrderFromQuote (editable luego).
 *  3. (opcional) pisa el snapshot con `overrides` del operador (si editó al convertir).
 *  4. inserta la OV con quote_id = estimado (link OV→estimado).
 *  5. marca quotes.sales_order_id = OV (reverso del link bidireccional).
 */
export async function convertEstimateToSalesOrder(
  quoteId: string,
  overrides?: Partial<SalesOrderInput>,
): Promise<{ ok?: boolean; error?: string; salesOrderCode?: string }> {
  const supabase = await createClient();

  const { data: quote, error: qErr } = await supabase
    .from("quotes")
    .select(
      "id, tenant_id, client_markbox, client_name, service, origin, destination, subtotal_usd, total_usd, notes, sales_order_id",
    )
    .eq("id", quoteId)
    .is("deleted_at", null)
    .maybeSingle<{
      id: string;
      tenant_id: string;
      client_markbox: string | null;
      client_name: string;
      service: SalesOrderInput["service"];
      origin: string;
      destination: string;
      subtotal_usd: number;
      total_usd: number;
      notes: string | null;
      sales_order_id: string | null;
    }>();
  if (qErr || !quote) return { error: "Estimado no encontrado." };
  if (quote.sales_order_id) {
    return { error: "Este estimado ya se convirtió en una orden de venta." };
  }

  // Snapshot del estimado + overrides del operador (si editó al convertir).
  const snapshot = buildSalesOrderFromQuote({
    client_markbox: quote.client_markbox,
    client_name: quote.client_name,
    service: quote.service,
    origin: quote.origin,
    destination: quote.destination,
    subtotal_usd: quote.subtotal_usd,
    total_usd: quote.total_usd,
    notes: quote.notes,
  });
  const { input, fieldErrors } = validateSalesOrderInput({
    ...snapshot,
    ...overrides,
  });
  if (fieldErrors) {
    const first = Object.values(fieldErrors)[0];
    return { error: first ?? "Datos de la orden de venta inválidos." };
  }

  const res = await insertSalesOrder(supabase, quote.tenant_id, input!, quote.id);
  if (res.error || !res.id) {
    return { error: res.error ?? "No se pudo crear la orden de venta." };
  }

  // Reverso del link: marcar el estimado como convertido (idempotente: solo si
  // sigue sin OV, backstop anti-race).
  const { error: linkErr } = await supabase
    .from("quotes")
    .update({ sales_order_id: res.id })
    .eq("id", quote.id)
    .is("sales_order_id", null);
  if (linkErr) {
    // La OV ya existe y apunta al estimado; el reverso es best-effort.
    console.error(
      "[sales-orders] OV creada pero no se marcó el estimado como convertido:",
      linkErr.message,
    );
  }

  await audit(
    quote.tenant_id,
    res.id,
    await currentUserId(supabase),
    "so_converted_from_estimate",
    {
      sales_order_code: res.salesOrderCode,
      quote_id: quote.id,
      total_usd: input!.totalUsd,
    },
  );

  revalidatePath(SO_PATH);
  revalidatePath("/studio/cotizador");
  return { ok: true, salesOrderCode: res.salesOrderCode };
}

// ── Editar OV (solo 'confirmada') ──────────────────────────────

export async function updateSalesOrder(
  salesOrderId: string,
  raw: Partial<SalesOrderInput>,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  const { input, fieldErrors } = validateSalesOrderInput(raw);
  if (fieldErrors) {
    const first = Object.values(fieldErrors)[0];
    return { error: first ?? "Datos de la orden de venta inválidos." };
  }

  const { data: so, error: readErr } = await supabase
    .from("sales_orders")
    .select("id, tenant_id, status")
    .eq("id", salesOrderId)
    .is("deleted_at", null)
    .maybeSingle<{ id: string; tenant_id: string; status: string }>();
  if (readErr || !so) return { error: "Orden de venta no encontrada." };
  if (!isEditableStatus(so.status)) {
    return {
      error: "Solo se puede editar una OV confirmada (antes de facturar).",
    };
  }

  const { error: updErr } = await supabase
    .from("sales_orders")
    .update({
      client_markbox: input!.clientMarkbox,
      client_name: input!.clientName,
      service: input!.service,
      origin: input!.origin,
      destination: input!.destination,
      subtotal_usd: input!.subtotalUsd,
      total_usd: input!.totalUsd,
      notes: input!.notes,
    })
    .eq("id", so.id);
  if (updErr) {
    return { error: `No se pudo actualizar la OV: ${updErr.message}` };
  }

  await audit(so.tenant_id, so.id, await currentUserId(supabase), "so_updated", {
    total_usd: input!.totalUsd,
  });

  revalidatePath(SO_PATH);
  return { ok: true };
}

// ── Transición de status ───────────────────────────────────────

export async function setSalesOrderStatus(
  salesOrderId: string,
  to: SalesOrderStatus,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  const { data: so, error: readErr } = await supabase
    .from("sales_orders")
    .select("id, tenant_id, status, sales_order_code")
    .eq("id", salesOrderId)
    .is("deleted_at", null)
    .maybeSingle<{
      id: string;
      tenant_id: string;
      status: string;
      sales_order_code: string;
    }>();
  if (readErr || !so) return { error: "Orden de venta no encontrada." };

  if (!canTransition(so.status, to)) {
    return { error: `No se puede pasar la OV de "${so.status}" a "${to}".` };
  }

  const { error: updErr } = await supabase
    .from("sales_orders")
    .update({ status: to })
    .eq("id", so.id);
  if (updErr) return { error: `No se pudo cambiar el estado: ${updErr.message}` };

  await audit(
    so.tenant_id,
    so.id,
    await currentUserId(supabase),
    "so_status_changed",
    { from: so.status, to, sales_order_code: so.sales_order_code },
  );

  revalidatePath(SO_PATH);
  return { ok: true };
}

export async function cancelSalesOrder(
  salesOrderId: string,
): Promise<{ ok?: boolean; error?: string }> {
  return setSalesOrderStatus(salesOrderId, "cancelada");
}

// ── OV ↔ prealerta (caja física) ───────────────────────────────

/**
 * Ata una prealerta (caja física) a la OV. Valida que ambas existan en el tenant
 * del usuario (RLS) y que la OV no esté en estado terminal. Idempotente: si la
 * prealerta ya apunta a otra OV, la re-apunta a esta.
 */
export async function assignPrealertaToSalesOrder(
  salesOrderId: string,
  prealertaId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  const { data: so, error: soErr } = await supabase
    .from("sales_orders")
    .select("id, tenant_id, status, sales_order_code")
    .eq("id", salesOrderId)
    .is("deleted_at", null)
    .maybeSingle<{
      id: string;
      tenant_id: string;
      status: string;
      sales_order_code: string;
    }>();
  if (soErr || !so) return { error: "Orden de venta no encontrada." };
  if (so.status === "cancelada") {
    return { error: "No se puede asignar una prealerta a una OV cancelada." };
  }

  // La prealerta debe existir en el tenant (RLS filtra; el update por id es
  // suficiente, pero validamos para devolver un error claro).
  const { data: pre, error: preErr } = await supabase
    .from("prealertas")
    .select("id, code")
    .eq("id", prealertaId)
    .is("deleted_at", null)
    .maybeSingle<{ id: string; code: string }>();
  if (preErr || !pre) return { error: "Prealerta no encontrada." };

  const { error: updErr } = await supabase
    .from("prealertas")
    .update({ sales_order_id: so.id })
    .eq("id", pre.id);
  if (updErr) {
    return { error: `No se pudo asignar la prealerta: ${updErr.message}` };
  }

  await audit(
    so.tenant_id,
    so.id,
    await currentUserId(supabase),
    "so_prealerta_assigned",
    { sales_order_code: so.sales_order_code, prealerta_code: pre.code },
  );

  revalidatePath(SO_PATH);
  return { ok: true };
}

/** Le quita la prealerta a la OV (set sales_order_id = null). */
export async function unassignPrealertaFromSalesOrder(
  salesOrderId: string,
  prealertaId: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();

  const { data: so } = await supabase
    .from("sales_orders")
    .select("id, tenant_id, sales_order_code")
    .eq("id", salesOrderId)
    .is("deleted_at", null)
    .maybeSingle<{ id: string; tenant_id: string; sales_order_code: string }>();
  if (!so) return { error: "Orden de venta no encontrada." };

  const { error: updErr } = await supabase
    .from("prealertas")
    .update({ sales_order_id: null })
    .eq("id", prealertaId)
    .eq("sales_order_id", so.id); // solo si estaba atada a ESTA OV
  if (updErr) {
    return { error: `No se pudo quitar la prealerta: ${updErr.message}` };
  }

  await audit(
    so.tenant_id,
    so.id,
    await currentUserId(supabase),
    "so_prealerta_unassigned",
    { sales_order_code: so.sales_order_code, prealerta_id: prealertaId },
  );

  revalidatePath(SO_PATH);
  return { ok: true };
}
