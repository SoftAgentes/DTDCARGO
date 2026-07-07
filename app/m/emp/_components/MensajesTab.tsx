"use client";

/**
 * MensajesTab · inbox de comunicaciones del empleado (SDD-0113 Slice C).
 * Abrir un mensaje → markCommReadAction (read_at). Los requires_ack muestran
 * "Acuso recibo" → ackCommAction (acked_at, timestamp in-app). La RLS self-update
 * acota al dueño: un empleado NUNCA toca el comm de otro.
 */

import { useState, useTransition, type Dispatch, type SetStateAction } from "react";
import {
  commIsUnread,
  commNeedsAck,
  commTypeLabel,
  type EmployeeComm,
} from "@/lib/studio/nomina/comms-types";
import { markCommReadAction, ackCommAction } from "../actions";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";

export function MensajesTab({
  comms,
  setComms,
}: {
  comms: EmployeeComm[];
  setComms: Dispatch<SetStateAction<EmployeeComm[]>>;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const toast = useToast();

  function open(c: EmployeeComm) {
    const willOpen = openId === c.id ? null : c.id;
    setOpenId(willOpen);
    if (willOpen && commIsUnread(c)) {
      const now = new Date().toISOString();
      setComms((prev) => prev.map((x) => (x.id === c.id ? { ...x, read_at: now } : x)));
      startTransition(async () => {
        await markCommReadAction(c.id);
      });
    }
  }

  function onAcked(c: EmployeeComm) {
    const now = new Date().toISOString();
    setComms((prev) => prev.map((x) => (x.id === c.id ? { ...x, acked_at: now, read_at: now } : x)));
    toast.success("Comunicación confirmada");
  }

  if (comms.length === 0) {
    return (
      <EmptyState
        eyebrow="Mensajes"
        title="No tienes comunicaciones por ahora"
        description="Cuando RRHH te envíe un aviso o recibo, aparecerá aquí."
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {err && (
        <div style={{ font: "500 12px/1.3 var(--f-sans)", color: "var(--danger)" }}>{err}</div>
      )}
      {comms.map((c) => {
        const unread = commIsUnread(c);
        const needsAck = commNeedsAck(c);
        const isOpen = openId === c.id;
        return (
          <div
            key={c.id}
            style={{
              background: "var(--bg-surface)",
              border: `1px solid ${needsAck ? "var(--warning)" : "var(--border)"}`,
              borderRadius: "var(--r-lg)",
              overflow: "hidden",
            }}
          >
            <button
              type="button"
              onClick={() => open(c)}
              style={{
                width: "100%",
                textAlign: "left",
                background: "none",
                border: "none",
                padding: "12px 14px",
                cursor: "pointer",
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
              }}
            >
              {unread && (
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    background: "var(--wine)",
                    marginTop: 5,
                    flexShrink: 0,
                  }}
                />
              )}
              <span style={{ flex: 1 }}>
                <span style={{ font: "600 10px/1.2 var(--f-sans)", color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: ".04em" }}>
                  {commTypeLabel(c.type)}
                </span>
                <span style={{ display: "block", font: `${unread ? 700 : 600} 13.5px/1.3 var(--f-sans)`, color: "var(--ink)", marginTop: 2 }}>
                  {c.title}
                </span>
                {needsAck && (
                  <span style={{ display: "block", font: "600 11px/1.3 var(--f-sans)", color: "var(--warning)", marginTop: 3 }}>
                    Falta confirmar
                  </span>
                )}
                {c.acked_at && (
                  <span style={{ display: "block", font: "500 11px/1.3 var(--f-sans)", color: "var(--success)", marginTop: 3 }}>
                    Confirmado el {new Date(c.acked_at).toLocaleString("es-VE")}
                  </span>
                )}
              </span>
            </button>

            {isOpen && (
              <div style={{ padding: "0 14px 14px", borderTop: "1px solid var(--border)" }}>
                <p style={{ font: "400 13px/1.55 var(--f-sans)", color: "var(--ink-soft)", whiteSpace: "pre-wrap", marginTop: 10 }}>
                  {c.body}
                </p>
                {needsAck && (
                  <div style={{ marginTop: 8 }}>
                    <ActionButton
                      variant="dark"
                      size="sm"
                      idleLabel="Confirmar recibo"
                      loadingLabel="Confirmando…"
                      successLabel="Confirmado"
                      onAction={() => {
                        setErr(null);
                        return ackCommAction(c.id);
                      }}
                      onSuccess={() => onAcked(c)}
                      onError={(m) => {
                        setErr(m);
                        toast.error(m);
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
