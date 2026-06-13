import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { sendEmail } from "@/lib/studio/mail/send-email";
import { CONTACT } from "@/lib/design-tokens";
import { apiError } from "@/lib/http/api-error";

/**
 * Captación del lead del formulario de contacto (/contacto).
 *
 * Por qué un API route y no un server action en /contacto: la frontera ESLint
 * prohíbe que el sitio público (app/contacto, components/) importe lib/studio /
 * lib/db / @supabase. `app/api/**` NO está bajo esa frontera → aquí sí podemos
 * usar el backend; el form solo hace `fetch` (un fetch no es import). Así se
 * captura el lead server-side SIN debilitar el aislamiento público↔ERP.
 *
 * Hace dos cosas (founder 2026-06-13):
 *   1. Avisa al EQUIPO (casilla general) con el lead → no se pierde aunque el
 *      cliente no toque el botón de WhatsApp.
 *   2. Manda al CLIENTE un email de confirmación ("recibimos tus datos").
 *
 * Best-effort: el form muestra igual la pantalla de WhatsApp pase lo que pase
 * (fallback que nunca pierde al que sí lo toca). El push directo a Kommo se
 * sumará cuando aterrice SDD-0074 (hoy el connector solo tiene el pull
 * Kommo→DTD; el WhatsApp del cliente ya alimenta el CRM por su cuenta).
 *
 * Anti-abuso V1: honeypot (campo trampa oculto del form). Throttle por IP =
 * hardening pendiente (ver portal_registro_throttle como molde).
 */

const HONEYPOT_FIELD = "empresa_web";

const TOPIC_LABELS: Record<string, string> = {
  cotizar: "Cotizar un envío",
  agente: "Agente de compra",
  inspeccion: "Inspección de fábrica",
  marca: "Registro de marca",
  visa: "Visa de negocios",
  otro: "Otro",
};

