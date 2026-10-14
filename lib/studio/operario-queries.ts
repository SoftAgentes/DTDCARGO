/**
 * Queries del módulo Operarios (admin Studio web · SDD-0028).
 *
 * RLS filtra por tenant_id del caller authenticated y, desde la migr 0475
 * (SDD-0515), por el permiso de vista del módulo Operarios en la matriz
 * (default de rbac.ts + desvíos de 0357). El cliente Supabase regular
 * (`createClient`) lee directamente — no usa service_role acá.
 *
 * ⚠️ NOMBRA LAS COLUMNAS. Desde 0475 el SELECT de operario_pins es por
 * columna y `pin_hash` no está concedido a nadie de la API: un `select("*")`
 * o pedir `pin_hash` falla con 42501 (permission denied).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { OperarioRol } from "./operario-pin";

export type OperarioRow = {
  id: string;
  tenant_id: string;
  warehouse_id: string | null;     // nullable desde SDD-0023 (VE choferes)
  region: "cn" | "ve";
  display_name: string;
  display_name_cn: string | null;
  /** Los cuatro de operario_pins_role_check (0025): bodeguero y camionero son de Venezuela. */
  role: OperarioRol;
  active: boolean;
  last_login_at: string | null;
  created_at: string;
  // Join data (nullable si el warehouse fue desactivado o region=ve)
  warehouse_code: string | null;
  warehouse_name_es: string | null;
};

const LIST_SELECT = `
  id, tenant_id, warehouse_id, region, display_name, display_name_cn, role,
  active, last_login_at, created_at,
  warehouse:warehouses_cn!warehouse_id ( code, hub_name_es )
`;

/**
 * Lista los operarios del tenant del usuario logueado. RLS filtra.
 * Ordenados: activos primero, después por display_name.
 */
export async function listOperarios(
  supabase: SupabaseClient,
): Promise<OperarioRow[]> {
  const { data, error } = await supabase
    .from("operario_pins")
    .select(LIST_SELECT)
    .order("active", { ascending: false })
    .order("display_name", { ascending: true });

  if (error) throw error;

  // Supabase devuelve warehouse como array aunque sea FK 1:1; aplanar.
  type RawRow = Omit<OperarioRow, "warehouse_code" | "warehouse_name_es"> & {
    warehouse:
      | { code: string; hub_name_es: string }
      | { code: string; hub_name_es: string }[]
      | null;
  };

  const rows = (data ?? []) as unknown as RawRow[];
  return rows.map((r) => {
    const wh = Array.isArray(r.warehouse) ? r.warehouse[0] : r.warehouse;
    return {
      id: r.id,
      tenant_id: r.tenant_id,
      warehouse_id: r.warehouse_id,
      region: r.region,
      display_name: r.display_name,
      display_name_cn: r.display_name_cn,
      role: r.role,
      active: r.active,
      last_login_at: r.last_login_at,
      created_at: r.created_at,
      warehouse_code: wh?.code ?? null,
      warehouse_name_es: wh?.hub_name_es ?? null,
    };
  });
}
