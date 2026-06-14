/**
 * Queries del módulo Configuración de servicios (SDD-0076 Fase 2).
 *
 * Funciones puras `(supabase) => …` consumidas desde app/studio/(app)/servicios/page.tsx.
 * RLS filtra por tenant_id automáticamente — no se pasa tenant_id.
 *
 * `listServiceConfigs` MERGEA la estructura de código (SERVICE_CATALOG, los 20
 * servicios canónicos) con el contenido de la DB: así la UI siempre tiene las 20
 * filas para editar, exista o no la fila en service_configs todavía.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SERVICE_CATALOG,
  type ServiceCatalogEntry,
} from "@/lib/shared/service-catalog";
import type {
  ServiceConfig,
  ServiceFaq,
  ServiceFaqAudience,
  ServiceAddon,
  ServicePriceEntry,
  ChargeMoment,
  ServiceState,
  PriceTable,
  PaymentMethod,
} from "./types";

const CONFIG_COLS =
  "service_key, shipment_service, title_public, description_public, includes_public, excludes_public, price_text, price_table, charge_moment, payment_methods, how_to_request, timelines_public, note_public, condiciones_politicas, notes_internal, internal_price_ref, mapeo_contable, is_public, service_state, updated_at, updated_by";

type RawConfigRow = {
  service_key: string;
  shipment_service: string | null;
  title_public: string;
  description_public: string;
  includes_public: string[] | null;
  excludes_public: string[] | null;
  price_text: string;
  price_table: PriceTable | null;
  charge_moment: string | null;
  payment_methods: string[] | null;
  how_to_request: string;
  timelines_public: string;
  note_public: string | null;
  condiciones_politicas: string | null;
  notes_internal: string | null;
  internal_price_ref: string | null;
  mapeo_contable: string | null;
  is_public: boolean;
  service_state: string;
  updated_at: string;
  updated_by: string | null;
};

function normalizeConfig(row: RawConfigRow): ServiceConfig {
  return {
    service_key: row.service_key as ServiceConfig["service_key"],
    shipment_service: row.shipment_service,
    title_public: row.title_public ?? "",
    description_public: row.description_public ?? "",
    includes_public: row.includes_public ?? [],
    excludes_public: row.excludes_public ?? [],
    price_text: row.price_text ?? "",
    price_table: row.price_table ?? null,
    charge_moment: (row.charge_moment as ChargeMoment | null) ?? null,
    payment_methods: (row.payment_methods ?? []) as PaymentMethod[],
    how_to_request: row.how_to_request ?? "",
    timelines_public: row.timelines_public ?? "",
    note_public: row.note_public,
    condiciones_politicas: row.condiciones_politicas,
    notes_internal: row.notes_internal,
    internal_price_ref: row.internal_price_ref,
    mapeo_contable: row.mapeo_contable,
    is_public: !!row.is_public,
    service_state: (row.service_state as ServiceState) ?? "activo",
    updated_at: row.updated_at,
    updated_by: row.updated_by,
  };
}

/** Un servicio del catálogo (estructura de código) + su contenido en DB (o null). */
export type ServiceCatalogItem = {
  catalog: ServiceCatalogEntry;
  config: ServiceConfig | null;
};

/**
 * Los 20 servicios canónicos con su contenido editable. La estructura sale del
 * código (siempre completa); el contenido, de la DB (puede faltar → null).
 */
export async function listServiceConfigs(
  supabase: SupabaseClient,
): Promise<ServiceCatalogItem[]> {
  const { data, error } = await supabase
    .from("service_configs")
    .select(CONFIG_COLS)
    .is("deleted_at", null);

  const byKey = new Map<string, ServiceConfig>();
  if (!error && data) {
    for (const r of data as RawConfigRow[]) {
      byKey.set(r.service_key, normalizeConfig(r));
    }
  }

  return SERVICE_CATALOG.map((c) => ({
    catalog: c,
    config: byKey.get(c.id) ?? null,
  }));
}

/** Una fila de service_configs por su clave (o null si aún no existe). */
export async function getServiceConfig(
  supabase: SupabaseClient,
  serviceKey: string,
): Promise<ServiceConfig | null> {
  const { data, error } = await supabase
    .from("service_configs")
    .select(CONFIG_COLS)
    .eq("service_key", serviceKey)
    .is("deleted_at", null)
    .maybeSingle<RawConfigRow>();

  if (error || !data) return null;
  return normalizeConfig(data);
}

/** FAQ de un servicio (todas: públicas + internas, para el Studio). */
export async function listServiceFaqs(
  supabase: SupabaseClient,
  serviceKey?: string,
): Promise<ServiceFaq[]> {
  let q = supabase
    .from("service_faqs")
    .select("id, service_key, question, answer, audience, is_public, sort_order")
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });
  if (serviceKey) q = q.eq("service_key", serviceKey);

  const { data, error } = await q;
  if (error || !data) return [];
  return (data as ServiceFaq[]).map((f) => ({
    ...f,
    audience: (f.audience as ServiceFaqAudience) ?? "public",
    is_public: !!f.is_public,
  }));
}

/** Adicionales (ADS) de un servicio. */
export async function listServiceAddons(
  supabase: SupabaseClient,
  serviceKey?: string,
): Promise<ServiceAddon[]> {
  let q = supabase
    .from("service_addons")
    .select(
      "id, service_key, nombre, condicion, tarifa, politica_texto, aplica_a, is_public, sort_order",
    )
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });
  if (serviceKey) q = q.eq("service_key", serviceKey);

  const { data, error } = await q;
  if (error || !data) return [];
  return (data as ServiceAddon[]).map((a) => ({
    ...a,
    aplica_a: a.aplica_a ?? [],
    is_public: !!a.is_public,
  }));
}

/** Historial de precios de un servicio (más reciente primero). */
export async function listPriceHistory(
  supabase: SupabaseClient,
  serviceKey: string,
): Promise<ServicePriceEntry[]> {
  const { data, error } = await supabase
    .from("service_price_history")
    .select("id, service_key, monto_texto, moneda, valid_from, nota")
    .eq("service_key", serviceKey)
    .order("valid_from", { ascending: false });

  if (error || !data) return [];
  return data as ServicePriceEntry[];
}
