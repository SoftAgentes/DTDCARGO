"use client";

/**
 * PhotoRetryRunner — drena la cola de fotos de recepción pendientes
 * (SDD-0027 · paridad con el PodRetryRunner del camionero).
 *
 * Montado en el OperarioHomeClient. Reintenta subir las fotos que quedaron
 * en localStorage (por red caída al registrar la recepción) cuando:
 *  - se monta (el operario reabre la PWA / vuelve al home)
 *  - vuelve el evento `online`
 *
 * Por cada foto pendiente reconstruye el File desde el dataURL y llama
 * uploadReceiptPhotoAction. Si sube OK → la remueve de la cola + toast. Si
 * el server la rechaza por validación (mime/size/receipt inexistente) NO es
 * reintentable → la remueve igual para no reintentar eternamente. Si vuelve
 * a fallar por red, la deja en la cola para el próximo intento.
 *
 * No renderiza UI (el toast de éxito es feedback suficiente).
 */

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import {
  dataUrlToFile,
  getPendingPhotos,
  removePhoto,
  type PendingPhoto,
} from "@/app/m/_lib/photo-queue";
import { t as tDict } from "@/lib/i18n";
import { operarioLangToLocale, type Lang } from "@/lib/lang";
import { uploadReceiptPhotoAction } from "../nueva/photo-actions";

export function PhotoRetryRunner({ lang }: { lang: Lang }) {
  const toast = useToast();
  const router = useRouter();
  const runningRef = useRef(false);
  const locale = operarioLangToLocale(lang);

  const drain = useCallback(async () => {
    if (runningRef.current) return;
    const pending = getPendingPhotos();
    if (pending.length === 0) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;

    runningRef.current = true;
    let uploaded = 0;
    try {
      for (const photo of pending) {
        const outcome = await retryOne(photo);
        if (outcome !== "keep") removePhoto(photo.localId);
        if (outcome === "uploaded") uploaded += 1;
        // "keep" → la red sigue caída, la dejamos para el próximo intento.
      }
    } finally {
      runningRef.current = false;
    }

    if (uploaded > 0) {
      toast.success(
        uploaded === 1
          ? tDict(locale, "pwa.receipt.photo_retry_one")
          : tDict(locale, "pwa.receipt.photo_retry_many", { n: uploaded }),
      );
      router.refresh();
    }
  }, [toast, router, locale]);

  // Drain al montar + cuando vuelve la conexión
  useEffect(() => {
    void drain();
    function onOnline() {
      void drain();
    }
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [drain]);

  return null;
}

type RetryOutcome = "uploaded" | "drop" | "keep";

/**
 * Reintenta subir una foto.
 *  - "uploaded": subió OK → remover de la cola.
 *  - "drop": el server la rechazó por validación (no reintentable) →
 *    remover igual para no reintentar para siempre.
 *  - "keep": falló por red → dejar en la cola.
 */
async function retryOne(photo: PendingPhoto): Promise<RetryOutcome> {
  try {
    const file = dataUrlToFile(photo.photoDataUrl, `photo-${photo.position}.jpg`);
    const fd = new FormData();
    fd.set("receipt_id", photo.receiptId);
    fd.set("position", String(photo.position));
    fd.set("photo", file);

    const res = await uploadReceiptPhotoAction(fd);
    if (!res.ok) {
      // retryable = transitorio (sesión/Storage/RPC) → dejar en cola.
      if (res.retryable) return "keep";
      // !retryable = validación dura (mime/size/receipt inexistente) → no va
      // a entrar nunca, la sacamos para no reintentar eternamente.
      console.warn(
        `[PhotoRetryRunner] foto ${photo.receiptId}#${photo.position} descartada: ${res.error}`,
      );
      return "drop";
    }
    return "uploaded";
  } catch {
    // Red sigue caída · dejar en cola
    return "keep";
  }
}
