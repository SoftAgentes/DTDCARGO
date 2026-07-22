import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { canonicalizeEmail } from "@/lib/studio/email-utils";
import {
  unsubscribeSecret,
  unsubscribeTokenFingerprint,
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
type UnsubscribeAudience = "newsletter" | "marketing";
type UnsubscribeResult = {
  status: number;
  title: string;
  body: string;
  audience?: UnsubscribeAudience;
};

export async function GET(req: NextRequest) {
  const result = await processUnsubscribe(req);
  const state = result.status === 200
    ? result.audience === "newsletter" ? "actualidad" : "marketing"
    : result.status >= 500 ? "error" : "invalido";

  // La confirmación vive en una página pública presentable. El redirect también
  // retira el token firmado (y por tanto el correo) de la URL que queda visible.
  return NextResponse.redirect(new URL(`/email/baja?estado=${state}`, req.url), 303);
}

/** RFC 8058 · baja de un clic desde el botón nativo del cliente de correo. */
export async function POST(req: NextRequest) {
  const result = await processUnsubscribe(req);
  return NextResponse.json(
    result.status === 200 ? { ok: true } : { ok: false, error: result.title },
    { status: result.status },
  );
}

async function processUnsubscribe(req: NextRequest): Promise<UnsubscribeResult> {
  const secret = unsubscribeSecret();
  if (!secret) {
    return { status: 500, title: "No disponible", body: "La baja no está configurada. Escríbenos y te quitamos de la lista." };
  }

  const token = req.nextUrl.searchParams.get("token");
  const payload = verifyUnsubscribeToken(token, secret);
  if (!payload) {
    const tokenValue = token ?? "";
    console.warn(JSON.stringify({
      level: "warn",
      event: "email_unsubscribe_invalid",
      requestId: req.headers.get("x-vercel-id"),
      tokenPresent: tokenValue.length > 0,
      tokenLength: tokenValue.length,
      tokenSegments: tokenValue ? tokenValue.split(".").length : 0,
      tokenFingerprint: tokenValue
        ? unsubscribeTokenFingerprint(tokenValue)
        : null,
      secretSource: process.env.EMAIL_UNSUBSCRIBE_SECRET
        ? "dedicated"
        : "service_role",
    }));
    return { status: 400, title: "Enlace inválido", body: "Este enlace de baja no es válido o está incompleto." };
  }

  const email = canonicalizeEmail(payload.email);
  if (!email) {
    return { status: 400, title: "Enlace inválido", body: "El correo del enlace no es válido." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { status: 503, title: "No disponible", body: "No pudimos procesar la baja ahora. Intenta de nuevo en un rato." };
  }

  let updateError: { message: string } | null = null;
  if (payload.audience === "newsletter") {
    const { error } = await admin
      .from("newsletter_subscribers")
      .update({
        status: "unsubscribed",
        unsubscribed_at: new Date().toISOString(),
        unsubscribe_reason: "signed_link",
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", payload.tenantId)
      .eq("email", email);
    updateError = error;
  } else {
    // Revocar el consentimiento de marketing por email en los clientes que calcen
    // (case-insensitive) dentro del tenant del token. NO se agrega a mail_blacklist:
    // esa lista bloquea TODO envío (incl. transaccional); la baja es solo de marketing
    // y el sender de campañas filtra por email_marketing_optin_at (ver docstring).
    const { error } = await admin
      .from("clients")
      .update({ email_marketing_optin_at: null })
      .eq("tenant_id", payload.tenantId)
      .ilike("email", email);
    updateError = error;
  }

  if (updateError) {
    return { status: 503, title: "No disponible", body: "No pudimos procesar la baja ahora. Intenta de nuevo en un rato." };
  }

  return {
    status: 200,
    title: "Listo, te diste de baja",
    body: payload.audience === "newsletter"
      ? "No vas a recibir más correos de Actualidad de DTD Cargo. Los avisos de tus envíos y facturas siguen llegando normalmente."
      : "No vas a recibir más correos de marketing de DTD Cargo. Los avisos de tus envíos y facturas siguen llegando normalmente.",
    audience: payload.audience === "newsletter" ? "newsletter" : "marketing",
  };
}
