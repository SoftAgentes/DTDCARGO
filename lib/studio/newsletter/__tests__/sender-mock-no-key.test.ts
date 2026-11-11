// @vitest-environment node
/**
 * A3 — `mock_no_key` tiene dos causas y el mensaje al admin las distingue:
 * llave ausente (RESEND_API_KEY no está configurada) vs. entorno de prueba
 * (`APP_ENV=staging`, envío simulado a propósito aunque haya llave).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NewsletterCampaign } from "../types";

const { sendEmailMock, batchMock } = vi.hoisted(() => ({
  sendEmailMock: vi.fn(),
  batchMock: vi.fn(),
}));

vi.mock("@/lib/studio/mail/send-email", () => ({ sendEmail: sendEmailMock }));
vi.mock("@/lib/studio/mail/resend-api", () => ({
  resendBatchSend: batchMock,
  RESEND_SIMULADO_PRUEBA: "app_env_staging",
}));

import { sendNewsletterCampaignBatch, sendNewsletterTest } from "../sender";

const CONFIG = {
  from_email: "actualidad@ejemplo.com",
  from_name: "DTD",
  reply_to: null,
  test_mode: false,
  internal_test_email: "interno@ejemplo.com",
};

/** Cliente falso: toda cadena es encadenable y esperable; devuelve `data` por tabla. */
function admin() {
  const porTabla: Record<string, unknown> = {
    newsletter_subscribers: [{ id: "sub-1" }],
    mail_blacklist: [],
    mail_logs: [{ id: "log-1", metadata: { newsletter_recipient_id: "rec-1" } }],
  };
  const cadena = (data: unknown): unknown =>
    new Proxy({}, {
      get(_t, prop) {
        if (prop === "maybeSingle") return async () => ({ data: CONFIG, error: null });
        if (prop === "then") return (ok: (v: unknown) => unknown) => ok({ data, error: null, count: 0 });
        return () => cadena(data);
      },
    });
  return {
    from: (tabla: string) => cadena(porTabla[tabla] ?? []),
    rpc: async () => ({
      data: [{ id: "rec-1", subscriber_id: "sub-1", email: "a@ejemplo.com", dispatch_key: "k", mail_log_id: null }],
      error: null,
    }),
  } as unknown as SupabaseClient;
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

beforeEach(() => {
  sendEmailMock.mockReset();
  batchMock.mockReset();
  sendEmailMock.mockResolvedValue({ ok: true, queued: true });
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://dtdcargo.com");
  vi.stubEnv("EMAIL_UNSUBSCRIBE_SECRET", "secreto-de-prueba");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("correo de prueba sin envío", () => {
  it("staging con llave → dice que es el entorno de prueba", async () => {
    vi.stubEnv("APP_ENV", "staging");
    vi.stubEnv("RESEND_API_KEY", "llave-de-prueba");
    const r = await sendNewsletterTest(admin(), "tenant-1", campaign);
    expect(r).toMatchObject({ ok: false });
    const error = (r as { error: string }).error;
    expect(error).toContain("entorno de prueba");
    expect(error).not.toContain("RESEND_API_KEY");
  });

  it("producción sin llave → mensaje de llave ausente", async () => {
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("RESEND_API_KEY", "");
    expect(await sendNewsletterTest(admin(), "tenant-1", campaign)).toEqual({
      ok: false,
      error: "RESEND_API_KEY no está configurada; la prueba no salió.",
    });
  });
});

describe("campaña real sin envío", () => {
  it("staging (code app_env_staging) → dice que es el entorno de prueba", async () => {
    batchMock.mockResolvedValue({ ok: false, error: "mock_no_key", code: "app_env_staging" });
    const r = await sendNewsletterCampaignBatch(admin(), "tenant-1", campaign, "user-1");
    expect(r).toMatchObject({ ok: false });
    const error = (r as { error: string }).error;
    expect(error).toContain("entorno de prueba");
    expect(error).not.toContain("RESEND_API_KEY");
  });

  it("sin llave (sin code) → mensaje de llave ausente", async () => {
    batchMock.mockResolvedValue({ ok: false, error: "mock_no_key" });
    expect(await sendNewsletterCampaignBatch(admin(), "tenant-1", campaign, "user-1")).toEqual({
      ok: false,
      error: "RESEND_API_KEY no está configurada.",
    });
  });
});
