/**
 * /studio/usuarios · Usuarios & Roles (SDD-0024 · design v1.3.1).
 *
 * Server component:
 *   1. Auth + verifica admin (no-admin → redirect /studio/dashboard).
 *   2. Fetch members (con admin client) + invitations.
 *   3. Render header con título "Usuarios & Roles" + subtitle dinámico +
 *      slot vacío `#users-page-actions` que UsersClient hidrata client-side
 *      con los botones [Permisos por rol] + [+ Invitar usuario].
 *   4. UsersClient maneja la vista (card roles, tabla, drawer, modal).
 *
 * Sin tabs · sin KPI cards horizontales (alineado a design).
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { listInvitations, listMembers } from "@/lib/studio/user-queries";
import type { UserMembershipWithProfile } from "@/lib/studio/user-types";
import { UsersClient } from "./_components/UsersClient";

export const metadata = { title: "Usuarios · DTD Studio" };
export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const supabase = await createClient();
  const { data: userResp } = await supabase.auth.getUser();
  if (!userResp.user) redirect("/studio/login");

  const { data: link } = await supabase
    .from("user_tenants")
    .select("tenant_id, role")
    .maybeSingle<{ tenant_id: string; role: string }>();

  if (!link?.tenant_id) {
    return (
      <EmptyState
        eyebrow="Sin tenant"
        title="Tu cuenta no está vinculada a ningún tenant"
        description="Pediles a un admin que te agregue al equipo."
      />
    );
  }

  if (link.role !== "admin") {
    redirect("/studio/dashboard");
  }

  // Admin client para listMembers (RLS de user_tenants restringe a 1 row).
  const supabaseAdminForListing = (() => {
    try {
      return createAdminClient();
    } catch {
      return null;
    }
  })();

  const [membersRaw, invitations] = await Promise.all([
    listMembers(supabaseAdminForListing ?? supabase, {
      tenantId: link.tenant_id,
    }),
    listInvitations(supabase),
  ]);

  // Resolver emails de auth.users via service_role admin client.
  // La query de listMembers devuelve email='' como placeholder.
  let members: UserMembershipWithProfile[] = membersRaw;
  if (supabaseAdminForListing) {
    try {
      const { data: authUsers } = await supabaseAdminForListing.auth.admin.listUsers({
        perPage: 200,
      });
      const emailMap = new Map<string, string>();
      for (const u of authUsers?.users ?? []) {
        if (u.email) emailMap.set(u.id, u.email);
      }
      members = membersRaw.map((m) => ({
        ...m,
        email: emailMap.get(m.user_id) ?? "—",
      }));
    } catch {
      members = membersRaw.map((m) => ({ ...m, email: "—" }));
    }
  } else {
    members = membersRaw.map((m) => ({ ...m, email: "—" }));
  }

  const activeCount = members.filter((m) => !m.disabled_at).length;
  const roleCount = 6; // Roles fijos en el system (STUDIO_USER_ROLES.length)

  return (
    <div style={{ maxWidth: 1280 }}>
      {/* Page header alineado a design v1.3.1 ─── título + subtitle + slot acciones */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        <div>
          <span className="studio-eyebrow">Sistema · Equipo</span>
          <h1
            className="studio-display"
            style={{
              fontSize: 30,
              margin: "8px 0 8px",
              color: "var(--ink)",
            }}
          >
            Usuarios & Roles
          </h1>
          <p
            style={{
              font: "400 13px/1.4 var(--font-sans, 'Archivo')",
              color: "var(--ink-soft)",
              margin: 0,
              maxWidth: "76ch",
            }}
          >
            {activeCount} usuario{activeCount === 1 ? "" : "s"} interno
            {activeCount === 1 ? "" : "s"} · {roleCount} roles definidos · acceso
            por módulo configurable.
          </p>
        </div>

        {/* Slot que UsersClient hidrata client-side con los botones de acción.
            Esto evita pasar callbacks server→client y mantiene el page como
            server component. Ver UsersClient::ActionsPortal. */}
        <div
          id="users-page-actions"
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
          }}
        />
      </div>

      <UsersClient
        members={members}
        invitations={invitations}
        currentUserId={userResp.user.id}
      />
    </div>
  );
}
