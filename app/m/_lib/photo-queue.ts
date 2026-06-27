"use client";

/**
 * Cola de fotos de recepción pendientes en localStorage (SDD-0027 ·
 * paridad con la pod-queue del camionero).
 *
 * El operario CN registra una recepción: el recibo se crea server-side y
 * las fotos se suben una por una DESPUÉS (ver NuevaRecepcionClient). Si el
 * upload de una foto falla por conectividad (red del hub China flojita),
 * NO la perdemos: la guardamos en localStorage como dataURL + receipt_id +
 * position, y un runner (PhotoRetryRunner) la reintenta al volver la señal
 * o al reabrir la PWA — igual que el camionero con sus PODs.
 *
 * Reusa blobToDataUrl/dataUrlToFile de pod-queue (mismo mecanismo base64).
 *
 * localStorage solo guarda strings → el blob va como base64 dataURL (infla
 * ~33%, pero la foto ya viene comprimida del image-compress, ~300-500KB).
 *
 * Límite defensivo: max 9 fotos en cola (≈3 recepciones de 3 fotos). Con
 * ~400KB c/u en base64 quedamos dentro del techo ~5MB de localStorage. Si
 * la quota igual revienta, write() dropea la más vieja y reintenta.
 */

import { blobToDataUrl, dataUrlToFile } from "@/app/m/_lib/pod-queue";

const QUEUE_KEY = "dtd_photo_queue";
const MAX_QUEUE = 9;

export type PendingPhoto = {
  /** id local para dedup (no es el photo id del server). */
  localId: string;
  receiptId: string;
  receiptCode: string;
  /** posición de la foto en la recepción (0-based). */
  position: number;
  photoDataUrl: string;
  contentType: string;
  queuedAt: number; // epoch ms
};

function read(): PendingPhoto[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as PendingPhoto[]) : [];
  } catch {
    return [];
  }
}

function write(photos: PendingPhoto[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(photos));
  } catch (err) {
    // QuotaExceeded · localStorage lleno. Dropear la más vieja y reintentar.
    console.warn("[photo-queue] write falló (quota?), dropeo la más vieja:", err);
    if (photos.length > 1) write(photos.slice(1));
  }
}

/**
 * Encola una foto pendiente. Dedup por receiptId+position: si ya hay una
 * foto pending de la misma posición de la misma recepción, la reemplaza
 * (no se acumulan duplicados si el operario reintenta manualmente).
 */
export function enqueuePhoto(photo: PendingPhoto): void {
  const current = read();
  const filtered = current.filter(
    (p) => !(p.receiptId === photo.receiptId && p.position === photo.position),
  );
  const next = [...filtered, photo].slice(-MAX_QUEUE);
  write(next);
}

export function getPendingPhotos(): PendingPhoto[] {
  return read();
}

export function removePhoto(localId: string): void {
  write(read().filter((p) => p.localId !== localId));
}

export function pendingPhotoCount(): number {
  return read().length;
}

/** localId estable sin Math.random (bloqueado en algunos contextos). */
export function makePhotoLocalId(receiptId: string, position: number): string {
  return `${receiptId}-${position}-${Date.now()}`;
}

// Re-export para que los consumidores (cliente + runner) importen todo
// desde un solo lugar.
export { blobToDataUrl, dataUrlToFile };
