/**
 * /studio/admin/alertas-telegram · A dónde llega cada aviso INTERNO.
 *
 * SDD-0606: los avisos al equipo salen por Discord —sólo lectura: la dirección
 * de cada canal vive en el servidor—. Telegram quedó retirado del Studio
 * (decisión de Sam, 2026-11-06): ya no sale ningún aviso por ahí, así que su
 * matriz de destinos (SDD-0271) dejó de mostrarse. Su código y sus tablas se
 * retiran en otra spec. La ruta conserva su nombre para no romper enlaces.
 *
 * ⚠️ No confundir con `/studio/admin/notificaciones` (SDD-0156), que configura los
 * avisos AL CLIENTE del viaje China→VE. Acá se configuran los avisos AL EQUIPO:
 * un alta de cliente, un bug crítico, el brief diario de operaciones. Audiencias
 * distintas, tablas distintas, pantallas distintas.
 *
 * Admin-only por el `layout.tsx` (requireModuleView("admin")).
 */

import { createClient } from "@/lib/db/server";
import { TELEGRAM_ALERT_CATEGORIES } from "@/lib/studio/telegram/alert-routing";
import {
  DISCORD_CHANNELS,
  DISCORD_FALLBACK_CATEGORY,
  discordCategoryStatus,
} from "@/lib/studio/discord/channels";
import { DiscordChannelsStatus } from "./_components/DiscordChannelsStatus";

export const metadata = {
  title: "Alertas del equipo · DTD Studio",
};

export const dynamic = "force-dynamic";

export default async function AlertasTelegramPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("user_tenants")
    .select("tenant_id")
    .is("disabled_at", null)
    .limit(1)
    .maybeSingle<{ tenant_id: string }>();

  // Sólo el estado de cada canal: la dirección del webhook no sale del servidor.
  const discord = discordCategoryStatus(TELEGRAM_ALERT_CATEGORIES, data?.tenant_id ?? null);

  return (
    <div style={{ maxWidth: 800 }}>
      <span className="studio-eyebrow">Administración</span>
      <h1
        className="studio-display"
        style={{ fontSize: 30, margin: "8px 0 32px", color: "var(--ink)" }}
      >
        Alertas del equipo.
      </h1>

      <DiscordChannelsStatus
        statuses={discord}
        canalRespaldo={DISCORD_CHANNELS[DISCORD_FALLBACK_CATEGORY].canal}
      />

      <h2
        style={{ font: "600 17px/1.3 var(--f-sans)", color: "var(--ink)", margin: "0 0 8px" }}
      >
        Telegram
      </h2>
      <p
        style={{
          font: "400 14px/1.6 var(--f-sans)",
          color: "var(--ink-soft)",
          margin: 0,
          maxWidth: 620,
        }}
      >
        Retirado. El Studio ya no manda ningún aviso por Telegram. Si un aviso no
        sale por Discord, igual llega por correo y a la campana del Studio.
      </p>
    </div>
  );
}
