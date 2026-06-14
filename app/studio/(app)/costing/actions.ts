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
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import {
  COST_CATEGORY_KEYS,
  validateCostInput,
  validateTemplateInput,
  type CostActionState,
  type TemplateActionState,
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
  const denial = await moduleEditDenial(supabase, "costing");
  if (denial) return { error: denial };

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

// ── Templates por ruta (Slice C) ──────────────────────────────
/**
 * Arma el objeto crudo de un template desde el FormData (los 7 montos + meta).
 * Campo de monto vacío → 0 (sin costo en esa categoría).
 */
function templateRawFromFormData(formData: FormData): Record<string, unknown> {
  const raw: Record<string, unknown> = {
    name: formData.get("name"),
    origin: formData.get("origin"),
    destination: formData.get("destination"),
    shipment_service: formData.get("shipment_service"),
    active: formData.get("active") === "off" ? false : true,
    notes: formData.get("notes"),
  };
  for (const k of COST_CATEGORY_KEYS) {
    const v = formData.get(k);
    raw[k] = v == null || String(v).trim() === "" ? 0 : v;
  }
  return raw;
}

/** Resuelve el tenant del usuario (mismo patrón que saveShipmentCosts). */
async function resolveTenantId(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<{ tenantId?: string; error?: string }> {
  const { data: link, error } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  if (error || !link?.tenant_id) {
    return { error: "No se pudo resolver el tenant del usuario." };
  }
  return { tenantId: link.tenant_id };
}

/** Mensaje cuando ya existe un template para la misma ruta+servicio vivo. */
const TEMPLATE_CONFLICT_MSG =
  "Ya hay un template para esa combinación de ruta y servicio. Edita ese o bórralo primero.";

/** ¿El error es la violación del índice único parcial de ruta del template? */
function isTemplateConflict(error: {
  code?: string;
  message?: string;
} | null): boolean {
  if (!error) return false;
  return (
    error.code === "23505" &&
    (error.message ?? "").includes("route_cost_templates_route_uniq")
  );
}

export async function createTemplate(
  _prev: TemplateActionState,
  formData: FormData,
): Promise<TemplateActionState> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "costing");
  if (denial) return { error: denial };

  const { input, fieldErrors } = validateTemplateInput(
    templateRawFromFormData(formData),
  );
  if (fieldErrors) return { fieldErrors };

  const { tenantId, error: tenantErr } = await resolveTenantId(supabase);
  if (tenantErr || !tenantId) return { error: tenantErr };

  const { error } = await supabase.from("route_cost_templates").insert({
    tenant_id: tenantId,
    name: input!.name,
    origin: input!.origin,
    destination: input!.destination,
    shipment_service: input!.shipment_service,
    freight: input!.freight,
    customs: input!.customs,
    transport: input!.transport,
    handling: input!.handling,
    insurance: input!.insurance,
    commission: input!.commission,
    other: input!.other,
    active: input!.active,
    notes: input!.notes,
  });

  if (error) {
    if (isTemplateConflict(error)) return { error: TEMPLATE_CONFLICT_MSG };
    return { error: `No se pudo crear el template: ${error.message}` };
  }

  revalidatePath("/studio/costing");
  return { ok: true };
}

export async function updateTemplate(
  id: string,
  _prev: TemplateActionState,
  formData: FormData,
): Promise<TemplateActionState> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "costing");
  if (denial) return { error: denial };

  const { input, fieldErrors } = validateTemplateInput(
    templateRawFromFormData(formData),
  );
  if (fieldErrors) return { fieldErrors };

  const { error } = await supabase
    .from("route_cost_templates")
    .update({
      name: input!.name,
      origin: input!.origin,
      destination: input!.destination,
      shipment_service: input!.shipment_service,
      freight: input!.freight,
      customs: input!.customs,
      transport: input!.transport,
      handling: input!.handling,
      insurance: input!.insurance,
      commission: input!.commission,
      other: input!.other,
      active: input!.active,
      notes: input!.notes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    if (isTemplateConflict(error)) return { error: TEMPLATE_CONFLICT_MSG };
    return { error: `No se pudo guardar el template: ${error.message}` };
  }

  revalidatePath("/studio/costing");
  return { ok: true };
}

export async function softDeleteTemplate(
  id: string,
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "costing");
  if (denial) return { error: denial };

  const { error } = await supabase
    .from("route_cost_templates")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return { error: `No se pudo eliminar el template: ${error.message}` };
  }

  revalidatePath("/studio/costing");
  return { ok: true };
}