type ContactBody = {
  topic?: string;
  nombre?: string;
  email?: string;
  whatsapp?: string;
  mensaje?: string;
  code?: string;
  [key: string]: unknown;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export async function POST(req: Request) {
  let body: ContactBody;
  try {
    body = (await req.json()) as ContactBody;
  } catch {
    return apiError("Solicitud inválida.", "json parse", 400, "contact");
  }

  // Honeypot: si el campo trampa llega no-vacío, es un bot → respuesta genérica
  // ok SIN enviar nada (no revela la trampa).
  const honeypot = String(body[HONEYPOT_FIELD] ?? "").trim();
  if (honeypot) return NextResponse.json({ ok: true });

  const nombre = String(body.nombre ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const whatsapp = String(body.whatsapp ?? "").trim();
  const mensaje = String(body.mensaje ?? "").trim();
  const topic = String(body.topic ?? "otro").trim();
  const topicLabel = TOPIC_LABELS[topic] ?? topic;
  const code =
    String(body.code ?? "").trim() ||
    `WEB-${Math.random().toString(36).toUpperCase().slice(2, 8)}`;

  // Email + WhatsApp son obligatorios (founder): sin ellos el lead no sirve.
  if (!nombre || !email || !whatsapp || !mensaje) {
    return apiError("Faltan datos obligatorios.", "validation", 400, "contact");
  }
  if (!isEmail(email)) {
    return apiError("El email no es válido.", "validation", 400, "contact");
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return apiError(
      "El contacto no está disponible ahora. Escríbenos por WhatsApp.",
      e,
      503,
      "contact",
    );
  }

  // Tenant operativo de DTD (uno solo hoy; mismo patrón que el registro).
  const { data: tenantRow, error: tenantErr } = await admin
    .from("tenants")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (tenantErr || !tenantRow?.id) {
    return apiError(
      "No pudimos procesar tu mensaje. Escríbenos por WhatsApp.",
      tenantErr,
      500,
      "contact",
    );
  }
  const tenantId = tenantRow.id;

  // 1. Aviso al EQUIPO con el lead (a la casilla general).
  const team = await sendEmail(admin, tenantId, {
    subject: `Nuevo contacto web · ${topicLabel} — ${nombre}`,
    html: buildTeamHtml({ code, topicLabel, nombre, email, whatsapp, mensaje }),
    to: CONTACT.emailGeneral,
    to_name: "Equipo DTD",
    metadata: { source: "contact-form", code, topic },
  });

  // 2. Confirmación al CLIENTE (best-effort: un fallo acá no rompe la captación).
  const confirm = await sendEmail(admin, tenantId, {
    subject: "Recibimos tu mensaje · DTD Cargo",
    html: buildClientHtml({ nombre, topicLabel, mensaje }),
    to: email,
    to_name: nombre,
    metadata: { source: "contact-form-confirm", code },
  });
  if (!confirm.ok) {
    console.warn("[contact] confirmación al cliente falló:", confirm.error);
  }

  // El aviso al equipo es el que importa: si falla, devolvemos error y el form
  // cae al WhatsApp (que nunca pierde al lead que sí escribe).
  if (!team.ok) {
    return apiError(
      "No pudimos enviar tu mensaje. Escríbenos por WhatsApp.",
      team.error,
      502,
      "contact",
    );
  }

  return NextResponse.json({ ok: true, code });
}

function buildTeamHtml(p: {
  code: string;
  topicLabel: string;
  nombre: string;
  email: string;
  whatsapp: string;
  mensaje: string;
}): string {
  const rows: Array<[string, string]> = [
    ["Código", p.code],
    ["Tema", p.topicLabel],
    ["Nombre", p.nombre],
    ["Email", p.email],
    ["WhatsApp", p.whatsapp],
  ];
  const trs = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#6B6B6B;font-size:13px">${escapeHtml(k)}</td><td style="padding:4px 0;color:#0F1E3D;font-size:14px;font-weight:600">${escapeHtml(v)}</td></tr>`,
    )
    .join("");
  return `<div style="font-family:Archivo,system-ui,sans-serif;color:#0F1E3D;max-width:560px;padding:24px;background:#FBFAF7">
<p style="font-size:16px;margin:0 0 4px"><b>Nuevo contacto desde la web</b></p>
<p style="margin:0 0 16px;color:#6B6B6B;font-size:13px">Llegó por el formulario de /contacto. Escríbele por WhatsApp.</p>
<table style="border-collapse:collapse;margin:0 0 16px">${trs}</table>
<p style="margin:0 0 6px;color:#6B6B6B;font-size:13px">Mensaje:</p>
<p style="margin:0 0 20px;color:#0F1E3D;font-size:14px;line-height:1.5;white-space:pre-wrap">${escapeHtml(p.mensaje)}</p>
<p style="margin:0 0 12px"><a href="https://wa.me/${CONTACT.ve.whatsappRaw}" style="color:#7F0F1A;text-decoration:underline;font-weight:600">Abrir WhatsApp del CRM &rarr;</a></p>
<hr style="border:0;border-top:1px solid #E8E6E2;margin:24px 0">
<p style="color:#6B6B6B;font-size:12px;margin:0">DTD Cargo · aviso interno automático</p>
</div>`;
}

function buildClientHtml(p: {
  nombre: string;
  topicLabel: string;
  mensaje: string;
}): string {
  const firstName = p.nombre.split(/\s+/)[0] || p.nombre;
  return `<div style="font-family:Archivo,system-ui,sans-serif;color:#0F1E3D;max-width:560px;padding:24px;background:#FBFAF7">
<p style="font-size:18px;margin:0 0 12px"><b>Recibimos tu mensaje, ${escapeHtml(firstName)}.</b></p>
<p style="margin:0 0 16px;color:#333333;font-size:14px;line-height:1.55">Gracias por escribirnos. Un asesor humano —no un bot— te contacta por WhatsApp, normalmente en menos de 24 horas.</p>
<p style="margin:0 0 6px;color:#6B6B6B;font-size:13px">Tu consulta (${escapeHtml(p.topicLabel)}):</p>
<p style="margin:0 0 20px;color:#0F1E3D;font-size:14px;line-height:1.5;white-space:pre-wrap;border-left:3px solid #7F0F1A;padding-left:12px">${escapeHtml(p.mensaje)}</p>
<p style="margin:0 0 4px;color:#333333;font-size:14px">¿Es urgente? Escríbenos directo:</p>
<p style="margin:0 0 20px"><a href="https://wa.me/${CONTACT.ve.whatsappRaw}" style="color:#7F0F1A;text-decoration:underline;font-weight:600">WhatsApp ${escapeHtml(CONTACT.ve.whatsapp)} &rarr;</a></p>
<hr style="border:0;border-top:1px solid #E8E6E2;margin:24px 0">
<p style="color:#6B6B6B;font-size:12px;margin:0">DTD Cargo · Puerta a puerta China &rarr; Venezuela · ${escapeHtml(CONTACT.web)}</p>
</div>`;
}
