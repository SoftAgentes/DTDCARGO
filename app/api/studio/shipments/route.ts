/**
 * Route handler de envíos del Studio.
 *
 * GET  /api/studio/shipments  — lista envios del tenant del usuario (100 mas recientes)
 * POST /api/studio/shipments  — crea envio nuevo
 *
 * Auth: requiere sesion Supabase valida. RLS filtra por tenant automaticamente.
 * tenant_id NO se acepta como param (se deriva del JWT) — seguridad.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/db/server";
import { apiError } from "@/lib/http/api-error";
import { requireStudioSession } from "@/lib/http/studio-session";
import { getUserTenantId } from "@/lib/auth/session";
import {
  isShipmentService,
  type ShipmentService,
  type ShipmentStatus,
} from "@/lib/studio/shipment-types";

type ShipmentCreatePayload = {
  code: string;
  shipment_service: ShipmentService;
  status?: ShipmentStatus;
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

export async function GET() {
  // Sin este guard, RLS devolvía cero filas a un anónimo y la ruta respondía
  // `{shipments: []}` con 200: una API que miente sobre lo que hizo.
  const sesion = await requireStudioSession();
  if (sesion instanceof NextResponse) return sesion;
  const { supabase } = sesion;

  const { data, error } = await supabase
    .from("shipments")
    .select(
      "id, code, client_name, client_markbox, origin, destination, shipment_service, status, weight_kg, volume_m3, vehicle_category, vehicle_model, created_at, updated_at",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return apiError("No pudimos leer los envíos.", error, 500, "shipments:list");
  }

  return NextResponse.json({ shipments: data ?? [] });
}

export async function POST(request: NextRequest) {
  let payload: ShipmentCreatePayload;
  try {
    payload = (await request.json()) as ShipmentCreatePayload;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  // Validaciones basicas
  if (!payload.code || payload.code.trim().length === 0) {
    return NextResponse.json({ error: "El código del envío es obligatorio." }, { status: 400 });
  }
  if (!isShipmentService(payload.shipment_service)) {
    return NextResponse.json({ error: "Servicio inválido." }, { status: 400 });
  }
  if (
    payload.shipment_service === "transporte_terrestre" &&
    (!payload.vehicle_category || payload.vehicle_category.trim().length === 0)
  ) {
    return NextResponse.json(
      { error: "Para transporte terrestre, el tipo de vehículo es obligatorio." },
      { status: 400 },
    );
  }

  // tenant_id del JWT (no del payload, por seguridad)
  const tenantId = await getUserTenantId();
  if (!tenantId) {
    return NextResponse.json({ error: "Sin tenant asignado." }, { status: 403 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shipments")
    .insert({
      tenant_id: tenantId,
      code: payload.code.trim(),
      shipment_service: payload.shipment_service,
      status: payload.status ?? "draft",
      client_name: payload.client_name ?? null,
      client_markbox: payload.client_markbox ?? null,
      origin: payload.origin ?? null,
      destination: payload.destination ?? null,
      weight_kg: payload.weight_kg ?? null,
      volume_m3: payload.volume_m3 ?? null,
      vehicle_category: payload.vehicle_category ?? null,
      vehicle_model: payload.vehicle_model ?? null,
      notes: payload.notes ?? null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: `Ya existe un envío con el código "${payload.code}".` },
        { status: 409 },
      );
    }
    return apiError("No pudimos crear el envío.", error, 500, "shipments:create");
  }

  return NextResponse.json({ shipment: data }, { status: 201 });
}
