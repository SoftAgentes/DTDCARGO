/**
 * Marco de Administración (SDD-0708, opción B «el menú acompaña»).
 *
 * Pinta el menú lateral alrededor de TODAS las pantallas de `/studio/admin/*`,
 * para que un clic en el menú lleve a la pantalla real sin perder el menú. El
 * encabezado «Administración» sale solo en `/studio/admin` (`AdminHeader`): en
 * las subrutas cada página trae su propio título.
 *
 * No es una guardia: cada página y cada subcarpeta conservan la suya. Este
 * layout solo decide si pinta el marco. `/studio/admin/rutas` es del módulo
 * `admin-rutas` y la usa `operations`: a quien no pasa `admin` se le entrega la
 * página sola, igual que antes.
 */
import { Suspense } from "react";
import { createClient } from "@/lib/db/server";
import { canAccessModule } from "@/lib/studio/rbac";
import { getStudioAccess } from "@/lib/studio/rbac-guard";
import { isPlatformAdmin } from "@/lib/studio/platform-admin";
import { AdminHeader } from "./_components/AdminHeader";
import { AdminNav } from "./_components/AdminNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { role, overrides, grants } = await getStudioAccess(supabase);
  if (!canAccessModule(role, "admin", overrides, grants)) return <>{children}</>;
  const isSuperadmin = await isPlatformAdmin(supabase);

  return (
    <div style={{ maxWidth: 1280 }}>
      <Suspense fallback={null}>
        <AdminHeader />
      </Suspense>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "240px minmax(0, 1fr)",
          gap: 16,
          alignItems: "flex-start",
        }}
      >
        <Suspense fallback={<div />}>
          <AdminNav isSuperadmin={isSuperadmin} />
        </Suspense>
        <div style={{ minWidth: 0 }}>{children}</div>
      </div>
    </div>
  );
}
