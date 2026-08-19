/**
 * Ajustes del Studio.
 *
 * Primera configuración real que aterriza acá: las alertas de Telegram
 * (SDD-0271). El resto —tarifas, integraciones, equipo, branding— sigue
 * pendiente de sus propios SDD.
 *
 * Gate por ROL, no por módulo: `ajustes` no está en la matriz RBAC (no es un
 * módulo registrado). El gate de fondo es la RLS admin-only de la migr 0386;
 * esto evita mostrar una pantalla que no va a poder guardar nada.
 */

import { createClient } from "@/lib/db/server";
import { getStudioRole } from "@/lib/studio/rbac-guard";
import { TELEGRAM_ALERT_CATEGORIES } from "@/lib/studio/telegram/alert-routing";
import {
  listTelegramDestinations,
  categoriesWithoutLiveDestination,
} from "@/lib/studio/telegram/destination-queries";
import { TelegramAlertsPanel } from "./_components/TelegramAlertsPanel";

export const metadata = {
  title: "Ajustes",
};

export default async function AjustesPage() {
  const supabase = await createClient();
  const role = await getStudioRole(supabase);
  const isAdmin = role === "admin";

  let destinations: Awaited<ReturnType<typeof listTelegramDestinations>> = [];
  if (isAdmin) {
    const { data } = await supabase
      .from("user_tenants")
      .select("tenant_id")
      .is("disabled_at", null)
      .limit(1)
      .maybeSingle<{ tenant_id: string }>();
    if (data?.tenant_id) {
      destinations = await listTelegramDestinations(supabase, data.tenant_id);
    }
  }

  const huerfanas = categoriesWithoutLiveDestination(
    destinations,
    TELEGRAM_ALERT_CATEGORIES,
  );

  return (
    <div style={{ maxWidth: 800 }}>
      <span className="studio-eyebrow">Configuración</span>
      <h1
        className="studio-display"
        style={{ fontSize: 30, margin: "8px 0 32px", color: "var(--ink)" }}
      >
        Ajustes.
      </h1>

      {isAdmin && (
        <TelegramAlertsPanel
          destinations={destinations}
          huerfanas={huerfanas}
          botUsername={process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? null}
        />
      )}

      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: 28,
        }}
      >
        <p
          style={{
            font: "400 14px/1.6 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
          }}
        >
          {isAdmin
            ? "Tarifas, integraciones, gestión de equipo y branding del tenant vendrán en SDDs futuros."
            : "Las alertas de Telegram y el resto de la configuración del tenant las administra un administrador."}
        </p>
      </div>
    </div>
  );
}
