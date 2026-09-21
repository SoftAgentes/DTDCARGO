/**
 * Server actions de transportistas terrestres y su tarifario (SDD-0236).
 *
 * Van en archivo propio y no dentro de `calculator-actions.ts` —que es lo que
 * decía el plan— porque son dominios distintos: aquel configura el calculador
 * público (parámetros y ciudades), este administra un registro de proveedores
 * con su tarifario. Comparten la sección del Admin, no el dominio.
 *
 * Gate: `admin`. La RLS de freight_carriers / carrier_tariffs lo refuerza en la
 * DB — acá se corta antes para dar un mensaje decente en vez de un error de
 * permisos crudo.
 *
 * Validación con validate*Input() — sin zod, patrón del proyecto.
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import {
  validateCarrierInput,
  validateTariffInput,
  type CarrierFieldKey,
  type TariffFieldKey,
} from "@/lib/studio/freight-carriers/types";
import { setDefaultCarrier } from "@/lib/studio/freight-carriers/queries";
import { tenantAdminGate } from "@/lib/studio/rbac-guard";

export type CarrierActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<CarrierFieldKey, string>>;
};

export type TariffActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<TariffFieldKey, string>>;
};

type SupabaseLike = Awaited<ReturnType<typeof createClient>>;

const ADMIN_MSG = "Solo un administrador puede editar los transportistas.";

/**
 * Resuelve tenant + rol con el guard central (SDD-0498).
 *
 * Antes leía `user_tenants` acá mismo: filtraba por `user_id` pero NO por
 * `disabled_at`, así que un admin suspendido pasaba este candado y podía
 * editar transportistas y tarifas de flete — el tarifario que cotiza la web
 * pública. La RLS de 0330 sí mira `disabled_at` y cortaba en la DB, pero un
 * gate de aplicación que aprueba a quien la DB rechaza no es defensa en
 * profundidad: es un candado que miente.
 *
 * Gate admin-only y no `moduleEditGate("admin")` porque la regla no es la fila
 * del módulo Admin en la matriz, es «esto lo toca un administrador».
 */
async function resolveTenantAdmin(
  supabase: SupabaseLike,
): Promise<{ ok: true; tenantId: string } | { ok: false; error: string }> {
  const gate = await tenantAdminGate(supabase, { denied: ADMIN_MSG });
  if (!gate.ok) return { ok: false, error: gate.denied };
  return { ok: true, tenantId: gate.tenantId };
}

/** El tarifario cambia lo que cotiza la web: hay que refrescar las dos caras. */
function revalidarTodo() {
  revalidatePath("/studio/admin");
  revalidatePath("/tarifas");
}

// ─────────────────────────────────────────────────────────────
// Transportistas
// ─────────────────────────────────────────────────────────────

export async function saveCarrierAction(
  _prev: CarrierActionState,
  formData: FormData,
): Promise<CarrierActionState> {
  const supabase = await createClient();
  const who = await resolveTenantAdmin(supabase);
  if (!who.ok) return { error: who.error };

  const parsed = validateCarrierInput(formData);
  if (!parsed.ok) return { fieldErrors: parsed.errors };
  const v = parsed.value;

  const id = String(formData.get("id") ?? "").trim();
  const fila = {
    tenant_id: who.tenantId,
    name: v.name,
    legal_name: v.legalName,
    tax_id: v.taxId,
    contact: v.contact,
    notes: v.notes,
    active: v.active,
  };

  // `is_default` NO se escribe acá: tiene su propia action, porque marcar uno
  // implica bajar al anterior y el índice único rechaza el cruce.
  const { data, error } = id
    ? await supabase.from("freight_carriers").update(fila).eq("id", id).select("id").maybeSingle()
    : await supabase.from("freight_carriers").insert(fila).select("id").maybeSingle();

  if (error) return { error: `No se pudo guardar el transportista: ${error.message}` };

  // Si lo pidieron como predeterminado, se hace en el segundo paso.
  if (v.isDefault) {
    const objetivo = id || (data as { id?: string } | null)?.id;
    if (objetivo) {
      try {
        await setDefaultCarrier(supabase, objetivo);
      } catch (e) {
        return { error: e instanceof Error ? e.message : "No se pudo marcar el predeterminado." };
      }
    }
  }

  revalidarTodo();
  return { ok: true };
}

export async function setDefaultCarrierAction(
  _prev: CarrierActionState,
  formData: FormData,
): Promise<CarrierActionState> {
  const supabase = await createClient();
  const who = await resolveTenantAdmin(supabase);
  if (!who.ok) return { error: who.error };

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Falta el transportista." };

  try {
    await setDefaultCarrier(supabase, id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo marcar el predeterminado." };
  }

  revalidarTodo();
  return { ok: true };
}

/**
 * Borrado en blando. No se borra de verdad porque las tarifas cuelgan de él y
 * porque el histórico de con quién se despachó importa para contabilidad.
 */
export async function deleteCarrierAction(
  _prev: CarrierActionState,
  formData: FormData,
): Promise<CarrierActionState> {
  const supabase = await createClient();
  const who = await resolveTenantAdmin(supabase);
  if (!who.ok) return { error: who.error };

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Falta el transportista." };

  const { error } = await supabase
    .from("freight_carriers")
    .update({ deleted_at: new Date().toISOString(), is_default: false })
    .eq("id", id);

  if (error) return { error: `No se pudo eliminar: ${error.message}` };

  revalidarTodo();
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Tarifas
// ─────────────────────────────────────────────────────────────

export async function saveTariffAction(
  _prev: TariffActionState,
  formData: FormData,
): Promise<TariffActionState> {
  const supabase = await createClient();
  const who = await resolveTenantAdmin(supabase);
  if (!who.ok) return { error: who.error };

  const parsed = validateTariffInput(formData);
  if (!parsed.ok) return { fieldErrors: parsed.errors };
  const v = parsed.value;
  if (!v.carrierId) return { error: "Falta el transportista." };

  const id = String(formData.get("id") ?? "").trim();
  const fila = {
    tenant_id: who.tenantId,
    carrier_id: v.carrierId,
    city_slug: v.citySlug,
    cost_usd_cbm: v.costUsdCbm,
    price_usd_cbm: v.priceUsdCbm,
    price_usd_ft3: v.priceUsdFt3,
    min_charge_usd: v.minChargeUsd,
    dispatch_frequency_days: v.dispatchFrequencyDays,
    departure_frequency: v.departureFrequency,
    transit_days: v.transitDays,
    conditions: v.conditions,
    valid_from: v.validFrom,
    valid_to: v.validTo,
  };

  const { error } = id
    ? await supabase.from("carrier_tariffs").update(fila).eq("id", id)
    : await supabase.from("carrier_tariffs").insert(fila);

  if (error) {
    // El índice único parcial: ya hay una tarifa viva para esa ciudad.
    if (error.code === "23505") {
      return {
        fieldErrors: {
          citySlug: "Ya hay una tarifa viva para esa ciudad con este transportista. Edítala en vez de crear otra.",
        },
      };
    }
    return { error: `No se pudo guardar la tarifa: ${error.message}` };
  }

  revalidarTodo();
  return { ok: true };
}

export async function deleteTariffAction(
  _prev: TariffActionState,
  formData: FormData,
): Promise<TariffActionState> {
  const supabase = await createClient();
  const who = await resolveTenantAdmin(supabase);
  if (!who.ok) return { error: who.error };

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Falta la tarifa." };

  const { error } = await supabase
    .from("carrier_tariffs")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: `No se pudo eliminar la tarifa: ${error.message}` };

  revalidarTodo();
  return { ok: true };
}
