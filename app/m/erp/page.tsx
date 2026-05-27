/**
 * /m/erp — Mobile ERP para usuarios full Studio (admin/comercial/operaciones).
 *
 * NO es para operarios PIN (esa app vive en /m/cn, /m/ve).
 * Auth: Supabase email+password regular (misma sesión que /studio).
 *
 * Portado de Claude Design v1.7 nuevo/mobile/app.jsx (56KB · Fase 1).
 * Fase 1 = layout + Home screen funcional + placeholders 4 tabs.
 *
 * Próximas fases:
 *  - Fase 2: TrackingScreen con embarques reales
 *  - Fase 3: ClientsScreen con geolocalización + lista
 *  - Fase 4: ExpensesScreen + NewExpenseModal (SDD nuevo)
 *  - Fase 5: MoreScreen con menús completos
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { listClients } from "@/lib/studio/client-queries";
import { listShipments } from "@/lib/studio/shipment-queries";
import {
  listMyExpenses,
  sumMyExpensesTodayUsd,
} from "@/lib/studio/expense-queries";
import { MobileErpClient } from "./_components/MobileErpClient";

export const metadata = {
  title: "Mobile ERP · DoorTuDoor",
  description: "Vista mobile del ERP para uso ejecutivo y comercial.",
};

export const dynamic = "force-dynamic";

export default async function MobileErpPage() {
  const supabase = await createClient();

  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) redirect("/studio/login");

  // Fetch profile + tenant + data de las tabs reales en paralelo
  const [profileRes, linkRes, shipments, clients, expenses, todaySum] =
    await Promise.all([
      supabase
        .from("user_profiles")
        .select("first_name, last_name")
        .eq("user_id", userResp.user.id)
        .maybeSingle<{ first_name: string | null; last_name: string | null }>(),
      supabase
        .from("user_tenants")
        .select("role")
        .maybeSingle<{ role: string }>(),
      listShipments(supabase, {}),
      listClients(supabase, {}),
      listMyExpenses(supabase, { limit: 50 }),
      sumMyExpensesTodayUsd(supabase),
    ]);
  const profile = profileRes.data;
  const link = linkRes.data;

  const firstName =
    profile?.first_name?.trim() ||
    userResp.user.email?.split("@")[0] ||
    "Usuario";
  const lastName = profile?.last_name?.trim() || "";
  const fullName = `${firstName} ${lastName}`.trim();
  const initials =
    (firstName[0] ?? "U").toUpperCase() +
    (lastName[0] ?? "").toUpperCase();
  const role = link?.role ?? "user";

  // Filtros: activos para Tracking (sin entregados/cancelados/borradores)
  // listShipments devuelve any[] · cast inline para satisfacer MobileShipment.
  const activeShipments = (shipments as {
    id: string;
    code: string;
    client_name: string | null;
    client_markbox: string | null;
    origin: string | null;
    destination: string | null;
    shipment_service:
      | "consolidacion"
      | "puerta_a_puerta_DDP"
      | "reserva_FCL"
      | "transporte_terrestre";
    status:
      | "draft"
      | "in_warehouse"
      | "consolidating"
      | "shipped"
      | "in_transit"
      | "in_customs"
      | "arrived_destination"
      | "delayed_warehouse"
      | "out_for_delivery"
      | "last_mile"
      | "delivered"
      | "exception"
      | "cancelled";
  }[]).filter(
    (s) =>
      s.status !== "delivered" &&
      s.status !== "cancelled" &&
      s.status !== "draft",
  );

  return (
    <MobileErpClient
      user={{
        id: userResp.user.id,
        firstName,
        fullName,
        initials,
        role,
        email: userResp.user.email ?? "",
      }}
      shipments={activeShipments}
      clients={clients}
      expenses={expenses}
      expensesTodayUsd={todaySum.total}
    />
  );
}
