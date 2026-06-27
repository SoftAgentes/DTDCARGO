/**
 * Inventario · WMS (SDD-0081 · Slice A).
 *
 * Torre de stock **read-only**: server component que gatea el módulo (RBAC
 * SDD-0085) y deriva el stock de ambas bodegas con `getStockByWarehouse`
 * (queries puras sobre tablas existentes — sin migración). Delega la UI con
 * tabs CN/VE a `InventarioClient`.
 *
 * Solo CBM/kg — sin valor en USD (decisión founder §6.2).
 */

import { createClient } from "@/lib/db/server";
import { requireModuleView } from "@/lib/studio/rbac-guard";
import { getStockByWarehouse } from "@/lib/studio/inventory/queries";
import { InventarioClient } from "./_components/InventarioClient";

export const metadata = { title: "Inventario · WMS — DTD Studio" };

export default async function InventarioPage() {
  await requireModuleView("inventory");
  const supabase = await createClient();

  const [cn, ve] = await Promise.all([
    getStockByWarehouse(supabase, "CN"),
    getStockByWarehouse(supabase, "VE"),
  ]);

  return <InventarioClient cn={cn} ve={ve} />;
}
