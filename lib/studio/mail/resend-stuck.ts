/**
 * Reenvío de un correo que no llegó.
 *
 * Complemento de `/api/cron/mail-health` (SDD-0248): aquel **detecta**, esto
 * **repara**. Sin esto, el aviso obliga a resolver a mano por SQL — y un aviso
 * que no se puede accionar desde la pantalla termina ignorándose.
 *
 * ── Lo que se puede y lo que no, y por qué ─────────────────────────────────
 *
 * **`mail_logs` NO guarda el cuerpo.** Guarda `subject`, `template_slug` y
 * `rendered_variables`, no el HTML final. Así que el correo se puede reconstruir
 * **sólo si salió de una plantilla**: se vuelve a renderizar con las mismas
 * variables. Un correo mandado con `subject` + `html` crudos (avisos internos,
 * confirmación del formulario de contacto) es irrecuperable, y hay que decirlo
 * en vez de mandar un cuerpo vacío.
 *
 * **Un rebote NO se reenvía a la misma dirección.** `bounced` / `complained`
 * significan que la dirección no sirve o que el destinatario marcó spam. Volver
 * a mandar ahí no falla distinto: falla igual, y de paso castiga la reputación
 * del dominio. Hay que corregirle el correo al cliente primero. Es la diferencia
 * entre los dos modos de falla que ya separa `mail-health`:
 * `nunca_salio` se reenvía, `no_llego` no.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail, type SendEmailResult } from "./send-email";

export type StuckMailRow = {
  id: string;
  tenant_id: string;
  to_email: string;
  to_name: string | null;
  subject: string | null;
  template_slug: string | null;
  rendered_variables: Record<string, string> | null;
  status: string;
};

export type ResendCheck =
  | { ok: true; templateSlug: string; vars: Record<string, string> }
  | { ok: false; reason: string };

/** Statuses que ya llegaron: reenviar sería duplicarle el correo al cliente. */
const YA_LLEGO = new Set(["delivered", "opened", "clicked", "sent"]);
/** La dirección no sirve · reenviar al mismo destino no cambia nada. */
const DESTINO_MUERTO = new Set(["bounced", "complained"]);

/**
 * ¿Se puede reenviar esta fila? Pura y testeable: sin DB ni red.
 *
 * Devuelve el motivo en `reason` cuando no se puede, para mostrárselo tal cual
 * al operador — que sepa POR QUÉ, no sólo que el botón no anda.
 */
export function canResend(row: StuckMailRow): ResendCheck {
  if (YA_LLEGO.has(row.status)) {
    return {
      ok: false,
      reason: "Este correo sí llegó. Reenviarlo le duplicaría el mensaje al cliente.",
    };
  }

  if (DESTINO_MUERTO.has(row.status)) {
    return {
      ok: false,
      reason:
        "Este correo rebotó: la dirección no sirve. Reenviarlo al mismo destino falla igual y castiga la reputación del dominio — hay que corregirle el correo al cliente primero.",
    };
  }

  if (!row.template_slug) {
    return {
      ok: false,
      reason:
        "Este correo se mandó con cuerpo libre, y el cuerpo no se guarda en el historial: no se puede reconstruir. Mandalo de nuevo desde 'Correo manual'.",
    };
  }

  if (!row.to_email?.trim()) {
    return { ok: false, reason: "La fila no tiene destinatario." };
  }

  return {
    ok: true,
    templateSlug: row.template_slug,
    vars: row.rendered_variables ?? {},
  };
}

/**
 * Reenvía el correo re-renderizando su plantilla con las MISMAS variables.
 *
 * Genera un `mail_log` nuevo en vez de reescribir el viejo, a propósito: el
 * historial tiene que mostrar que hubo dos intentos y cuándo. Pisar la fila
 * original borraría la evidencia de que el primero se perdió.
 *
 * El log nuevo queda enlazado al original por `metadata.resend_of`.
 */
export async function resendStuckMail(
  admin: SupabaseClient,
  row: StuckMailRow,
): Promise<SendEmailResult> {
  const check = canResend(row);
  if (!check.ok) return { ok: false, error: check.reason };

  return sendEmail(admin, row.tenant_id, {
    templateSlug: check.templateSlug,
    to: row.to_email,
    to_name: row.to_name ?? undefined,
    vars: check.vars,
    metadata: { source: "resend-stuck", resend_of: row.id },
  });
}
