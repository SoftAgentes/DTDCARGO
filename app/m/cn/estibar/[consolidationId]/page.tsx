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
import { parseZoneLayout, type StuffedBox } from "@/lib/studio/naviera/zones";
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
    .select("zone_layout, label")
    .eq("tenant_id", operario.tenant_id)
    .eq("code", consol.container_type ?? "")
    .maybeSingle<{ zone_layout: unknown; label: string | null }>();

  const layout = parseZoneLayout(ct?.zone_layout);

  // Lo ya estibado (solo posiciones vivas)
  const { data: posRows } = await admin
    .from("consolidation_box_positions")
    .select("box_id, zx, zy, zz, seq, warehouse_boxes(code, markbox, client_name)")
    .eq("consolidation_id", consolidationId)
    .is("unstuffed_at", null)
    .order("seq", { ascending: true })
    .limit(2000);

  const stuffed: StuffedBox[] = ((posRows as Record<string, unknown>[] | null) ?? []).map(
    (raw) => {
      const embed = raw.warehouse_boxes as
        | Record<string, unknown>
        | Record<string, unknown>[]
        | null;
      const boxRow = Array.isArray(embed) ? embed[0] : embed;
      return {
        boxId: String(raw.box_id ?? ""),
        code: String(boxRow?.code ?? ""),
        markbox: (boxRow?.markbox as string | null) ?? null,
        clientName: (boxRow?.client_name as string | null) ?? null,
        zx: Number(raw.zx ?? 0),
        zy: Number(raw.zy ?? 0),
        zz: Number(raw.zz ?? 0),
        seq: Number(raw.seq ?? 0),
      };
    },
  );

  // Cuántas cajas se esperan en este contenedor (suma de piezas asignadas)
  const { data: items } = await admin
    .from("consolidation_items")
    .select("pieces")
    .eq("consolidation_id", consolidationId)
    .limit(5000);

  const expected = ((items as { pieces: number | null }[] | null) ?? []).reduce(
    (s, i) => s + (i.pieces ?? 0),
    0,
  );

  return (
    <EstibaClient
      consolidationId={consol.id}
      consolidationRef={consol.ref}
      containerLabel={ct?.label ?? consol.container_type ?? "Contenedor"}
      containerNo={consol.container_no}
      status={consol.status}
      layout={layout}
      initialStuffed={stuffed}
      expectedCount={expected}
    />
  );
}
