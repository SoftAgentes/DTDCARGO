/**
 * lib/studio/bitacora/storage.ts · SDD-0146 Fase 3 — helpers de Storage (PUROS).
 *
 * Módulo sin dependencias (ni server-only ni supabase): lo comparten el browser
 * client (arma el path + sube), la route de transcripción (valida el path) y los
 * tests. Espejo del bucket `bitacora` de la migración 0213:
 *   - privado, 50 MB, mimes audio: SOLO `audio/webm` y `audio/mp4`.
 *   - audio → `{tenant}/bitacora_meeting/{meetingId}/{uuid}.{ext}` (sin fila en
 *     documents; policies por `foldername(name)[1] = tenant`).
 *
 * iOS: Safari graba `audio/mp4` (NO webm) — la extensión se deriva del mimeType
 * REAL, nunca se hardcodea `.webm`. `.m4a` (contenedor MP4) sube como `audio/mp4`
 * (el único mime audio-mp4 que el bucket acepta).
 */

/** Nombre del bucket privado de Bitácora (match 0213). */
export const BITACORA_BUCKET = "bitacora";

/** Tope de tamaño del bucket (50 MB) — se valida en el cliente ANTES de subir. */
export const AUDIO_MAX_BYTES = 50 * 1024 * 1024;

/** Cap duro de duración de grabación (10 min) — contador + auto-stop en el cliente. */
export const AUDIO_MAX_SECONDS = 600;

/** Extensiones de audio aceptadas en el path (match del regex de la route). */
export const AUDIO_ALLOWED_EXTS = ["webm", "mp4", "m4a"] as const;
export type AudioExt = (typeof AUDIO_ALLOWED_EXTS)[number];

/** UUID v4-ish (mismo shape que el resto del proyecto). */
const UUID = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
const UUID_RE = new RegExp(`^${UUID}$`);

/**
 * Deriva la extensión (webm|mp4|m4a) del mimeType REAL del blob/archivo. Devuelve
 * null si el formato no encaja en el bucket (mp3/ogg/wav/aac → el caller pide
 * pegar el texto). Chequea `m4a` antes que `mp4` (audio/x-m4a contiene "m4a").
 */
export function audioExtFromMime(mime: string | null | undefined): AudioExt | null {
  if (!mime) return null;
  const m = mime.toLowerCase();
  if (m.includes("webm")) return "webm";
  if (m.includes("m4a")) return "m4a";
  if (m.includes("mp4")) return "mp4";
  return null;
}

/**
 * Extensión de un `File` subido: primero por mimeType, luego por el nombre (algunos
 * browsers reportan `File.type` vacío para .m4a). null = formato no soportado.
 */
export function audioExtFromFile(file: { type?: string; name?: string }): AudioExt | null {
  const fromMime = audioExtFromMime(file.type);
  if (fromMime) return fromMime;
  const name = (file.name ?? "").toLowerCase();
  if (name.endsWith(".webm")) return "webm";
  if (name.endsWith(".m4a")) return "m4a";
  if (name.endsWith(".mp4")) return "mp4";
  return null;
}

/**
 * Content-Type con el que se sube al bucket. m4a y mp4 comparten `audio/mp4` (el
 * único mime audio-mp4 en `allowed_mime_types`); webm → `audio/webm`.
 */
export function audioContentTypeForExt(ext: AudioExt): string {
  return ext === "webm" ? "audio/webm" : "audio/mp4";
}

/**
 * Arma el path del audio: `{tenant}/bitacora_meeting/{meetingId}/{uuid}.{ext}`.
 * `meetingId` y `uuid` son uuid client-generated; el tenant lo pone el servidor
 * (prop) — nunca el usuario a mano.
 */
export function buildMeetingAudioPath(opts: {
  tenantId: string;
  meetingId: string;
  uuid: string;
  ext: AudioExt;
}): string {
  return `${opts.tenantId}/bitacora_meeting/${opts.meetingId}/${opts.uuid}.${opts.ext}`;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Valida que `path` sea EXACTAMENTE un audio del tenant del caller:
 * `^{tenant}/bitacora_meeting/{uuid}/{uuid}\.(webm|mp4|m4a)$`.
 *
 * El regex estricto ya rechaza `..`, segmentos vacíos, otro tenant y extensiones
 * fuera de la lista (los uuid no contienen `.` ni `/`). Se agrega un guard
 * explícito de `..` como defensa-en-profundidad (deja la intención clara).
 */
export function isValidMeetingAudioPath(
  path: unknown,
  tenantId: string,
): boolean {
  if (typeof path !== "string" || path.length === 0) return false;
  if (path.includes("..")) return false;
  if (!UUID_RE.test(tenantId)) return false; // tenant del caller mal formado → nada matchea
  const re = new RegExp(
    `^${escapeRegex(tenantId)}/bitacora_meeting/${UUID}/${UUID}\\.(webm|mp4|m4a)$`,
  );
  return re.test(path);
}
