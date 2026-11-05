/**
 * Administración › Alertas del equipo · estado de los canales de Discord
 * (SDD-0606).
 *
 * Responde una sola pregunta por categoría: ¿a qué canal de Discord sale este
 * aviso HOY? La dirección de cada canal es una llave y vive en el servidor: acá
 * sólo llega el estado, nunca la dirección.
 *
 * Sólo lectura a propósito. Con un webhook por canal y los canales uno a uno
 * con las categorías, no hay nada que rutear desde la pantalla; lo que sí hace
 * falta ver es si a una categoría le falta su canal — porque entonces cae al
 * de respaldo, y eso tiene que decirse en voz alta.
 */

import { Badge } from "@/app/studio/_components/ui/Badge";
import {
  TELEGRAM_ALERT_CATEGORY_HINTS,
  TELEGRAM_ALERT_CATEGORY_LABELS,
} from "@/lib/studio/telegram/alert-routing";
import type { DiscordCategoryStatus } from "@/lib/studio/discord/channels";

interface Props {
  statuses: DiscordCategoryStatus[];
  /** Canal de respaldo, como se ve en Discord. */
  canalRespaldo: string;
}

function estado(s: DiscordCategoryStatus, canalRespaldo: string) {
  switch (s.state) {
    case "propio":
      return { tone: "success" as const, text: `Sale a ${s.canal}` };
    case "respaldo":
      return { tone: "warning" as const, text: `Sin canal propio · cae a ${canalRespaldo}` };
    case "apagado":
      return { tone: "neutral" as const, text: "Apagado en el entorno de prueba" };
    case "sin-tenant":
      return {
        tone: "neutral" as const,
        text: "Discord no está asignado a esta empresa · sigue por Telegram",
      };
    default:
      return { tone: "neutral" as const, text: "Sin Discord · sigue por Telegram" };
  }
}

export function DiscordChannelsStatus({ statuses, canalRespaldo }: Props) {
  const conDiscord = statuses.filter((s) => s.state === "propio" || s.state === "respaldo");
  const enRespaldo = statuses.filter((s) => s.state === "respaldo");
  const invalidas = statuses.filter((s) => s.invalida);
  const apagado = statuses.some((s) => s.state === "apagado");
  const sinTenant = statuses.some((s) => s.state === "sin-tenant");

  return (
    <section aria-labelledby="alertas-discord-titulo" style={{ marginBottom: 40 }}>
      <h2
        id="alertas-discord-titulo"
        style={{ font: "600 17px/1.3 var(--f-sans)", color: "var(--ink)", margin: "0 0 8px" }}
      >
        Discord
      </h2>
      <p
        style={{
          font: "400 14px/1.6 var(--f-sans)",
          color: "var(--ink-soft)",
          margin: "0 0 16px",
          maxWidth: 620,
        }}
      >
        Cada aviso sale primero al canal de Discord de su categoría, con lo mínimo:
        qué pasó, el código y el enlace al Studio. La dirección de cada canal se
        configura en el servidor, no desde esta pantalla.
      </p>

      {sinTenant && (
        <div
          role="status"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "12px 14px",
            marginBottom: 16,
            font: "400 13px/1.6 var(--f-sans)",
            color: "var(--ink)",
          }}
        >
          <b>Los canales de Discord no están asignados a esta empresa.</b> Se
          asignan en el servidor con <code>DISCORD_TENANT_ID</code>. Mientras
          tanto, los avisos siguen saliendo por Telegram.
        </div>
      )}

      {!apagado && !sinTenant && conDiscord.length === 0 && (
        <div
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "12px 14px",
            marginBottom: 16,
            font: "400 13px/1.6 var(--f-sans)",
            color: "var(--ink)",
          }}
        >
          <b>Discord todavía no está configurado.</b> Los avisos siguen saliendo por
          Telegram, como hasta ahora.
        </div>
      )}

      {enRespaldo.length > 0 && (
        <div
          role="status"
          style={{
            background: "var(--warning-bg)",
            border: "1px solid var(--warning)",
            borderRadius: 8,
            padding: "12px 14px",
            marginBottom: 16,
            font: "400 13px/1.6 var(--f-sans)",
            color: "var(--ink)",
          }}
        >
          <b>Sin canal propio todavía:</b>{" "}
          {enRespaldo.map((s) => TELEGRAM_ALERT_CATEGORY_LABELS[s.category]).join(" · ")}.
          <br />
          Mientras tanto esos avisos salen a {canalRespaldo}, para que no se pierda
          ninguno.
          {invalidas.length > 0 && (
            <>
              <br />
              La dirección guardada en el servidor no tiene forma de webhook de
              Discord en: {invalidas.map((s) => s.envVar).join(", ")}.
            </>
          )}
        </div>
      )}

      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "grid",
          gap: 8,
        }}
      >
        {statuses.map((s) => {
          const e = estado(s, canalRespaldo);
          return (
            <li
              key={s.category}
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: "14px 16px",
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <div style={{ flex: "1 1 280px", minWidth: 0 }}>
                <div style={{ font: "600 14px/1.3 var(--f-sans)", color: "var(--ink)" }}>
                  {TELEGRAM_ALERT_CATEGORY_LABELS[s.category]}
                </div>
                <div
                  style={{
                    font: "400 12.5px/1.5 var(--f-sans)",
                    color: "var(--ink-soft)",
                    marginTop: 2,
                  }}
                >
                  {TELEGRAM_ALERT_CATEGORY_HINTS[s.category]}
                </div>
              </div>
              <Badge tone={e.tone} size="sm">
                {e.text}
              </Badge>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
