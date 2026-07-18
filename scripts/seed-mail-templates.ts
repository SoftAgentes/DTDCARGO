/**
 * Seed UPSERT de templates de mailing (SDD-0026 Fase 1).
 *
 * Sincroniza `public.mail_templates` por cada tenant con la lista
 * MAIL_TEMPLATE_SEED de este archivo. Fuente de verdad: código.
 *
 * Idempotente: `on conflict (tenant_id, slug) do update`. Re-deploys
 * actualizan subject/body/category sin migración manual.
 *
 * Defensivo: usa service_role (las policies de mail_templates permiten
 * INSERT a authenticated por tenant, pero como el seed corre sin sesión,
 * va por service_role).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  extractVariables,
  type MailCategory,
  type MailChannel,
} from "@/lib/studio/mail-types";

interface MailTemplateSeed {
  slug: string;
  name: string;
  category: MailCategory;
  channel: MailChannel;
  subject: string;
  body_html: string;
  lang?: string;
}

/**
 * 8 templates iniciales del Studio. HTML simple pero alineado al Brand
 * Book DTD (Archivo font, wine accent, structure sentence-case). Vars
 * con {{snake_case}}. Se auto-extraen al UPSERT (no hace falta listarlas).
 *
 * Estos templates cubren los 6 flujos críticos del Studio:
 *  - Estimados (enviado / aceptado)
 *  - Facturación (emitida / vencida)
 *  - Operación (embarque creado / arribado)
 *  - Cliente (bienvenida)
 *  - Sistema (recovery no-olvidar)
 */
