/**
 * Marco de Administración (SDD-0708, opción B «el menú acompaña»).
 *
 * Pinta el encabezado y el menú lateral alrededor de TODAS las pantallas de
 * `/studio/admin/*`, para que un clic en el menú lleve a la pantalla real sin
 * perder el menú.
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
import { AdminNav } from "./_components/AdminNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { role, overrides, grants } = await getStudioAccess(supabase);
  if (!canAccessModule(role, "admin", overrides, grants)) return <>{children}</>;
  const isSuperadmin = await isPlatformAdmin(supabase);

  return (
    <div style={{ maxWidth: 1280 }}>
      <header
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div className="studio-eyebrow" style={{ marginBottom: 10 }}>
            Configuración · Studio
          </div>
          <h1
            className="studio-display"
            style={{ fontSize: 28, margin: "0 0 6px", color: "var(--ink)", letterSpacing: "-0.01em" }}
          >
            Administración
          </h1>
          <p style={{ font: "400 13px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: 0, maxWidth: "72ch" }}>
            Configuración global del Studio. Solo accesible para rol Admin.
          </p>
        </div>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 10px",
            background: "var(--bg-elevated)",
            color: "var(--ink)",
            borderRadius: "var(--r-pill)",
            font: "700 11px/1 var(--f-sans)",
            letterSpacing: "0.04em",
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--ink-soft)" }} />
          Acceso restringido · Admin
        </span>
      </header>

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
