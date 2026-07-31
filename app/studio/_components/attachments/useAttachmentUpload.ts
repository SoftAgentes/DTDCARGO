"use client";

import { useCallback, useEffect, useState } from "react";
import { Uppy } from "@uppy/core";
import Tus from "@uppy/tus";
import { ATTACHMENT_TUS_CHUNK_BYTES, type AttachmentUploadAuthorization } from "@/lib/studio/attachments/types";
import { validateAttachmentCandidate } from "@/lib/studio/attachments/policy";
import {
  listQueuedAttachments,
  reconcileInterruptedAttachments,
  patchQueuedAttachment,
  putQueuedAttachment,
  removeCompletedAttachment,
  type AttachmentQueueRecord,
} from "./attachment-queue";

async function json<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? `Solicitud falló (${response.status}).`);
  return body;
}

export function useAttachmentUpload(input: { ownerKey: string; entityId: string }) {
  const [records, setRecords] = useState<AttachmentQueueRecord[]>([]);
  const [progress, setProgress] = useState<Record<string, number>>({});

  const refresh = useCallback(async () => {
    setRecords(await listQueuedAttachments(input.ownerKey));
  }, [input.ownerKey]);

  useEffect(() => {
    let active = true;
    void reconcileInterruptedAttachments(input.ownerKey).then((items) => {
      if (active) setRecords(items);
    });
    return () => { active = false; };
  }, [input.ownerKey]);

  const uploadRecord = useCallback(async (record: AttachmentQueueRecord) => {
    try {
      await patchQueuedAttachment(record.id, { status: "uploading", error: undefined });
      if (record.intentId) {
        const recovered = await fetch(`/api/studio/attachments/${record.intentId}/finalize`, { method: "POST" });
        if (recovered.ok) {
          await patchQueuedAttachment(record.id, { status: "completed" });
          await refresh();
          return;
        }
      }
      const authorization = await json<AttachmentUploadAuthorization>(await fetch("/api/studio/attachments/reserve", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          entityType: "expense", entityId: record.entityId, folder: "receipt",
          docType: "Comprobante de gasto", originalName: record.fileName,
          declaredMime: record.mime, declaredSize: record.size, idempotencyKey: record.id,
        }),
      }));
      await patchQueuedAttachment(record.id, { intentId: authorization.intentId, documentId: authorization.documentId });

      const uppy = new Uppy({ autoProceed: false, restrictions: { maxNumberOfFiles: 1 } });
      uppy.use(Tus, {
        endpoint: authorization.endpoint,
        chunkSize: ATTACHMENT_TUS_CHUNK_BYTES,
        retryDelays: [0, 3000, 5000, 10_000, 20_000],
        headers: { "x-signature": authorization.signature, "x-upsert": "false" },
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        allowedMetaFields: ["bucketName", "objectName", "contentType", "cacheControl"],
      });
      uppy.on("upload-progress", (_file, info) => {
        const percentage = info.bytesTotal ? Math.round((info.bytesUploaded / info.bytesTotal) * 100) : 0;
        setProgress((current) => ({ ...current, [record.id]: percentage }));
      });
      uppy.addFile({
        name: record.fileName, type: record.mime, data: record.file,
        meta: { bucketName: authorization.bucketId, objectName: authorization.objectKey, contentType: record.mime, cacheControl: "3600" },
      });
      const result = await uppy.upload();
      uppy.destroy();
      if (result?.failed?.length) {
        const firstError = result.failed[0]?.error;
        throw new Error(typeof firstError === "string" ? firstError : "La subida TUS falló.");
      }

      await patchQueuedAttachment(record.id, { status: "finalizing" });
      await json<{ documentId: string }>(await fetch(`/api/studio/attachments/${authorization.intentId}/finalize`, { method: "POST" }));
      await patchQueuedAttachment(record.id, { status: "completed" });
      await refresh();
    } catch (error) {
      await patchQueuedAttachment(record.id, { status: "failed", error: error instanceof Error ? error.message : "Error desconocido." });
      await refresh();
    }
  }, [refresh]);

  const add = useCallback(async (file: File) => {
    const invalid = validateAttachmentCandidate({ name: file.name, mime: file.type, size: file.size });
    if (invalid) throw new Error(invalid);
    const now = new Date().toISOString();
    const record: AttachmentQueueRecord = {
      id: crypto.randomUUID(), ownerKey: input.ownerKey, entityId: input.entityId,
      file, fileName: file.name, mime: file.type, size: file.size,
      status: "queued", createdAt: now, updatedAt: now,
    };
    await putQueuedAttachment(record);
    await refresh();
    await uploadRecord(record);
  }, [input.entityId, input.ownerKey, refresh, uploadRecord]);

  const retry = useCallback(async (id: string) => {
    const record = records.find((item) => item.id === id);
    if (!record) throw new Error("Adjunto local no encontrado.");
    await uploadRecord(record);
  }, [records, uploadRecord]);

  const dismissCompleted = useCallback(async (id: string) => {
    await removeCompletedAttachment(id);
    await refresh();
  }, [refresh]);

  return { records, progress, add, retry, dismissCompleted };
}
