/**
 * /m/ve/bodeguero — Home del bodeguero VE (SDD-0030).
 *
 * Server component:
 *  1. Valida sesión + role
 *  2. Fetch ODs activas del tenant (status creada/cargando/lista)
 *  3. Render BodegueroClient con la cola
 */

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/db/admin";
import { getCurrentOperario } from "@/lib/auth/operario-session";
import {
  listAvailableDriversForHub,
  listAvailableTrucksForHub,
  listOdsForBodeguero,
} from "@/lib/studio/dispatch-mobile-queries";
import { BodegueroClient } from "./_components/BodegueroClient";

export const metadata = { title: "Despacho · Bodeguero" };
export const dynamic = "force-dynamic";

export default async function BodegueroHomePage() {
  const operario = await getCurrentOperario();
  if (!operario) redirect("/m/ve/login");
  if (operario.region !== "ve") redirect("/m/ve/login");

  // Sprint D · multi-rol: si tiene > 1 modo y no eligió hoy, al selector
  if (operario.roles.length > 1 && !operario.current_mode) {
    redirect("/m/ve/modos");
  }
  // Si el modo activo es camionero, no entra al bodeguero
  const activeMode = operario.current_mode ?? operario.role;
  if (activeMode === "camionero") redirect("/m/ve/camionero");

  // Mono-rol legacy: bloquear camionero (que no eligió modo y tiene role=camionero)
  if (operario.role === "camionero" && !operario.current_mode) {
    redirect("/m/ve/camionero");
  }

  const admin = createAdminClient();
  const ods = await listOdsForBodeguero(admin, operario.tenant_id);

  // Sprint 2 · pool de trucks/drivers disponibles para reasignación inline
  const [availableTrucks, availableDrivers] = await Promise.all([
    listAvailableTrucksForHub(admin, operario.tenant_id),
    listAvailableDriversForHub(admin, operario.tenant_id),
  ]);

  // Sprint 2 · feature flag para warehouse_location (default off)
  const { data: flag } = await admin
    .from("feature_flags")
    .select("enabled")
    .eq("tenant_id", operario.tenant_id)
    .eq("key", "dispatch.show_warehouse_location")
    .maybeSingle<{ enabled: boolean }>();
  const showWarehouseLocation = !!flag?.enabled;

  const firstName = operario.display_name.split(/\s+/)[0] ?? operario.display_name;
  const initials =
    operario.display_name
      .split(/\s+/)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .slice(0, 2)
      .join("") || "??";

  return (
    <BodegueroClient
      operario={{
        operario_id: operario.operario_id,
        displayName: operario.display_name,
        firstName,
        initials,
        role: operario.role,
        roles: operario.roles,
      }}
      ods={ods}
      tenantId={operario.tenant_id}
      availableTrucks={availableTrucks}
      availableDrivers={availableDrivers}
      showWarehouseLocation={showWarehouseLocation}
    />
  );
}
