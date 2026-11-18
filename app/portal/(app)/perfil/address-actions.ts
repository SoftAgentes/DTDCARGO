"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/db/server";
import { getPortalClient, getPortalClientPrincipal } from "@/lib/portal/portal-queries";
import {
  validateClientAddressInput,
  type ClientAddressFieldErrors,
} from "@/lib/studio/client-address-types";
import {
  insertClientDeliveryAddress,
  isSameDeliveryAddress,
  listClientDeliveryAddresses,
  updateClientDeliveryAddress,
  clearDefaultForClient,
  setDefaultDeliveryAddress,
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
  correlationId?: string;
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
    // Un reintento, o la misma dirección otra vez, no crea una fila más (SDD-0599).
    const vigentes = await listClientDeliveryAddresses(supabase, client.id);
    const igual = vigentes.find((address) => isSameDeliveryAddress(address, parsed.value));
    if (igual) {
      if (parsed.value.isDefault && !igual.isDefault) {
        await setDefaultDeliveryAddress(supabase, client.id, igual.id);
      }
    } else {
      if (parsed.value.isDefault) {
        await clearDefaultForClient(supabase, client.id);
      }
      await insertClientDeliveryAddress(supabase, client.id, parsed.value);
    }
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

/** SDD-0377: sólo confirma tras borrado propio + auditoría en una transacción. */
export async function deleteAddressAction(
  _prev: AddressActionState,
  formData: FormData,
): Promise<AddressActionState> {
  const values = formData.getAll("addressId");
  const id = typeof values[0] === "string" ? values[0].trim() : "";
  if (values.length !== 1 || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return { error: "No se pudo identificar la dirección. Recarga la página e intenta de nuevo." };
  }
  const correlationId = randomUUID();
  const failure: AddressActionState = {
    error: "No se pudo confirmar el borrado. Intenta de nuevo; si continúa, contacta a tu asesor.",
    correlationId,
  };
  try {
    const supabase = await createClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    const principal = await getPortalClientPrincipal(supabase);
    // El helper exige vínculo activo y cliente/tenant coherentes. El caller
    // además compara el actor; la RPC revalida propiedad exacta bajo locks.
    if (authError || !auth.user?.id || !principal || principal.userId !== auth.user.id) {
      console.error("[deleteAddressAction] falló:", { correlationId, stage: "principal" });
      return failure;
    }
    const { data, error } = await supabase.rpc("delete_portal_delivery_address", {
      p_address_id: id,
      p_correlation_id: correlationId,
    });
    if (error || data !== true) {
      console.error("[deleteAddressAction] falló:", { correlationId, stage: "write", status: "not_confirmed" });
      return failure;
    }
  } catch {
    // Conserva console.error sin cuerpo del proveedor, UUID de dirección ni PII.
    console.error("[deleteAddressAction] falló:", { correlationId, stage: "transport" });
    return failure;
  }
  try {
    revalidatePath(PATH);
  } catch {
    // La RPC ya confirmó el commit: una caché fallida no revierte ese hecho.
    console.error("[deleteAddressAction] falló:", { correlationId, stage: "cache", status: "committed" });
  }
  return { ok: true };
}
