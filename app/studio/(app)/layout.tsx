/**
 * Layout autenticado del Studio · Shell v1 (SDD-0007).
 *
 * Provee Sidebar agrupado oscuro + Topbar sticky con search/theme/user menu.
 * Auth guard server-side: el proxy.ts filtra SESIÓN; acá además se exige
 * membership activa en user_tenants (sesión del portal ≠ acceso al Studio).
 *
 * i18n: resuelve locale y region UNA vez por request leyendo
 * user_tenants.region + user_profiles.locale + Accept-Language. El
 * LocaleProvider client maneja el override URL `?lang=cn|es`.
 */

import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { listFeatureFlags } from "@/lib/studio/feature-flags-queries";
import { countActiveAlerts } from "@/lib/studio/expense-alerts-queries";
import { listNotificationsForUser } from "@/lib/studio/bug-queries";
import { listUnreadConversationsForBadge } from "@/lib/studio/conversaciones/conversations-queries";
import type { BugNotification } from "@/lib/studio/bug-types";
import { resolveLocale } from "@/lib/i18n/resolve-server";
import { LocaleProvider } from "@/lib/i18n";
import { StudioSidebar } from "./_components/StudioSidebar";
import { StudioTopbar } from "./_components/StudioTopbar";
import type { StudioUserRole, WarehouseScope } from "@/lib/studio/user-types";
import { WiringProvider } from "../_components/wiring/WiringProvider";
import { ToastProvider } from "../_components/ui/ToastProvider";
import { BugFABButton } from "../_components/bug-reporter/BugFABButton";
import { BugTechCaptureProvider } from "../_components/bug-reporter/BugTechCaptureProvider";
import { EnvBanner } from "../_components/EnvBanner";
import { Suspense } from "react";
import { DeniedToast } from "./_components/DeniedToast";

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

  // Resolver la región del user via user_tenants.region (migración 0052).
  // Un user puede estar en N tenants — para V1 tomamos el primero (suficiente
  // mientras el Studio sea single-tenant por sesión; cuando haya tenant
  // switcher, leer del switcher activo).
  // select("*") a propósito: warehouse_scope (migr 0202) puede no existir aún
  // → la query no rompe y el scope degrada a 'all' (SDD-0139).
  const { data: tenantLink } = await supabase
    .from("user_tenants")
    .select("*")
    .eq("user_id", user.id)
    .is("disabled_at", null)
    .limit(1)
    .maybeSingle<{
      tenant_id: string;
      region: string | null;
      role: string | null;
      warehouse_scope?: string | null;
    }>();

  // ── GATE de membresía (2026-07-03) ────────────────────────────────
  // Sesión válida ≠ acceso al Studio: el portal cliente comparte el mismo
  // Supabase Auth, así que un cliente logueado pasaba el proxy (solo chequea
  // sesión) y renderizaba el shell del ERP con sidebar vacío. Sin membership
  // ACTIVA en user_tenants no hay Studio — mismo patrón que
  // requireAnyBackRole() en el Back. Cliente del portal → su portal;
  // cualquier otra sesión sin rol (incluye desactivados, SDD-0139) → home.
  if (!tenantLink) {
    const { data: portalClientId } = await supabase.rpc("get_portal_client_id");
    redirect(portalClientId ? "/portal" : "/");
  }

  // Rol del user — el sidebar lo usa para esconder los módulos que el rol no
  // puede ver (matriz ROLE_MODULE_ACCESS, SDD-0085). El gate real de seguridad
  // está en cada page.tsx (requireModuleView); esto solo evita mostrar un link
  // que daría redirect. `null` = sin membership (fail-closed en el sidebar).
  const role = (tenantLink?.role ?? null) as StudioUserRole | null;
  // Scope de almacén (SDD-0139): el sidebar esconde los módulos del lado que
  // el usuario no tiene asignado (cn/cola-qr/etiquetas vs ve).
  const warehouseScope: WarehouseScope =
    tenantLink?.warehouse_scope === "cn" || tenantLink?.warehouse_scope === "ve"
      ? tenantLink.warehouse_scope
      : "all";

  // Resolver locale activo. El override URL `?lang=` se aplica client-side
  // en LocaleProvider.
  const { locale, region } = await resolveLocale({
    userProfileLocale: profile?.locale ?? null,
    userTenantRegion: tenantLink?.region ?? null,
  });

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
  // En paralelo: count de alertas de gastos activas (badge sidebar · RLS
  // ya lo scopea al tenant y al rol — un VE no-accounting ve 0).
  const [
    featureFlags,
    expenseAlertCount,
    initialNotifications,
    initialUnreadConversations,
  ] = await Promise.all([
    listFeatureFlags(supabase),
    countActiveAlerts(supabase),
    // Campanita in-app (SDD-0036 Fase 5): outbox del user, RLS lo scopea a
    // auth.uid(). Best-effort — un fallo no debe tumbar el shell.
    listNotificationsForUser(supabase, user.id, { limit: 20 }).catch(
      () => [] as BugNotification[],
    ),
    // Badge de Conversaciones sin leer del topbar (SDD-0148). RLS scopea al
    // tenant. Best-effort — un fallo no debe tumbar el shell.
    listUnreadConversationsForBadge(supabase).catch(
      () => [] as { id: string; unread_count: number }[],
    ),
  ]);

  return (
    <LocaleProvider locale={locale} region={region}>
      <ToastProvider>
        <WiringProvider profileInitial={profileInitial} buildSha={buildSha}>
          <div
            style={{
              display: "flex",
              minHeight: "100vh",
              // Fondo de página con glow tonal sutil (BD-034 · --grad-page) en vez
              // de plano. Incluye --bg-base como capa base, así que no cambia el color.
              background: "var(--grad-page)",
              color: "var(--ink)",
            }}
          >
            <StudioSidebar
              featureFlags={featureFlags}
              expenseAlertCount={expenseAlertCount}
              role={role}
              warehouseScope={warehouseScope}
            />

            <main
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                minWidth: 0,
              }}
            >
              <EnvBanner />
              <StudioTopbar
                userEmail={user.email ?? ""}
                userId={user.id}
                initialNotifications={initialNotifications}
                conversationsTenantId={tenantLink?.tenant_id ?? null}
                initialUnreadConversations={initialUnreadConversations}
              />
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

          {/* Bug Reporter · SDD-0036 · la captura técnica corre siempre; el FAB
              queda OCULTO por defecto (se enciende con Alt+B). El modal lo
              hostea WiringProvider · entrada canónica = menú de perfil. */}
          <BugTechCaptureProvider />
          <BugFABButton />
          {/* RBAC: aviso cuando requireModuleView redirige por falta de acceso. */}
          <Suspense fallback={null}>
            <DeniedToast />
          </Suspense>
        </WiringProvider>
      </ToastProvider>
    </LocaleProvider>
  );
}
