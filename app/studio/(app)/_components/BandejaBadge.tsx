"use client";

/**
 * Badge del item «Bandeja» del sidebar (SDD-0585, E2-D21): conversaciones de
 * Chatwoot abiertas con no leídos. Arranca con lo que trajo el layout y se
 * mantiene vivo con Supabase Realtime sobre `chatwoot_conversations` (0504),
 * que el webhook y la reconciliación actualizan. Sin texto ni datos del contacto.
 */
import { useT } from "@/lib/i18n";
import { useRealtimeTable } from "@/lib/studio/hooks/use-realtime-table";
import { contarNoLeidas, type ConversacionNoLeida } from "@/lib/studio/chatwoot/conversations-queries";

export function BandejaBadge({ tenantId, initial }: { tenantId: string; initial: ConversacionNoLeida[] }) {
  const t = useT();
  const { data } = useRealtimeTable<ConversacionNoLeida>({
    table: "chatwoot_conversations",
    filter: `tenant_id=eq.${tenantId}`,
    initial,
  });
  const n = contarNoLeidas(data);
  if (n === 0) return null;
  return (
    <span
      aria-label={t("bandeja.badge.aria", { n })}
      style={{
        minWidth: 18,
        height: 18,
        padding: "0 5px",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 9,
        background: "var(--wine)",
        // Sobre vino (oscuro en los dos temas) va la tinta «side», blanca en
        // ambos; la invertida da 2,51 en Oscuro (dark-theme-contrast-contract).
        color: "var(--ink-side-strong)",
        font: "800 10px/1 var(--f-mono)",
        flexShrink: 0,
      }}
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}
