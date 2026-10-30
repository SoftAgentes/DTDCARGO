"use client";

/**
 * Tarjeta «Conversaciones en la Bandeja» de la ficha del cliente (SDD-0585, E2-D23).
 *
 * Lista las conversaciones de Chatwoot ligadas a este cliente por un cruce
 * ÚNICO del teléfono (0504): si el teléfono coincide con más de un cliente, la
 * conversación no tiene `client_id` y no aparece en ninguna ficha. Sin texto ni
 * datos del contacto: número, estado, no leídos y última actividad. «Abrir»
 * lleva a la Bandeja en esa conversación (`?c=N`).
 */
import Link from "next/link";

import { useLocale, useT } from "@/lib/i18n";
import type { I18nKey } from "@/lib/i18n/dict";
import type { ConversacionDeCliente } from "@/lib/studio/chatwoot/conversations-queries";

function fechaCorta(iso: string | null, locale: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat(locale, {
    timeZone: "America/Caracas",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function ChatwootConversacionesCard({ conversaciones }: { conversaciones: ConversacionDeCliente[] }) {
  const t = useT();
  const locale = useLocale();

  return (
    <section
      aria-labelledby="ficha-chatwoot"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: "var(--s-5)", display: "flex", flexDirection: "column", gap: "var(--s-3)" }}
    >
      <h2 id="ficha-chatwoot" style={{ font: "800 15px/1.2 var(--f-display)", color: "var(--ink)", margin: 0 }}>
        {t("bandeja.card.title")}
      </h2>
      {conversaciones.length === 0 ? (
        <p style={{ margin: 0, font: "400 13px/1.5 var(--f-sans)", color: "var(--ink-mute)" }}>{t("bandeja.card.empty")}</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
          {conversaciones.map((c) => {
            const fecha = fechaCorta(c.last_activity_at, locale);
            return (
              <li key={c.conversation_id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--s-3)", flexWrap: "wrap" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-1)", minWidth: 0 }}>
                  <span style={{ font: "600 14px/1.3 var(--f-sans)", color: "var(--ink)" }}>
                    {t("bandeja.card.conversation", { n: c.conversation_id })}
                    <span style={{ font: "500 12px/1 var(--f-sans)", color: "var(--ink-soft)", marginLeft: "var(--s-2)" }}>
                      {t(`bandeja.status.${c.status}` as I18nKey)}
                    </span>
                    {c.unread_count > 0 ? (
                      <span style={{ font: "700 12px/1 var(--f-sans)", color: "var(--wine-text)", marginLeft: "var(--s-2)" }}>
                        {t("bandeja.card.unread", { n: c.unread_count })}
                      </span>
                    ) : null}
                  </span>
                  {fecha ? (
                    <span style={{ font: "400 12px/1.3 var(--f-sans)", color: "var(--ink-mute)" }}>
                      {t("bandeja.card.last_activity", { fecha })}
                    </span>
                  ) : null}
                </div>
                <Link href={`/studio/bandeja?c=${c.conversation_id}`} className="studio-btn studio-btn-ghost studio-btn-sm">
                  {t("bandeja.card.open")}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
