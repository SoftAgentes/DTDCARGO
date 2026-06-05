"use server";

/**
 * Acciones del módulo Kommo (SDD-0058). Puente lead → cliente:
 *  - convertLeadToClientAction: convierte (idempotente), con prefill opcional del
 *    contacto elegido (Slice B).
 *  - searchKommoContactsAction: busca contactos del espejo para el picker.
 * Resuelven el tenant del usuario logueado y delegan en la lógica pura
 * (lib/studio/kommo-convert); RLS scopea las lecturas por tenant.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import {
  convertLead,
  searchKommoContacts,
  type ContactPrefill,
  type ConvertLeadResult,
  type KommoContactPick,
} from "@/lib/studio/kommo-convert";

export async function convertLeadToClientAction(
  leadId: number,
  prefill?: ContactPrefill,
): Promise<ConvertLeadResult> {
  const supabase = await createClient();

  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .maybeSingle<{ tenant_id: string }>();
  if (!link?.tenant_id) return { error: "No se pudo resolver el tenant." };

  const res = await convertLead(supabase, link.tenant_id, leadId, prefill ?? {});
  if (res.ok) revalidatePath("/studio/kommo");
  return res;
}

export async function searchKommoContactsAction(
  q: string,
): Promise<KommoContactPick[]> {
  const supabase = await createClient();
  // RLS de kommo_contacts filtra por tenant → no hace falta resolverlo acá.
  return searchKommoContacts(supabase, q);
}
