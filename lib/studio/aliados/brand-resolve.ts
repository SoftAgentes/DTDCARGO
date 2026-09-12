/**
 * El lado que sí toca la base: resuelve la marca de un cliente (SDD-0255).
 *
 * `lib/shared/brand-context.ts` es puro y no puede importar Supabase (frontera
 * público↔ERP). Acá se lee la fila y allá se decide la marca.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  resolveBrand,
  DTD_BRAND,
  type AliadoBrandRow,
  type BrandContext,
} from "@/lib/shared/brand-context";

const BRAND_COLUMNS =
  "trade_name, brand_name, brand_primary, brand_secondary, " +
  "support_email, support_whatsapp, support_website, hide_dtd_brand";

/**
 * La marca con la que hay que pintar los documentos de un cliente.
 *
 * ⚠️ **NO confundir con `getAliadoByClientId()`** (`aliado-queries.ts`): aquella
 * busca el aliado CUYO `client_id` es ese cliente — o sea "este cliente ES un
 * aliado". Acá hace falta lo inverso: `clients.aliado_id → aliados`.
 *
 * ⚠️ **Con qué cliente de Supabase llamarla.** La política de `aliados` es
 * `tenant_id = get_user_tenant_id()` (migr 0362), y un usuario del PORTAL no
 * tiene fila en `user_tenants`: con su sesión esto devuelve DTD siempre, en
 * silencio. Desde el portal hay que pasar el admin client. Desde el Studio, la
 * sesión del usuario alcanza.
 *
 * Ante cualquier error devuelve la marca de DTD: un documento con la marca de la
 * casa es el estado de hoy; uno a medio pintar, no.
 */
export async function resolveBrandForClient(
  db: SupabaseClient,
  ref: { clientId: string } | { markbox: string },
): Promise<BrandContext> {
  const base = db.from("clients").select(`aliado_id, aliados:aliado_id (${BRAND_COLUMNS})`);
  const { data, error } =
    "clientId" in ref
      ? await base.eq("id", ref.clientId).maybeSingle()
      : await base.eq("markbox", ref.markbox).maybeSingle();

  if (error || !data?.aliado_id || !data.aliados) return DTD_BRAND;

  // PostgREST devuelve el embed como objeto (FK a-uno) o como array según cómo
  // infiera la relación; se normaliza para no depender de esa inferencia.
  const row = Array.isArray(data.aliados) ? data.aliados[0] : data.aliados;
  return resolveBrand((row ?? null) as AliadoBrandRow | null);
}

/**
 * Marca del cliente del Portal autenticado.
 *
 * La RPC no recibe `clientId` ni Shipping Mark: resuelve la vinculación activa
 * desde `auth.uid()` y devuelve únicamente las columnas públicas de marca. Así
 * las páginas no construyen un service_role ni dependen de filtros manuales.
 * Un cliente directo, una sesión revocada o cualquier error caen a DTD.
 */
export async function resolveBrandForPortal(
  db: SupabaseClient,
): Promise<BrandContext> {
  const { data, error } = await db.rpc("get_portal_brand");
  if (error) return DTD_BRAND;

  const row = Array.isArray(data) ? data[0] : data;
  return resolveBrand((row ?? null) as AliadoBrandRow | null);
}
