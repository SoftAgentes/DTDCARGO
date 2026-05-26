/**
 * /m/ve/camionero — Home del camionero VE (SDD-0030).
 *
 * Server component:
 *  1. Valida sesión + role
 *  2. Fetch ODs `lista` o `en_ruta` asignadas al driver (match por nombre)
 *  3. Render CamioneroClient con ruta del día
 */

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/db/admin";
import { getCurrentOperario } from "@/lib/auth/operario-session";
import { listOdsForCamionero } from "@/lib/studio/dispatch-mobile-queries";
import { CamioneroClient } from "./_components/CamioneroClient";

export const metadata = { title: "Despacho · Camionero" };
export const dynamic = "force-dynamic";

export default async function CamioneroHomePage() {
  const operario = await getCurrentOperario();
  if (!operario) redirect("/m/ve/login");
  if (operario.region !== "ve") redirect("/m/ve/login");
  // Bodeguero NO entra acá
  if (operario.role === "bodeguero" || operario.role === "operario") {
    redirect("/m/ve/bodeguero");
  }

  const admin = createAdminClient();
  const ods = await listOdsForCamionero(
    admin,
    operario.tenant_id,
    operario.display_name,
  );

  const firstName = operario.display_name.split(/\s+/)[0] ?? operario.display_name;
  const initials =
    operario.display_name
      .split(/\s+/)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .slice(0, 2)
      .join("") || "??";

  return (
    <CamioneroClient
      operario={{
        operario_id: operario.operario_id,
        displayName: operario.display_name,
        firstName,
        initials,
      }}
      ods={ods}
    />
  );
}
