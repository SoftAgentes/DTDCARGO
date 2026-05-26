/**
 * Layout autenticado del Studio · Shell v1 (SDD-0007).
 *
 * Provee Sidebar agrupado oscuro + Topbar sticky con search/theme/user menu.
 * Auth guard server-side: el proxy.ts ya filtra, pero acá hacemos segunda
 * verificación por defensa en profundidad.
 */

import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/session";
import { StudioSidebar } from "./_components/StudioSidebar";
import { StudioTopbar } from "./_components/StudioTopbar";
import { WiringProvider } from "../_components/wiring/WiringProvider";
import { BugFABButton } from "../_components/bug-reporter/BugFABButton";

export default async function StudioAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();
  if (!user) redirect("/studio/login");

  // Build SHA del deploy (Vercel inyecta VERCEL_GIT_COMMIT_SHA en build time).
  // NEXT_PUBLIC_BUILD_SHA permite override manual. Local: undefined.
  const buildSha =
    process.env.NEXT_PUBLIC_BUILD_SHA ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    null;

  return (
    <WiringProvider>
      <div
        style={{
          display: "flex",
          minHeight: "100vh",
          background: "var(--bg-base)",
          color: "var(--ink)",
        }}
      >
        <StudioSidebar />

        <main
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
          }}
        >
          <StudioTopbar userEmail={user.email ?? ""} />
          <div
            style={{
              flex: 1,
              padding: "var(--s-6) var(--s-8)",
              maxWidth: "var(--content-max)",
              width: "100%",
              margin: "0 auto",
            }}
          >
            {children}
          </div>
        </main>
      </div>

      {/* Bug Reporter FAB · SDD-0036 Fase 2 · visible en todo el Studio */}
      <BugFABButton buildSha={buildSha} />
    </WiringProvider>
  );
}
