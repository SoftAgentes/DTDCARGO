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
import { listOdsForBodeguero } from "@/lib/studio/dispatch-mobile-queries";
import { BodegueroClient } from "./_components/BodegueroClient";

export const metadata = { title: "Despacho · Bodeguero" };
export const dynamic = "force-dynamic";

export default async function BodegueroHomePage() {
  const operario = await getCurrentOperario();
  if (!operario) redirect("/m/ve/login");
  if (operario.region !== "ve") redirect("/m/ve/login");
  // Camionero NO entra acá
  if (operario.role === "camionero") redirect("/m/ve/camionero");

  const admin = createAdminClient();
  const ods = await listOdsForBodeguero(admin, operario.tenant_id);

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
      }}
      ods={ods}
      tenantId={operario.tenant_id}
    />
  );
}
