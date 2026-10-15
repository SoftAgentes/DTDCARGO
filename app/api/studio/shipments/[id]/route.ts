/**
 * Route handler de un envio individual.
 *
 * GET    /api/studio/shipments/[id]  — detalle envio + lista de eventos
 * PATCH  /api/studio/shipments/[id]  — edita campos (no cambia code ni shipment_service)
 * DELETE /api/studio/shipments/[id]  — borrado auditado con motivo (RPC de la 0476, SDD-0522)
 *
 * Auth: sesion Supabase valida obligatoria. RLS filtra por tenant.
 * tenant_id NO se acepta como param (se deriva del JWT).
 *
 * SDD-0531 · lo que devuelven GET y PATCH pasa por la regla de Tracking: al
 * equipo de China (región cn, no admin) el envío le llega sin nombre del
 * cliente ni ubicación de entrega.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/db/server";
import {
  readCanSeeClientNames,
  segunVisibilidad,
} from "@/lib/studio/privacidad-cn";
import { apiError } from "@/lib/http/api-error";
import {
  getShipmentById,
  getShipmentEvents,
} from "@/lib/studio/shipment-queries";
import { capabilityDenial, moduleEditDenial, moduleViewDenial } from "@/lib/studio/rbac-guard";
import { validateAuditReason } from "@/lib/studio/audit/reason";
import {
  mensajeResultadoEmbarques,
  normalizarLote,
  shipmentDeleteBlockReason,
} from "@/lib/studio/borrado/reglas";
import { eliminarEmbarques } from "@/lib/studio/borrado/servidor";

async function requireStudioSession() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user };
}

/**
 * Campos editables via PATCH. Excluye:
 *   - id, tenant_id, code, shipment_service (inmutables despues de crear)
 *   - status (se cambia via /events POST, no via PATCH del shipment)
 *   - deleted_at, arrived_destination_at (manejados por triggers/DELETE)
 *   - created_at, updated_at (auto)
 */
type ShipmentEditablePayload = {
  client_name?: string | null;
  client_markbox?: string | null;
  origin?: string | null;
  destination?: string | null;
  weight_kg?: number | null;
  volume_m3?: number | null;
  vehicle_category?: string | null;
  vehicle_model?: string | null;
  notes?: string | null;
};

const EDITABLE_FIELDS: (keyof ShipmentEditablePayload)[] = [
  "client_name",
  "client_markbox",
  "origin",
  "destination",
  "weight_kg",
  "volume_m3",
  "vehicle_category",
  "vehicle_model",
  "notes",
];

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { supabase, user } = await requireStudioSession();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const denial = await moduleViewDenial(supabase, "tracking");
  if (denial) return NextResponse.json({ error: denial }, { status: 403 });

  try {
    const shipment = await getShipmentById(supabase, id);
    if (!shipment) {
      return NextResponse.json({ error: "Envío no encontrado." }, { status: 404 });
    }
    const events = await getShipmentEvents(supabase, id);
    return NextResponse.json({
      shipment: segunVisibilidad(shipment, await readCanSeeClientNames(supabase)),
      events,
    });
  } catch (err) {
    return apiError("No pudimos leer el envío.", err, 500, "shipments:get");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { supabase, user } = await requireStudioSession();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const denial = await moduleEditDenial(supabase, "tracking");
  if (denial) return NextResponse.json({ error: denial }, { status: 403 });

  let raw: Partial<ShipmentEditablePayload>;
  try {
    raw = (await request.json()) as Partial<ShipmentEditablePayload>;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  // Sanitizar — solo campos editables
  const update: Partial<ShipmentEditablePayload> = {};
  for (const key of EDITABLE_FIELDS) {
    if (key in raw) update[key] = raw[key] as never;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Sin cambios para guardar." }, { status: 400 });
  }

  // Validar tipos numericos
  if (update.weight_kg !== undefined && update.weight_kg !== null) {
    const n = Number(update.weight_kg);
    if (Number.isNaN(n) || n < 0) {
      return NextResponse.json({ error: "Peso inválido." }, { status: 400 });
    }
    update.weight_kg = n;
  }
  if (update.volume_m3 !== undefined && update.volume_m3 !== null) {
    const n = Number(update.volume_m3);
    if (Number.isNaN(n) || n < 0) {
      return NextResponse.json({ error: "Volumen inválido." }, { status: 400 });
    }
    update.volume_m3 = n;
  }

  const { data, error } = await supabase
    .from("shipments")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Envío no encontrado." }, { status: 404 });
    }
    return apiError("No pudimos guardar los cambios.", error, 500, "shipments:patch");
  }
  return NextResponse.json({
    shipment: segunVisibilidad(data, await readCanSeeClientNames(supabase)),
  });
}

/**
 * DELETE con motivo (SDD-0522): body JSON `{ "reason": "…" }`, de 4 a 1000
 * caracteres. Sólo admin (`delete_shipments`); la RPC de la 0476 decide si se
 * puede (409 con los bloqueos si no), escribe `shipment_deleted` y cancela los
 * avisos pendientes. El UPDATE directo de `deleted_at` ya no está permitido.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { supabase, user } = await requireStudioSession();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const denial = await capabilityDenial(supabase, "delete_shipments");
  if (denial) return NextResponse.json({ error: denial }, { status: 403 });

  const lote = normalizarLote([id]);
  if (!lote.ok) return NextResponse.json({ error: "Envío no válido." }, { status: 400 });

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const motivo = validateAuditReason(
    typeof body === "object" && body !== null ? (body as { reason?: unknown }).reason : undefined,
  );
  if (!motivo.ok) return NextResponse.json({ error: motivo.error }, { status: 400 });

  const resultado = await eliminarEmbarques(supabase, lote.ids, motivo.reason);
  if (resultado.estado === "eliminado") return NextResponse.json({ ok: true });
  if (resultado.estado === "rechazado") {
    const fila = resultado.bloqueadas[0];
    if (!fila) return NextResponse.json({ error: "Envío no encontrado." }, { status: 404 });
    return NextResponse.json(
      { error: shipmentDeleteBlockReason({ bloqueos: fila.bloqueos, avisos: {} }), blockers: fila.bloqueos },
      { status: 409 },
    );
  }
  const status = resultado.tipo === "permiso" ? 403 : resultado.tipo === "entrada" ? 400 : 500;
  const mensaje = mensajeResultadoEmbarques(resultado);
  return NextResponse.json({ error: "error" in mensaje ? mensaje.error : "No pudimos eliminar el envío." }, { status });
}
