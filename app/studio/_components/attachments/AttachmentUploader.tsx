"use client";

import { useId, useState } from "react";
import { useAttachmentUpload } from "./useAttachmentUpload";
import { useT } from "@/lib/i18n";
import { Aviso } from "@/app/studio/_components/ui/Aviso";

const STATUS_KEYS = {
  queued: "expenses.attachment.status.queued",
  uploading: "expenses.attachment.status.uploading",
  finalizing: "expenses.attachment.status.finalizing",
  completed: "expenses.attachment.status.completed",
  failed: "expenses.attachment.status.failed",
} as const;

export function AttachmentUploader({ ownerKey, entityId }: { ownerKey: string; entityId: string }) {
  const inputId = useId();
  const t = useT();
  const [error, setError] = useState<string | null>(null);
  const queue = useAttachmentUpload({ ownerKey, entityId });

  return (
    <section style={{ display: "grid", gap: "var(--s-2)" }}>
      <label htmlFor={inputId} className="studio-label">{t("expenses.field.receipt_secure")}</label>
      <input
        id={inputId} type="file" accept="image/jpeg,image/png,image/webp,application/pdf"
        className="studio-input" style={{ padding: "var(--s-2) var(--s-3)" }}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (!file) return;
          setError(null);
          void queue.add(file).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "No se pudo guardar el adjunto."));
        }}
      />
      <p style={{ margin: 0, color: "var(--ink-soft)", font: "500 11px/1.4 var(--f-sans)" }}>
        {t("expenses.attachment.limits")}
      </p>
      {error && <Aviso tono="error" compacto>{error}</Aviso>}
      {queue.records.map((record) => (
        <div key={record.id} style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "var(--s-2)", display: "flex", gap: "var(--s-2)", alignItems: "center" }}>
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", font: "500 12px/1.4 var(--f-sans)" }}>{record.fileName}</span>
          <span aria-live="polite" style={{ color: "var(--ink-soft)", font: "600 11px/1.4 var(--f-mono)" }}>
            {record.status === "uploading"
              ? t("expenses.attachment.status.uploading_progress", { progress: queue.progress[record.id] ?? 0 })
              : t(STATUS_KEYS[record.status])}
          </span>
          {record.status === "failed" && <button type="button" className="studio-btn studio-btn-ghost" onClick={() => void queue.retry(record.id)}>{t("expenses.attachment.retry")}</button>}
          {record.status === "completed" && <button type="button" className="studio-btn studio-btn-ghost" onClick={() => void queue.dismissCompleted(record.id)}>{t("expenses.attachment.close")}</button>}
          {record.error && <span className="sr-only">{record.error}</span>}
        </div>
      ))}
    </section>
  );
}
