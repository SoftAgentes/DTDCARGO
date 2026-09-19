/**
 * SDD-0482 · Edición directa de nombre, cédula/RIF y teléfono desde el Portal.
 *
 * PURO: normaliza y valida lo que escribe el cliente antes de llamar a la RPC
 * `portal_update_my_profile` (0462), que repite las reglas en SQL y decide qué
 * cambió de verdad. Un campo vacío significa «no lo toques», nunca «bórralo».
 */
import {
  normalizeDocByKind,
  type ClientDocKind,
} from "@/lib/studio/client-types";
import { normalizeWhatsappPhone } from "@/lib/studio/quote-types";
import type { EditableField } from "@/lib/portal/change-request-types";

export type DirectEditInput = { name: string; doc: string; phone: string };

export type DirectEditValues = {
  name: string | null;
  doc: string | null;
  phone: string | null;
};

export type DirectEditValidation =
  | { ok: true; values: DirectEditValues }
  | { ok: false; fieldErrors: Partial<Record<EditableField, string>> };

export function validateDirectEdit(
  kind: ClientDocKind,
  input: DirectEditInput,
): DirectEditValidation {
  const fieldErrors: Partial<Record<EditableField, string>> = {};
  const values: DirectEditValues = { name: null, doc: null, phone: null };

  const name = input.name.trim();
  if (name) {
    if (name.length < 2 || name.length > 120) {
      fieldErrors.name = "Escribe tu nombre completo.";
    } else {
      values.name = name;
    }
  }

  const doc = input.doc.trim();
  if (doc) {
    const normalized = normalizeDocByKind(kind, doc);
    if (!normalized) {
      fieldErrors.doc =
        kind === "empresa"
          ? "RIF inválido. Formato J-12345678-9."
          : "Cédula o pasaporte inválido. Formato V-12345678 o P-A1234567.";
    } else {
      values.doc = normalized;
    }
  }

  const phone = input.phone.trim();
  if (phone) {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 7 || digits.length > 15) {
      fieldErrors.phone = "Teléfono inválido.";
    } else {
      // Formato canónico de 0353: 58 + 10 dígitos para Venezuela.
      values.phone = normalizeWhatsappPhone(phone);
    }
  }

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  return { ok: true, values };
}

export type DirectEditOutcome =
  | "applied"
  | "no_changes"
  | "blocked"
  | "rate_limited";

export function isDirectEditOutcome(value: unknown): value is DirectEditOutcome {
  return (
    value === "applied" ||
    value === "no_changes" ||
    value === "blocked" ||
    value === "rate_limited"
  );
}

/** Mensajes al cliente. `blocked` NO revela que el dato exista en otra ficha. */
export const DIRECT_EDIT_MESSAGES = {
  noChanges: "No cambiaste ningún dato.",
  blocked:
    "No pudimos guardar ese dato. Escríbenos por soporte y lo revisamos.",
  rateLimited:
    "Por seguridad, espera 24 horas para volver a cambiar tu documento o tu teléfono, o escríbenos por soporte.",
  limitReached:
    "Ya usaste tus 3 cambios de perfil. Si necesitas corregir algo importante, escríbenos por soporte.",
  unavailable: "No está disponible ahora. Prueba de nuevo en un rato.",
  failed: "No pudimos guardar tus datos. Prueba de nuevo.",
} as const;
