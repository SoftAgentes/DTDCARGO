"use client";

/**
 * SplitQueueRetryRunner — drena la cola de fraccionamientos pendientes
 * (SDD-0030 · paridad con PodRetryRunner del camionero).
 *
 * Montado en el BodegueroClient. Reintenta los splits que quedaron en
 * localStorage (por red caída) cuando:
 *  - se monta (el bodeguero reabre la PWA)
 *  - vuelve el evento `online`
 *
 * Por cada split: reconstruye FormData y llama splitPackageP2Action.
 *  - throw (red sigue caída) → lo deja en la cola.
 *  - {error} resuelto → lo saca de la cola. Incluye P0013 "ya fraccionado"
 *    (el split original SÍ entró · phantom-success) y validaciones que no se
 *    arreglan reintentando. La idempotencia de la DB (migr 0184) garantiza
 *    que un reintento de phantom-success NO duplica el split.
 *  - {ok} → lo saca de la cola.
 *
 * No renderiza UI · el toast de éxito es feedback suficiente.
 */

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import {
  getPendingSplits,
  removeSplit,
  type PendingSplit,
} from "@/app/m/_lib/split-queue";
import { splitPackageP2Action } from "../actions";

export function SplitQueueRetryRunner() {
  const toast = useToast();
  const router = useRouter();
  const runningRef = useRef(false);

  const drain = useCallback(async () => {
    if (runningRef.current) return;
    const pending = getPendingSplits();
    if (pending.length === 0) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;

    runningRef.current = true;
    let settled = 0;
    try {
      for (const split of pending) {
        const done = await retryOne(split);
        if (done) {
          removeSplit(split.localId);
          settled += 1;
        }
        // Si falla por red, lo dejamos en la cola para el próximo `online`/mount.
      }
    } finally {
      runningRef.current = false;
    }

    if (settled > 0) {
      toast.success(
        settled === 1
          ? "Fraccionamiento pendiente aplicado ✓"
          : `${settled} fraccionamientos pendientes aplicados ✓`,
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
 * Reintenta un split. Devuelve true si quedó resuelto (sacar de la cola) ·
 * false si la red sigue caída (mantener en cola).
 */
async function retryOne(split: PendingSplit): Promise<boolean> {
  try {
    const fd = new FormData();
    fd.set("od_id", split.odId);
    fd.set("package_id", split.packageId);
    fd.set("boxes_shipped", String(split.boxesShipped));
    fd.set("split_reason", split.splitReason);
    if (split.splitReasonText) fd.set("split_reason_text", split.splitReasonText);

    const result = await splitPackageP2Action({}, fd);
    if (result?.error) {
      // Resuelto con error del server (incluye P0013 "ya fraccionado", que
      // es éxito-equivalente: el split original entró). No reintentable ·
      // sacar de la cola.
      console.warn(
        `[SplitQueueRetryRunner] split ${split.packageId} resuelto con error: ${result.error}`,
      );
      return true;
    }
    return true; // {ok} · sacar de la cola
  } catch {
    // Red sigue caída · dejar en cola
    return false;
  }
}
