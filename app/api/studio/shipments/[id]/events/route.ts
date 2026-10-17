/**
 * Route handler de eventos del timeline.
 *
 * POST /api/studio/shipments/[id]/events  — agrega evento (cambio de estado)
 *
 * Cambiar el estado del shipment + insertar un event van en la misma transaccion
 * logica (dos statements seguidos). Si el insert del event falla, revertimos
 * el status manualmente — no hay RPC transaccional en MVP.
 *
 * Auth: sesion Supabase valida obligatoria + gate de EDICION del modulo
 * "tracking". RLS filtra por tenant.
 *
 * SDD-0499 · este POST era el unico del recurso sin gate de modulo: pedia
 * tenant y nada mas, mientras sus hermanos de `shipments/[id]/route.ts` ya
 * usaban `moduleViewDenial`/`moduleEditDenial` con "tracking". Y es el POST que
 * MUTA `shipments.status` e inserta en `shipment_events`, o sea el que mueve el
 * estado del envio. Se aplica el mismo criterio que el PATCH de al lado.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/db/server";
import { getUser, getUserTenantId } from "@/lib/auth/session";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import { isValidStatusForService } from "@/lib/studio/shipment-state-machine";
import type { ShipmentService, ShipmentStatus } from "@/lib/studio/shipment-types";

type EventCreatePayload = {
  status: ShipmentStatus;
  note?: string | null;
  occurred_at?: string; // ISO date string, default now()
};

const ALL_STATUSES: ShipmentStatus[] = [
  "draft",
  "in_warehouse",
  "consolidating",
  "shipped",
  "in_transit",
  "in_customs",
  "arrived_destination",
  "delayed_warehouse",
  "out_for_delivery",
  "last_mile",
  "delivered",
  "exception",
  "cancelled",
];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let payload: EventCreatePayload;
  try {
    payload = (await request.json()) as EventCreatePayload;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  if (!payload.status || !ALL_STATUSES.includes(payload.status)) {
    return NextResponse.json({ error: "Estado inválido." }, { status: 400 });
  }

  const supabase = await createClient();

  // Gate de modulo ANTES de leer el dominio: quien no puede editar "tracking"
  // recibe la denegacion y NO el envio.
  const denial = await moduleEditDenial(supabase, "tracking");
  if (denial) return NextResponse.json({ error: denial }, { status: 403 });

  const tenantId = await getUserTenantId();
  if (!tenantId) {
    return NextResponse.json({ error: "Sin tenant asignado." }, { status: 403 });
  }

  // 1. Leer el shipment para validar servicio + status actual
  const { data: shipment, error: readError } = await supabase
    .from("shipments")
    .select("id, shipment_service, status")
    .eq("id", id)
    .maybeSingle();

  if (readError) {
    return NextResponse.json(
      { error: "No pudimos leer el envío.", detail: readError.message },
      { status: 500 },
    );
  }
  if (!shipment) {
    return NextResponse.json({ error: "Envío no encontrado." }, { status: 404 });
  }

  // 2. Validar transicion segun la state machine (UI hint, no enforcement DB)
  const service = shipment.shipment_service as ShipmentService;
  if (!isValidStatusForService(service, payload.status)) {
    return NextResponse.json(
      {
        error: `El estado "${payload.status}" no aplica al servicio "${service}".`,
      },
      { status: 400 },
    );
  }

  const previousStatus = shipment.status as ShipmentStatus;
  const user = await getUser();

  // 3. Actualizar status del shipment (si cambio)
  if (previousStatus !== payload.status) {
    const { error: updateError } = await supabase
      .from("shipments")
      .update({ status: payload.status })
      .eq("id", id);
    if (updateError) {
      return NextResponse.json(
        { error: "No pudimos actualizar el estado.", detail: updateError.message },
        { status: 500 },
      );
    }
  }

  // 4. Insertar event
  const { data: event, error: eventError } = await supabase
    .from("shipment_events")
    .insert({
      tenant_id: tenantId,
      shipment_id: id,
      status: payload.status,
      note: payload.note ?? null,
      occurred_at: payload.occurred_at ?? new Date().toISOString(),
      created_by: user?.id ?? null,
    })
    .select()
    .single();

  if (eventError) {
    // Revertir el status si fallo el event
    if (previousStatus !== payload.status) {
      await supabase
        .from("shipments")
        .update({ status: previousStatus })
        .eq("id", id);
    }
    return NextResponse.json(
      { error: "No pudimos registrar el evento.", detail: eventError.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ event }, { status: 201 });
}
