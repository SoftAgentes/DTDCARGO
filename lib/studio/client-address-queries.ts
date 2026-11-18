/**
 * Queries de direcciones de entrega del cliente (SDD-0138 Slice B · tabla
 * `client_delivery_addresses`, migr 0198). Funciones puras que reciben un
 * `SupabaseClient` — las usan las dos superficies:
 *   · Portal  → con el admin client, scopeado por el `clientId` resuelto por sesión.
 *   · Studio  → con el client de sesión del asesor (RLS por tenant).
 *
 * El trigger de la migración sella `tenant_id` + `client_markbox` desde `clients`,
 * así que en el INSERT solo mandamos `client_id` + los campos del usuario.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ClientDeliveryAddress,
  ClientDeliveryAddressInput,
} from "./client-address-types";

const TABLE = "client_delivery_addresses";

type Row = {
  id: string;
  client_id: string;
  label: string | null;
  line: string;
  city: string | null;
  city_slug: string | null;
  state: string | null;
  reference: string | null;
  is_default: boolean;
};

function mapRow(r: Row): ClientDeliveryAddress {
  return {
    id: r.id,
    clientId: r.client_id,
    label: r.label,
    line: r.line,
    city: r.city,
    citySlug: r.city_slug,
    state: r.state,
    reference: r.reference,
    isDefault: r.is_default,
  };
}

/** Direcciones vivas de un cliente, predeterminada primero, luego por antigüedad. */
export async function listClientDeliveryAddresses(
  supabase: SupabaseClient,
  clientId: string,
): Promise<ClientDeliveryAddress[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("id, client_id, label, line, city, city_slug, state, reference, is_default")
    .eq("client_id", clientId)
    .is("deleted_at", null)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapRow(r as Row));
}

/** La misma dirección, sin mirar si es la predeterminada: agregarla otra vez sería un duplicado (SDD-0599). */
export function isSameDeliveryAddress(
  address: ClientDeliveryAddress,
  input: ClientDeliveryAddressInput,
): boolean {
  return (
    address.label === input.label &&
    address.line === input.line &&
    address.city === input.city &&
    address.citySlug === input.citySlug &&
    address.state === input.state &&
    address.reference === input.reference
  );
}

/** Quita la marca de predeterminada a TODAS las direcciones vivas del cliente. */
export async function clearDefaultForClient(
  supabase: SupabaseClient,
  clientId: string,
): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .update({ is_default: false })
    .eq("client_id", clientId)
    .is("deleted_at", null)
    .eq("is_default", true);
  if (error) throw new Error(error.message);
}

/**
 * Inserta una dirección. `tenant_id`/`client_markbox` los sella el trigger desde
 * `clients` (no se mandan). Si `input.isDefault`, el caller debe llamar antes a
 * `clearDefaultForClient` (el índice único parcial exige una sola predeterminada).
 */
export async function insertClientDeliveryAddress(
  supabase: SupabaseClient,
  clientId: string,
  input: ClientDeliveryAddressInput,
): Promise<ClientDeliveryAddress> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      client_id: clientId,
      label: input.label,
      line: input.line,
      city: input.city,
      city_slug: input.citySlug,
      state: input.state,
      reference: input.reference,
      is_default: input.isDefault,
    })
    .select("id, client_id, label, line, city, city_slug, state, reference, is_default")
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data as Row);
}

/**
 * Actualiza los campos de una dirección. Si `input.isDefault`, el caller debe
 * llamar antes a `clearDefaultForClient` (índice único parcial).
 */
export async function updateClientDeliveryAddress(
  supabase: SupabaseClient,
  id: string,
  input: ClientDeliveryAddressInput,
): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .update({
      label: input.label,
      line: input.line,
      city: input.city,
      city_slug: input.citySlug,
      state: input.state,
      reference: input.reference,
      is_default: input.isDefault,
    })
    .eq("id", id)
    .is("deleted_at", null);
  if (error) throw new Error(error.message);
}

/** Marca una dirección como predeterminada (limpia las otras primero). */
export async function setDefaultDeliveryAddress(
  supabase: SupabaseClient,
  clientId: string,
  id: string,
): Promise<void> {
  await clearDefaultForClient(supabase, clientId);
  const { error } = await supabase
    .from(TABLE)
    .update({ is_default: true })
    .eq("id", id)
    .eq("client_id", clientId)
    .is("deleted_at", null);
  if (error) throw new Error(error.message);
}

/** Borra (soft) una dirección. */
export async function softDeleteClientDeliveryAddress(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
