"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/app/studio/_components/ui/ConfirmDialog";
import type { NewsletterCampaignStatus } from "@/lib/studio/newsletter/types";
import {
  approveNewsletterCampaign,
  retryNewsletterCampaign,
  sendNewsletterCampaign,
  sendNewsletterCampaignTest,
  submitNewsletterCampaign,
} from "../actions";

type Intent = "approve" | "send" | "retry" | null;

export function CampaignActions({ id, status, isAdmin }: { id: string; status: NewsletterCampaignStatus; isAdmin: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [intent, setIntent] = useState<Intent>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function run(action: () => Promise<{ error?: string; message?: string }>) {
    setError(null); setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
      else setMessage(result.message ?? "Listo.");
      setIntent(null);
      router.refresh();
    });
  }

  const dialog = intent === "approve"
    ? { title: "Aprobar campaña", message: "Se congelará la audiencia actual. El contenido aprobado no podrá cambiar antes del envío.", label: "Aprobar", action: () => approveNewsletterCampaign(id) }
    : intent === "send"
      ? { title: status === "sending" ? "Continuar envío" : "Enviar campaña", message: "Esta acción enviará hasta 100 correos reales. Si quedan destinatarios, deberás continuar manualmente con el siguiente lote.", label: "Enviar lote", action: () => sendNewsletterCampaign(id) }
      : intent === "retry"
        ? { title: "Preparar reintento", message: "Solo se volverán a poner en cola los destinatarios cuyo envío falló.", label: "Preparar", action: () => retryNewsletterCampaign(id) }
        : null;

  return (
    <div style={{ marginTop: "var(--s-3)" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--s-2)" }}>
        {status === "draft" && <>
          <button className="studio-btn studio-btn-ghost studio-btn-xs" type="button" onClick={() => router.push(`/studio/marketing/newsletter?edit=${id}`)}>Editar</button>
          <button className="studio-btn studio-btn-primary studio-btn-xs" type="button" disabled={pending} onClick={() => run(() => submitNewsletterCampaign(id))}>Enviar a revisión</button>
        </>}
        {status !== "sent" && <button className="studio-btn studio-btn-ghost studio-btn-xs" type="button" disabled={pending} onClick={() => run(() => sendNewsletterCampaignTest(id))}>Enviar prueba</button>}
        {status === "pending_approval" && isAdmin && <button className="studio-btn studio-btn-primary studio-btn-xs" type="button" onClick={() => setIntent("approve")}>Aprobar</button>}
        {["approved", "sending"].includes(status) && isAdmin && <button className="studio-btn studio-btn-primary studio-btn-xs" type="button" onClick={() => setIntent("send")}>{status === "sending" ? "Continuar envío" : "Enviar campaña"}</button>}
        {["partial", "failed"].includes(status) && isAdmin && <button className="studio-btn studio-btn-ghost studio-btn-xs" type="button" onClick={() => setIntent("retry")}>Reintentar fallos</button>}
      </div>
      {error && <p role="alert" style={{ margin: "var(--s-2) 0 0", color: "var(--danger)", font: "600 12px/1.4 var(--f-sans)" }}>{error}</p>}
      {message && <p role="status" style={{ margin: "var(--s-2) 0 0", color: "var(--ink-soft)", font: "600 12px/1.4 var(--f-sans)" }}>{message}</p>}
      {dialog && <ConfirmDialog open title={dialog.title} message={dialog.message} confirmLabel={dialog.label} pending={pending} onCancel={() => setIntent(null)} onConfirm={() => run(dialog.action)} />}
    </div>
  );
}
