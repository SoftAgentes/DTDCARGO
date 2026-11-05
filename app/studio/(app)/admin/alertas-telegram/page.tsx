/**
 * /studio/admin/alertas-telegram · A dónde llega cada aviso INTERNO.
 *
 * Dos bloques (SDD-0606): arriba Discord, que es por donde salen los avisos
 * —sólo lectura: la dirección de cada canal vive en el servidor—; abajo los
 * destinos de Telegram de SDD-0271, que quedan de respaldo hasta el corte. La
 * ruta conserva su nombre para no romper enlaces guardados.
 *
 * ⚠️ No confundir con `/studio/admin/notificaciones` (SDD-0156), que configura los
 * avisos AL CLIENTE del viaje China→VE. Acá se configuran los avisos AL EQUIPO:
 * un alta de cliente, un bug crítico, el brief diario de operaciones. Audiencias
 * distintas, tablas distintas, pantallas distintas.
 *
 * Admin-only por el `layout.tsx` (requireModuleView("admin")). Las server actions
 * revalidan su propio gate de rol: la pantalla escondida no es una barrera.
 */

import { createClient } from "@/lib/db/server";
import { TELEGRAM_ALERT_CATEGORIES } from "@/lib/studio/telegram/alert-routing";
import {
  listTelegramDestinations,
  categoriesWithoutLiveDestination,
} from "@/lib/studio/telegram/destination-queries";
import {
  DISCORD_CHANNELS,
  DISCORD_FALLBACK_CATEGORY,
  discordCategoryStatus,
} from "@/lib/studio/discord/channels";
import { TelegramAlertsPanel } from "./_components/TelegramAlertsPanel";
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

  const destinations = data?.tenant_id
    ? await listTelegramDestinations(supabase, data.tenant_id)
    : [];

  const huerfanas = categoriesWithoutLiveDestination(
    destinations,
    TELEGRAM_ALERT_CATEGORIES,
  );

  // Sólo el estado de cada canal: la dirección del webhook no sale del servidor.
  const discord = discordCategoryStatus(TELEGRAM_ALERT_CATEGORIES, data?.tenant_id ?? null);
  const discordActivo = discord.some(
    (s) => s.state === "propio" || s.state === "respaldo",
  );

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
          margin: "0 0 16px",
          maxWidth: 620,
        }}
      >
        {discordActivo
          ? "Queda de respaldo: sólo se usa si Discord no entrega un aviso. Se retira cuando termine el paso a Discord."
          : "Es por donde salen los avisos hoy, hasta que Discord quede configurado."}
      </p>

      <TelegramAlertsPanel
        destinations={destinations}
        huerfanas={huerfanas}
        botUsername={process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? null}
      />
    </div>
  );
}
