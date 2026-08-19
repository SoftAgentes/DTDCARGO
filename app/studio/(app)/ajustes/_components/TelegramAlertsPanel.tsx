"use client";

/**
 * Ajustes › Alertas de Telegram (SDD-0271).
 *
 * Una matriz destino × categoría. La pantalla existe para responder dos
 * preguntas de un vistazo:
 *
 *   1. ¿A qué chat le llega cada tipo de aviso?
 *   2. ¿Hay alguna categoría que HOY no tiene chat? — porque una ruta
 *      configurada sobre un destino sin enlazar se ve igual que una que
 *      funciona, y esa confusión es la que hace creer que un aviso se perdió.
 *      Esas categorías caen al broadcast de admins y el aviso banner lo dice.
 */

import { useState, useTransition } from "react";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { Icon } from "@/app/studio/_components/icons";
import {
  TELEGRAM_ALERT_CATEGORIES,
  TELEGRAM_ALERT_CATEGORY_LABELS,
  TELEGRAM_ALERT_CATEGORY_HINTS,
  type TelegramAlertCategory,
} from "@/lib/studio/telegram/alert-routing";
import type { TelegramDestination } from "@/lib/studio/telegram/destination-queries";
import {
  createTelegramDestinationAction,
  regenerateTelegramLinkCodeAction,
  toggleTelegramRouteAction,
  deleteTelegramDestinationAction,
} from "../actions";

interface Props {
  destinations: TelegramDestination[];
  /** Categorías sin ningún destino enlazado y activo. */
  huerfanas: TelegramAlertCategory[];
  /** `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`, para armar el link t.me. */
  botUsername: string | null;
}

