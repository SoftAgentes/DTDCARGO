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
import { fetchAllPaged } from "@/lib/db/paginate";
import { createAdminClient } from "@/lib/db/admin";
import { getCurrentOperario } from "@/lib/auth/operario-session";
import { EstibaClient, type SugerenciaPlan } from "../_components/EstibaClient";
import { etiquetasAncho, type PlanCarga } from "@/lib/shared/estiba-plan";

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
  // Paginado: de acá salen "cuántas cajas" y "cuántos lotes" que ve el
  // operario. Truncar le dice que falta menos carga de la que falta.
  const { rows } = await fetchAllPaged<{ load_order: number | null }>((d, h) =>
    admin
      .from("consolidation_box_positions")
      .select("box_id, load_order")
      .eq("consolidation_id", consolidationId)
      .is("unstuffed_at", null)
      .order("box_id", { ascending: true })
      .range(d, h),
  );
  const stuffedCount = rows.length;
  const lotsCount = new Set(rows.map((r) => r.load_order ?? 0)).size;

  // SDD-0184 · Fase 4 — el plan vigente, masticado para la pantalla del operario.
  // El motor NO corre acá: solo se traduce el plan guardado a "para este cliente,
  // este lado". Si no hay plan, la estiba funciona exactamente como antes.
  const { data: planRow } = await admin
    .from("consolidation_plans")
    .select("id, result")
    .eq("consolidation_id", consolidationId)
    .eq("tenant_id", operario.tenant_id)
    .eq("is_current", true)
    .maybeSingle<{ id: string; result: PlanCarga }>();

  let sugerencia: SugerenciaPlan | null = null;
  if (planRow?.result?.pasos?.length) {
    const lados = etiquetasAncho(planRow.result.espacio.layout.nz);
    const porCliente: SugerenciaPlan["porCliente"] = {};
    for (const paso of planRow.result.pasos) {
      // El primer área del lote manda: es donde el operario empieza a poner.
      const z = paso.zonas[0];
      if (!paso.markbox || !z) continue;
      // Solo el PRIMER lote de cada cliente: si tiene dos, el segundo se resuelve
      // cuando el primero ya esté montado.
      if (porCliente[paso.markbox]) continue;
      porCliente[paso.markbox] = {
        lado: z.zz,
        frase: `${paso.destino} · ${lados[z.zz] ?? ""}`.replace(/ · $/, ""),
      };
    }
    sugerencia = {
      planId: planRow.id,
      porCliente,
      totalLotes: planRow.result.pasos.length,
    };
  }

  return (
    <EstibaClient
      consolidationId={consol.id}
      consolidationRef={consol.ref}
      containerLabel={ct?.label ?? consol.container_type ?? "Contenedor"}
      containerNo={consol.container_no}
      status={consol.status}
      initialStuffedCount={stuffedCount}
      sugerencia={sugerencia}
      lotsCount={lotsCount}
    />
  );
}
