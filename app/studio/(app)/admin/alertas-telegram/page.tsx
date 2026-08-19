/**
 * /studio/admin/alertas-telegram · A qué chat llega cada aviso INTERNO (SDD-0271).
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
import { TelegramAlertsPanel } from "./_components/TelegramAlertsPanel";

export const metadata = {
  title: "Alertas de Telegram · DTD Studio",
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

  return (
    <div style={{ maxWidth: 800 }}>
      <span className="studio-eyebrow">Administración</span>
      <h1
        className="studio-display"
        style={{ fontSize: 30, margin: "8px 0 32px", color: "var(--ink)" }}
      >
        Alertas de Telegram.
      </h1>

      <TelegramAlertsPanel
        destinations={destinations}
        huerfanas={huerfanas}
        botUsername={process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? null}
      />
    </div>
  );
}
