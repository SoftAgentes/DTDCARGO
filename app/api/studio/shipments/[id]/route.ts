/**
 * Route handler de un envio individual.
 *
 * GET    /api/studio/shipments/[id]  — detalle envio + lista de eventos
 * PATCH  /api/studio/shipments/[id]  — edita campos (no cambia code ni shipment_service)
 * DELETE /api/studio/shipments/[id]  — soft delete (set deleted_at = now())
 *
 * Auth: sesion Supabase valida obligatoria. RLS filtra por tenant.
 * tenant_id NO se acepta como param (se deriva del JWT).
 */

import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/http/api-error";
import { requireStudioSession } from "@/lib/http/studio-session";
import {
  getShipmentById,
  getShipmentEvents,
} from "@/lib/studio/shipment-queries";

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
  const sesion = await requireStudioSession();
  if (sesion instanceof NextResponse) return sesion;
  const { supabase } = sesion;

  try {
    const shipment = await getShipmentById(supabase, id);
    if (!shipment) {
      return NextResponse.json({ error: "Envío no encontrado." }, { status: 404 });
    }
    const events = await getShipmentEvents(supabase, id);
    return NextResponse.json({ shipment, events });
  } catch (err) {
    return apiError("No pudimos leer el envío.", err, 500, "shipments:get");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sesion = await requireStudioSession();
  if (sesion instanceof NextResponse) return sesion;
  const { supabase } = sesion;

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
  return NextResponse.json({ shipment: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sesion = await requireStudioSession();
  if (sesion instanceof NextResponse) return sesion;
  const { supabase } = sesion;

  // Soft delete — el trigger cascade_soft_delete_events propaga a shipment_events
  const { error } = await supabase
    .from("shipments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return apiError("No pudimos eliminar el envío.", error, 500, "shipments:delete");
  }
  return NextResponse.json({ ok: true });
}
