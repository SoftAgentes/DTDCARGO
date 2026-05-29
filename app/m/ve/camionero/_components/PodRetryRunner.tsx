"use client";

/**
 * PodRetryRunner — drena la cola de PODs pendientes (Sprint 3.5 v3).
 *
 * Montado en el CamioneroClient. Reintenta subir los PODs que quedaron en
 * localStorage (por red caída) cuando:
 *  - se monta (el camionero reabre la PWA)
 *  - vuelve el evento `online`
 *
 * Por cada POD pendiente: reconstruye FormData desde los dataURLs, llama
 * podAction; si OK, chain advance a entregada + remueve de la cola + toast.
 * Si vuelve a fallar por red, lo deja en la cola para el próximo intento.
 *
 * No renderiza UI (salvo un badge sutil de "N pendientes" via el padre, que
 * no implementamos acá · el toast de éxito es suficiente feedback).
 */

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import {
  dataUrlToFile,
  getPendingPods,
  removePod,
  type PendingPod,
} from "@/app/m/_lib/pod-queue";
import { advanceOdAction, podAction } from "../actions";

export function PodRetryRunner() {
  const toast = useToast();
  const router = useRouter();
  const runningRef = useRef(false);

  const drain = useCallback(async () => {
    if (runningRef.current) return;
    const pending = getPendingPods();
    if (pending.length === 0) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;

    runningRef.current = true;
    let delivered = 0;
    try {
      for (const pod of pending) {
        const ok = await retryOne(pod);
        if (ok) {
          removePod(pod.localId);
          delivered += 1;
        }
        // Si falla, lo dejamos en la cola para el próximo `online`/mount.
      }
    } finally {
      runningRef.current = false;
    }

    if (delivered > 0) {
      toast.success(
        delivered === 1
          ? "POD pendiente subido ✓"
          : `${delivered} PODs pendientes subidos ✓`,
      );
      router.refresh();
    }
  }, [toast, router]);

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

/**
 * Reintenta un POD. Devuelve true si subió (POD OK · el advance es
 * best-effort: si el POD subió pero advance falla, igual lo sacamos de la
 * cola porque el POD ya está en el server, no queremos re-subir la foto).
 */
async function retryOne(pod: PendingPod): Promise<boolean> {
  try {
    const photo = dataUrlToFile(pod.photoDataUrl, "pod.jpg");
    const signature = dataUrlToFile(pod.signatureDataUrl, "signature.png");

    const fd = new FormData();
    fd.set("od_id", pod.odId);
    fd.set("photo", photo);
    fd.set("signature", signature);
    fd.set("received_by", pod.receivedBy);
    if (pod.receivedDoc) fd.set("received_doc", pod.receivedDoc);
    if (pod.notes) fd.set("notes", pod.notes);
    if (pod.podGpsStatus) fd.set("pod_gps_status", pod.podGpsStatus);
    if (pod.podGpsStatus === "on" && pod.podLat != null && pod.podLng != null) {
      fd.set("pod_lat", String(pod.podLat));
      fd.set("pod_lng", String(pod.podLng));
      if (pod.podAccuracyM != null) fd.set("pod_accuracy_m", String(pod.podAccuracyM));
    }

    const result = await podAction({}, fd);
    if (result?.error) {
      // Validación server (ej OD ya entregada por otra vía). El POD no va a
      // entrar nunca · lo sacamos de la cola para no reintentar eternamente.
      console.warn(`[PodRetryRunner] POD ${pod.odId} rechazado: ${result.error}`);
      return true; // true = remover de cola (no reintentable)
    }

    // POD subió · chain advance (best-effort)
    try {
      const fdAdv = new FormData();
      fdAdv.set("od_id", pod.odId);
      fdAdv.set("status", "entregada");
      fdAdv.set("progress", "100");
      await advanceOdAction({}, fdAdv);
    } catch {
      // advance falló pero el POD ya subió · OK sacar de cola igual
    }
    return true;
  } catch {
    // Red sigue caída · dejar en cola
    return false;
  }
}
