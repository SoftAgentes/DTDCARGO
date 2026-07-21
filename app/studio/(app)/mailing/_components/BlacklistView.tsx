"use client";

/**
 * BlacklistView · lista mail_blacklist + add/remove manual (SDD-0026 Fase 3e).
 *
 * Entries en blacklist se crean por 2 vías:
 *  - Auto: webhook handler /api/webhooks/resend al recibir email.bounced
 *    o email.complained inserta con reason='bounce'|'complaint'
 *  - Manual: admin agrega via form de este componente con reason='manual'
 *
 * sendEmail helper bloquea envíos a emails en blacklist (step 4: check).
 */

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { ConfirmDialog } from "@/app/studio/_components/ui/ConfirmDialog";
import {
  addMailBlacklistAction,
  removeMailBlacklistAction,
} from "../actions";
import {
  INITIAL_MAILING_STATE,
  type MailBlacklistRow,
} from "./mailing-types";

interface Props {
  blacklist: MailBlacklistRow[];
}

const REASON_LABELS: Record<string, string> = {
  bounce: "Rebote",
  complaint: "Spam reportado",
  manual: "Manual",
};

const REASON_TONES: Record<string, { bg: string; fg: string }> = {
  bounce: {
    bg: "var(--danger-bg, #FCEDED)",
    fg: "var(--danger, #A8323E)",
  },
  complaint: {
    bg: "var(--danger-bg, #FCEDED)",
    fg: "var(--danger, #A8323E)",
  },
  manual: {
    bg: "var(--neutral-bg, #F2F0EC)",
    fg: "var(--ink-soft, #6B6B6B)",
  },
};

