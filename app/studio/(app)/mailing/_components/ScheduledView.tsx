"use client";

/**
 * ScheduledView · Mailing → Programados (SDD-0140 Slice D).
 *
 * Cola de correos programados portada del Norte
 * (docs/design/studio/_norte/erp/modules/mailing-scheduled.jsx):
 *   - 2 KPIs: En cola (count queued) + Total.
 *   - Lista con canal, subject + destinatario (+ N adj.), fecha/hora (mono),
 *     Badge de estado. Para los 'queued': "Enviar ya" (<ActionButton>) +
 *     cancelar (con <ConfirmDialog>).
 *
 * Mutaciones: se llama la server action DIRECTO en onAction del <ActionButton>
 * y se devuelve `{ error }` si falla (patrón del Studio, no fire-and-forget).
 */

import { useState } from "react";
import { Icon } from "@/app/studio/_components/icons";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { KpiCard } from "@/app/studio/_components/ui/KpiCard";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { ConfirmDialog } from "@/app/studio/_components/ui/ConfirmDialog";
import {
  scheduledStatusBadgeTone,
  scheduledStatusLabel,
  type MailScheduled,
} from "@/lib/studio/mail-types";
import {
  cancelScheduledAction,
  sendScheduledNowAction,
} from "../actions";

interface Props {
  scheduled: MailScheduled[];
}

/** "03 jul" · "14:30" para la columna de fecha/hora (mono). */
function fmtWhen(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "—", time: "" };
  return {
    date: d.toLocaleDateString("es-VE", { day: "2-digit", month: "short" }),
    time: d.toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" }),
  };
}

export function ScheduledView({ scheduled }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelPending, setCancelPending] = useState(false);

  if (scheduled.length === 0) {
    return (
      <EmptyState
        eyebrow="Sin envíos programados"
        title="No hay correos en cola"
        description="Cuando programes un correo desde Envío manual, aparece acá en cola hasta su fecha de envío. Puedes adelantarlo o cancelarlo."
      />
    );
  }

  const queuedCount = scheduled.filter((x) => x.status === "queued").length;

  async function doCancel() {
    if (!cancelId) return;
    setCancelPending(true);
    setError(null);
    const fd = new FormData();
    fd.set("id", cancelId);
    const r = await cancelScheduledAction(fd);
    setCancelPending(false);
    setCancelId(null);
    if (r?.error) setError(r.error);
  }

  return (
    <div>
      {error && (
        <div
          role="alert"
          style={{
            marginBottom: 16,
            padding: "10px 14px",
            borderRadius: "var(--r-md)",
            background: "var(--danger-bg)",
            color: "var(--danger)",
            font: "500 13px/1.4 var(--f-sans)",
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 220px))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <KpiCard
          value={queuedCount}
          label="En cola"
          valueColor={queuedCount > 0 ? "var(--wine)" : "var(--ink)"}
        />
        <KpiCard value={scheduled.length} label="Programados (total)" />
      </div>

      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid var(--border)",
            font: "700 10.5px/1 var(--f-sans)",
            color: "var(--wine)",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
          }}
        >
          Cola de envíos · {scheduled.length}
        </div>

        {scheduled.map((it, i) => {
          const when = fmtWhen(it.scheduled_for);
          return (
            <div
              key={it.id}
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr auto auto",
                gap: 14,
                alignItems: "center",
                padding: "14px 18px",
                borderTop: i > 0 ? "1px solid var(--border)" : undefined,
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "var(--r-md)",
                  background: "var(--wine-tint)",
                  color: "var(--wine)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {it.channel === "whatsapp" ? Icon.globe(16) : Icon.mail(16)}
              </span>

              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    font: "600 13.5px/1.3 var(--f-sans)",
                    color: "var(--ink)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={it.subject}
                >
                  {it.subject}
                </div>
                <div
                  style={{
                    font: "500 11.5px/1.3 var(--f-mono, var(--font-mono))",
                    color: "var(--ink-soft)",
                    marginTop: 3,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {it.to_name ? `${it.to_name} · ` : ""}
                  {it.to_email}
                  {it.attachments_count > 0
                    ? ` · ${it.attachments_count} adj.`
                    : ""}
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    font: "700 12px/1 var(--f-mono, var(--font-mono))",
                    color: "var(--ink)",
                  }}
                >
                  {when.date}
                </div>
                <div
                  style={{
                    font: "500 11px/1 var(--f-mono, var(--font-mono))",
                    color: "var(--ink-soft)",
                    marginTop: 4,
                  }}
                >
                  {when.time}
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Badge tone={scheduledStatusBadgeTone(it.status)} size="sm" dot>
                  {scheduledStatusLabel(it.status)}
                </Badge>

                {it.status === "queued" && (
                  <>
                    <ActionButton
                      variant="ghost"
                      size="sm"
                      idleLabel="Enviar ya"
                      loadingLabel="Enviando…"
                      successLabel="Enviado"
                      idleIcon={Icon.mail(13)}
                      successIcon={Icon.check(13)}
                      onError={setError}
                      onAction={async () => {
                        setError(null);
                        const fd = new FormData();
                        fd.set("id", it.id);
                        return sendScheduledNowAction(fd);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setCancelId(it.id);
                      }}
                      title="Cancelar"
                      aria-label="Cancelar envío programado"
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: "var(--r-sm)",
                        border: "1px solid var(--border)",
                        background: "var(--bg-surface)",
                        color: "var(--danger)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {Icon.trash(13)}
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        open={cancelId !== null}
        danger
        title="Cancelar envío programado"
        message="El correo no se enviará. Esta acción no se puede deshacer."
        confirmLabel="Cancelar envío"
        cancelLabel="Volver"
        pending={cancelPending}
        onCancel={() => setCancelId(null)}
        onConfirm={doCancel}
      />
    </div>
  );
}
