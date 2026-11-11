/**
 * /studio/usuarios · Usuarios & Roles (SDD-0024 · design v1.3.1).
 *
 * Server component:
 *   1. Auth + verifica admin (no-admin → redirect /studio/dashboard).
 *   2. Fetch members (con admin client) + invitations.
 *   3. Render header + slot vacío `#users-page-actions` que UsersClient
 *      hidrata client-side con el botón [Invitar usuario].
 *   4. UsersClient maneja las tres pestañas (Personas · Roles y permisos ·
 *      Invitaciones), la ficha y el alta.
 *
 * SDD-0274: la matriz de permisos dejó de vivir en Administración y los
 * overrides se cargan acá para la pestaña Roles.
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { listInvitations, listMembers } from "@/lib/studio/user-queries";
import {
  STUDIO_USER_ROLES,
  type UserMembershipWithProfile,
} from "@/lib/studio/user-types";
import { getRoleModuleOverrides } from "@/lib/studio/role-module-overrides-queries";
import { listTenantModuleGrants } from "@/lib/studio/user-module-grants-queries";
import { isSensitiveModule } from "@/lib/studio/user-module-grants";
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

  const [membersRaw, invitations, roleModuleOverrides, moduleGrants] = await Promise.all([
    // includeDisabled: sin esto el desactivado se esfuma de la tabla y el botón
    // "Reactivar" (único unban) queda inalcanzable (hallazgo review 2026-07-02).
    listMembers(supabaseAdminForListing ?? supabase, {
      tenantId: link.tenant_id,
      includeDisabled: true,
    }),
    listInvitations(supabase),
    // SDD-0274: la matriz de permisos se mudó de Administración a la pestaña
    // «Roles y permisos» de este módulo. Mismo gate: los dos eran admin-only.
    getRoleModuleOverrides(supabase),
    // SDD-0622: accesos extra del tenant (vigentes y vencidos). La RLS de la
    // 0529 deja leer todas al admin con su sesión; sin la 0529 llega vacío.
    listTenantModuleGrants(supabase, isSensitiveModule),
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
      /**
       * SDD-0275. `user_tenants.last_login_at` lo escribe un trigger sobre
       * `auth.sessions` (migr 0019) y **tiene falsos negativos**: medido en
       * producción el 2026-08-20, dos de nueve cuentas lo tienen en `null`
       * habiendo iniciado sesión de verdad — una de ellas el 2026-06-20.
       *
       * Eso no era grave mientras la columna sólo pintaba un "Nunca" en una
       * celda. Con la banda de trabajo de SDD-0274 sí lo es: cuenta gente como
       * pendiente y ofrece **mandarle un correo de acceso a alguien que ya
       * entra**.
       *
       * `auth.users.last_sign_in_at` es la fuente de verdad de Auth y la página
       * ya la está trayendo para resolver los correos — sólo estaba sin usar.
       * Se toma la MÁS RECIENTE de las dos, que cubre tanto el `null` como una
       * columna que se haya quedado atrás. No se pierde fidelidad por tenant:
       * el propio trigger actualiza todos los tenants del user a la vez.
       */
      const loginMap = new Map<string, string | null>();
      for (const u of authUsers?.users ?? []) {
        if (u.email) emailMap.set(u.id, u.email);
        loginMap.set(u.id, u.last_sign_in_at ?? null);
      }
      members = membersRaw.map((m) => {
        const deAuth = loginMap.get(m.user_id) ?? null;
        const deTenant = m.last_login_at;
        const masReciente =
          deTenant && deAuth
            ? (new Date(deAuth) > new Date(deTenant) ? deAuth : deTenant)
            : (deTenant ?? deAuth);
        return {
          ...m,
          email: emailMap.get(m.user_id) ?? "—",
          last_login_at: masReciente,
        };
      });
    } catch {
      members = membersRaw.map((m) => ({ ...m, email: "—" }));
    }
  } else {
    members = membersRaw.map((m) => ({ ...m, email: "—" }));
  }

  const activeCount = members.filter((m) => !m.disabled_at).length;
  const roleCount = STUDIO_USER_ROLES.length; // roles oficiales del sistema

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
              margin: "var(--s-2) 0 var(--s-2)",
              color: "var(--ink)",
            }}
          >
            Usuarios y roles
          </h1>
          <p
            style={{
              font: "400 13px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: 0,
              maxWidth: "76ch",
            }}
          >
            {activeCount} {activeCount === 1 ? "persona activa" : "personas activas"} ·{" "}
            {roleCount} roles · quién es quién, qué puede ver cada rol y las
            invitaciones sin aceptar, en un solo sitio.
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
        roleModuleOverrides={roleModuleOverrides}
        grants={moduleGrants}
      />
    </div>
  );
}
