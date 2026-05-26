/**
 * Email de bienvenida al crear cliente (SDD-0032).
 *
 * Lee template `welcome_markbox` de `mail_templates` (seedeado por
 * 0026_welcome_email_template_seed.sql), renderiza variables y
 * registra el envío en `mail_logs` con status='queued'.
 *
 * V1 NO envía email real — espera que Resend esté configurado en V2.
 * El log queda como "queued" hasta que un job/worker lo procese.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const TEMPLATE_SLUG = "welcome_markbox";
const PORTAL_BASE = "https://portal.dtdcargo.com";

export type WelcomeEmailInput = {
  markbox: string;
  name: string;
  email: string;
};

export type WelcomeEmailResult =
  | { ok: true; log_id: string }
  | { ok: false; error: string };

/**
 * Renderiza `{{var_name}}` reemplazando por valor en `vars`.
 * Si una var no existe, deja el placeholder visible (debug-friendly).
 */
export function renderTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, k: string) =>
    vars[k] != null ? vars[k] : `{{${k}}}`,
  );
}

/**
 * Genera el link al portal del cliente desde el MARKBOX.
 * Ej: `DTD-5452` → `https://portal.dtdcargo.com/dtd-5452`
 */
export function portalLinkFromMarkbox(markbox: string): string {
  return `${PORTAL_BASE}/${markbox.toLowerCase()}`;
}

/**
 * Dispara el email de bienvenida (registro en mail_logs).
 *
 * Llamada desde server actions (createClientAction). Recibe el supabase
 * client ya autenticado del caller para mantener la transacción/RLS
 * coherente con el tenant resuelto.
 *
 * @returns log_id en éxito o error string en falla. NUNCA tira excepción —
 * la creación del cliente NO debe romperse si el email falla.
 */
export async function sendWelcomeEmail(
  supabase: SupabaseClient,
  tenantId: string,
  client: WelcomeEmailInput,
): Promise<WelcomeEmailResult> {
  if (!client.email || !client.email.trim()) {
    return { ok: false, error: "cliente sin email" };
  }

  // 1. Leer template
  const { data: template, error: tErr } = await supabase
    .from("mail_templates")
    .select("id, slug, subject, body_html, variables, active")
    .eq("tenant_id", tenantId)
    .eq("slug", TEMPLATE_SLUG)
    .maybeSingle<{
      id: string;
      slug: string;
      subject: string;
      body_html: string;
      variables: string[];
      active: boolean;
    }>();

  if (tErr) {
    return { ok: false, error: `error leyendo template: ${tErr.message}` };
  }
  if (!template) {
    return {
      ok: false,
      error:
        "template welcome_markbox no encontrado · aplicá la migration 0026_welcome_email_template_seed.sql",
    };
  }
  if (!template.active) {
    return { ok: false, error: "template welcome_markbox desactivado" };
  }

  // 2. Render
  const vars: Record<string, string> = {
    client_name: client.name,
    markbox: client.markbox,
    portal_link: portalLinkFromMarkbox(client.markbox),
  };
  const subject = renderTemplate(template.subject, vars);
  const body_html = renderTemplate(template.body_html, vars);

  // 3. Insert en mail_logs (status='queued' · sin Resend en V1)
  // NOTA: el insert necesita service_role porque la policy de mail_logs
  // bloquea INSERT desde authenticated. En V2, cuando Resend esté en
  // un worker server-side, se hace allí directo.
  // Por ahora usamos el caller's supabase (que debe correr con service_role
  // si llega de un server action que NO depende de auth.uid del browser).
  const { data: log, error: lErr } = await supabase
    .from("mail_logs")
    .insert({
      tenant_id: tenantId,
      template_id: template.id,
      template_slug: template.slug,
      to_email: client.email.trim(),
      to_name: client.name,
      subject,
      rendered_variables: vars,
      status: "queued",
      metadata: { source: "createClient", body_preview: body_html.slice(0, 200) },
    })
    .select("id")
    .single<{ id: string }>();

  if (lErr || !log) {
    return { ok: false, error: `error registrando log: ${lErr?.message}` };
  }

  return { ok: true, log_id: log.id };
}
