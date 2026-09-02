import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getEnvStatus, integrationEnvVar } from "../env-status";

const INTEGRATION_ENV_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "RESEND_API_KEY",
  "RESEND_WEBHOOK_SECRET",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_WEBHOOK_SECRET",
  "ANTHROPIC_API_KEY",
  "OPENROUTER_API_KEY",
  "NEXT_PUBLIC_HAILUWAY_API",
  "DTD_API_KEY",
  "SEARATES_API_BASE",
  "SEARATES_PLATFORM_ID",
  "SEARATES_API_KEY",
] as const;

beforeEach(() => {
  for (const envKey of INTEGRATION_ENV_VARS) {
    vi.stubEnv(envKey, "");
  }
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getEnvStatus · configuración completa", () => {
  it("mantiene Supabase missing hasta tener URL y anon key", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://stub.supabase.co");
    expect(getEnvStatus().integrations.supabase).toBe("missing");

    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-test");
    expect(getEnvStatus().integrations.supabase).toBe("active");
  });

  it("no declara activos los webhooks con sólo el secreto", () => {
    vi.stubEnv("RESEND_WEBHOOK_SECRET", "whsec-test");
    vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "telegram-secret-test");

    expect(getEnvStatus().integrations.resendWebhook).toBe("mock");
    expect(getEnvStatus().integrations.telegramWebhook).toBe("mock");

    vi.stubEnv("RESEND_API_KEY", "re-test");
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "bot-test");

    expect(getEnvStatus().integrations.resendWebhook).toBe("active");
    expect(getEnvStatus().integrations.telegramWebhook).toBe("active");
  });

  it("exige URL y key para HailuWay", () => {
    vi.stubEnv("DTD_API_KEY", "dtd-test");
    expect(getEnvStatus().integrations.hailuway).toBe("mock");

    vi.stubEnv("NEXT_PUBLIC_HAILUWAY_API", "https://erp.example.test");
    expect(getEnvStatus().integrations.hailuway).toBe("active");
  });

  it("exige base, platform id y key para SeaRates", () => {
    vi.stubEnv("SEARATES_PLATFORM_ID", "platform-test");
    vi.stubEnv("SEARATES_API_KEY", "searates-test");
    expect(getEnvStatus().integrations.searates).toBe("mock");

    vi.stubEnv("SEARATES_API_BASE", "https://api.example.test");
    expect(getEnvStatus().integrations.searates).toBe("active");
  });

  it("trata valores sólo con espacios como ausentes", () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "   ");

    const status = getEnvStatus();

    expect(status.integrations.telegram).toBe("mock");
    expect(status.envVarsPresent).not.toContain("TELEGRAM_BOT_TOKEN");
  });

  it("muestra todos los requisitos sin revelar valores", () => {
    expect(integrationEnvVar("supabase")).toBe(
      "NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
    expect(integrationEnvVar("searates")).toBe(
      "SEARATES_API_BASE + SEARATES_PLATFORM_ID + SEARATES_API_KEY",
    );
  });
});
