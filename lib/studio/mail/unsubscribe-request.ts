import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { localRedirect } from "@/lib/http/local-redirect";
import { emailIlikePattern, sameEmail } from "@/lib/shared/email-literal";
import { canonicalizeEmail } from "@/lib/studio/email-utils";
import {
  unsubscribeSecret,
  unsubscribeSecretSource,
  unsubscribeTokenFingerprint,
  verifyUnsubscribeToken,
} from "@/lib/studio/mail/unsubscribe-token";

type UnsubscribeAudience = "newsletter" | "marketing";
type UnsubscribeTransport = "path" | "query";
type UnsubscribeResult = {
  status: number;
  title: string;
  body: string;
  audience?: UnsubscribeAudience;
};

export async function handleUnsubscribeGet(
  req: NextRequest,
  token: string | null,
  transport: UnsubscribeTransport,
) {
  const result = await processUnsubscribe(req, token, transport);
  const state = result.status === 200
    ? result.audience === "newsletter" ? "actualidad" : "marketing"
    : result.status >= 500 ? "error" : "invalido";

  // La confirmación pública elimina el token de la URL final del navegador.
  return localRedirect(`/email/baja?estado=${state}`, 303);
}

export async function handleUnsubscribePost(
  req: NextRequest,
  token: string | null,
  transport: UnsubscribeTransport,
) {
  const result = await processUnsubscribe(req, token, transport);
  return NextResponse.json(
    result.status === 200 ? { ok: true } : { ok: false, error: result.title },
    { status: result.status },
  );
}

async function processUnsubscribe(
  req: NextRequest,
  token: string | null,
  transport: UnsubscribeTransport,
): Promise<UnsubscribeResult> {
  const secret = unsubscribeSecret();
  if (!secret) {
    return { status: 500, title: "No disponible", body: "La baja no está configurada. Escríbenos y te quitamos de la lista." };
  }

  const payload = verifyUnsubscribeToken(token, secret);
  if (!payload) {
    const tokenValue = token ?? "";
    console.warn(JSON.stringify({
      level: "warn",
      event: "email_unsubscribe_invalid",
      // Correlación con el log del proxy: `x-vercel-id` en Vercel; detrás de
      // Traefik, el `X-Request-Id` que fija su middleware (SDD-0505). Sin
      // ninguno queda null: la app no inventa IDs.
      requestId: req.headers.get("x-vercel-id") ?? req.headers.get("x-request-id"),
      tokenTransport: transport,
      tokenPresent: tokenValue.length > 0,
      tokenLength: tokenValue.length,
      tokenSegments: tokenValue ? tokenValue.split(".").length : 0,
      tokenFingerprint: tokenValue
        ? unsubscribeTokenFingerprint(tokenValue)
        : null,
      secretSource: unsubscribeSecretSource(),
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
    // SDD-0600 · se leen primero las filas: un `.update` con `.ilike` le quitaba el
    // permiso también a un parecido (`a_b@` alcanza a `a.b@`), y `*` no se puede
    // escapar (ver `email-literal.ts`).
    const { data: filas, error: readError } = await admin
      .from("clients")
      .select("id, email")
      .eq("tenant_id", payload.tenantId)
      .ilike("email", emailIlikePattern(email));
    updateError = readError;
    const ids = (filas ?? [])
      .filter((fila) => sameEmail(fila.email, email))
      .map((fila) => fila.id);
    if (ids.length > 0) {
      const { error } = await admin
        .from("clients")
        .update({ email_marketing_optin_at: null })
        .eq("tenant_id", payload.tenantId)
        .in("id", ids);
      updateError = error;
    }
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
