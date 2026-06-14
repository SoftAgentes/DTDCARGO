/**
 * Utilidades PURAS de email para captura/consentimiento (SDD-0082 · SDD-0062 Slice D).
 *
 * Centraliza la validación + canonicalización de email (hoy dispersa: un EMAIL_REGEX
 * propio en register-types, otro en client-types). Sin imports de Supabase ni del ERP
 * → testeable directo. La comparación/normalización de match ya vive en
 * `estimado-linking.ts` (`normalizeEmail`/`emailsMatch`); acá NO se mueve, se suma lo
 * que falta: validar + canonicalizar para guardar + el catálogo de fuentes de opt-in.
 */

/**
 * Email laxo pero suficiente (mismo criterio que el resto del repo): `algo@algo.tld`
 * sin espacios. No pretende ser RFC 5322 — atrapa typos groseros, no valida MX.
 */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** ¿El string es un email con formato válido? (tras trim). */
export function isValidEmail(raw: string | null | undefined): boolean {
  return EMAIL_RE.test(String(raw ?? "").trim());
}

/**
 * Email canónico para PERSISTIR: trim + minúsculas, validado. Devuelve el email
 * canónico o `null` si el formato es inválido (no guardamos basura). Es la forma
 * que se escribe en `clients.email` y se compara para dedup.
 */
export function canonicalizeEmail(raw: string | null | undefined): string | null {
  const e = String(raw ?? "").trim().toLowerCase();
  return e && EMAIL_RE.test(e) ? e : null;
}

// ── Fuente del opt-in de marketing (clients.email_optin_source) ─────────────
// TEXT en DB + validación acá (convención de clients: registration_channel/doc_kind
// son text + validación en app, no enum/CHECK en la DB).
export const EMAIL_OPTIN_SOURCES = [
  "portal_register",
  "kommo_flow",
  "kommo_salesbot",
  "admin_manual",
  "sign_in_google",
  "import",
] as const;

export type EmailOptinSource = (typeof EMAIL_OPTIN_SOURCES)[number];

export function isEmailOptinSource(v: unknown): v is EmailOptinSource {
  return (
    typeof v === "string" &&
    (EMAIL_OPTIN_SOURCES as readonly string[]).includes(v)
  );
}
