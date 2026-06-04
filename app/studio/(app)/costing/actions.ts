/**
 * Server actions del módulo Costing & Margen (SDD-0053 · Slice B).
 *
 * `saveShipmentCosts` — guarda (upsert) los 7 costos USD de un embarque en
 * `shipment_costs` (1 fila × embarque vía unique (tenant_id, shipment_id)).
 *
 * Patrón del repo: "use server" + parsing manual de FormData + validateCostInput
 * (Slice A, sin Zod) + revalidatePath. RLS filtra por tenant; el trigger en DB
 * (migración 0100) rechaza un shipment_id de otro tenant. tenant_id se resuelve
 * desde user_tenants para el insert (igual que createRate en Tarifas).
 *
 * Costos en USD canónico; el toggle VES de la UI es solo display, NO se persiste.
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import {
  COST_CATEGORY_KEYS,
  validateCostInput,
  type CostActionState,
} from "@/lib/studio/costing/types";

/** Arma el objeto crudo de costos desde el FormData (los 7 montos + meta). */
function rawFromFormData(formData: FormData): Record<string, unknown> {
  const raw: Record<string, unknown> = {
    shipment_id: formData.get("shipment_id"),
    notes: formData.get("notes"),
  };
  for (const k of COST_CATEGORY_KEYS) {
    const v = formData.get(k);
    // "" / null → 0 (campo vacío = sin costo en esa categoría).
    raw[k] = v == null || String(v).trim() === "" ? 0 : v;
  }
  return raw;
}

export async function saveShipmentCosts(
  _prev: CostActionState,
  formData: FormData,
): Promise<CostActionState> {
  const supabase = await createClient();

  const { input, fieldErrors } = validateCostInput(rawFromFormData(formData));
  if (fieldErrors) return { fieldErrors };

  // tenant_id para el insert (RLS no lo inyecta en el body). Mismo patrón que
  // createRate: select del propio user_tenants.
  const { data: link, error: linkErr } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  if (linkErr || !link?.tenant_id) {
    return { error: "No se pudo resolver el tenant del usuario." };
  }

  const { error } = await supabase
    .from("shipment_costs")
    .upsert(
      {
        tenant_id: link.tenant_id,
        shipment_id: input!.shipment_id,
        freight: input!.freight,
        customs: input!.customs,
        transport: input!.transport,
        handling: input!.handling,
        insurance: input!.insurance,
        commission: input!.commission,
        other: input!.other,
        notes: input!.notes,
        deleted_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id,shipment_id" },
    );

  if (error) {
    return { error: `No se pudieron guardar los costos: ${error.message}` };
  }

  revalidatePath("/studio/costing");
  return { ok: true };
}
