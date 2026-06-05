"use server";

/**
 * Acciones del módulo Kommo (SDD-0058). Por ahora solo el puente lead → cliente.
 * Resuelve el tenant del usuario logueado y delega en la lógica pura
 * `convertLead` (lib/studio/kommo-convert), luego revalida la pantalla.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { convertLead, type ConvertLeadResult } from "@/lib/studio/kommo-convert";

export async function convertLeadToClientAction(
  leadId: number,
): Promise<ConvertLeadResult> {
  const supabase = await createClient();

  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  if (!link?.tenant_id) return { error: "No se pudo resolver el tenant." };

  const res = await convertLead(supabase, link.tenant_id, leadId);
  if (res.ok) revalidatePath("/studio/kommo");
  return res;
}