export function BlacklistView({ blacklist }: Props) {
  const router = useRouter();
  const [addState, addAction, addPending] = useActionState(
    addMailBlacklistAction,
    INITIAL_MAILING_STATE,
  );
  const [removeState, removeAction, removePending] = useActionState(
    removeMailBlacklistAction,
    INITIAL_MAILING_STATE,
  );
  const [removeCandidate, setRemoveCandidate] = useState<MailBlacklistRow | null>(null);
  const [, startRemoveTransition] = useTransition();

  useEffect(() => {
    const closeFrame = removeState.ok
      ? window.requestAnimationFrame(() => setRemoveCandidate(null))
      : null;
    if (addState.ok || removeState.ok) router.refresh();
    return () => {
      if (closeFrame !== null) window.cancelAnimationFrame(closeFrame);
    };
  }, [addState.ok, removeState.ok, router]);

  const pending = addPending || removePending;

  return (
    <>
      {/* Header explicativo + form add manual */}
      <div
        style={{
          marginBottom: 20,
          padding: "14px 16px",
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: 8,
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: "var(--ink-soft)",
            marginBottom: 12,
            lineHeight: 1.5,
          }}
        >
          Emails que NO reciben más mensajes del Studio. El webhook de Resend
          agrega automáticamente los rebotes (bounce) y reportes de spam
          (complaint). También puedes agregar manualmente abajo (ej: clientes
          que pidieron no recibir más comunicaciones).
        </div>

        <form
          action={addAction}
          style={{
            display: "flex",
            gap: 8,
            alignItems: "flex-start",
            flexWrap: "wrap",
          }}
        >
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              flex: 1,
              minWidth: 240,
            }}
          >
            <span
              style={{
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "var(--ink-soft)",
              }}
            >
              Email a bloquear
            </span>
            <input
              name="email"
              type="email"
              placeholder="ej: cliente@ejemplo.com"
              disabled={pending}
              style={{
                height: 38,
                padding: "0 12px",
                border: `1px solid ${
                  addState.fieldErrors?.email
                    ? "var(--danger)"
                    : "var(--border)"
                }`,
                borderRadius: 6,
                background: "var(--bg-base)",
                color: "var(--ink)",
                fontFamily: "inherit",
                fontSize: 13,
                outline: "none",
              }}
            />
            {addState.fieldErrors?.email && (
              <span style={{ fontSize: 11, color: "var(--danger)" }}>
                {addState.fieldErrors.email}
              </span>
            )}
          </label>

          <label
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              flex: 2,
              minWidth: 280,
            }}
          >
            <span
              style={{
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "var(--ink-soft)",
              }}
            >
              Notas (opcional)
            </span>
            <input
              name="notes"
              type="text"
              placeholder="ej: pidió no recibir más por WhatsApp 2026-05-26"
              maxLength={200}
              disabled={pending}
              style={{
                height: 38,
                padding: "0 12px",
                border: "1px solid var(--border)",
                borderRadius: 6,
                background: "var(--bg-base)",
                color: "var(--ink)",
                fontFamily: "inherit",
                fontSize: 13,
                outline: "none",
              }}
            />
          </label>

          <button
            type="submit"
            disabled={pending}
            className="studio-btn studio-btn-primary"
            style={{ alignSelf: "flex-end", marginBottom: 0 }}
          >
            {addPending ? "Agregando…" : "Bloquear"}
          </button>
        </form>

        {addState.error && (
          <div
            role="alert"
            style={{
              marginTop: 10,
              padding: "8px 12px",
              background: "var(--danger-bg, #FCEDED)",
              border: "1px solid var(--danger)",
              borderRadius: 6,
              color: "var(--danger)",
              fontSize: 12,
            }}
          >
            {addState.error}
          </div>
        )}
        {addState.ok && addState.message && (
          <div
            style={{
              marginTop: 10,
              padding: "8px 12px",
              background: "var(--success-bg, #E5F4ED)",
              border: "1px solid var(--success)",
              borderRadius: 6,
              color: "var(--success)",
              fontSize: 12,
            }}
          >
            ✓ {addState.message}
          </div>
        )}
      </div>

      {blacklist.length === 0 ? (
        <EmptyState
          eyebrow="Sin entradas"
          title="La blacklist está vacía"
          description="Cuando se reciba el primer bounce o complaint vía webhook, va a aparecer acá automáticamente. También puedes agregar manualmente con el form de arriba."
        />
      ) : (
        <div
          style={{
            background: "var(--bg-surface, #FFFFFF)",
            border: "1px solid var(--border, #E8E6E2)",
            borderRadius: 8,
            overflow: "auto",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 13,
            }}
          >
            <thead>
              <tr style={{ background: "var(--bg-elevated, #F2F0EC)" }}>
                <Th>Email</Th>
                <Th>Razón</Th>
                <Th>Notas</Th>
                <Th>Agregado</Th>
                <Th>Acción</Th>
              </tr>
            </thead>
            <tbody>
              {blacklist.map((entry) => {
                const tone = REASON_TONES[entry.reason] ?? REASON_TONES.manual;
                return (
                  <tr
                    key={entry.id}
                    style={{
                      borderTop: "1px solid var(--border, #E8E6E2)",
                    }}
                  >
                    <Td>
                      <code
                        style={{
                          fontFamily: "var(--font-mono, 'JetBrains Mono')",
                          fontSize: 12,
                          color: "var(--ink)",
                        }}
                      >
                        {entry.email}
                      </code>
                    </Td>
                    <Td>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 8px",
                          background: tone.bg,
                          color: tone.fg,
                          fontSize: 11,
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          borderRadius: 4,
                        }}
                      >
                        {REASON_LABELS[entry.reason] ?? entry.reason}
                      </span>
                    </Td>
                    <Td>
                      <div
                        style={{
                          color: "var(--ink-soft)",
                          fontSize: 12,
                          maxWidth: 360,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={entry.notes ?? ""}
                      >
                        {entry.notes ?? <span>—</span>}
                      </div>
                    </Td>
                    <Td>
                      <RelTime iso={entry.added_at} />
                    </Td>
                    <Td>
                      <div>
                        <button
                          type="button"
                          disabled={pending}
                          className="studio-btn studio-btn-ghost studio-btn-xs"
                          onClick={() => setRemoveCandidate(entry)}
                          style={{ color: "var(--danger)" }}
                        >
                          Remover
                        </button>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {removeState.error && (
        <div
          role="alert"
          style={{
            marginTop: 12,
            padding: "8px 12px",
            background: "var(--danger-bg, #FCEDED)",
            border: "1px solid var(--danger)",
            borderRadius: 6,
            color: "var(--danger)",
            fontSize: 12,
          }}
        >
          {removeState.error}
        </div>
      )}
      <ConfirmDialog
        open={removeCandidate !== null}
        danger
        pending={removePending}
        title="Remover de la blacklist"
        message={
          removeCandidate
            ? `${removeCandidate.email} podrá volver a recibir correos del Studio.`
            : ""
        }
        confirmLabel="Remover"
        error={removeState.error}
        onCancel={() => setRemoveCandidate(null)}
        onConfirm={() => {
          if (!removeCandidate) return;
          const data = new FormData();
          data.set("id", removeCandidate.id);
          startRemoveTransition(() => removeAction(data));
        }}
      />
    </>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "12px 12px",
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        color: "var(--ink-soft)",
        fontWeight: 600,
      }}
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td style={{ padding: "12px 12px", verticalAlign: "top" }}>{children}</td>
  );
}

function RelTime({ iso }: { iso: string }) {
  const d = new Date(iso);
  const [now] = useState(() => Date.now());
  const diffMs = now - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const label =
    diffMin < 1
      ? "ahora"
      : diffMin < 60
        ? `${diffMin}m`
        : diffMin < 1440
          ? `${Math.floor(diffMin / 60)}h`
          : `${Math.floor(diffMin / 1440)}d`;
  return (
    <span
      title={d.toLocaleString("es-VE")}
      style={{
        color: "var(--ink-soft)",
        cursor: "help",
        textDecoration: "underline dotted",
        textDecorationColor: "var(--ink-mute, #B5B5B5)",
        textUnderlineOffset: 3,
      }}
    >
      {label}
    </span>
  );
}
