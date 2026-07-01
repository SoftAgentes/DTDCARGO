"use server";

/**
 * Feriados & ferias (SDD-0127) — server actions (admin only).
 * CRUD sobre operational_calendar. Soft-delete.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { moduleEditDenial } from "@/lib/studio/rbac-guard";
import {
  validateCalendarEventInput,
  type CalendarActionState,
} from "@/lib/studio/op-calendar-types";

async function resolveTenantId(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const { data } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .limit(1)
    .maybeSingle<{ tenant_id: string }>();
  return data?.tenant_id ?? null;
}

export async function saveCalendarEventAction(
  _prev: CalendarActionState,
  formData: FormData,
): Promise<CalendarActionState> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "admin");
  if (denial) return { error: denial };

  const { input, fieldErrors } = validateCalendarEventInput(formData);
  if (fieldErrors) return { fieldErrors };

  const tenantId = await resolveTenantId(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant." };

  const { data: userResp } = await supabase.auth.getUser();
  const id = typeof formData.get("id") === "string" ? (formData.get("id") as string) : "";

  const values = {
    country: input!.country,
    kind: input!.kind,
    name: input!.name,
    start_date: input!.startDate,
    end_date: input!.endDate,
    note: input!.note || null,
  };

  if (id) {
    const { error } = await supabase
      .from("operational_calendar")
      .update(values)
      .eq("id", id)
      .eq("tenant_id", tenantId);
    if (error) return { error: `No se pudo guardar el evento: ${error.message}` };
  } else {
    const { error } = await supabase
      .from("operational_calendar")
      .insert({ tenant_id: tenantId, created_by: userResp.user?.id ?? null, ...values });
    if (error) return { error: `No se pudo crear el evento: ${error.message}` };
  }

  revalidatePath("/studio/admin");
  return { ok: true };
}

export async function deleteCalendarEventAction(
  _prev: CalendarActionState,
  formData: FormData,
): Promise<CalendarActionState> {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "admin");
  if (denial) return { error: denial };

  const id = typeof formData.get("id") === "string" ? (formData.get("id") as string) : "";
  if (!id) return { error: "Falta el id del evento." };

  const tenantId = await resolveTenantId(supabase);
  if (!tenantId) return { error: "No se pudo resolver el tenant." };

  const { error } = await supabase
    .from("operational_calendar")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", tenantId);
  if (error) return { error: `No se pudo eliminar el evento: ${error.message}` };

  revalidatePath("/studio/admin");
  return { ok: true };
}
