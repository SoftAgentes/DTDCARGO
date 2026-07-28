export const NEWSLETTER_HONEYPOT_FIELD = "empresa_web";

export const NEWSLETTER_SOURCES = [
  "noticias",
  "noticias-articulo",
  "footer",
  "admin",
] as const;

export type NewsletterSource = (typeof NEWSLETTER_SOURCES)[number];
