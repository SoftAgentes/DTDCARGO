"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { getPortalClient } from "@/lib/portal/portal-queries";
import {
  validateClientAddressInput,
  type ClientAddressFieldErrors,
} from "@/lib/studio/client-address-types";
import {
  insertClientDeliveryAddress,
  updateClientDeliveryAddress,
  clearDefaultForClient,
  setDefaultDeliveryAddress,
  softDeleteClientDeliveryAddress,
} from "@/lib/studio/client-address-queries";

/**
 * Server actions del cliente para SUS direcciones de entrega (SDD-0138 Slice B).
 * Corren con el client de SESIÓN: la RLS self-por-markbox (migr 0198) garantiza
 * que el cliente solo toque sus propias filas, y el trigger sella tenant/markbox
 * desde `clients` (no confía en el body). La identidad se resuelve por sesión.
 */
export type AddressActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: ClientAddressFieldErrors;
};

const PATH = "/portal/perfil";

/** Alta de una dirección del cliente logueado. */
export async function addAddressAction(
  _prev: AddressActionState,
  formData: FormData,
): Promise<AddressActionState> {
  const supabase = await createClient();
  const client = await getPortalClient(supabase);
  if (!client) return { error: "Sesión no válida. Vuelve a entrar." };

  const parsed = validateClientAddressInput(formData);
  if (!parsed.ok) return { fieldErrors: parsed.errors };

  try {
    if (parsed.value.isDefault) {
      await clearDefaultForClient(supabase, client.id);
    }
    await insertClientDeliveryAddress(supabase, client.id, parsed.value);
  } catch (err) {
    // El detalle NUNCA va al cliente (convención apiError), pero SÍ al log: el
    // hueco `city_slug` (0347) estuvo 34 días roto en silencio justamente porque
    // este catch era ciego — el cliente reintentaba y nadie veía por qué fallaba.
    console.error("[addAddressAction] insert dirección falló:", err);
    return { error: "No se pudo guardar la dirección. Intenta de nuevo." };
  }
  revalidatePath(PATH);
  return { ok: true };
}

/** Edita una dirección existente del cliente logueado. */
export async function updateAddressAction(
  _prev: AddressActionState,
  formData: FormData,
): Promise<AddressActionState> {
  const supabase = await createClient();
  const client = await getPortalClient(supabase);
  if (!client) return { error: "Sesión no válida. Vuelve a entrar." };

  const id = (formData.get("addressId") as string | null)?.trim();
  if (!id) return { error: "Falta la dirección a editar." };

  const parsed = validateClientAddressInput(formData);
  if (!parsed.ok) return { fieldErrors: parsed.errors };

  try {
    if (parsed.value.isDefault) {
      await clearDefaultForClient(supabase, client.id);
    }
    // RLS self-update: solo actualiza si la fila es del cliente (markbox).
    await updateClientDeliveryAddress(supabase, id, parsed.value);
  } catch (err) {
    console.error("[updateAddressAction] update dirección falló:", err);
    return { error: "No se pudo actualizar la dirección. Intenta de nuevo." };
  }
  revalidatePath(PATH);
  return { ok: true };
}

/** Marca una dirección como predeterminada. */
export async function setDefaultAddressAction(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const client = await getPortalClient(supabase);
  if (!client) return;
  const id = (formData.get("addressId") as string | null)?.trim();
  if (!id) return;
  try {
    await setDefaultDeliveryAddress(supabase, client.id, id);
    revalidatePath(PATH);
  } catch (err) {
    /* no rompemos la navegación por un fallo transitorio, pero lo dejamos escrito */
    console.error("[setDefaultAddressAction] falló:", err);
  }
}

/** Borra (soft) una dirección del cliente logueado. */
export async function deleteAddressAction(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const client = await getPortalClient(supabase);
  if (!client) return;
  const id = (formData.get("addressId") as string | null)?.trim();
  if (!id) return;
  try {
    // RLS self-update cubre el soft-delete (set deleted_at) solo en filas propias.
    await softDeleteClientDeliveryAddress(supabase, id);
    revalidatePath(PATH);
  } catch (err) {
    /* idem */
    console.error("[deleteAddressAction] falló:", err);
  }
}
