"use client";

/**
 * <RecoveryClient> — form de solicitud + estado de los pedidos propios
 * (SDD-0025 §4.6). El submit llama a requestRecoveryAction; la lista muestra
 * el avance M-of-N (aprobaciones / requeridas) y el estado.
 *
 * Solo tokens var(--*). Copy en tuteo VE.
 */

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ErrorAlert } from "@/app/studio/_components/ui/ErrorAlert";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { requestRecoveryAction } from "../../actions";
import {
  formatLastAccess,
  recoveryStatusBadgeTone,
  recoveryStatusLabel,
  type NoOlvidarActionState,
  type NoOlvidarRecoveryRequest,
} from "@/lib/studio/no-olvidar-types";

export function RecoveryClient({ requests }: { requests: NoOlvidarRecoveryRequest[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState<NoOlvidarActionState, FormData>(
    requestRecoveryAction,
    {},
  );

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state.ok, router]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <form
        ref={formRef}
        action={formAction}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          padding: 18,
          borderRadius: "var(--r-lg)",
          border: "1px solid var(--border)",
          background: "var(--bg-surface)",
        }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <span style={{ font: "600 12px/1 var(--f-sans)", color: "var(--ink-mute)" }}>
            Motivo de la recuperación (mín. 20 caracteres)
          </span>
          <textarea
            name="reason"
            required
            minLength={20}
            rows={4}
            placeholder="Ej. Cambié de teléfono y perdí el acceso a mi app de 2FA. No tengo el recovery kit a mano."
            style={{
              padding: "10px 12px",
              borderRadius: "var(--r-md)",
              border: "1px solid var(--border)",
              background: "var(--surface-sel)",
              color: "var(--ink)",
              font: "400 14px/1.5 var(--f-sans)",
              resize: "vertical",
            }}
          />
        </label>

        {state.ok && (
          <div
            role="status"
            style={{
              padding: "8px 10px",
              borderRadius: "var(--r-sm)",
              background: "var(--success-bg)",
              color: "var(--success)",
              font: "500 12.5px/1.4 var(--f-sans)",
            }}
          >
            Pedido enviado. Los administradores fueron notificados.
          </div>
        )}
        <ErrorAlert state={state} compact />

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="submit" disabled={isPending} className="studio-btn studio-btn-primary">
            {isPending ? "Enviando…" : "Solicitar recuperación"}
          </button>
        </div>
      </form>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span style={{ font: "700 11px/1 var(--f-sans)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-soft)" }}>
          Tus pedidos
        </span>
        {requests.length === 0 ? (
          <p style={{ font: "400 13px/1.4 var(--f-sans)", color: "var(--ink-mute)", margin: 0 }}>
            No tienes pedidos de recuperación.
          </p>
        ) : (
          requests.map((r) => (
            <div
              key={r.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 12,
                padding: "12px 14px",
                borderRadius: "var(--r-md)",
                border: "1px solid var(--border)",
                background: "var(--bg-surface)",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                <span style={{ font: "500 13px/1.4 var(--f-sans)", color: "var(--ink)" }}>{r.reason}</span>
                <span style={{ font: "500 11.5px/1 var(--f-sans)", color: "var(--ink-mute)" }}>
                  {formatLastAccess(r.created_at)} · {r.approvals.length}/{r.approvals_required} aprobaciones
                </span>
              </div>
              <Badge tone={recoveryStatusBadgeTone(r.status)}>{recoveryStatusLabel(r.status)}</Badge>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
