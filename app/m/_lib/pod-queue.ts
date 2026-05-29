"use client";

/**
 * Cola de PODs pendientes en localStorage (Sprint 3.5 v3).
 *
 * Cuando el camionero confirma una entrega y el upload falla por
 * conectividad (red VE flojita en la calle), NO perdemos el POD: lo
 * guardamos en localStorage como dataURLs (foto + firma) + los campos, y
 * un runner lo reintenta al volver la señal o al reabrir la PWA.
 *
 * localStorage solo guarda strings · los blobs van como base64 dataURL
 * (infla ~33% pero la foto ya viene comprimida del image-compress, ~300KB
 * → ~400KB en base64, bien dentro del límite ~5MB de localStorage).
 *
 * Límite defensivo: max 5 PODs en cola (si hay más, algo está muy mal con
 * la red y conviene que el camionero llame al hub).
 */

const QUEUE_KEY = "dtd_pod_queue";
const MAX_QUEUE = 5;

export type PendingPod = {
  /** id local para dedup (no es el POD id del server). */
  localId: string;
  odId: string;
  photoDataUrl: string;
  signatureDataUrl: string;
  receivedBy: string;
  receivedDoc: string | null;
  notes: string | null;
  podLat: number | null;
  podLng: number | null;
  podAccuracyM: number | null;
  podGpsStatus: "on" | "off" | "denied" | "unavailable" | null;
  queuedAt: number; // epoch ms
};

function read(): PendingPod[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as PendingPod[]) : [];
  } catch {
    return [];
  }
}

function write(pods: PendingPod[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(pods));
  } catch (err) {
    // QuotaExceeded · localStorage lleno. Dropear el más viejo y reintentar.
    console.warn("[pod-queue] write falló (quota?), dropeo el más viejo:", err);
    if (pods.length > 1) write(pods.slice(1));
  }
}

export function enqueuePod(pod: PendingPod): void {
  const current = read();
  // Dedup por odId · si ya hay un POD pending de la misma OD, reemplazar
  const filtered = current.filter((p) => p.odId !== pod.odId);
  const next = [...filtered, pod].slice(-MAX_QUEUE);
  write(next);
}

export function getPendingPods(): PendingPod[] {
  return read();
}

export function removePod(localId: string): void {
  write(read().filter((p) => p.localId !== localId));
}

export function pendingPodCount(): number {
  return read().length;
}

// ─── conversión blob ↔ dataURL ────────────────────────────────

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header, base64] = dataUrl.split(",");
  const mimeMatch = header.match(/data:([^;]+)/);
  const mime = mimeMatch ? mimeMatch[1] : "application/octet-stream";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}

/** localId estable sin Math.random (que está bloqueado en algunos contextos). */
export function makeLocalId(odId: string): string {
  // odId + timestamp + contador de cola · suficientemente único client-side
  return `${odId}-${Date.now()}-${read().length}`;
}
