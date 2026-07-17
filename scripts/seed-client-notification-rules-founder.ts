/**
 * SDD-0156 · Siembra la config REAL del founder en `client_notification_rules`
 * para el tenant DTD (reglas default = `client_id` null → aplican a todos los
 * clientes). Complementa las 4 reglas base de la migr 0247 (in_warehouse /
 * shipped / out_for_delivery / delivered) con los 3 casos del founder:
 *
 *   1. eta_set          → "va llegando" a ETA + 5 días (anchor=eta, +7200 min).
 *   2. consolidated     → aviso +2 días después de consolidar (anchor=event).
 *   3. status:in_customs→ OCULTO en el portal + dispara "cobro anticipado".
 *
 * Canal: `both` (correo + push; el push cae a solo correo si el cliente no está
 * suscrito). Idempotente: upsert por (tenant, client_id null, trigger_event) —
 * re-correrlo actualiza en vez de duplicar.
 *
 * ⚠️ Escribe en PROD (pnpm dev/tsx usa la nube xpfuzq). Correr sólo con OK del
 * founder:  pnpm tsx scripts/seed-client-notification-rules-founder.ts
 *
 * Revisión segura (NO escribe): agregá `--dry-run` → valida las reglas, resuelve
 * el tenant y muestra qué se escribiría + el estado actual, sin tocar nada:
 *   pnpm tsx scripts/seed-client-notification-rules-founder.ts --dry-run
 */
import { createClient } from "@supabase/supabase-js";
import {
  validateRuleInput,
  upsertRule,
  type UpsertRuleInput,
} from "../lib/studio/notifications/client-notification-rules-queries";

const RULES: UpsertRuleInput[] = [
  {
    // "Va llegando": 2 días ANTES del ETA (adelantarse al arribo). El motor
    // resuelve el ETA real (pod_eta SeaRates → sailings.eta → recepción VE).
    // 100% editable desde /studio/admin/notificaciones (valor · unidad · antes/
    // después · ancla) — este es solo el default sembrado.
    trigger_event: "eta_set",
    channel: "both",
    anchor: "eta",
    offset_minutes: -2 * 24 * 60, // -2880 = 2 días antes
    template_key: "va_llegando",
    custom_title: null,
    custom_body: null,
    visible_in_portal: true,
    active: true,
  },
  {
    // Al consolidar, avisar +2 días después (no al instante).
    trigger_event: "consolidated",
    channel: "both",
    anchor: "event",
    offset_minutes: 2 * 24 * 60, // +2880 = +2 días
    template_key: null,
    custom_title: "Tu envío ya está consolidado",
    custom_body:
      "Tu mercancía quedó lista en el contenedor. En los próximos días zarpa rumbo a Venezuela.",
    visible_in_portal: true,
    active: true,
  },
  {
    // En aduana: NO mostrar "llegó a aduana" (oculto) y disparar el cobro
    // anticipado en su lugar (las dos perillas en la misma fila).
    trigger_event: "status:in_customs",
    channel: "both",
    anchor: "event",
    offset_minutes: 0,
    template_key: "cobro_anticipado",
    custom_title: null,
    custom_body: null,
    visible_in_portal: false,
    active: true,
  },
];

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local",
    );
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", "dtd")
    .maybeSingle<{ id: string }>();
  if (tenantError || !tenant) {
    throw new Error("Tenant 'dtd' no existe. Aplica migración 0001 primero.");
  }

  console.log(
    dryRun
      ? `\n[DRY-RUN · NO escribe] ${RULES.length} reglas del founder para tenant dtd:`
      : `Sembrando ${RULES.length} reglas del founder en tenant dtd...`,
  );
  for (const rule of RULES) {
    // Validación SIEMPRE (también en dry-run): atrapa canal/ancla/offset/evento
    // inválidos antes de cualquier escritura.
    const validated = validateRuleInput(rule);
    if ("error" in validated) {
      throw new Error(`Regla "${rule.trigger_event}" inválida: ${validated.error}`);
    }
    if (!dryRun) {
      const res = await upsertRule(supabase, tenant.id, validated.value);
      if ("error" in res) {
        throw new Error(`Upsert "${rule.trigger_event}" falló: ${res.error}`);
      }
    }
    const vis = rule.visible_in_portal ? "visible" : "OCULTO";
    const tpl = rule.template_key ?? (rule.custom_title ? "copy propio" : "default");
    console.log(
      `  ${dryRun ? "•" : "✓"} ${rule.trigger_event.padEnd(18)} ${rule.channel} · ${
        rule.anchor
      } ${rule.offset_minutes >= 0 ? "+" : ""}${rule.offset_minutes}min · ${tpl} · ${vis}`,
    );
  }

  // Read-back: mostrar el estado final de las reglas default del tenant.
  const { data: after } = await supabase
    .from("client_notification_rules")
    .select("trigger_event, channel, anchor, offset_minutes, visible_in_portal, active")
    .eq("tenant_id", tenant.id)
    .is("client_id", null)
    .order("trigger_event", { ascending: true });
  console.log(`\nReglas default del tenant (${after?.length ?? 0}):`);
  for (const r of after ?? []) {
    console.log(`  · ${JSON.stringify(r)}`);
  }
  console.log("\nListo.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
