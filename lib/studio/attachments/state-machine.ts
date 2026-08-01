import type { AttachmentStatus } from "./types";

const TRANSITIONS: Readonly<Record<AttachmentStatus, readonly AttachmentStatus[]>> = {
  reservado: ["subiendo", "fallido"],
  subiendo: ["guardado", "fallido"],
  guardado: ["verificando", "fallido"],
  verificando: ["disponible", "cuarentena", "fallido"],
  cuarentena: ["eliminado"],
  disponible: ["protegido", "eliminado"],
  protegido: ["eliminado"],
  fallido: ["subiendo", "verificando", "eliminado"],
  eliminado: [],
};

export function canTransitionAttachment(
  current: AttachmentStatus,
  next: AttachmentStatus,
): boolean {
  return TRANSITIONS[current].includes(next);
}

export function assertAttachmentTransition(
  current: AttachmentStatus,
  next: AttachmentStatus,
): void {
  if (!canTransitionAttachment(current, next)) {
    throw new Error(`Transición de adjunto inválida: ${current} → ${next}`);
  }
}

