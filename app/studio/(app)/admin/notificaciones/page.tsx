/**
 * /studio/admin/notificaciones · Config de avisos al cliente (SDD-0156 · B).
 *
 * Por cada evento del journey China→VE el admin define canal · cuándo (ancla +
 * offset) · texto · visibilidad en el portal. Scope: reglas por defecto del
 * tenant, o override para un cliente puntual (`?client=<id>`).
 *
 * Admin-only (redirect si no). RLS por tenant en client_notification_rules.
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/db/server";
import { listRules } from "@/lib/studio/notifications/client-notification-rules-queries";
import { NotificationsClient } from "./_components/NotificationsClient";

export const metadata = { title: "Notificaciones al cliente · DTD Studio" };
export const dynamic = "force-dynamic";

interface ClientRow {
  id: string;
  markbox: string | null;
  name: string | null;
}

export default async function NotificacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const { client: clientParam } = await searchParams;
  const supabase = await createClient();

  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) redirect("/studio/login");

  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id, role")
    .maybeSingle<{ tenant_id: string; role: string }>();
  if (!link?.tenant_id) redirect("/studio/dashboard");
  if (link.role !== "admin") redirect("/studio/admin");

  const selectedClientId = clientParam?.trim() || null;

  const [defaultRules, overrideRules, clientsRaw] = await Promise.all([
    listRules(supabase, link.tenant_id, null),
    selectedClientId
      ? listRules(supabase, link.tenant_id, selectedClientId)
      : Promise.resolve([]),
    supabase
      .from("clients")
      .select("id, markbox, name")
      .eq("tenant_id", link.tenant_id)
      .is("deleted_at", null)
      .order("markbox", { ascending: true })
      .limit(1000),
  ]);

  const clients = (clientsRaw.data ?? []) as ClientRow[];

  return (
    <div style={{ maxWidth: 1040 }}>
      <div
        style={{
          marginBottom: "var(--s-6)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <Link
          href="/studio/admin"
          style={{
            font: "500 12px/1 var(--font-sans, 'Archivo')",
            color: "var(--ink-soft)",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          ← Administración
        </Link>
        <Link
          href="/studio/admin/notificaciones/estado"
          style={{
            font: "500 12px/1 var(--font-sans, 'Archivo')",
            color: "var(--ink-soft)",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          Estado del motor de avisos →
        </Link>
      </div>

      <NotificationsClient
        defaultRules={defaultRules}
        overrideRules={overrideRules}
        clients={clients}
        selectedClientId={selectedClientId}
      />
    </div>
  );
}
