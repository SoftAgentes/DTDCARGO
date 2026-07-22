import { createHash } from "node:crypto";
import type { NewsletterCampaignInput } from "./types";

const EMAIL_FIELD_LIMITS = {
  internalName: 120,
  subject: 150,
  previewText: 180,
  heading: 160,
  bodyText: 12_000,
  ctaLabel: 50,
} as const;

export function validateNewsletterCampaignInput(
  raw: NewsletterCampaignInput,
): { ok: true; value: NewsletterCampaignInput } | { ok: false; error: string } {
  const value: NewsletterCampaignInput = {
    id: raw.id?.trim() || undefined,
    internalName: raw.internalName.trim(),
    subject: raw.subject.trim(),
    previewText: raw.previewText.trim(),
    heading: raw.heading.trim(),
    bodyText: raw.bodyText.trim(),
    ctaLabel: raw.ctaLabel.trim(),
    ctaUrl: raw.ctaUrl.trim(),
  };

  if (value.internalName.length < 3) return fail("Escribe un nombre interno de al menos 3 caracteres.");
  if (value.subject.length < 3) return fail("Escribe el asunto del correo.");
  if (value.heading.length < 3) return fail("Escribe el título principal del correo.");
  if (value.bodyText.length < 20) return fail("El contenido debe tener al menos 20 caracteres.");

  for (const [field, limit] of Object.entries(EMAIL_FIELD_LIMITS)) {
    if (value[field as keyof typeof EMAIL_FIELD_LIMITS].length > limit) {
      return fail(`El campo ${field} supera el máximo de ${limit} caracteres.`);
    }
  }

  if ((value.ctaLabel && !value.ctaUrl) || (!value.ctaLabel && value.ctaUrl)) {
    return fail("El botón necesita texto y enlace, o ambos campos vacíos.");
  }
  if (value.ctaUrl) {
    try {
      const url = new URL(value.ctaUrl);
      if (url.protocol !== "https:") return fail("El enlace del botón debe usar HTTPS.");
    } catch {
      return fail("El enlace del botón no es válido.");
    }
  }

  return { ok: true, value };
}
export function newsletterContentHash(input: NewsletterCampaignInput): string {
  const canonical = JSON.stringify({
    internalName: input.internalName.trim(),
    subject: input.subject.trim(),
    previewText: input.previewText.trim(),
    heading: input.heading.trim(),
    bodyText: input.bodyText.trim(),
    ctaLabel: input.ctaLabel.trim(),
    ctaUrl: input.ctaUrl.trim(),
  });
  return createHash("sha256").update(canonical).digest("hex");
}

function fail(error: string) {
  return { ok: false as const, error };
}
