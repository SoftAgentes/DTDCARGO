/**
 * /m/cn — Home del operario CN (SDD-0027).
 *
 * Server component que:
 *  1. Valida sesión via getCurrentOperario (lee cookie + DB)
 *  2. Si no hay sesión → redirect a /m/cn/login
 *  3. Query del warehouse (code + nombre CN) para el subtitle
 *  4. Renderiza OperarioHomeClient con props
 *
 * Datos del día (KPIs + recent receipts) son mock V1. V2 los traerá
 * de Supabase via queries scoped por operario.
 */

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/db/admin";
import { getCurrentOperario } from "@/lib/auth/operario-session";
import { OperarioHomeClient } from "./_components/OperarioHomeClient";

export const metadata = { title: "Mi día" };

export default async function OperarioHomePage() {
  const operario = await getCurrentOperario();
  if (!operario) redirect("/m/cn/login");

  // Warehouse para el header (code + nombre chino)
  const admin = createAdminClient();
  const { data: wh } = await admin
    .from("warehouses_cn")
    .select("code, warehouse_name, hub_name_cn")
    .eq("id", operario.warehouse_id)
    .maybeSingle<{ code: string; warehouse_name: string | null; hub_name_cn: string }>();

  // Initials: primera letra de cada palabra del display_name
  const initials = operario.display_name
    .split(/\s+/)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");

  // First name: primera palabra del display_name (Hola, Wang)
  const firstName = operario.display_name.split(/\s+/)[0] ?? operario.display_name;

  return (
    <OperarioHomeClient
      operario={{
        displayName: operario.display_name,
        displayNameCn: operario.display_name_cn,
        initials: initials || "??",
        firstName,
        firstNameCn: operario.display_name_cn ?? firstName,
        warehouseCode: wh?.code ?? "—",
        warehouseNameCn: wh?.warehouse_name ?? wh?.hub_name_cn ?? "—",
      }}
    />
  );
}
