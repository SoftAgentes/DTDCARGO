// @vitest-environment node
/**
 * SDD-0523 — el emisor de Actualidad no firma enlaces de baja con la clave vacía.
 *
 * Con `EMAIL_UNSUBSCRIBE_SECRET=` vacía, el enlace sale sellado con el service
 * role; sin ningún secreto, no sale ningún correo.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verifyUnsubscribeToken } from "@/lib/studio/mail/unsubscribe-token";
import type { NewsletterCampaign } from "../types";

const { sendEmailMock } = vi.hoisted(() => ({ sendEmailMock: vi.fn() }));

vi.mock("@/lib/studio/mail/send-email", () => ({ sendEmail: sendEmailMock }));
vi.mock("@/lib/studio/mail/resend-api", () => ({ resendBatchSend: vi.fn() }));

import { sendNewsletterTest } from "../sender";

const SERVICE_ROLE = "service-role-de-prueba";

function admin() {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => ({
      data: {
        from_email: "actualidad@ejemplo.com",
        from_name: "DTD",
        reply_to: null,
        test_mode: true,
        internal_test_email: "Interno@Ejemplo.com",
      },
      error: null,
    }),
  };
  return { from: () => chain } as unknown as SupabaseClient;
}

const campaign = {
  id: "campaign-1",
  internal_name: "Prueba",
  subject: "Asunto",
  preview_text: "Vista previa",
  heading: "Título",
  body_text: "Cuerpo",
  cta_label: null,
  cta_url: null,
} as unknown as NewsletterCampaign;

function tokenDelEnlace(): string {
  const headers = sendEmailMock.mock.calls[0][2].headers as Record<string, string>;
  const url = headers["List-Unsubscribe"].slice(1, -1);
  return decodeURIComponent(url.split("/api/email/unsubscribe/")[1]);
}

beforeEach(() => {
  sendEmailMock.mockReset();
  sendEmailMock.mockResolvedValue({ ok: true, queued: false });
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://dtdcargo.com");
  vi.stubEnv("APP_ENV", "production");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("enlace de baja del correo de prueba", () => {
  it.each([
    ["vacía", ""],
    ["con espacios", "   "],
  ])("con la dedicada %s, sella con el service role y no con la clave vacía", async (_n, dedicated) => {
    vi.stubEnv("EMAIL_UNSUBSCRIBE_SECRET", dedicated);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", SERVICE_ROLE);

    expect(await sendNewsletterTest(admin(), "tenant-1", campaign)).toMatchObject({ ok: true });

    const token = tokenDelEnlace();
    expect(verifyUnsubscribeToken(token, SERVICE_ROLE)).toMatchObject({
      email: "interno@ejemplo.com",
      tenantId: "tenant-1",
      audience: "newsletter",
    });
    expect(verifyUnsubscribeToken(token, "")).toBeNull();
  });

  it.each([
    ["las dos vacías", "", ""],
    ["las dos con espacios", " ", "\t"],
    ["las dos sin definir", undefined, undefined],
  ])("%s → no firma ni envía", async (_n, dedicated, serviceRole) => {
    vi.stubEnv("EMAIL_UNSUBSCRIBE_SECRET", dedicated);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", serviceRole);

    expect(await sendNewsletterTest(admin(), "tenant-1", campaign)).toEqual({
      ok: false,
      error: "No está configurado el secreto de baja.",
    });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});
