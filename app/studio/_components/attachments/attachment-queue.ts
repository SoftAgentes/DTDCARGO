export type QueueStatus = "queued" | "uploading" | "finalizing" | "completed" | "failed";

export interface AttachmentQueueRecord {
  id: string;
  ownerKey: string;
  entityId: string;
  file: Blob;
  fileName: string;
  mime: string;
  size: number;
  status: QueueStatus;
  intentId?: string;
  documentId?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

const DB_NAME = "dtd-attachment-queue-v1";
const STORE = "uploads";

function openQueue(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("ownerKey", "ownerKey", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("No se pudo abrir IndexedDB."));
  });
}

async function transaction<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openQueue();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = run(tx.objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Falló la cola local."));
      tx.onabort = () => reject(tx.error ?? new Error("La transacción local fue abortada."));
    });
  } finally {
    db.close();
  }
}

export async function putQueuedAttachment(record: AttachmentQueueRecord): Promise<void> {
  await transaction("readwrite", (store) => store.put(record));
}

export async function getQueuedAttachment(id: string): Promise<AttachmentQueueRecord | undefined> {
  return transaction("readonly", (store) => store.get(id));
}

export async function listQueuedAttachments(ownerKey: string): Promise<AttachmentQueueRecord[]> {
  const db = await openQueue();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const request = tx.objectStore(STORE).index("ownerKey").getAll(ownerKey);
      request.onsuccess = () => resolve((request.result as AttachmentQueueRecord[]).sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
      request.onerror = () => reject(request.error ?? new Error("No se pudo leer la cola local."));
    });
  } finally { db.close(); }
}

export async function patchQueuedAttachment(id: string, patch: Partial<AttachmentQueueRecord>): Promise<AttachmentQueueRecord> {
  const current = await getQueuedAttachment(id);
  if (!current) throw new Error("Adjunto local no encontrado.");
  const next = { ...current, ...patch, id: current.id, updatedAt: new Date().toISOString() };
  await putQueuedAttachment(next);
  return next;
}

export async function reconcileInterruptedAttachments(ownerKey: string): Promise<AttachmentQueueRecord[]> {
  const records = await listQueuedAttachments(ownerKey);
  await Promise.all(records.map(async (record) => {
    if (record.status === "uploading" || record.status === "finalizing") {
      await patchQueuedAttachment(record.id, {
        status: "failed",
        error: "La operación fue interrumpida. Reintenta para continuar sin perder el archivo.",
      });
    }
  }));
  return listQueuedAttachments(ownerKey);
}

export async function removeCompletedAttachment(id: string): Promise<void> {
  const current = await getQueuedAttachment(id);
  if (!current || current.status !== "completed") {
    throw new Error("Solo se puede retirar una copia local después de completar el servidor.");
  }
  await transaction("readwrite", (store) => store.delete(id));
}
