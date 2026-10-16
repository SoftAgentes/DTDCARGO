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
  bytesFiltroIn,
  MAX_BYTES_FILTRO_LOTE,
  validateBulkPriceInput,
  validateCarrierInput,
  validateTariffInput,
  type BulkPriceFieldKey,
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

/** Una edición o un retiro que no tocó ninguna fila NO es un éxito (SDD-0539). */
const TRANSPORTISTA_NO_ENCONTRADO =
  "Ese transportista ya no está activo. Recarga la página y vuelve a intentarlo.";

/**
 * Alta o edición de un transportista (SDD-0236 · SDD-0539).
 *
 * La edición va acotada a tenant + vivo y con `.select("id")`. Antes hacía
 * `update().eq("id")` y respondía `ok` aunque la RLS o un borrado previo no
 * dejaran tocar ninguna fila. Tampoco reescribe `tenant_id`: editar no cambia
 * de tenant.
 */
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
  const campos = {
    name: v.name,
    legal_name: v.legalName,
    tax_id: v.taxId,
    contact: v.contact,
    notes: v.notes,
    active: v.active,
  };

  // `is_default` NO se escribe acá: tiene su propia action, porque marcar uno
  // implica bajar al anterior y el índice único rechaza el cruce.
  let objetivo = id;
  if (id) {
    const { data, error } = await supabase
      .from("freight_carriers")
      .update(campos)
      .eq("id", id)
      .eq("tenant_id", who.tenantId)
      .is("deleted_at", null)
      .select("id");
    if (error) return { error: `No se pudo guardar el transportista: ${error.message}` };
    if (!Array.isArray(data) || data.length === 0) return { error: TRANSPORTISTA_NO_ENCONTRADO };
  } else {
    const { data, error } = await supabase
      .from("freight_carriers")
      .insert({ tenant_id: who.tenantId, ...campos })
      .select("id")
      .maybeSingle();
    if (error) return { error: `No se pudo guardar el transportista: ${error.message}` };
    objetivo = (data as { id?: string } | null)?.id ?? "";
  }

  // Si lo pidieron como predeterminado, se hace en el segundo paso. Sin id no
  // hay a quién marcar: antes se saltaba el paso y respondía `ok` igual.
  if (v.isDefault) {
    if (!objetivo) {
      return {
        error:
          "El transportista se guardó, pero no se pudo marcar como el que cotiza la web. Recarga la página y márcalo desde su tarjeta.",
      };
    }
    try {
      await setDefaultCarrier(supabase, objetivo);
    } catch (e) {
      return { error: e instanceof Error ? e.message : "No se pudo marcar el predeterminado." };
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
 * Acotado a tenant + vivo y con `.select("id")`, como la edición (SDD-0539).
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

  const { data, error } = await supabase
    .from("freight_carriers")
    .update({ deleted_at: new Date().toISOString(), is_default: false })
    .eq("id", id)
    .eq("tenant_id", who.tenantId)
    .is("deleted_at", null)
    .select("id");

  if (error) return { error: `No se pudo eliminar: ${error.message}` };
  if (!Array.isArray(data) || data.length === 0) return { error: TRANSPORTISTA_NO_ENCONTRADO };

  revalidarTodo();
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Tarifas
// ─────────────────────────────────────────────────────────────

/** Una edición o un retiro que no tocó ninguna fila NO es un éxito (SDD-0537). */
const TARIFA_NO_ENCONTRADA =
  "Esa ruta ya no está activa con este transportista. Recarga la página y vuelve a intentarlo.";

/**
 * Alta o edición de la tarifa de UNA ciudad (SDD-0236 · SDD-0537).
 *
 * · Alta: la ciudad tiene que existir viva en `calculator_cities` del tenant.
 *   La UI sólo ofrece ciudades del catálogo, pero la acción lo vuelve a
 *   comprobar: `city_slug` no tiene FK dura (0330) y un slug inventado
 *   quedaría como una tarifa que la web nunca puede cotizar.
 * · Edición: cambia los números y las condiciones, NUNCA el transportista ni
 *   la ciudad — cambiar de ciudad es quitar una ruta y agregar otra. El UPDATE
 *   va acotado a tenant + transportista + viva y con `.select("id")`: sin eso,
 *   una fila filtrada por la RLS o quitada en otra pestaña devolvía `ok` sin
 *   haber guardado nada.
 */
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
  const numeros = {
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

  if (id) {
    const { data, error } = await supabase
      .from("carrier_tariffs")
      .update(numeros)
      .eq("id", id)
      .eq("tenant_id", who.tenantId)
      .eq("carrier_id", v.carrierId)
      .is("deleted_at", null)
      .select("id");
    if (error) return { error: `No se pudo guardar la tarifa: ${error.message}` };
    if (!Array.isArray(data) || data.length === 0) return { error: TARIFA_NO_ENCONTRADA };
    revalidarTodo();
    return { ok: true };
  }

  const { data: ciudad, error: ciudadError } = await supabase
    .from("calculator_cities")
    .select("slug")
    .eq("tenant_id", who.tenantId)
    .eq("slug", v.citySlug)
    .is("deleted_at", null)
    .maybeSingle();
  if (ciudadError) return { error: `No se pudo comprobar la ciudad: ${ciudadError.message}` };
  if (!ciudad) {
    return {
      fieldErrors: { citySlug: "Esa ciudad no está en el catálogo de la calculadora." },
    };
  }

  const { error } = await supabase.from("carrier_tariffs").insert({
    tenant_id: who.tenantId,
    carrier_id: v.carrierId,
    city_slug: v.citySlug,
    ...numeros,
  });

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

export type BulkPriceActionState = {
  ok?: boolean;
  /** Cuántas ciudades cambiaron. */
  updated?: number;
  error?: string;
  fieldErrors?: Partial<Record<BulkPriceFieldKey, string>>;
};

/**
 * Cambio en lote (SDD-0537 · SDD-0539): un costo y/o una venta nuevos, en
 * valor absoluto, para varias ciudades del mismo transportista.
 *
 * Todo o nada: primero lee las tarifas vivas de ese transportista y exige que
 * TODAS las elegidas estén ahí; si falta una, no cambia ninguna. Después, un
 * solo UPDATE, que es una sola sentencia, con los MISMOS filtros.
 *
 * Los ids de la selección NO viajan en la URL (SDD-0539). PostgREST lleva los
 * filtros en la URL, y 300 uuids en un `in.(…)` miden unos 11,7 KB: más que
 * los 8 KB que acepta un proxy nginx. La lectura no lleva lista, y el UPDATE
 * filtra por `city_slug`, que pesa un tercio de lo que pesa un uuid. El índice
 * único vivo de 0330 (`carrier_tariffs_one_live_per_city`) garantiza que cada
 * ciudad es UNA tarifa viva del transportista. Si aun así el filtro no cabe,
 * no se escribe nada.
 *
 * Si otra pestaña quitó una ruta entre la lectura y el UPDATE, esa no se toca
 * y `updated` dice cuántas cambiaron de verdad (la UI lo avisa). Si la quitó y
 * la volvió a agregar, la ciudad sigue elegida y su tarifa nueva recibe el
 * precio. Con 0490 aplicada, cada fila deja su evento AUD-01 en esa misma
 * transacción.
 */
export async function bulkUpdateTariffPricesAction(
  _prev: BulkPriceActionState,
  formData: FormData,
): Promise<BulkPriceActionState> {
  const supabase = await createClient();
  const who = await resolveTenantAdmin(supabase);
  if (!who.ok) return { error: who.error };

  const parsed = validateBulkPriceInput(formData);
  if (!parsed.ok) return { error: parsed.error, fieldErrors: parsed.errors };
  const v = parsed.value;

  const { data: vivas, error: lecturaError } = await supabase
    .from("carrier_tariffs")
    .select("id, city_slug")
    .eq("tenant_id", who.tenantId)
    .eq("carrier_id", v.carrierId)
    .is("deleted_at", null);
  if (lecturaError) return { error: `No se pudo comprobar la selección: ${lecturaError.message}` };
  const ciudadPorId = new Map(
    (vivas ?? []).map((t) => [t.id as string, t.city_slug as string]),
  );
  if (!v.ids.every((id) => ciudadPorId.has(id))) {
    return {
      error:
        "Alguna de las ciudades elegidas ya no está activa con este transportista. No se cambió ninguna: recarga la página y vuelve a seleccionar.",
    };
  }
  const ciudades = v.ids.map((id) => ciudadPorId.get(id) as string);
  if (bytesFiltroIn("city_slug", ciudades) > MAX_BYTES_FILTRO_LOTE) {
    return {
      error:
        "Son demasiadas ciudades para cambiarlas de una vez. No se cambió ninguna: divide la selección en dos lotes.",
    };
  }

  const patch: { cost_usd_cbm?: number; price_usd_cbm?: number } = {};
  if (v.costUsdCbm != null) patch.cost_usd_cbm = v.costUsdCbm;
  if (v.priceUsdCbm != null) patch.price_usd_cbm = v.priceUsdCbm;

  const { data, error } = await supabase
    .from("carrier_tariffs")
    .update(patch)
    .eq("tenant_id", who.tenantId)
    .eq("carrier_id", v.carrierId)
    .is("deleted_at", null)
    .in("city_slug", ciudades)
    .select("id");
  if (error) return { error: `No se pudieron cambiar los precios: ${error.message}` };
  const updated = Array.isArray(data) ? data.length : 0;
  if (updated === 0) return { error: TARIFA_NO_ENCONTRADA };

  revalidarTodo();
  return { ok: true, updated };
}

/**
 * Quitar una ruta: borrado en blando (MP-01). La ciudad se puede volver a
 * agregar después: el índice único de 0330 sólo cuenta las tarifas vivas.
 * Exige el transportista para no quitar por id una ruta de otro.
 */
export async function deleteTariffAction(
  _prev: TariffActionState,
  formData: FormData,
): Promise<TariffActionState> {
  const supabase = await createClient();
  const who = await resolveTenantAdmin(supabase);
  if (!who.ok) return { error: who.error };

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Falta la tarifa." };
  const carrierId = String(formData.get("carrierId") ?? "").trim();
  if (!carrierId) return { error: "Falta el transportista." };

  const { data, error } = await supabase
    .from("carrier_tariffs")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", who.tenantId)
    .eq("carrier_id", carrierId)
    .is("deleted_at", null)
    .select("id");

  if (error) return { error: `No se pudo quitar la ruta: ${error.message}` };
  if (!Array.isArray(data) || data.length === 0) return { error: TARIFA_NO_ENCONTRADA };

  revalidarTodo();
  return { ok: true };
}
