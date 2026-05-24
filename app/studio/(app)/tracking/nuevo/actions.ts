/**
 * Server action de creacion de envio.
 *
 * Valida campos (code obligatorio, service obligatorio, vehicle_category
 * obligatorio si service=transporte_terrestre), inserta via Supabase,
 * y redirige a /studio/tracking con el envio en la lista.
 *
 * RLS: tenant_id se deriva del JWT en el route handler. Aca el insert directo
 * por el cliente Supabase tambien respeta RLS — pero seteamos tenant_id explicito
 * via getUserTenantId() para que el insert no falle por NOT NULL constraint.
 */

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { getUserTenantId } from "@/lib/auth/session";
import type { ShipmentService, ShipmentStatus } from "@/lib/studio/shipment-types";
import { getDefaultInitialStatus } from "@/lib/studio/shipment-state-machine";

const VALID_SERVICES: ShipmentService[] = [
  "consolidacion",
  "puerta_a_puerta_DDP",
  "reserva_FCL",
  "transporte_terrestre",
];

export type CreateShipmentState = {
  error?: string;
  fieldErrors?: Partial<Record<string, string>>;
};

function parseNumber(value: FormDataEntryValue | null): number | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function parseString(value: FormDataEntryValue | null): string | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

export async function createShipment(
  _prevState: CreateShipmentState,
  formData: FormData,
): Promise<CreateShipmentState> {
  const code = parseString(formData.get("code"));
  const shipment_service = String(formData.get("shipment_service") ?? "") as ShipmentService;
  const client_name = parseString(formData.get("client_name"));
  const client_markbox = parseString(formData.get("client_markbox"));
  const origin = parseString(formData.get("origin"));
  const destination = parseString(formData.get("destination"));
  const weight_kg = parseNumber(formData.get("weight_kg"));
  const volume_m3 = parseNumber(formData.get("volume_m3"));
  const vehicle_category = parseString(formData.get("vehicle_category"));
  const vehicle_model = parseString(formData.get("vehicle_model"));
  const destination_gps = parseString(formData.get("destination_gps"));
  const notes = parseString(formData.get("notes"));

  // Validaciones
  const fieldErrors: Record<string, string> = {};
  if (!code) fieldErrors.code = "Obligatorio.";
  if (!VALID_SERVICES.includes(shipment_service))
    fieldErrors.shipment_service = "Elegí un servicio.";
  if (shipment_service === "transporte_terrestre" && !vehicle_category)
    fieldErrors.vehicle_category = "Para transporte terrestre es obligatorio.";

  if (Object.keys(fieldErrors).length > 0) {
    return { error: "Revisá los campos marcados.", fieldErrors };
  }

  const tenantId = await getUserTenantId();
  if (!tenantId) {
    return { error: "Tu sesión no tiene tenant asignado. Contactá a Sam." };
  }

  const initialStatus: ShipmentStatus = getDefaultInitialStatus(shipment_service);

  const supabase = await createClient();
  const { error } = await supabase.from("shipments").insert({
    tenant_id: tenantId,
    code: code!,
    shipment_service,
    status: initialStatus,
    client_name,
    client_markbox,
    origin,
    destination,
    weight_kg,
    volume_m3,
    vehicle_category,
    vehicle_model,
    destination_gps,
    notes,
  });

  if (error) {
    if (error.code === "23505") {
      return {
        error: `Ya existe un envío con el código "${code}".`,
        fieldErrors: { code: "Código repetido." },
      };
    }
    return { error: "No pudimos crear el envío. Intentá de nuevo." };
  }

  revalidatePath("/studio/tracking");
  revalidatePath("/studio/resumen");
  redirect("/studio/tracking");
}
