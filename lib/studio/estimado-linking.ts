/**
 * SDD-0061 Fase B2 — Helpers PUROS del vínculo estimado web ↔ cliente.
 *
 * Lógica de matcheo (teléfono/email) compartida por:
 *  - el vínculo automático por datos del registro (Slice 2),
 *  - el cruce con el lead de Kommo por teléfono (Slice 4),
 *  - la resolución de destinatario del mail a prospecto (Slice 5).
 *
 * SIN imports de Supabase ni del ERP: es transformación pura → testeable con
 * stubs. Las queries que tocan la DB viven en `quote-queries.ts` / `kommo-convert.ts`
 * y consumen estos predicados.
 */

/** Solo los dígitos de un teléfono (descarta +, espacios, guiones, paréntesis). */
export function normalizePhone(raw: string | null | undefined): string {
  if (raw == null) return "";
  return String(raw).replace(/\D+/g, "");
}

/**
 * ¿Dos teléfonos son "el mismo"? Compara los ÚLTIMOS 10 dígitos — el número
 * nacional significativo de Venezuela — lo que tolera las variantes reales del
 * mismo número sin falsos positivos por el prefijo (código de país vs cero):
 *   "+58 412 1668021" (58+10) · "0412-1668021" (0+10) · "4121668021" (10)
 *   → los últimos 10 dígitos de los tres son "4121668021".
 * Exige ≥10 dígitos en ambos (un número incompleto no se cruza con seguridad).
 * Nota: comparar el sufijo completo del más corto fallaría acá, porque el cero
 * inicial del formato nacional no está en el internacional (58…) → desalinea.
 */
export function phonesMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const na = normalizePhone(a);
  const nb = normalizePhone(b);
  if (na.length < 10 || nb.length < 10) return false;
  return na.slice(-10) === nb.slice(-10);
}

/** Email canónico para comparar (trim + minúsculas). */
export function normalizeEmail(raw: string | null | undefined): string {
  return (raw ?? "").trim().toLowerCase();
}

/** ¿Dos emails son el mismo (exacto, case-insensitive)? Vacío nunca matchea. */
export function emailsMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const ea = normalizeEmail(a);
  const eb = normalizeEmail(b);
  return ea.length > 0 && ea === eb;
}

/**
 * Slice 2 — vínculo automático POR DATOS. El estimado web se vincula al cliente
 * registrado SOLO si teléfono Y email calzan exacto (decisión founder, §3.6 del
 * spec). Si el estimado no dejó email, no hay match por datos (queda para el
 * vínculo por código o el manual).
 */
export function prospectMatches(
  estimate: {
    prospect_email?: string | null;
    prospect_whatsapp?: string | null;
  },
  contact: { email?: string | null; phone?: string | null },
): boolean {
  return (
    emailsMatch(estimate.prospect_email, contact.email) &&
    phonesMatch(estimate.prospect_whatsapp, contact.phone)
  );
}

/**
 * Slice 5 — destinatario del mail. Para un estimado web sin MARKBOX, el cliente
 * todavía no existe → se le escribe al PROSPECTO. Prioridad:
 *   1. override directo (clientEmail),
 *   2. email resuelto por MARKBOX (markboxEmail),
 *   3. prospect_email del estimado web.
 * Devuelve el primero no-vacío, o null si no hay a quién escribirle.
 */
export function resolveClientRecipientEmail(args: {
  clientEmail?: string | null;
  markboxEmail?: string | null;
  prospectEmail?: string | null;
}): string | null {
  const pick = (v: string | null | undefined): string | null => {
    const t = (v ?? "").trim();
    return t.length > 0 ? t : null;
  };
  return pick(args.clientEmail) ?? pick(args.markboxEmail) ?? pick(args.prospectEmail);
}
