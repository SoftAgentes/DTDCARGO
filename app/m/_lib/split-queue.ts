"use client";

/**
 * Cola de fraccionamientos (split P1/P2) pendientes en localStorage
 * (SDD-0030 · paridad con pod-queue del camionero y photo-queue del CN).
 *
 * Cuando el bodeguero fracciona un paquete y la llamada falla por red (señal
 * VE flojita en la bodega), NO perdemos la intención: la guardamos en
 * localStorage (puro JSON · sin blobs, a diferencia del POD) y un runner la
 * reintenta al volver la señal o al reabrir la PWA.
 *
 * Seguridad de reintento: el split crea una OD hija, así que un reintento
 * "a ciegas" duplicaría el fraccionamiento. La idempotencia la garantiza la
 * DB (migr 0184: `bodeguero_split_p2` lanza P0013 si el paquete ya tiene
 * split_reason). El runner trata cualquier {error} resuelto como "ya no
 * reintentable" y lo saca de la cola; solo un fallo de red (throw) lo
 * mantiene encolado.
 *
 * Límite defensivo: max 5 splits en cola (si hay más, la red está muy mal y
 * conviene que el bodeguero avise al hub).
 */

import type { DispatchSplitReason } from "@/lib/studio/dispatch-types";

const QUEUE_KEY = "dtd_split_queue";
const MAX_QUEUE = 5;

export type PendingSplit = {
  /** id local para dedup (no es el OD id del server). */
  localId: string;
  odId: string;
  odCode: string | null;
  packageId: string;
  markbox: string | null;
  boxesShipped: number;
  splitReason: DispatchSplitReason;
  splitReasonText: string | null;
  queuedAt: number; // epoch ms
};

function read(): PendingSplit[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as PendingSplit[]) : [];
  } catch {
    return [];
  }
}

function write(splits: PendingSplit[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(splits));
  } catch (err) {
    // QuotaExceeded · localStorage lleno. Dropear el más viejo y reintentar.
    console.warn("[split-queue] write falló (quota?), dropeo el más viejo:", err);
    if (splits.length > 1) write(splits.slice(1));
  }
}

export function enqueueSplit(split: PendingSplit): void {
  const current = read();
  // Dedup por packageId · un paquete solo se fracciona una vez (la UI esconde
  // el botón si ya es parcial), así que un split pending por paquete basta.
  const filtered = current.filter((s) => s.packageId !== split.packageId);
  const next = [...filtered, split].slice(-MAX_QUEUE);
  write(next);
}

export function getPendingSplits(): PendingSplit[] {
  return read();
}

export function removeSplit(localId: string): void {
  write(read().filter((s) => s.localId !== localId));
}

export function pendingSplitCount(): number {
  return read().length;
}

/** localId estable sin Math.random (bloqueado en algunos contextos). */
export function makeSplitLocalId(packageId: string): string {
  return `${packageId}-${Date.now()}-${read().length}`;
}
