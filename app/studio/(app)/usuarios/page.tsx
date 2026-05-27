/**
 * /studio/usuarios · Gestión de usuarios + invitaciones (SDD-0024 Fase 2).
 *
 * Server component:
 *   1. Auth + verifica admin (no-admin → redirect /studio/dashboard).
 *   2. Fetch members (con auth.admin para resolver emails) + invitations + KPIs.
 *   3. Render UsersClient (tabs Members/Invitations + filtros + drawer invitar).
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import {
  computeUserKpis,
  listInvitations,
  listMembers,
} from "@/lib/studio/user-queries";
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

  // listMembers + computeUserKpis usan admin client porque la RLS
  // de user_tenants solo permite ver el row propio (1 fila). Para mostrar
  // todos los miembros del tenant, necesitamos service_role + filter
  // explícito por tenant_id (defensa en profundidad).
  // listInvitations sigue con client regular porque user_invitations
  // RLS sí permite ver todas las del tenant.
  const supabaseAdminForListing = (() => {
    try {
      return createAdminClient();
    } catch {
      return null;
    }
  })();

  const [membersRaw, invitations, kpis] = await Promise.all([
    listMembers(supabaseAdminForListing ?? supabase, {
      tenantId: link.tenant_id,
    }),
    listInvitations(supabase),
    computeUserKpis(
      supabaseAdminForListing ?? supabase,
      supabaseAdminForListing ? link.tenant_id : undefined,
    ),
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

  return (
    <div style={{ maxWidth: 1280 }}>
      <div style={{ marginBottom: 24 }}>
        <span className="studio-eyebrow">Sistema · Equipo</span>
        <h1
          className="studio-display"
          style={{ fontSize: 30, margin: "8px 0 8px", color: "var(--ink)" }}
        >
          Usuarios
        </h1>
        <p
          style={{
            font: "400 13px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
            maxWidth: "76ch",
          }}
        >
          Miembros del tenant y sus roles. Invitá nuevos usuarios por email
          (token expira en 7 días). Hasta que el módulo de mailing esté
          activo, copiá el link de invitación a mano cuando creés una.
        </p>
      </div>

      <UsersClient
        members={members}
        invitations={invitations}
        kpis={kpis}
        currentUserId={userResp.user.id}
      />
    </div>
  );
}
