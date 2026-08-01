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
import { listCities } from "@/lib/studio/dispatch-routes-queries";
import {
  NuevaRecepcionClient,
  type PickerClient,
  type PickerCity,
} from "./_components/NuevaRecepcionClient";

export const metadata = { title: "Nueva recepción" };

export default async function NuevaRecepcionPage() {
  const operario = await getCurrentOperario();
  if (!operario) redirect("/m/cn/login");
  // Defensive: SDD-0030 hizo warehouse_id nullable. El operario CN debería
  // tener siempre warehouse_id por constraint operario_pins_cn_requires_warehouse.
  if (!operario.warehouse_id) redirect("/m/cn/login");

  const initialLang = await getOperarioLang();

  // Query clientes del tenant del operario (para el cliente picker).
  //
  // PRIVACIDAD (auditoría 2026-07, hallazgo H-7): el equipo CN identifica al
  // importador SOLO por Shipping Mark, nunca por su nombre real. La regla ya
  // existía en el Studio (`listReceipts({ redactClientNames })`, SDD-0039 B.9)
  // pero esta PWA se construyó después y no la heredó: mandaba la tabla
  // `clients` COMPLETA —con nombre— al dispositivo en Yiwu.
  //
  // Se redacta en el SERVER, no ocultando en el cliente: lo que no se
  // selecciona no puede filtrarse.
  const admin = createAdminClient();
  const [{ data: clientsData }, citiesData] = await Promise.all([
    admin
      .from("clients")
      .select("markbox")
      .eq("tenant_id", operario.tenant_id)
      .is("deleted_at", null)
      .order("markbox", { ascending: true }),
    // Cities per-tenant para el picker de destino · admin client porque
    // operario session no es Supabase auth user (es PIN-based).
    listCities(admin, { activeOnly: true }).catch(() => []),
  ]);

  const clients: PickerClient[] = (clientsData ?? []).map((c) => ({
    markbox: c.markbox as string,
  }));

  const cities: PickerCity[] = citiesData
    .filter((c) => c.tenant_id === operario.tenant_id)
    .map((c) => ({ id: c.id, city: c.city, state_name: c.state_name }));

  return (
    <NuevaRecepcionClient
      initialLang={initialLang}
      clients={clients}
      cities={cities}
      defaultWarehouseId={operario.warehouse_id}
    />
  );
}
