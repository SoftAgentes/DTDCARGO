"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import type { BackRole } from "@/lib/back/auth";
import { signOut } from "../actions";

type NavItem = {
  href: string;
  label: string;
  icon: string;
  /** Si está definido, solo se muestra a estos roles. Si omitido, visible a todos. */
  roles?: readonly BackRole[];
};

const NAV: readonly NavItem[] = [
  { href: "/back", label: "Dashboard", icon: "▦" },
  { href: "/back/servicios", label: "Servicios", icon: "▤", roles: ["admin", "disenador", "editor"] },
  { href: "/back/noticias", label: "Noticias", icon: "✎", roles: ["admin", "editor"] },
  { href: "/back/glosario", label: "Glosario", icon: "≡", roles: ["admin", "editor"] },
  { href: "/back/leads", label: "Leads", icon: "✉", roles: ["admin"] },
  { href: "/back/assets", label: "Media", icon: "▣", roles: ["admin", "disenador"] },
  { href: "/back/users", label: "Usuarios", icon: "◍", roles: ["admin"] },
  { href: "/back/settings", label: "Settings", icon: "✸", roles: ["admin"] },
] as const;

/**
 * Sidebar del back (cliente). Filtra los nav items según los roles
 * del user — si no podés hacer algo, no lo ves en el menú.
 *
 * RLS de Supabase + helpers requireBackRole() son la defensa real;
 * el filtrado acá es solo UX para no confundir al user con links
 * a los que va a recibir un redirect.
 */
export function BackSidebar({
  user,
  roles,
}: {
  user: User;
  roles: BackRole[];
}) {
  const pathname = usePathname();

  const visibleItems = NAV.filter(
    (n) => !n.roles || n.roles.some((r) => roles.includes(r)),
  );

  return (
    <aside
      style={{
        background: "#0F1E3D",
        color: "white",
        padding: "24px 16px",
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        position: "sticky",
        top: 0,
        overflowY: "auto",
      }}
    >
      {/* Brand */}
      <Link
        href="/back"
        style={{
          color: "white",
          textDecoration: "none",
          padding: "0 8px 24px",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          display: "block",
        }}
      >
        <div style={{ font: "900 20px/1 'Archivo Black', Archivo, sans-serif", letterSpacing: "-0.02em" }}>
          <span style={{ color: "#C2747F" }}>DTD</span>{" "}
          <span style={{ color: "white" }}>Cargo</span>
        </div>
        <div
          style={{
            font: "700 9.5px/1.4 Archivo, sans-serif",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.45)",
            marginTop: 6,
          }}
        >
          Back · contenido
        </div>
      </Link>

      {/* Nav */}
      <nav
        style={{
          flex: 1,
          paddingTop: 24,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {visibleItems.map((n) => {
          const active =
            pathname === n.href ||
            (n.href !== "/back" && pathname.startsWith(n.href + "/")) ||
            (n.href !== "/back" && pathname === n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                color: active ? "white" : "rgba(255,255,255,0.65)",
                background: active ? "rgba(194,116,127,0.15)" : "transparent",
                borderLeft: active ? "2px solid #C2747F" : "2px solid transparent",
                textDecoration: "none",
                font: "500 13.5px/1.2 Archivo, sans-serif",
                display: "flex",
                alignItems: "center",
                gap: 10,
                transition: "background 0.12s",
              }}
            >
              <span style={{ width: 18, textAlign: "center", opacity: 0.65, fontFamily: "Archivo, sans-serif" }}>
                {n.icon}
              </span>
              {n.label}
            </Link>
          );
        })}
      </nav>

      {/* User + signout */}
      <div
        style={{
          padding: "16px 8px 0",
          borderTop: "1px solid rgba(255,255,255,0.1)",
          marginTop: 16,
        }}
      >
        <div
          style={{
            font: "600 12px/1.3 Archivo, sans-serif",
            color: "rgba(255,255,255,0.85)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={user.email ?? ""}
        >
          {user.email}
        </div>
        <div
          style={{
            font: "500 10.5px/1.3 Archivo, sans-serif",
            color: "rgba(255,255,255,0.5)",
            marginTop: 2,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          {roles.join(" · ")}
        </div>
        <form action={signOut} style={{ marginTop: 12 }}>
          <button
            type="submit"
            style={{
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 6,
              padding: "6px 10px",
              color: "rgba(255,255,255,0.65)",
              font: "500 11.5px/1 Archivo, sans-serif",
              cursor: "pointer",
              width: "100%",
            }}
          >
            Cerrar sesión
          </button>
        </form>
      </div>
    </aside>
  );
}
