"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/db/server";
import { getPortalClientPrincipal } from "@/lib/portal/portal-queries";
import {
  validateClientAddressInput,
  type ClientAddressFieldErrors,
} from "@/lib/studio/client-address-types";
import {
  insertClientDeliveryAddress,
  updateClientDeliveryAddress,
  clearDefaultForClient,
  setDefaultDeliveryAddress,
} from "@/lib/studio/client-address-queries";

/**
 * Server actions del cliente para SUS direcciones de entrega (SDD-0138 Slice B).
 * Cliente de SESIÓN; RLS y triggers sellan identidad/tenant. El borrado usa
 * exclusivamente el comando estrecho 0427 porque SELECT oculta históricos.
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
  const principal = await getPortalClientPrincipal(supabase);
  if (!principal) return { error: "Sesión no válida. Vuelve a entrar." };
  const client = principal.client;
  const scope = { tenantId: principal.tenantId, markbox: client.markbox };

  const parsed = validateClientAddressInput(formData);
  if (!parsed.ok) return { fieldErrors: parsed.errors };

  try {
    if (parsed.value.isDefault) {
      await clearDefaultForClient(supabase, client.id, scope);
    }
    await insertClientDeliveryAddress(supabase, client.id, parsed.value, scope);
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
  const principal = await getPortalClientPrincipal(supabase);
  if (!principal) return { error: "Sesión no válida. Vuelve a entrar." };
  const client = principal.client;
  const scope = { tenantId: principal.tenantId, markbox: client.markbox };

  const id = (formData.get("addressId") as string | null)?.trim();
  if (!id) return { error: "Falta la dirección a editar." };

  const parsed = validateClientAddressInput(formData);
  if (!parsed.ok) return { fieldErrors: parsed.errors };

  try {
    if (parsed.value.isDefault) {
      await clearDefaultForClient(supabase, client.id, scope);
    }
    // RLS self-update: solo actualiza si la fila es del cliente (markbox).
    await updateClientDeliveryAddress(supabase, id, parsed.value, {
      ...scope,
      clientId: client.id,
    });
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
  const principal = await getPortalClientPrincipal(supabase);
  if (!principal) return;
  const client = principal.client;
  const id = (formData.get("addressId") as string | null)?.trim();
  if (!id) return;
  try {
    await setDefaultDeliveryAddress(supabase, client.id, id, {
      tenantId: principal.tenantId,
      markbox: client.markbox,
    });
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
    const { data, error } = await supabase.rpc("delete_portal_delivery_address", {
      p_address_id: id,
      p_correlation_id: correlationId,
    });
    if (error || data !== true) {
      console.error("[deleteAddressAction] borrado no confirmado", { correlationId });
      return failure;
    }
  } catch {
    // Sin cuerpo del proveedor, UUID de dirección ni contenido postal en logs.
    console.error("[deleteAddressAction] fallo de transporte/sesión", { correlationId });
    return failure;
  }
  try {
    revalidatePath(PATH);
  } catch {
    // La RPC ya confirmó el commit: una caché fallida no revierte ese hecho.
    console.error("[deleteAddressAction] caché pendiente tras borrado confirmado", { correlationId });
  }
  return { ok: true };
}
