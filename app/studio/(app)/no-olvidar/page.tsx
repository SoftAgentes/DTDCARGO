/**
 * /studio/no-olvidar — vista principal del No-Olvidar (SDD-0025 Fase 3).
 *
 * Server component. Cadena de gates:
 *   1. no auth            → /studio
 *   2. sin fila user_keys → /studio (no es empleado dtd-cargo)
 *   3. setup incompleto   → /studio/no-olvidar/setup
 *   4. sesión expirada    → /studio/no-olvidar/2fa
 *   5. OK                 → lista desbloqueada
 *
 * El módulo YA está gateado por RBAC en layout.tsx (requireModuleView). Acá
 * solo mandamos metadata al cliente: el plaintext se revela lazy vía
 * revealItemAction. El módulo depende de las migraciones 0250-0252 + KEK creada
 * (runbook §1-2) para funcionar en runtime.
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import {
  computeNoOlvidarKpis,
  getUserKeys,
  isNoOlvidarAdmin,
  listItems,
} from "@/lib/studio/no-olvidar-queries";
import { isSessionExpired, toItemMeta, type NoOlvidarConfig } from "@/lib/studio/no-olvidar-types";
import { NoOlvidarKpis } from "./_components/NoOlvidarKpis";
import { NoOlvidarClient } from "./_components/NoOlvidarClient";

export const metadata = { title: "No-Olvidar" };

export default async function NoOlvidarPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/studio");

  const keys = await getUserKeys(supabase);
  if (!keys) redirect("/studio");
  if (!keys.setup_completed) redirect("/studio/no-olvidar/setup");

  const { data: config } = await supabase
    .from("no_olvidar_config")
    .select("*")
    .eq("id", 1)
    .maybeSingle<NoOlvidarConfig>();

  const timeout = config?.session_timeout_minutes ?? 30;
  if (isSessionExpired(keys.last_unlock_at, timeout)) {
    redirect("/studio/no-olvidar/2fa?next=/studio/no-olvidar");
  }

  const [items, kpis, isAdmin] = await Promise.all([
    listItems(supabase),
    computeNoOlvidarKpis(supabase),
    isNoOlvidarAdmin(supabase, auth.user.id),
  ]);

  const revealConfig = {
    holdToReveal: config?.hold_to_reveal ?? true,
    autoHideSeconds: config?.reveal_auto_hide_seconds ?? 3,
    blurOnWindowBlur: config?.blur_on_window_blur ?? true,
    forensicWatermark: config?.forensic_watermark ?? true,
    blockCopyEvent: config?.block_copy_event ?? true,
    charByChar: config?.char_by_char_reveal ?? false,
    clipboardClearSeconds: config?.clipboard_clear_seconds ?? 30,
  };

  const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
  const watermarkLabel = `${auth.user.email ?? "empleado"} · ${stamp}`;

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 22 }}>
        <span className="studio-eyebrow">Interno · DTD Cargo</span>
        <h1 className="studio-display" style={{ fontSize: 30, margin: "8px 0 8px", color: "var(--ink)" }}>
          No-Olvidar
        </h1>
        <p style={{ font: "400 13px/1.4 var(--f-sans)", color: "var(--ink-soft)", margin: 0, maxWidth: "72ch" }}>
          Caja fuerte interna de contraseñas y secretos. Cada item se cifra con
          envelope encryption; solo tú lo ves. Si pierdes el acceso, dos admins
          pueden ayudarte a recuperarlo (recovery M-of-N).
        </p>
      </div>

      <NoOlvidarKpis kpis={kpis} />

      <NoOlvidarClient
        items={items.map(toItemMeta)}
        isAdmin={isAdmin}
        sessionTimeoutMinutes={timeout}
        lastUnlockAt={keys.last_unlock_at}
        revealConfig={revealConfig}
        watermarkLabel={watermarkLabel}
      />
    </div>
  );
}
