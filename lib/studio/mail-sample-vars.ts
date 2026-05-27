/**
 * Sample vars para preview/test de templates de mailing.
 *
 * Usado por:
 *  - sendTestTemplateAction (server, manda email de prueba con datos demo)
 *  - TemplateEditorDrawer (client, render preview en iframe)
 *
 * Cada variable conocida tiene un default representativo. Vars desconocidas
 * caen a "[var_name]" para que sea visible en el preview que falta resolver.
 */

const DEFAULTS: Record<string, string> = {
  // Cliente / persona
  customer_name: "María Pérez",
  inviter_name: "Sam Maan",
  tenant_name: "DTD Cargo",
  role_label: "Admin",
  invitation_link: "https://dtdcargo.com/invitar/SAMPLE_TOKEN_XYZ",
  expires_in_days: "7",
  agent_name: "Sam",
  reporter_name: "María Pérez",

  // Comercial / cotizaciones
  quote_code: "Q-2026-0042",
  validity_days: "15",
  service: "Puerta a Puerta DDP",

  // Facturación
  invoice_code: "F-2026-0117",
  shipment_code: "S-2026-0089",
  markbox: "DTD-1234",
  issue_date: "2026-05-26",
  due_date: "2026-06-25",
  days_overdue: "5",
  total_usd: "4,250.00",
  total_ves: "152,000.00",
  bcv_rate: "35.76",

  // Operativo
  origin: "Yiwu, CN",
  destination: "Caracas, VE",
  cbm: "12.5",
  eta: "2026-06-15",
  arrival_date: "2026-06-12",
  customs_eta_days: "3",
  whatsapp_number: "+58 412 166 8021",

  // No-olvidar
  requester_name: "María Pérez",
  requester_email: "maria@example.com",
  reason: "Olvidé mi master password del No-Olvidar.",
  requested_at: "2026-05-26 18:30 UTC",
  expires_at: "2026-05-28 18:30 UTC",
  approvals_required: "2 de 3 admins",
  review_url: "https://dtdcargo.com/studio/no-olvidar/recovery/SAMPLE",

  // Bug reporter
  bug_folio: "BUG-00042",
  bug_title: "Drawer no cierra con ESC",
  bug_state: "Triaje",
  bug_severity: "Crítica",
  notif_type_label: "Bug crítico reportado",
  message_excerpt: "Mensaje de ejemplo del admin sobre tu reporte.",
  bug_url: "https://dtdcargo.com/studio/bugs?focus=sample",
  action_label: "Ver bug",
};

/**
 * Devuelve un map de sample vars para las variables del template.
 * Variables conocidas → default representativo. Desconocidas → "[var_name]".
 */
export function buildSampleVars(
  slug: string,
  variableNames: string[],
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const v of variableNames) {
    result[v] = DEFAULTS[v] ?? `[${v}]`;
  }
  // Slug-specific overrides (placeholder por si en el futuro algún slug
  // necesita defaults distintos)
  if (slug === "team_invitation") {
    result.inviter_name = result.inviter_name || "Sam Maan";
  }
  return result;
}

/**
 * Render client-side de un template HTML con variables {{var}}.
 * NO ejecuta JS · solo sustitución de strings.
 */
export function renderTemplateClient(
  html: string,
  vars: Record<string, string>,
): string {
  return html.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
    return vars[key] ?? `{{${key}}}`;
  });
}
