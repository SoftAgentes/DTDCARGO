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

  // Fetch profile del user logueado · para saludo + avatar
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("first_name, last_name")
    .eq("user_id", userResp.user.id)
    .maybeSingle<{ first_name: string | null; last_name: string | null }>();

  // Fetch user_tenant para rol display
  const { data: link } = await supabase
    .from("user_tenants")
    .select("role")
    .maybeSingle<{ role: string }>();

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
    />
  );
}
