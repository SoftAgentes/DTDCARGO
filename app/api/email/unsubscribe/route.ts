import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { canonicalizeEmail } from "@/lib/studio/email-utils";
import {
  unsubscribeSecret,
  verifyUnsubscribeToken,
} from "@/lib/studio/mail/unsubscribe-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Baja de marketing por email (SDD-0082 · SDD-0062 Slice D) — prerequisito LEGAL
 * de cualquier campaña. Link autocontenido firmado (token HMAC), sin sesión: lo
 * abre cualquiera desde su correo.
 *
 * Por qué un API route: `app/api/**` NO está bajo la frontera público↔ERP, así
 * que puede usar lib/studio + admin client. El token se firma con un secreto del
 * server (jamás expuesto). Idempotente: dar de baja dos veces es no-op.
 *
 * GET realiza la baja (los clientes de correo no hacen POST desde un link). Es
 * idempotente y seguro de repetir; el riesgo de prefetch es aceptable en V1 (no
 * hay campaña viva todavía). Efecto: revoca SOLO el consentimiento de marketing
 * (limpia clients.email_marketing_optin_at). **NO toca mail_blacklist** a propósito:
 * esa lista la chequea el motor para TODO envío (incluido el transaccional —
 * bienvenida, factura, avisos de envío), y la baja es de marketing únicamente. El
 * sender de campañas filtra por email_marketing_optin_at (índice parcial 0134) → con
 * el opt-in en NULL no entra al segmento, y los avisos transaccionales siguen.
 */
export async function GET(req: NextRequest) {
  const secret = unsubscribeSecret();
  if (!secret) {
    return htmlResponse(
      500,
      "No disponible",
      "La baja no está configurada. Escríbenos y te quitamos de la lista.",
    );
  }

  const token = req.nextUrl.searchParams.get("token");
  const payload = verifyUnsubscribeToken(token, secret);
  if (!payload) {
    return htmlResponse(
      400,
      "Enlace inválido",
      "Este enlace de baja no es válido o está incompleto.",
    );
  }

  const email = canonicalizeEmail(payload.email);
  if (!email) {
    return htmlResponse(400, "Enlace inválido", "El correo del enlace no es válido.");
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return htmlResponse(
      503,
      "No disponible",
      "No pudimos procesar la baja ahora. Intenta de nuevo en un rato.",
    );
  }

  if (payload.audience === "newsletter") {
    await admin
      .from("newsletter_subscribers")
      .update({
        status: "unsubscribed",
        unsubscribed_at: new Date().toISOString(),
        unsubscribe_reason: "signed_link",
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", payload.tenantId)
      .eq("email", email);
  } else {
    // Revocar el consentimiento de marketing por email en los clientes que calcen
    // (case-insensitive) dentro del tenant del token. NO se agrega a mail_blacklist:
    // esa lista bloquea TODO envío (incl. transaccional); la baja es solo de marketing
    // y el sender de campañas filtra por email_marketing_optin_at (ver docstring).
    await admin
      .from("clients")
      .update({ email_marketing_optin_at: null })
      .eq("tenant_id", payload.tenantId)
      .ilike("email", email);
  }

  return htmlResponse(
    200,
    "Listo, te diste de baja",
    payload.audience === "newsletter"
      ? "No vas a recibir más correos de Actualidad de DTD Cargo. Los avisos de tus envíos y facturas siguen llegando normalmente."
      : "No vas a recibir más correos de marketing de DTD Cargo. Los avisos de tus envíos y facturas siguen llegando normalmente.",
  );
}

/** Página HTML mínima de respuesta (standalone, estilos inline como los emails). */
function htmlResponse(status: number, title: string, body: string): NextResponse {
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title} · DTD Cargo</title></head>
<body style="margin:0;background:#FBFAF7;font-family:Archivo,system-ui,sans-serif;color:#0F1E3D">
<div style="max-width:480px;margin:64px auto;padding:32px 28px;background:#ffffff;border:1px solid #E8E6E2;border-radius:12px">
<p style="font-size:20px;font-weight:800;margin:0 0 12px">${title}</p>
<p style="font-size:14px;line-height:1.6;color:#333333;margin:0 0 20px">${body}</p>
<p style="font-size:12px;color:#6B6B6B;margin:0">DTD Cargo · Puerta a puerta China &rarr; Venezuela</p>
</div></body></html>`;
  return new NextResponse(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