const MAIL_TEMPLATE_SEED: MailTemplateSeed[] = [
  {
    slug: "quote_sent",
    name: "Estimado enviado",
    category: "comercial",
    channel: "email",
    subject: "Estimado DTD Cargo · {{quote_code}} · {{customer_name}}",
    body_html: htmlBlock(`
      <p>Hola {{customer_name}},</p>
      <p>Te adjuntamos el estimado <strong>{{quote_code}}</strong> con el desglose del flete puerta a puerta.</p>
      <table style="border-collapse:collapse;font:14px Archivo,sans-serif;margin:16px 0;">
        <tr><td style="padding:6px 12px;color:#6B6B6B;">Ruta</td><td style="padding:6px 12px;color:#0F1E3D;">{{origin}} → {{destination}}</td></tr>
        <tr><td style="padding:6px 12px;color:#6B6B6B;">Servicio</td><td style="padding:6px 12px;color:#0F1E3D;">{{service}}</td></tr>
        <tr><td style="padding:6px 12px;color:#6B6B6B;">Volumen</td><td style="padding:6px 12px;color:#0F1E3D;">{{cbm}} CBM</td></tr>
        <tr><td style="padding:6px 12px;color:#6B6B6B;">Total</td><td style="padding:6px 12px;color:#7F0F1A;font-weight:bold;">USD {{total_usd}}</td></tr>
      </table>
      <p>El estimado es válido por <strong>{{validity_days}}</strong> días.</p>
      <p>Cualquier ajuste, contesta este correo y lo coordinamos.</p>
    `),
  },
  {
    slug: "quote_accepted",
    name: "Estimado aceptado · confirmación",
    category: "comercial",
    channel: "email",
    subject: "Estimado {{quote_code}} confirmado — siguiente paso",
    body_html: htmlBlock(`
      <p>Hola {{customer_name}},</p>
      <p>Recibimos tu confirmación del estimado <strong>{{quote_code}}</strong>. Vamos a abrir el embarque y te enviamos el código de seguimiento en las próximas <strong>24 horas hábiles</strong>.</p>
      <p>Mientras tanto, puedes ir preparando:</p>
      <ul style="font:14px Archivo,sans-serif;color:#0F1E3D;">
        <li>Packing list final</li>
        <li>Factura comercial del proveedor en CN</li>
        <li>HS codes de los productos (si los tienes)</li>
      </ul>
      <p>Cualquier consulta a este mismo correo o por WhatsApp.</p>
    `),
  },
  {
    slug: "invoice_emitted",
    name: "Factura emitida",
    category: "cobranza",
    channel: "email",
    subject: "DTD Cargo · Factura {{invoice_code}} por USD {{total_usd}}",
    body_html: htmlBlock(`
      <p>Hola {{customer_name}},</p>
      <p>Adjuntamos la factura <strong>{{invoice_code}}</strong> correspondiente al embarque {{shipment_code}}.</p>
      <table style="border-collapse:collapse;font:14px Archivo,sans-serif;margin:16px 0;">
        <tr><td style="padding:6px 12px;color:#6B6B6B;">Fecha de emisión</td><td style="padding:6px 12px;color:#0F1E3D;">{{issue_date}}</td></tr>
        <tr><td style="padding:6px 12px;color:#6B6B6B;">Vencimiento</td><td style="padding:6px 12px;color:#0F1E3D;">{{due_date}}</td></tr>
        <tr><td style="padding:6px 12px;color:#6B6B6B;">Total USD</td><td style="padding:6px 12px;color:#0F1E3D;font-family:'JetBrains Mono',monospace;">USD {{total_usd}}</td></tr>
        <tr><td style="padding:6px 12px;color:#6B6B6B;">Equivalente VES</td><td style="padding:6px 12px;color:#0F1E3D;font-family:'JetBrains Mono',monospace;">Bs. {{total_ves}} @ BCV {{bcv_rate}}</td></tr>
      </table>
      <p>Datos para transferencia o pago en USDT al final del email.</p>
    `),
  },
  {
    slug: "invoice_overdue",
    name: "Factura vencida · recordatorio",
    category: "cobranza",
    channel: "email",
    subject: "Recordatorio · Factura {{invoice_code}} vencida hace {{days_overdue}} días",
    body_html: htmlBlock(`
      <p>Hola {{customer_name}},</p>
      <p>Te recordamos que la factura <strong>{{invoice_code}}</strong> por <strong>USD {{total_usd}}</strong> venció el <strong>{{due_date}}</strong>.</p>
      <p>Para evitar el corte de servicios y la suspensión de embarques en curso, te pedimos regularizar el pago lo antes posible.</p>
      <p>Si ya pagaste, mándanos el comprobante a este correo y lo conciliamos.</p>
      <p>Cualquier consulta o coordinación de plan de pagos, contáctanos.</p>
    `),
  },
  {
    slug: "shipment_created",
    name: "Embarque creado · código de seguimiento",
    category: "operativo",
    channel: "email",
    subject: "Embarque {{shipment_code}} creado — seguimiento disponible",
    body_html: htmlBlock(`
      <p>Hola {{customer_name}},</p>
      <p>Abrimos el embarque <strong>{{shipment_code}}</strong>. Puedes seguirlo en cualquier momento desde:</p>
      <p style="margin:20px 0;"><a href="https://dtdcargo.com/track/{{shipment_code}}" style="display:inline-block;padding:10px 18px;background:#7F0F1A;color:#fff;text-decoration:none;font:600 14px Archivo,sans-serif;border-radius:6px;">Ver tracking → {{shipment_code}}</a></p>
      <table style="border-collapse:collapse;font:14px Archivo,sans-serif;margin:16px 0;">
        <tr><td style="padding:6px 12px;color:#6B6B6B;">Ruta</td><td style="padding:6px 12px;color:#0F1E3D;">{{origin}} → {{destination}}</td></tr>
        <tr><td style="padding:6px 12px;color:#6B6B6B;">Servicio</td><td style="padding:6px 12px;color:#0F1E3D;">{{service}}</td></tr>
        <tr><td style="padding:6px 12px;color:#6B6B6B;">ETA estimada</td><td style="padding:6px 12px;color:#0F1E3D;">{{eta}}</td></tr>
      </table>
      <p>Te vamos a notificar en cada hito (zarpado, en aduana, arribado, entregado).</p>
    `),
  },
  {
    slug: "shipment_arrived",
    name: "Embarque arribado a destino",
    category: "operativo",
    channel: "email",
    subject: "Tu carga llegó · {{shipment_code}} arribada a {{destination}}",
    body_html: htmlBlock(`
      <p>Hola {{customer_name}},</p>
      <p>Tu embarque <strong>{{shipment_code}}</strong> arribó a <strong>{{destination}}</strong> el <strong>{{arrival_date}}</strong>.</p>
      <p>Próximos pasos:</p>
      <ol style="font:14px Archivo,sans-serif;color:#0F1E3D;">
        <li>Liberación aduanal (estimamos {{customs_eta_days}} días hábiles)</li>
        <li>Coordinación de retiro o entrega final</li>
        <li>POD firmada al recibir</li>
      </ol>
      <p>Cuando esté listo para retiro o salida hacia tu dirección, te avisamos por este correo y por WhatsApp.</p>
    `),
  },
  {
    slug: "customer_welcome",
    name: "Bienvenida · nuevo cliente",
    category: "cliente",
    channel: "email",
    subject: "Bienvenido a DTD Cargo, {{customer_name}}",
    body_html: htmlBlock(`
      <p>Hola {{customer_name}},</p>
      <p>Gracias por elegirnos para tu logística China → Venezuela. Tu cuenta quedó creada con Shipping Mark <strong>{{markbox}}</strong> — usa este código en cualquier comunicación con nosotros.</p>
      <p>Algunos atajos útiles:</p>
      <ul style="font:14px Archivo,sans-serif;color:#0F1E3D;">
        <li><strong>Estimar:</strong> responde este correo o entra a dtdcargo.com/estimacion</li>
        <li><strong>Tracking:</strong> dtdcargo.com/track + tu código de envío</li>
        <li><strong>WhatsApp:</strong> {{whatsapp_number}}</li>
      </ul>
      <p>Tu agente comercial asignado es <strong>{{agent_name}}</strong>. Cualquier cosa, vas directo a él.</p>
      <p>Bienvenido a bordo.</p>
    `),
  },
  {
    slug: "no_olvidar_recovery_requested",
    name: "No-Olvidar · pedido de recovery (admin)",
    category: "sistema",
    channel: "email",
    subject: "[DTD No-Olvidar] {{requester_name}} solicitó recovery — necesitamos tu aprobación",
    body_html: htmlBlock(`
      <p>Hola,</p>
      <p>El usuario <strong>{{requester_name}}</strong> ({{requester_email}}) solicitó un recovery del No-Olvidar interno.</p>
      <table style="border-collapse:collapse;font:14px Archivo,sans-serif;margin:16px 0;">
        <tr><td style="padding:6px 12px;color:#6B6B6B;vertical-align:top;">Motivo</td><td style="padding:6px 12px;color:#0F1E3D;">{{reason}}</td></tr>
        <tr><td style="padding:6px 12px;color:#6B6B6B;">Solicitado</td><td style="padding:6px 12px;color:#0F1E3D;font-family:'JetBrains Mono',monospace;">{{requested_at}}</td></tr>
        <tr><td style="padding:6px 12px;color:#6B6B6B;">Expira</td><td style="padding:6px 12px;color:#0F1E3D;font-family:'JetBrains Mono',monospace;">{{expires_at}}</td></tr>
        <tr><td style="padding:6px 12px;color:#6B6B6B;">Aprobaciones requeridas</td><td style="padding:6px 12px;color:#0F1E3D;">{{approvals_required}}</td></tr>
      </table>
      <p><strong>Aprueba solo si confirmaste por canal externo (WhatsApp, llamada) que el pedido es legítimo.</strong> Un recovery aprobado permite resetear la master password del No-Olvidar.</p>
      <p style="margin:20px 0;"><a href="{{review_url}}" style="display:inline-block;padding:10px 18px;background:#7F0F1A;color:#fff;text-decoration:none;font:600 14px Archivo,sans-serif;border-radius:6px;">Revisar en el No-Olvidar →</a></p>
    `),
  },
  {
    slug: "team_invitation",
    name: "Invitación al equipo · DTD Studio",
    category: "interno",
    channel: "email",
    subject: "{{inviter_name}} te invitó a {{tenant_name}} · DTD Studio",
    body_html: htmlBlock(`
      <p>Hola,</p>
      <p><strong>{{inviter_name}}</strong> te invitó a unirte al equipo de <strong>{{tenant_name}}</strong> en DTD Studio con el rol de <strong>{{role_label}}</strong>.</p>
      <p>Acepta tu invitación y crea tu cuenta:</p>
      <p style="margin:20px 0;"><a href="{{invitation_link}}" style="display:inline-block;padding:10px 18px;background:#7F0F1A;color:#fff;text-decoration:none;font:600 14px Archivo,sans-serif;border-radius:6px;">Aceptar invitación →</a></p>
      <p style="color:#6B6B6B;font-size:13px;">El link expira en <strong>{{expires_in_days}}</strong> días. Si no esperabas esta invitación, ignórala — no se crea ninguna cuenta hasta que la aceptes.</p>
      <hr style="border:0;border-top:1px solid #E8E6E2;margin:24px 0;">
      <p style="color:#6B6B6B;font-size:12px;margin:0;">¿Problemas con el link? Cópialo a tu navegador:<br><code style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#7F0F1A;word-break:break-all;">{{invitation_link}}</code></p>
    `),
  },
  {
    // SDD-0082 (SDD-0062 Slice D): reactivación de prospectos inactivos por email.
    // MARKETING → lleva footer de baja obligatorio ({{unsubscribe_url}}). Sin sender
    // automático todavía: un admin crea la regla en /studio/mailing cuando corresponda.
    slug: "lead_dormant_reengagement",
    name: "Prospecto inactivo · reenganche",
    category: "comercial",
    channel: "email",
    subject: "{{customer_name}}, ¿seguimos con tu importación?",
    body_html: htmlBlock(`
      <p>Hola {{customer_name}},</p>
      <p>Hace un tiempo nos escribiste por una importación desde China y no llegamos a cerrarla. ¿Sigues con la idea? Estamos para ayudarte a traerla puerta a puerta.</p>
      <p>Lo que hacemos:</p>
      <ul style="font:14px Archivo,sans-serif;color:#0F1E3D;">
        <li>Consolidación LCL desde China — pagas solo tu espacio</li>
        <li>Puerta a puerta — pagas al llegar*</li>
        <li>Agente de compra e inspección en origen</li>
      </ul>
      <p>Respóndenos este correo o escríbenos por WhatsApp {{whatsapp_number}} y retomamos donde quedamos.</p>
      <hr style="border:0;border-top:1px solid #E8E6E2;margin:24px 0;">
      <p style="color:#6B6B6B;font-size:11px;margin:0;line-height:1.5;">Recibes este correo porque te registraste o nos escribiste y aceptaste novedades por email. <a href="{{unsubscribe_url}}" style="color:#6B6B6B;text-decoration:underline;">Darme de baja</a>.</p>
    `),
  },
];

