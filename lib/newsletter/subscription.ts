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
