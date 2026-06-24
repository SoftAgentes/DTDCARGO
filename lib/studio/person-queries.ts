/**
 * Queries del dominio Persona (SDD-0106). Funciones puras que reciben el
 * SupabaseClient; RLS filtra por tenant. Fundación para la unificación de
 * servicios (carga + academia) por cédula en Fase 2.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Person } from "./person-types";

const PERSON_COLUMNS =
  "id, tenant_id, national_id, doc_kind, name, email, phone, legacy_client_id, created_at, updated_at, deleted_at";

/** Persona por id. RLS valida ownership. `null` si no existe. */
export async function getPersonById(
  supabase: SupabaseClient,
  id: string,
): Promise<Person | null> {
  const { data, error } = await supabase
    .from("persons")
    .select(PERSON_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return (data as Person | null) ?? null;
}

/**
 * Lista personas del tenant (hasta `limit`, recientes primero). RLS por tenant.
 * El lookup por cédula del lado de carga vive en `getClientByCedula()` (RPC);
 * el de persona (para academia) llega en Fase 2.
 */
export async function listPersons(
  supabase: SupabaseClient,
  limit = 200,
): Promise<Person[]> {
  const { data, error } = await supabase
    .from("persons")
    .select(PERSON_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data as Person[] | null) ?? [];
}
