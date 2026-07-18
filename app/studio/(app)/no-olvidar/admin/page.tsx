/**
 * /studio/no-olvidar/admin — panel de administración del No-Olvidar (SDD-0025).
 *
 * Solo admins del módulo (no_olvidar_check_admin). Un member que llegue acá se
 * redirige a la vista normal. Reúne: pedidos de recuperación (aprobar M-of-N,
 * rechazar, ejecutar), configuración, versiones de KEK (+ rotar) y bitácora de
 * acceso. Las escrituras van por server actions con re-chequeo de admin.
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import {
  isNoOlvidarAdmin,
  listAccessLog,
  listKekVersions,
  listRecoveryRequests,
} from "@/lib/studio/no-olvidar-queries";
import type { NoOlvidarConfig } from "@/lib/studio/no-olvidar-types";
import { AdminClient } from "./_components/AdminClient";

export const metadata = { title: "No-Olvidar · Administración" };

export default async function NoOlvidarAdminPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/studio");

  const admin = await isNoOlvidarAdmin(supabase, auth.user.id);
  if (!admin) redirect("/studio/no-olvidar");

  const [requests, kekVersions, accessLog, configResp] = await Promise.all([
    listRecoveryRequests(supabase, { limit: 30 }),
    listKekVersions(supabase),
    listAccessLog(supabase, { limit: 40 }),
    supabase.from("no_olvidar_config").select("*").eq("id", 1).maybeSingle<NoOlvidarConfig>(),
  ]);

  return (
    <div style={{ maxWidth: 960 }}>
      <div style={{ marginBottom: 22 }}>
        <span className="studio-eyebrow">No-Olvidar · Administración</span>
        <h1 className="studio-display" style={{ fontSize: 28, margin: "8px 0 8px", color: "var(--ink)" }}>
          Panel de administración
        </h1>
        <p style={{ font: "400 13px/1.4 var(--f-sans)", color: "var(--ink-soft)", margin: 0, maxWidth: "72ch" }}>
          Recuperaciones custodiales (M-of-N), política del módulo, rotación de la
          llave maestra (KEK) y la bitácora de acceso inmutable.
        </p>
      </div>

      <AdminClient
        currentUserId={auth.user.id}
        requests={requests}
        kekVersions={kekVersions}
        accessLog={accessLog}
        config={configResp.data ?? null}
      />
    </div>
  );
}
