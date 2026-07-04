/**
 * Núcleo PURO del GC de audios huérfanos de Bitácora (SDD-0146 · Fase 6).
 *
 * El bucket `bitacora` guarda DOS cosas con ciclos de vida distintos:
 *   - `{tenant}/bitacora_meeting/{meetingId}/{uuid}.{ext}` → AUDIO de reunión,
 *     SIN fila en `documents`; su único puntero es `bitacora_meetings.audio_path`.
 *   - `{tenant}/bitacora_task/{taskId}/{uuid}.{ext}` → ADJUNTO de tarea, CON
 *     fila en `documents` (los gestiona el usuario / la acción de borrado).
 *
 * Este GC limpia SOLO los audios de reunión que quedaron huérfanos (el usuario
 * subió el audio y abandonó antes de crear el borrador). Los adjuntos de tarea
 * NO se tocan JAMÁS acá: no están en `audio_path`, así que sin este scoping
 * TODOS parecerían huérfanos y se borrarían. Por eso `isMeetingAudioObject`
 * acota los candidatos antes de aplicar la lógica de huérfanos.
 */

import {
  pickOrphans,
  type OrphanPick,
  type StoredObject,
} from "@/lib/studio/storage/receipt-orphans";

/** True si el objeto vive bajo `{tenant}/bitacora_meeting/...` (audio de reunión). */
export function isMeetingAudioObject(name: string): boolean {
  const parts = name.split("/");
  return parts.length >= 3 && parts[1] === "bitacora_meeting";
}

/**
 * Huérfanos = SOLO audios de reunión (nunca adjuntos de tarea) que no están
 * referenciados por `bitacora_meetings.audio_path` y son más viejos que
 * `minAgeMs` (para no matar un upload en vuelo). Reusa `pickOrphans`.
 */
export function pickMeetingAudioOrphans(opts: {
  objects: StoredObject[];
  known: Set<string>;
  minAgeMs: number;
  nowMs: number;
  cap: number;
}): OrphanPick {
  const scoped = opts.objects.filter((o) => isMeetingAudioObject(o.name));
  return pickOrphans({ ...opts, objects: scoped });
}
