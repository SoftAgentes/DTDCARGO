/**
 * /m/cn/estibar/[consolidationId] — el operario CN estiba el contenedor (SDD-0152).
 *
 * Server component:
 *  1. Valida sesión via getCurrentOperario (cookie + DB) · redirect si no hay
 *  2. Lee la consolidación + su grilla de zonas + lo ya estibado
 *  3. Renderiza EstibaClient
 *
 * El operario NO es `auth.users` → todo por createAdminClient (service_role) con
 * filtro explícito por tenant. NO se depende de RLS acá (regla de app/m/CLAUDE.md).
 */

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/db/admin";
import { getCurrentOperario } from "@/lib/auth/operario-session";
import { EstibaClient } from "../_components/EstibaClient";

export const metadata = { title: "Estibar" };
export const dynamic = "force-dynamic";

export default async function EstibarPage({
  params,
}: {
  params: Promise<{ consolidationId: string }>;
}) {
  const operario = await getCurrentOperario();
  if (!operario) redirect("/m/cn/login");
  if (operario.region !== "cn") redirect("/m/cn");

  const { consolidationId } = await params;
  const admin = createAdminClient();

  // Consolidación · filtro por tenant EXPLÍCITO (service_role bypassa RLS)
  const { data: consol } = await admin
    .from("consolidations")
    .select("id, ref, container_type, container_no, status, tenant_id")
    .eq("id", consolidationId)
    .eq("tenant_id", operario.tenant_id)
    .is("deleted_at", null)
    .maybeSingle<{
      id: string;
      ref: string;
      container_type: string | null;
      container_no: string | null;
      status: string;
    }>();

  if (!consol) redirect("/m/cn");

  // Grilla de zonas del tipo de contenedor
  const { data: ct } = await admin
    .from("container_types")
    .select("label")
    .eq("tenant_id", operario.tenant_id)
    .eq("code", consol.container_type ?? "")
    .maybeSingle<{ label: string | null }>();

  // Lo ya montado (solo posiciones vivas). SDD-0155: lo que importa para la UI del
  // operario es CUÁNTAS cajas y CUÁNTOS lotes (load_order distintos), no la grilla.
  const { data: posRows } = await admin
    .from("consolidation_box_positions")
    .select("load_order")
    .eq("consolidation_id", consolidationId)
    .is("unstuffed_at", null)
    .limit(5000);

  const rows = (posRows as { load_order: number | null }[] | null) ?? [];
  const stuffedCount = rows.length;
  const lotsCount = new Set(rows.map((r) => r.load_order ?? 0)).size;

  return (
    <EstibaClient
      consolidationId={consol.id}
      consolidationRef={consol.ref}
      containerLabel={ct?.label ?? consol.container_type ?? "Contenedor"}
      containerNo={consol.container_no}
      status={consol.status}
      initialStuffedCount={stuffedCount}
      lotsCount={lotsCount}
    />
  );
}
