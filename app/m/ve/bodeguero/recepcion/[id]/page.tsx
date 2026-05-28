/**
 * /m/ve/bodeguero/recepcion/[id] — Pantalla de scan (Sprint E · plan v3).
 *
 * Server component:
 *  1. Valida sesión + role
 *  2. Fetch receipt + cajas
 *  3. Render ReceptionScanClient (QR scanner + lista de cajas)
 */

import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/db/admin";
import { getCurrentOperario } from "@/lib/auth/operario-session";
import { getReceiptVeWithBoxes } from "@/lib/studio/warehouse-receipt-ve-queries";
import { ReceptionScanClient } from "../_components/ReceptionScanClient";

export const metadata = { title: "Recepción VE · Scan" };
export const dynamic = "force-dynamic";

export default async function ReceptionScanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: receiptId } = await params;

  const operario = await getCurrentOperario();
  if (!operario) redirect("/m/ve/login");
  if (operario.region !== "ve") redirect("/m/ve/login");

  if (operario.roles.length > 1 && !operario.current_mode) {
    redirect("/m/ve/modos");
  }
  const activeMode = operario.current_mode ?? operario.role;
  if (activeMode !== "bodeguero" && activeMode !== "supervisor") {
    redirect("/m/ve/bodeguero");
  }

  const admin = createAdminClient();
  const receipt = await getReceiptVeWithBoxes(
    admin,
    operario.tenant_id,
    receiptId,
  );
  if (!receipt) notFound();

  return (
    <ReceptionScanClient
      receipt={receipt}
      tenantId={operario.tenant_id}
      operario={{
        operario_id: operario.operario_id,
        firstName:
          operario.display_name.split(/\s+/)[0] ?? operario.display_name,
      }}
    />
  );
}
