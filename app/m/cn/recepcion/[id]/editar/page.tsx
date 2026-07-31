/**
 * /m/cn/recepcion/[id]/editar — Edit recepción CN (Sprint 1 v3).
 *
 * Server component:
 *  1. Valida sesión + region CN.
 *  2. Fetch receipt + items + valida que sea editable
 *     (pendiente_consolidacion + created_by_operario_id match o supervisor).
 *  3. Renderiza EditarRecepcionClient con valores pre-cargados.
 *
 * Si la recepción ya fue consolidada o es de otro operario · 404.
 */

import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/db/admin";
import { getCurrentOperario } from "@/lib/auth/operario-session";
import { EditarRecepcionClient } from "./_components/EditarRecepcionClient";

export const metadata = { title: "Editar recepción · DTD" };
export const dynamic = "force-dynamic";

export default async function EditarRecepcionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: receiptId } = await params;
  const operario = await getCurrentOperario();
  if (!operario) redirect("/m/cn/login");
  if (operario.region !== "cn") redirect("/m/cn/login");

  const admin = createAdminClient();
  const { data: receipt, error: rErr } = await admin
    .from("warehouse_receipts_cn")
    .select(
      // PRIVACIDAD (hallazgo H-7): sin `client_name` — el equipo CN edita la
      // recepción identificando al importador por Shipping Mark.
      `id, tenant_id, receipt_code, warehouse_id, client_markbox,
       is_orphan, orphan_marks, orphan_brought_by,
       supplier_name, supplier_name_translated,
       boxes, total_cbm, total_weight_kg,
       status, received_at, notes, destination_city,
       created_by_operario_id`,
    )
    .eq("id", receiptId)
    .eq("tenant_id", operario.tenant_id)
    .is("deleted_at", null)
    .maybeSingle<{
      id: string;
      tenant_id: string;
      receipt_code: string;
      warehouse_id: string;
      client_markbox: string | null;
      is_orphan: boolean;
      orphan_marks: string | null;
      orphan_brought_by: string | null;
      supplier_name: string | null;
      supplier_name_translated: string | null;
      boxes: number;
      total_cbm: number | null;
      total_weight_kg: number | null;
      status: string;
      received_at: string;
      notes: string | null;
      destination_city: string | null;
      created_by_operario_id: string | null;
    }>();
  if (rErr || !receipt) notFound();

  // Sólo editable si pertenece al operario (o si es supervisor) y está en
  // pendiente_consolidacion.
  if (receipt.status !== "pendiente_consolidacion") notFound();
  const isOwner = receipt.created_by_operario_id === operario.operario_id;
  const isSupervisor = operario.roles.includes("supervisor");
  if (!isOwner && !isSupervisor) notFound();

  const { data: itemsData } = await admin
    .from("warehouse_receipt_items")
    .select("description, description_translated, hs_code, quantity, unit_value_usd, notes, position")
    .eq("receipt_id", receiptId)
    .order("position", { ascending: true });

  return (
    <EditarRecepcionClient
      receipt={{
        id: receipt.id,
        code: receipt.receipt_code,
        warehouseId: receipt.warehouse_id,
        isOrphan: receipt.is_orphan,
        clientMarkbox: receipt.client_markbox ?? "",
        orphanMarks: receipt.orphan_marks ?? "",
        orphanBroughtBy: receipt.orphan_brought_by ?? "",
        supplierName: receipt.supplier_name ?? "",
        supplierNameTranslated: receipt.supplier_name_translated ?? "",
        boxes: receipt.boxes,
        totalCbm: receipt.total_cbm,
        totalWeightKg: receipt.total_weight_kg,
        receivedAt: receipt.received_at,
        notes: receipt.notes ?? "",
        destinationCity: receipt.destination_city ?? "",
      }}
      items={(itemsData ?? []).map((it) => ({
        description: it.description as string,
        description_translated: (it.description_translated as string | null) ?? null,
        hs_code: (it.hs_code as string | null) ?? null,
        quantity: (it.quantity as number | null) ?? null,
        unit_value_usd: (it.unit_value_usd as number | null) ?? null,
        notes: (it.notes as string | null) ?? null,
      }))}
    />
  );
}
