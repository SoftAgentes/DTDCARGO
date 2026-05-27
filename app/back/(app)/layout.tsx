import type { ReactNode } from "react";
import { requireAnyBackRole } from "@/lib/back/auth";
import { BackSidebar } from "./_components/BackSidebar";

/**
 * Layout protegido del back. Aplica a todo /back/(app)/* (que en URL es
 * /back, /back/servicios, /back/noticias, etc.).
 *
 * Gatekeeping:
 * - requireAnyBackRole() redirige a /back/login si falta sesión o rol.
 * - El user y sus roles se pasan al sidebar (cliente) para filtrar nav.
 *
 * El middleware.ts global ya refrescó la cookie de sesión antes de
 * llegar acá, así que el query a Supabase devuelve el JWT al día.
 */
export const metadata = {
  title: "Back · DTD Cargo",
};

export default async function BackAppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { user, roles } = await requireAnyBackRole();

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "240px 1fr",
        minHeight: "100vh",
        background: "#FBFAF7",
        fontFamily: "var(--font-archivo), Archivo, system-ui, sans-serif",
      }}
    >
      <BackSidebar user={user} roles={roles} />
      <main style={{ padding: "40px 48px", overflow: "auto" }}>
        {children}
      </main>
    </div>
  );
}