export function TelegramAlertsPanel({
  destinations,
  huerfanas,
  botUsername,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [codigoNuevo, setCodigoNuevo] = useState<{ id: string; code: string } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();

  function run(
    action: (prev: Record<string, never>, fd: FormData) => Promise<{
      ok?: boolean;
      error?: string;
      linkCode?: string;
    }>,
    fd: FormData,
    onCode?: (code: string) => void,
  ) {
    setError(null);
    startTransition(async () => {
      const res = await action({}, fd);
      if (res.error) setError(res.error);
      else if (res.linkCode && onCode) onCode(res.linkCode);
    });
  }

  function toggle(
    destinationId: string,
    category: TelegramAlertCategory,
    enable: boolean,
  ) {
    const fd = new FormData();
    fd.set("destination_id", destinationId);
    fd.set("category", category);
    fd.set("enable", enable ? "1" : "0");
    run(toggleTelegramRouteAction, fd);
  }

  return (
    <section style={{ marginBottom: 40 }}>
      <h2
        className="studio-display"
        style={{ fontSize: 20, margin: "0 0 4px", color: "var(--ink)" }}
      >
        Alertas de Telegram.
      </h2>
      <p
        style={{
          font: "400 14px/1.6 var(--f-sans)",
          color: "var(--ink-soft)",
          margin: "0 0 20px",
          maxWidth: 620,
        }}
      >
        Cada aviso del sistema sale a los chats que marques acá — <b>una sola vez
        por chat</b>, aunque dos cuentas del equipo apunten al mismo Telegram.
      </p>

      {error && (
        <div
          role="alert"
          style={{
            background: "var(--danger-bg)",
            border: "1px solid var(--danger)",
            borderRadius: 8,
            padding: "10px 14px",
            marginBottom: 16,
            font: "400 13px/1.5 var(--f-sans)",
            color: "var(--danger)",
          }}
        >
          {error}
        </div>
      )}

      {huerfanas.length > 0 && (
        <div
          style={{
            background: "var(--warning-bg)",
            border: "1px solid var(--warning)",
            borderRadius: 8,
            padding: "12px 14px",
            marginBottom: 20,
            font: "400 13px/1.6 var(--f-sans)",
            color: "var(--ink)",
          }}
        >
          <b>Sin chat propio todavía:</b>{" "}
          {huerfanas.map((c) => TELEGRAM_ALERT_CATEGORY_LABELS[c]).join(" · ")}.
          <br />
          Mientras tanto esos avisos van a todos los administradores con Telegram
          enlazado, para que no se pierda ninguno.
        </div>
      )}

      <div style={{ display: "grid", gap: 16 }}>
        {destinations.map((d) => (
          <article
            key={d.id}
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: 20,
            }}
          >
            <header
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
                marginBottom: 14,
              }}
            >
              <span
                style={{
                  font: "600 15px/1.3 var(--f-sans)",
                  color: "var(--ink)",
                }}
              >
                {d.label}
              </span>
              {d.chatId ? (
                <Badge tone="success" size="xs" dot>
                  Enlazado
                  {d.telegramUsername ? ` · @${d.telegramUsername}` : ""}
                </Badge>
              ) : (
                <Badge tone="warning" size="xs" dot>
                  Pendiente de enlazar
                </Badge>
              )}
              <span style={{ flex: 1 }} />
              <button
                type="button"
                className="studio-btn studio-btn-ghost studio-btn-xs"
                disabled={pending}
                onClick={() => {
                  const fd = new FormData();
                  fd.set("destination_id", d.id);
                  run(regenerateTelegramLinkCodeAction, fd, (code) =>
                    setCodigoNuevo({ id: d.id, code }),
                  );
                }}
              >
                {Icon.refresh(13)} {d.chatId ? "Cambiar de chat" : "Código nuevo"}
              </button>
              <button
                type="button"
                className="studio-btn studio-btn-ghost studio-btn-xs"
                disabled={pending}
                onClick={() => {
                  const fd = new FormData();
                  fd.set("destination_id", d.id);
                  run(deleteTelegramDestinationAction, fd);
                }}
              >
                {Icon.trash(13)} Borrar
              </button>
            </header>

            {!d.chatId && (
              <LinkInstructions
                code={codigoNuevo?.id === d.id ? codigoNuevo.code : d.linkCode}
                botUsername={botUsername}
              />
            )}

            <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
              <legend
                style={{
                  font: "500 12px/1.4 var(--f-sans)",
                  color: "var(--ink-mute)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  padding: 0,
                  marginBottom: 10,
                }}
              >
                Qué recibe este chat
              </legend>
              <div style={{ display: "grid", gap: 10 }}>
                {TELEGRAM_ALERT_CATEGORIES.map((cat) => {
                  const on = d.categories.includes(cat);
                  return (
                    <label
                      key={cat}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 10,
                        cursor: pending ? "wait" : "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        className="studio-checkbox"
                        checked={on}
                        disabled={pending}
                        onChange={(e) => toggle(d.id, cat, e.target.checked)}
                        style={{ marginTop: 2 }}
                      />
                      <span>
                        <span
                          style={{
                            font: "500 14px/1.4 var(--f-sans)",
                            color: "var(--ink)",
                            display: "block",
                          }}
                        >
                          {TELEGRAM_ALERT_CATEGORY_LABELS[cat]}
                        </span>
                        <span
                          style={{
                            font: "400 12px/1.5 var(--f-sans)",
                            color: "var(--ink-mute)",
                          }}
                        >
                          {TELEGRAM_ALERT_CATEGORY_HINTS[cat]}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </article>
        ))}
      </div>

      <NewDestinationForm pending={pending} onSubmit={run} />
    </section>
  );
}

/** Las instrucciones de `/start <código>`, que es el ÚNICO modo de enlazar. */
function LinkInstructions({
  code,
  botUsername,
}: {
  code: string | null;
  botUsername: string | null;
}) {
  if (!code) {
    return (
      <p
        style={{
          font: "400 13px/1.6 var(--f-sans)",
          color: "var(--ink-soft)",
          margin: "0 0 16px",
        }}
      >
        Este destino no tiene código activo. Toca <b>Código nuevo</b> para generar
        uno.
      </p>
    );
  }

  const link = botUsername
    ? `https://t.me/${botUsername}?start=${code}`
    : null;

  return (
    <div
      style={{
        background: "var(--bg-base)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "12px 14px",
        marginBottom: 16,
      }}
    >
      <p
        style={{
          font: "400 13px/1.6 var(--f-sans)",
          color: "var(--ink-soft)",
          margin: "0 0 8px",
        }}
      >
        Abre Telegram <b>con la cuenta que va a recibir</b> y mándale al bot:
      </p>
      <code
        className="studio-input-mono"
        style={{
          display: "inline-block",
          font: "500 14px/1.4 var(--f-mono)",
          color: "var(--ink)",
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          padding: "6px 10px",
        }}
      >
        /start {code}
      </code>
      {link && (
        <p
          style={{
            font: "400 12px/1.5 var(--f-sans)",
            color: "var(--ink-mute)",
            margin: "8px 0 0",
          }}
        >
          O abre este enlace desde esa cuenta:{" "}
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            style={{ color: "var(--wine-text)", textDecoration: "underline" }}
          >
            {link}
          </a>
        </p>
      )}
      <p
        style={{
          font: "400 12px/1.5 var(--f-sans)",
          color: "var(--ink-mute)",
          margin: "8px 0 0",
        }}
      >
        No alcanza con el número de teléfono: el bot sólo conoce un chat cuando
        esa cuenta le escribe.
      </p>
    </div>
  );
}

function NewDestinationForm({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (
    action: (prev: Record<string, never>, fd: FormData) => Promise<{
      ok?: boolean;
      error?: string;
      linkCode?: string;
    }>,
    fd: FormData,
  ) => void;
}) {
  const [label, setLabel] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!label.trim()) return;
        const fd = new FormData();
        fd.set("label", label.trim());
        onSubmit(createTelegramDestinationAction, fd);
        setLabel("");
      }}
      style={{
        display: "flex",
        gap: 10,
        alignItems: "center",
        marginTop: 20,
        flexWrap: "wrap",
      }}
    >
      <input
        className="studio-input"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Nombre del destino (ej: Comercial y clientes)"
        maxLength={60}
        style={{ flex: "1 1 280px" }}
        aria-label="Nombre del destino de Telegram"
      />
      <button
        type="submit"
        className="studio-btn studio-btn-primary studio-btn-sm"
        disabled={pending || !label.trim()}
      >
        {Icon.plus(14)} Agregar destino
      </button>
    </form>
  );
}
