import {
  NEWSLETTER_HONEYPOT_FIELD,
  NEWSLETTER_SOURCES,
  type NewsletterSource,
} from "./constants";

export type NewsletterSubscribeInput = {
  email: string;
  source: NewsletterSource;
  consent: true;
};

export type NewsletterSubscribeValidation =
  | { ok: true; input: NewsletterSubscribeInput }
  | { ok: false; reason: "honeypot" | "email" | "consent" };

export type NewsletterSubscriberUpsertInput = {
  tenantId: string;
  email: string;
  source: NewsletterSource;
  consentAt: string;
  consentIpHash: string;
  userAgent: string | null;
};

export function isNewsletterSource(value: unknown): value is NewsletterSource {
  return (
    typeof value === "string" &&
    (NEWSLETTER_SOURCES as readonly string[]).includes(value)
  );
}

function canonicalizeNewsletterEmail(raw: unknown): string | null {
  const email = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function validateNewsletterSubscribePayload(
  body: Record<string, unknown>,
): NewsletterSubscribeValidation {
  const honeypot = String(body[NEWSLETTER_HONEYPOT_FIELD] ?? "").trim();
  if (honeypot) return { ok: false, reason: "honeypot" };

  const email = canonicalizeNewsletterEmail(body.email);
  if (!email) return { ok: false, reason: "email" };

  if (body.consent !== true) return { ok: false, reason: "consent" };

  const source = isNewsletterSource(body.source) ? body.source : "noticias";

  return { ok: true, input: { email, source, consent: true } };
}

export function newsletterSuccessMessage() {
  return {
    ok: true,
    message:
      "Si el correo puede recibir Actualidad de DTD Cargo, la suscripción quedó registrada.",
  };
}

/**
 * Registro canónico de alta o resuscripción.
 *
 * Una nueva autorización reemplaza la baja anterior: fecha y motivo deben
 * limpiarse juntos para que el estado auditable no quede contradictorio.
 */
export function buildNewsletterSubscriberUpsert(
  input: NewsletterSubscriberUpsertInput,
) {
  return {
    tenant_id: input.tenantId,
    email: input.email,
    status: "subscribed" as const,
    origin: input.source,
    consent_text:
      "Acepto recibir comunicaciones por email de DTD Cargo. Máximo dos correos al mes. Puedo darme de baja cuando quiera.",
    consent_at: input.consentAt,
    consent_ip_hash: input.consentIpHash,
    user_agent: input.userAgent,
    unsubscribed_at: null,
    unsubscribe_reason: null,
    updated_at: input.consentAt,
  };
}
