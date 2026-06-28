/**
 * Núcleo PURO del GC de huérfanos del bucket `receipt-photos`.
 *
 * El bucket es multi-uso: guarda fotos de recepción CN
 * (warehouse_receipt_photos.storage_path) Y las pruebas de entrega del
 * camionero (dispatch_pods.photo_path + signature_path · documentos legales).
 * Por eso `known` debe traer los paths de TODAS esas columnas: borrar algo
 * referenciado = perder una prueba de entrega.
 *
 * Un "huérfano" es un objeto del bucket que NO está en `known`. Pero hay una
 * trampa: los flujos suben el archivo a Storage y DESPUÉS insertan la fila
 * (link RPC). Entre ambos pasos el objeto existe sin fila → "huérfano"
 * transitorio. Para no borrar un upload en vuelo, solo consideramos objetos
 * más viejos que `minAgeMs`. Y si no podemos determinar la edad, NO se borra
 * (sesgo conservador).
 */

export type StoredObject = {
  name: string; // path completo dentro del bucket
  createdAt: string | null;
};

export type OrphanPick = {
  orphans: string[];
  scanned: number;
  referenced: number;
  skippedTooNew: number;
  skippedNoDate: number;
  cappedAt: number | null; // cap aplicado, o null si no se llegó al techo
};

export function pickOrphans(opts: {
  objects: StoredObject[];
  known: Set<string>;
  minAgeMs: number;
  nowMs: number;
  cap: number;
}): OrphanPick {
  const { objects, known, minAgeMs, nowMs, cap } = opts;
  const orphans: string[] = [];
  let referenced = 0;
  let skippedTooNew = 0;
  let skippedNoDate = 0;
  let cappedAt: number | null = null;

  for (const obj of objects) {
    if (known.has(obj.name)) {
      // Referenciado por una fila viva · NO tocar (puede ser un POD legal).
      referenced += 1;
      continue;
    }
    if (!obj.createdAt) {
      // Sin fecha → no podemos garantizar que no esté en vuelo · conservar.
      skippedNoDate += 1;
      continue;
    }
    const age = nowMs - new Date(obj.createdAt).getTime();
    if (!Number.isFinite(age) || age < minAgeMs) {
      // Demasiado nuevo · podría ser un upload en vuelo (sube → linkea).
      skippedTooNew += 1;
      continue;
    }
    if (orphans.length >= cap) {
      cappedAt = cap;
      break;
    }
    orphans.push(obj.name);
  }

  return {
    orphans,
    scanned: objects.length,
    referenced,
    skippedTooNew,
    skippedNoDate,
    cappedAt,
  };
}
