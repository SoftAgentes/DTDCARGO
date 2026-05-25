/**
 * /m/cn/nueva — Nueva recepción CN (SDD-0027).
 *
 * Server component:
 *  1. Valida sesión del operario (cookie HTTP-only + DB)
 *  2. Query clientes del tenant (para el picker en step 2)
 *  3. Delega UI a NuevaRecepcionClient
 *
 * Submit final dispara createReceiptFromOperarioAction que llama RPC
 * create_receipt_as_operario con service_role.
 */

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/db/admin";
import { getCurrentOperario } from "@/lib/auth/operario-session";
import { getOperarioLang } from "@/lib/lang-server";
import {
  NuevaRecepcionClient,
  type PickerClient,
} from "./_components/NuevaRecepcionClient";

export const metadata = { title: "Nueva recepción" };

export default async function NuevaRecepcionPage() {
  const operario = await getCurrentOperario();
  if (!operario) redirect("/m/cn/login");

  const initialLang = await getOperarioLang();

  // Query clientes del tenant del operario (para el cliente picker)
  const admin = createAdminClient();
  const { data: clientsData } = await admin
    .from("clients")
    .select("markbox, name")
    .eq("tenant_id", operario.tenant_id)
    .is("deleted_at", null)
    .order("markbox", { ascending: true });

  const clients: PickerClient[] = (clientsData ?? []).map((c) => ({
    markbox: c.markbox as string,
    name: c.name as string,
  }));

  return (
    <NuevaRecepcionClient
      initialLang={initialLang}
      clients={clients}
      defaultWarehouseId={operario.warehouse_id}
    />
  );
}
