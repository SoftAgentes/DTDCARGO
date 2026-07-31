import type { AttachmentMime } from "./types";

const MIME_LIMITS: Readonly<Record<AttachmentMime, number>> = {
  "image/jpeg": 8 * 1024 * 1024,
  "image/png": 8 * 1024 * 1024,
  "image/webp": 8 * 1024 * 1024,
  "application/pdf": 25 * 1024 * 1024,
};

export function isAttachmentMime(value: string): value is AttachmentMime {
  return Object.prototype.hasOwnProperty.call(MIME_LIMITS, value);
}

export function validateAttachmentCandidate(candidate: {
  name: string;
  mime: string;
  size: number;
}): string | null {
  if (!candidate.name.trim() || candidate.name.length > 255) {
    return "El nombre del archivo es inválido.";
  }
  if (!isAttachmentMime(candidate.mime)) {
    return "Formato no permitido. Usa JPG, PNG, WebP o PDF.";
  }
  if (!Number.isSafeInteger(candidate.size) || candidate.size <= 0) {
    return "El archivo está vacío o su tamaño es inválido.";
  }
  if (candidate.size > MIME_LIMITS[candidate.mime]) {
    return candidate.mime.startsWith("image/")
      ? "La imagen supera el máximo de 8 MB."
      : "El documento supera el máximo de 25 MB.";
  }
  return null;
}

export function extensionForMime(mime: AttachmentMime): string {
  return {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "application/pdf": "pdf",
  }[mime];
}

