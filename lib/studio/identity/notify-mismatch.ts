/**
 * Alerta interna al equipo cuando una verificación de identidad da `mismatch`
 * (SDD-0046 · Slice B).
 *
 * Cuando el motor detecta que el nombre del registro oficial NO coincide con el
 * que cargó el cliente, el founder quiere que el equipo se entere ("clientes
 * reales, no basura"). Esto es un aviso interno, best-effort:
 *
 *   - **No rompe** la verificación: cualquier falla se loguea a console.error y
 *     la server action sigue (el status ya quedó persistido).
 *   - **Email crudo** (subject + html), NO un template de mail_templates: el plan
 *     B1 pide evitar una migración nueva de template. `sendEmail` acepta el
 *     override `{ subject, html }` sin tocar la DB de templates.
 *   - Va a los **admins del tenant** (mismo padrón que las notifs de bugs).
 *   - Respeta test_mode / blacklist (lo maneja `sendEmail` adentro).
 *
 * Usa el cliente admin (service_role) porque `mail_logs` INSERT está bloqueado
 * para `authenticated` (igual que welcome-email / bug-email-notify).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/studio/mail/send-email";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export type IdentityMismatchAlert = {
  /** MARKBOX del cliente (para el link y el cuerpo). */
  markbox: string;
  /** Nombre que cargó el cliente. */
  clientName: string;
  /** Nombre / razón social que devolvió el registro oficial. */
  registryName: string | null;
  /** Fuente del resultado (cne | seniat). */
  source: string;
};

/** Escapa lo mínimo para no romper el HTML del email con `<`, `>`, `&`. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Resuelve los emails de los admins activos del tenant (igual padrón que las
 * notifs de bugs: rol 'admin', no disabled, vía auth.admin.listUsers).
 */
async function resolveAdminEmails(
  supabaseAdmin: SupabaseClient,
  tenantId: string,
): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("user_tenants")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .eq("role", "admin")
    .is("disabled_at", null);

  if (error || !data || data.length === 0) return [];

  const ids = (data as Array<{ user_id: string }>).map((r) => r.user_id);
  const { data: users } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  const usersList = users?.users ?? [];
  return usersList
    .filter((u) => ids.includes(u.id) && !!u.email)
    .map((u) => u.email as string);
}

/**
 * Manda el aviso de mismatch a los admins del tenant. Best-effort: nunca tira.
 */
export async function notifyIdentityMismatch(
  supabaseAdmin: SupabaseClient,
  tenantId: string,
  alert: IdentityMismatchAlert,
): Promise<void> {
  try {
    const admins = await resolveAdminEmails(supabaseAdmin, tenantId);
    if (admins.length === 0) {
      console.warn(
        "[identity-notify] No hay admins para alertar mismatch",
        alert.markbox,
      );
      return;
    }

    const detailUrl = `${SITE_URL}/studio/clientes/${encodeURIComponent(alert.markbox)}`;
    const sourceLabel = alert.source === "seniat" ? "SENIAT" : "CNE";
    const registry = alert.registryName ?? "(no devuelto)";

    const subject = `Verificación de identidad · ${alert.markbox} no corresponde`;
    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a2e;line-height:1.5">
        <p>La verificación automática (${esc(sourceLabel)}) marcó <strong>no corresponde</strong>
        para el cliente <strong>${esc(alert.markbox)}</strong>.</p>
        <table style="border-collapse:collapse;margin:12px 0">
          <tr><td style="padding:4px 12px 4px 0;color:#6b6b80">Nombre cargado</td>
              <td style="padding:4px 0"><strong>${esc(alert.clientName)}</strong></td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#6b6b80">Nombre del registro</td>
              <td style="padding:4px 0"><strong>${esc(registry)}</strong></td></tr>
        </table>
        <p>Revísalo a ojo en el detalle del cliente:
          <a href="${detailUrl}" style="color:#7a1f3d">${detailUrl}</a>
        </p>
        <p style="color:#6b6b80;font-size:13px">Esto es advisory — el cliente sigue activo.
        Si el nombre es correcto (apellido de casada, 2º nombre, typo), marca "corresponde" manualmente.</p>
      </div>`;

    for (const to of admins) {
      const result = await sendEmail(supabaseAdmin, tenantId, {
        to,
        subject,
        html,
        metadata: {
          source: "identity-mismatch",
          markbox: alert.markbox,
          verify_source: alert.source,
        },
      });
      if (!result.ok) {
        console.error("[identity-notify] sendEmail failed:", result.error);
      }
    }
  } catch (err) {
    console.error("[identity-notify] notifyIdentityMismatch failed:", err);
  }
}
