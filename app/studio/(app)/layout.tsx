/**
 * Layout autenticado del Studio · Shell v1 (SDD-0007).
 *
 * Provee Sidebar agrupado oscuro + Topbar sticky con search/theme/user menu.
 * Auth guard server-side: el proxy.ts ya filtra, pero acá hacemos segunda
 * verificación por defensa en profundidad.
 */

import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { listFeatureFlags } from "@/lib/studio/feature-flags-queries";
import { StudioSidebar } from "./_components/StudioSidebar";
import { StudioTopbar } from "./_components/StudioTopbar";
import { WiringProvider } from "../_components/wiring/WiringProvider";
import { BugFABButton } from "../_components/bug-reporter/BugFABButton";
import { BugTechCaptureProvider } from "../_components/bug-reporter/BugTechCaptureProvider";

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

  // Cargar profile real del user logueado para alimentar el ProfileModal
  // del topbar (WiringProvider). Si la row no existe todavía, defaults nulos.
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("user_profiles")
    .select(
      "first_name, last_name, phone, locale, timezone, operating_lat, operating_lng, telegram_chat_id, telegram_username",
    )
    .eq("user_id", user.id)
    .maybeSingle<{
      first_name: string | null;
      last_name: string | null;
      phone: string | null;
      locale: string | null;
      timezone: string | null;
      operating_lat: number | null;
      operating_lng: number | null;
      telegram_chat_id: string | null;
      telegram_username: string | null;
    }>();

  const profileInitial = {
    email: user.email ?? "",
    firstName: profile?.first_name ?? null,
    lastName: profile?.last_name ?? null,
    phone: profile?.phone ?? null,
    locale: profile?.locale ?? null,
    timezone: profile?.timezone ?? null,
    operatingLat: profile?.operating_lat ?? null,
    operatingLng: profile?.operating_lng ?? null,
    telegramChatId: profile?.telegram_chat_id ?? null,
    telegramUsername: profile?.telegram_username ?? null,
    telegramBotUsername: process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? null,
  };

  // Feature flags del tenant (Tier 1.2). El sidebar los usa para esconder
  // módulos que el tenant no quiere ver (ej: seniat OFF, no-olvidar OFF, etc.).
  // Si falla, cae a defaults del handoff v1.7.
  const featureFlags = await listFeatureFlags(supabase);

  return (
    <WiringProvider profileInitial={profileInitial}>
      <div
        style={{
          display: "flex",
          minHeight: "100vh",
          background: "var(--bg-base)",
          color: "var(--ink)",
        }}
      >
        <StudioSidebar featureFlags={featureFlags} />

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

      {/* Bug Reporter · SDD-0036 · visible en todo el Studio */}
      {/* Provider (sin UI) instala listeners de error/network para tech_data */}
      <BugTechCaptureProvider />
      <BugFABButton buildSha={buildSha} />
    </WiringProvider>
  );
}
