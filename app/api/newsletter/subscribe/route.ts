import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { apiError } from "@/lib/http/api-error";
import { readJsonBody } from "@/lib/http/read-json-body";
import { resolveRequestIp } from "@/lib/http/request-ip";
import {
  buildNewsletterSubscriberUpsert,
  newsletterSuccessMessage,
  validateNewsletterSubscribePayload,
} from "@/lib/newsletter/subscription";

export const runtime = "nodejs";

const RL_TABLE = "portal_registro_throttle";
const RL_IP_PREFIX = "newsletter:";
const RL_LIMIT = 6;
const RL_WINDOW_MINUTES = 60;

type NewsletterBody = {
  email?: string;
  consent?: boolean;
  source?: string;
  [key: string]: unknown;
};

export async function POST(req: NextRequest) {
  const parsed = await readJsonBody<NewsletterBody>(req);
  if (!parsed.ok) {
    return apiError(
      parsed.status === 413 ? "Solicitud demasiado grande." : "Solicitud inválida.",
      parsed.status === 413 ? "body too large" : "json parse",
      parsed.status,
      "newsletter",
    );
  }

  const validation = validateNewsletterSubscribePayload(parsed.body);

  // Honeypot: contestar OK genérico sin tocar DB ni revelar la trampa.
  if (!validation.ok && validation.reason === "honeypot") {
    return NextResponse.json(newsletterSuccessMessage(), { status: 202 });
  }

  if (!validation.ok) {
    return NextResponse.json(
      {
        ok: false,
        error:
          validation.reason === "email"
            ? "Escribe un correo válido."
            : "Debes aceptar recibir correos para suscribirte.",
      },
      { status: 400 },
    );
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (err) {
    return apiError(
      "La suscripción no está disponible ahora.",
      err,
      503,
      "newsletter",
    );
  }

  const ip = resolveRequestIp(req.headers);
  const namespacedIp = RL_IP_PREFIX + ip;
  const windowStart = new Date(
    Date.now() - RL_WINDOW_MINUTES * 60 * 1000,
  ).toISOString();

  const { count: recentCount, error: rlErr } = await admin
    .from(RL_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("ip", namespacedIp)
    .gte("created_at", windowStart);

  if (!rlErr && (recentCount ?? 0) >= RL_LIMIT) {
    return NextResponse.json(
      {
        ok: false,
        error: "Demasiados intentos desde tu conexión. Intenta de nuevo en un rato.",
      },
      { status: 429 },
    );
  }

  await admin.from(RL_TABLE).insert({ ip: namespacedIp });

  const { data: tenantRow, error: tenantErr } = await admin
    .from("tenants")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (tenantErr || !tenantRow?.id) {
    return apiError(
      "No pudimos registrar la suscripción.",
      tenantErr ?? new Error("no tenant"),
      500,
      "newsletter",
    );
  }

  const { email, source } = validation.input;
  const tenantId = tenantRow.id;

  // Lista de exclusión existente: si el correo está bloqueado por rebote,
  // queja, baja o bloqueo manual, no lo reactivamos desde el formulario público.
  const { data: blocked } = await admin
    .from("mail_blacklist")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("email", email)
    .maybeSingle<{ id: string }>();

  if (blocked) {
    return NextResponse.json(newsletterSuccessMessage(), { status: 202 });
  }

  const now = new Date().toISOString();
  const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? null;

  const { error: upsertErr } = await admin
    .from("newsletter_subscribers")
    .upsert(
      buildNewsletterSubscriberUpsert({
        tenantId,
        email,
        source,
        consentAt: now,
        consentIpHash: hashIp(ip),
        userAgent,
      }),
      { onConflict: "tenant_id,email" },
    );

  if (upsertErr) {
    return apiError(
      "No pudimos registrar la suscripción.",
      upsertErr,
      500,
      "newsletter",
    );
  }

  return NextResponse.json(newsletterSuccessMessage());
}

function hashIp(ip: string): string {
  const salt =
    process.env.NEWSLETTER_IP_HASH_SECRET ??
    process.env.EMAIL_UNSUBSCRIBE_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    "newsletter-local";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}
