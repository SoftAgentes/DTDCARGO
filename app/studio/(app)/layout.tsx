/**
 * Layout autenticado del Studio.
 *
 * Provee sidebar + topbar + auth guard.
 *
 * El proxy.ts ya hace el guard de sesión, pero acá hacemos una segunda
 * verificación server-side por defensa en profundidad: si por alguna razón
 * el proxy no corrió (CDN edge cache, etc.), no entra acá sin user.
 */

import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/session";
import { SidebarNav } from "./_components/SidebarNav";
import { Breadcrumb } from "./_components/Breadcrumb";
import { LogoutButton } from "./_components/LogoutButton";

export default async function StudioAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();
  if (!user) redirect("/studio/login");

  return (
    <div className="studio-root" style={{ display: "flex", minHeight: "100vh" }}>
      {/* Sidebar */}
      <aside
        style={{
          width: 240,
          background: "#0F1E3D",
          color: "#FFFFFF",
          padding: "20px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 4,
          flexShrink: 0,
        }}
      >
        {/* Brand mark */}
        <div
          style={{
            padding: "4px 10px 16px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            marginBottom: 8,
          }}
        >
          <div
            style={{
              font: '900 18px/1.1 "Archivo Black", sans-serif',
              letterSpacing: "-0.01em",
            }}
          >
            <span style={{ color: "#C2747F" }}>Door</span>TuDoor
          </div>
          <div
            style={{
              font: "500 10px/1 Archivo, sans-serif",
              color: "rgba(255, 255, 255, 0.5)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginTop: 5,
            }}
          >
            Studio · DTD·CARGO
          </div>
        </div>

        {/* Nav (client component con active state) */}
        <SidebarNav />

        {/* User chip + logout */}
        <div
          style={{
            marginTop: "auto",
            padding: "12px 10px",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "#C2747F",
              color: "#0F1E3D",
              display: "grid",
              placeItems: "center",
              font: '800 13px "Archivo Black", sans-serif',
              flexShrink: 0,
            }}
          >
            {user.email?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div style={{ flex: 1, minWidth: 0, font: "500 11px/1.3 Archivo, sans-serif" }}>
            <div
              style={{
                fontWeight: 700,
                color: "#FFFFFF",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {user.email}
            </div>
            <div style={{ color: "rgba(255, 255, 255, 0.5)", fontSize: 10, marginTop: 2 }}>
              Admin · DTD
            </div>
          </div>
          <LogoutButton />
        </div>
      </aside>

      {/* Body */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Topbar con breadcrumb dinámico */}
        <div
          style={{
            height: 52,
            padding: "0 28px",
            background: "#FFFFFF",
            borderBottom: "1px solid #E8E6E2",
            display: "flex",
            alignItems: "center",
          }}
        >
          <Breadcrumb />
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: 32, background: "#FBFAF7" }}>{children}</div>
      </main>
    </div>
  );
}
