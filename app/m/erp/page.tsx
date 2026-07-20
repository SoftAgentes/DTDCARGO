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
import {
  listLatestShipmentEvents,
  listShipments,
} from "@/lib/studio/shipment-queries";
import {
  listMyExpenses,
  signReceiptUrls,
  sumMyExpensesTodayUsd,
} from "@/lib/studio/expense-queries";
import { countMyOpenTasks } from "@/lib/studio/bitacora/bitacora-queries";
import { MobileErpClient } from "./_components/MobileErpClient";

export const metadata = {
  title: "Mobile ERP",
  description: "Vista mobile del ERP para uso ejecutivo y comercial.",
};

export const dynamic = "force-dynamic";

export default async function MobileErpPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();

  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) redirect("/studio/login");

  // Tab inicial por deep-link (`/m/erp?tab=tracking` desde ErpBottomNav en
  // las rutas hermanas, p. ej. /m/erp/bitacora).
  const sp = await searchParams;
  const rawTab = typeof sp.tab === "string" ? sp.tab : null;
  const initialTab =
    rawTab === "tracking" ||
    rawTab === "clients" ||
    rawTab === "expenses" ||
    rawTab === "more"
      ? rawTab
      : undefined;

  // Fetch profile + tenant + data de las tabs reales en paralelo
  const [profileRes, linkRes, shipments, clients, expenses, todaySum, bitacoraOpenCount] =
    await Promise.all([
      supabase
        .from("user_profiles")
        .select("first_name, last_name, operating_lat, operating_lng")
        .eq("user_id", userResp.user.id)
        .maybeSingle<{
          first_name: string | null;
          last_name: string | null;
          operating_lat: number | null;
          operating_lng: number | null;
        }>(),
      supabase
        .from("user_tenants")
        .select("role")
        .eq("user_id", userResp.user.id)
        .is("disabled_at", null)
        .limit(1)
        .maybeSingle<{ role: string }>(),
      listShipments(supabase, {}),
      listClients(supabase, {}),
      listMyExpenses(supabase, { limit: 50 }),
      sumMyExpensesTodayUsd(supabase),
      // Badge del tab Bitácora (SDD-0146): count barato head-only; degrada a 0
      // hasta que el founder aplique la migración 0212.
      countMyOpenTasks(supabase, userResp.user.id),
    ]);
  const profile = profileRes.data;
  const link = linkRes.data;

  // ── GATE de membresía (2026-07-03) ── misma regla que el layout del
  // Studio: el portal cliente comparte Supabase Auth, así que sesión válida
  // ≠ acceso al ERP móvil. Sin membership ACTIVA en user_tenants (incluye
  // desactivados) no se renderiza: cliente del portal → su portal; resto → home.
  if (!link) {
    const { data: portalClientId } = await supabase.rpc("get_portal_client_id");
    redirect(portalClientId ? "/portal" : "/");
  }

  // Signed URLs (TTL 1h) para las fotos de recibo de los expenses con receipt_path
  const receiptUrls = await signReceiptUrls(supabase, expenses);

  const firstName =
    profile?.first_name?.trim() ||
    userResp.user.email?.split("@")[0] ||
    "Usuario";
  const lastName = profile?.last_name?.trim() || "";
  const fullName = `${firstName} ${lastName}`.trim();
  const initials =
    (firstName[0] ?? "U").toUpperCase() +
    (lastName[0] ?? "").toUpperCase();
  const role = link.role;

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
      | "consolidado_lcl"
      | "puerta_a_puerta_DDP"
      | "fcl_directo"
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

  // Tracking real: último evento de shipment_events por embarque (status +
  // cuándo ocurrió). Reemplaza el "mock" de progreso por dato real de cuándo
  // se movió el embarque por última vez.
  const latestEvents = await listLatestShipmentEvents(
    supabase,
    activeShipments.map((s) => s.id),
  );
  const shipmentsWithEvents = activeShipments.map((s) => {
    const ev = latestEvents.get(s.id);
    return {
      ...s,
      last_event_status: ev?.status ?? null,
      last_event_at: ev?.occurred_at ?? null,
    };
  });

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
      shipments={shipmentsWithEvents}
      clients={clients}
      expenses={expenses}
      receiptUrls={receiptUrls}
      expensesTodayUsd={todaySum.total}
      operatingLat={profile?.operating_lat ?? null}
      operatingLng={profile?.operating_lng ?? null}
      bitacoraOpenCount={bitacoraOpenCount}
      initialTab={initialTab}
    />
  );
}
