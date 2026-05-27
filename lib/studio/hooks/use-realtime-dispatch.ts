"use client";

/**
 * Variantes especializadas de useRealtimeTable para el pipeline Despacho.
 *
 * Subscribe via Supabase Realtime · ver memoria
 * [[bridge-approach-supabase-realtime]] para la decisión arquitectónica.
 *
 * Exports:
 *   - useRealtimeDispatchOrders  · cola admin + panel ODs activas
 *   - useRealtimeOdPackages      · packages de una OD (cargando/lista)
 *   - useRealtimeCnInbox         · paquetes CN listos para Despacho
 */

import { useRealtimeTable, type RealtimeStatus } from "./use-realtime-table";
import type { DispatchOrder } from "@/lib/studio/dispatch-types";
import type { DispatchOrderPackage } from "@/lib/studio/dispatch-types";

// ─────────────────────────────────────────────────────────────
// Dispatch orders por tenant
// ─────────────────────────────────────────────────────────────

export function useRealtimeDispatchOrders({
  tenantId,
  initial,
  disabled = false,
}: {
  tenantId: string | null;
  initial: DispatchOrder[];
  disabled?: boolean;
}): { data: DispatchOrder[]; status: RealtimeStatus } {
  return useRealtimeTable<DispatchOrder>({
    table: "dispatch_orders",
    filter: tenantId ? `tenant_id=eq.${tenantId}` : undefined,
    initial,
    disabled: disabled || !tenantId,
  });
}

// ─────────────────────────────────────────────────────────────
// Packages de un OD específico
// ─────────────────────────────────────────────────────────────

/**
 * Packages de una OD. RLS via JOIN al dispatch_orders (que filtra por
 * tenant), pero Realtime necesita filter sobre la propia tabla. Filtramos
 * por `od_id` que es seguro (un usuario solo puede recibir payloads de
 * packages de ODs visibles por sus RLS).
 */
export function useRealtimeOdPackages({
  odId,
  initial,
  disabled = false,
}: {
  odId: string | null;
  initial: DispatchOrderPackage[];
  disabled?: boolean;
}): { data: DispatchOrderPackage[]; status: RealtimeStatus } {
  return useRealtimeTable<DispatchOrderPackage & { id: string }>({
    table: "dispatch_order_packages",
    filter: odId ? `od_id=eq.${odId}` : undefined,
    initial: initial.map(coercePackageId),
    disabled: disabled || !odId,
  });
}

// ─────────────────────────────────────────────────────────────
// CN inbox · paquetes listos para Despacho desde almacén CN
// ─────────────────────────────────────────────────────────────

export function useRealtimeCnInbox<
  T extends { id: string; tenant_id: string },
>({
  tenantId,
  initial,
  disabled = false,
}: {
  tenantId: string | null;
  initial: T[];
  disabled?: boolean;
}): { data: T[]; status: RealtimeStatus } {
  return useRealtimeTable<T>({
    table: "warehouse_receipts_cn",
    filter: tenantId ? `tenant_id=eq.${tenantId}` : undefined,
    initial,
    disabled: disabled || !tenantId,
  });
}

// ─────────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────────

/**
 * dispatch_order_packages tiene PK compuesta (od_id, package_id). El hook
 * genérico requiere `id` como PK string. Sintetizamos uno estable a partir
 * de los dos campos para que el applyPayload pueda upsert correctamente.
 */
function coercePackageId(p: DispatchOrderPackage): DispatchOrderPackage & { id: string } {
  return { ...p, id: `${p.od_id}::${p.package_id}` };
}