/**
 * Helper para HTML compacto: trim de indentación + colapsa whitespace
 * múltiple. Mantiene legibilidad en código sin inflar el body en DB.
 */
function htmlBlock(s: string): string {
  return s
    .replace(/^\s*\n/, "")
    .replace(/\n\s*/g, "\n")
    .trim();
}

function seedToRow(s: MailTemplateSeed, tenantId: string) {
  const variables = extractVariables(`${s.subject} ${s.body_html}`);
  return {
    tenant_id: tenantId,
    slug: s.slug,
    name: s.name,
    category: s.category,
    channel: s.channel,
    subject: s.subject,
    body_html: s.body_html,
    variables,
    lang: s.lang ?? "es",
    active: true,
  };
}

export async function seedMailTemplates(supabase: SupabaseClient): Promise<void> {
  // Necesitamos iterar tenants — los templates son tenant-scoped.
  const { data: tenants, error: tenantsErr } = await supabase
    .from("tenants")
    .select("id, display_name");

  if (tenantsErr || !tenants || tenants.length === 0) {
    console.log("[seed-mail-templates] No hay tenants en DB — nada que sembrar.");
    return;
  }

  let totalUpserted = 0;
  for (const t of tenants as Array<{ id: string; display_name: string }>) {
    const rows = MAIL_TEMPLATE_SEED.map((s) => seedToRow(s, t.id));
    const { error, data } = await supabase
      .from("mail_templates")
      .upsert(rows, { onConflict: "tenant_id,slug" })
      .select("slug");

    if (error) {
      throw new Error(
        `[seed-mail-templates] UPSERT failed para tenant ${t.display_name}: ${error.message}`,
      );
    }

    const count = (data ?? []).length;
    totalUpserted += count;
    console.log(
      `[seed-mail-templates] Tenant ${t.display_name}: ${count} templates sincronizadas.`,
    );
  }

  console.log(
    `[seed-mail-templates] Total: ${totalUpserted} templates upserted (${MAIL_TEMPLATE_SEED.length} × ${tenants.length} tenants).`,
  );
}
