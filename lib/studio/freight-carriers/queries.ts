/**
 * Transportistas terrestres y su tarifario — queries (SDD-0236).
 *
 * Funciones puras que reciben el `SupabaseClient`. RLS filtra por tenant
 * automáticamente: NUNCA se pasa `tenant_id` como parámetro de lectura.
 *
 * Postgres devuelve `numeric` como string vía PostgREST — todo lo que sea plata
 * se normaliza acá, una sola vez, para que la UI nunca reciba un string donde
 * espera un número.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CarrierTariff, FreightCarrier } from "./types";

type CarrierRow = {
  id: string;
  tenant_id: string;
  name: string;
  legal_name: string | null;
  tax_id: string | null;
  contact: string | null;
  notes: string | null;
  is_default: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type TariffRow = {
  id: string;
  tenant_id: string;
  carrier_id: string;
  city_slug: string;
  cost_usd_cbm: number | string;
  price_usd_cbm: number | string;
  price_usd_ft3: number | string | null;
  min_charge_usd: number | string | null;
  dispatch_frequency_days: number | null;
  departure_frequency: string | null;
  transit_days: string | null;
  conditions: string | null;
  valid_from: string | null;
  valid_to: string | null;
  created_at: string;
  updated_at: string;
};

const CARRIER_COLUMNS =
  "id, tenant_id, name, legal_name, tax_id, contact, notes, is_default, active, created_at, updated_at";

// ⚠️ Una sola cadena literal, sin concatenar: el cliente tipado de Supabase
// parsea este string en tiempo de compilación para inferir la forma de la fila.
// Partirlo en varios trozos con `+` rompe esa inferencia y el select empieza a
// devolver `GenericStringError`.
const TARIFF_COLUMNS =
  "id, tenant_id, carrier_id, city_slug, cost_usd_cbm, price_usd_cbm, price_usd_ft3, min_charge_usd, dispatch_frequency_days, departure_frequency, transit_days, conditions, valid_from, valid_to, created_at, updated_at";

/** numeric de PostgREST → number. */
function num(v: number | string): number {
  return typeof v === "number" ? v : Number(v);
}
function numOrNull(v: number | string | null): number | null {
  return v == null ? null : num(v);
}

function toCarrier(r: CarrierRow): FreightCarrier {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    name: r.name,
    legalName: r.legal_name,
    taxId: r.tax_id,
    contact: r.contact,
    notes: r.notes,
    isDefault: r.is_default,
    active: r.active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function toTariff(r: TariffRow): CarrierTariff {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    carrierId: r.carrier_id,
    citySlug: r.city_slug,
    costUsdCbm: num(r.cost_usd_cbm),
    priceUsdCbm: num(r.price_usd_cbm),
    priceUsdFt3: numOrNull(r.price_usd_ft3),
    minChargeUsd: numOrNull(r.min_charge_usd),
    dispatchFrequencyDays: r.dispatch_frequency_days,
    departureFrequency: r.departure_frequency,
    transitDays: r.transit_days,
    conditions: r.conditions,
    validFrom: r.valid_from,
    validTo: r.valid_to,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Los transportistas vivos del tenant. El predeterminado va de primero. */
export async function listFreightCarriers(
  supabase: SupabaseClient,
): Promise<FreightCarrier[]> {
  const { data, error } = await supabase
    .from("freight_carriers")
    .select(CARRIER_COLUMNS)
    .is("deleted_at", null)
    .order("is_default", { ascending: false })
    .order("name", { ascending: true });

  if (error) throw new Error(`No se pudieron leer los transportistas: ${error.message}`);
  return (data ?? []).map((r) => toCarrier(r as CarrierRow));
}

/**
 * El transportista predeterminado del tenant, o `null` si no hay ninguno.
 *
 * `null` NO es un caso raro que se pueda ignorar: significa que la calculadora
 * pública no tiene con qué cotizar el tramo nacional y tiene que derivar al
 * asesor en vez de inventar un precio.
 */
export async function getDefaultCarrier(
  supabase: SupabaseClient,
): Promise<FreightCarrier | null> {
  const { data, error } = await supabase
    .from("freight_carriers")
    .select(CARRIER_COLUMNS)
    .is("deleted_at", null)
    .eq("is_default", true)
    .eq("active", true)
    .maybeSingle();

  if (error) throw new Error(`No se pudo leer el transportista predeterminado: ${error.message}`);
  return data ? toCarrier(data as CarrierRow) : null;
}

/** Las tarifas vivas de un transportista, por ciudad. */
export async function listCarrierTariffs(
  supabase: SupabaseClient,
  carrierId: string,
): Promise<CarrierTariff[]> {
  const { data, error } = await supabase
    .from("carrier_tariffs")
    .select(TARIFF_COLUMNS)
    .eq("carrier_id", carrierId)
    .is("deleted_at", null)
    .order("city_slug", { ascending: true });

  if (error) throw new Error(`No se pudo leer el tarifario: ${error.message}`);
  return (data ?? []).map((r) => toTariff(r as TariffRow));
}

/**
 * Todas las tarifas vivas del tenant, de todos los transportistas.
 * Para el comparativo "quién gana en cada ciudad".
 */
export async function listAllTariffs(
  supabase: SupabaseClient,
): Promise<CarrierTariff[]> {
  const { data, error } = await supabase
    .from("carrier_tariffs")
    .select(TARIFF_COLUMNS)
    .is("deleted_at", null)
    .order("city_slug", { ascending: true });

  if (error) throw new Error(`No se pudo leer el tarifario: ${error.message}`);
  return (data ?? []).map((r) => toTariff(r as TariffRow));
}

/**
 * Marca un transportista como el predeterminado y baja al que lo era.
 *
 * ⚠️ Los dos UPDATE van en este orden a propósito: el índice único parcial
 * `freight_carriers_one_default_per_tenant` rechaza tener dos predeterminados
 * vivos a la vez, así que primero se baja el anterior. Si esto se invierte, la
 * base lo rechaza — y está bien que lo haga.
 */
export async function setDefaultCarrier(
  supabase: SupabaseClient,
  carrierId: string,
): Promise<void> {
  const bajar = await supabase
    .from("freight_carriers")
    .update({ is_default: false })
    .eq("is_default", true)
    .neq("id", carrierId)
    .is("deleted_at", null);
  if (bajar.error)
    throw new Error(`No se pudo quitar el predeterminado anterior: ${bajar.error.message}`);

  const subir = await supabase
    .from("freight_carriers")
    .update({ is_default: true, active: true })
    .eq("id", carrierId);
  if (subir.error)
    throw new Error(`No se pudo marcar el predeterminado: ${subir.error.message}`);
}
