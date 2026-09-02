import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const ENDPOINT_URL = "https://dtdcargo.com/api/telegram/webhook";
const PRIMARY_SECRET = "primary_secret-2026";
const LEGACY_SECRET = "legacy-secret-in-old-url";

const dependencies = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  sendTelegramMessage: vi.fn(),
}));

vi.mock("@/lib/db/admin", () => ({
  createAdminClient: dependencies.createAdminClient,
}));

vi.mock("@/lib/studio/telegram/send-message", () => ({
  sendTelegramMessage: dependencies.sendTelegramMessage,
}));

function request(options: {
  headerSecret?: string;
  querySecret?: string;
  body?: string;
} = {}): Request {
  const url = new URL(ENDPOINT_URL);
  if (options.querySecret !== undefined) {
    url.searchParams.set("secret", options.querySecret);
  }
  const headers = new Headers({ "content-type": "application/json" });
  if (options.headerSecret !== undefined) {
    headers.set("x-telegram-bot-api-secret-token", options.headerSecret);
  }
  return new Request(url, {
    method: "POST",
    headers,
    body: options.body ?? JSON.stringify({ update_id: 1 }),
  });
}

describe("/api/telegram/webhook · autenticación del proveedor", () => {
  beforeEach(() => {
    vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", PRIMARY_SECRET);
    vi.stubEnv("TELEGRAM_WEBHOOK_LEGACY_QUERY_SECRET", "");
    dependencies.createAdminClient.mockReset();
    dependencies.sendTelegramMessage.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("acepta el header oficial sobre una URL limpia", async () => {
    const response = await POST(request({ headerSecret: PRIMARY_SECRET }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, ignored: "no message" });
    expect(dependencies.createAdminClient).not.toHaveBeenCalled();
  });

  it("no acepta el secreto primario por query string", async () => {
    const response = await POST(request({ querySecret: PRIMARY_SECRET }));

    expect(response.status).toBe(403);
    expect(dependencies.createAdminClient).not.toHaveBeenCalled();
  });

  it("un header incorrecto no puede degradar al secreto legacy correcto", async () => {
    vi.stubEnv("TELEGRAM_WEBHOOK_LEGACY_QUERY_SECRET", LEGACY_SECRET);

    const response = await POST(
      request({ headerSecret: "incorrecto", querySecret: LEGACY_SECRET }),
    );

    expect(response.status).toBe(403);
  });

  it("acepta temporalmente el query sólo contra el secreto legacy separado", async () => {
    vi.stubEnv("TELEGRAM_WEBHOOK_LEGACY_QUERY_SECRET", LEGACY_SECRET);

    const response = await POST(request({ querySecret: LEGACY_SECRET }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, ignored: "no message" });
  });

  it("falla cerrado y no revela el nombre de la variable si falta el primario", async () => {
    vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "");

    const response = await POST(request({ querySecret: LEGACY_SECRET }));
    const body = JSON.stringify(await response.json());

    expect(response.status).toBe(503);
    expect(body).not.toContain("TELEGRAM_WEBHOOK_SECRET");
  });

  it("falla cerrado si el primario no cumple el contrato de secret_token", async () => {
    vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "no admite espacios");

    const response = await POST(request({ headerSecret: "no admite espacios" }));

    expect(response.status).toBe(503);
  });

  it("autentica antes de analizar JSON", async () => {
    const unauthorized = await POST(request({ body: "{" }));
    const authorized = await POST(
      request({ headerSecret: PRIMARY_SECRET, body: "{" }),
    );

    expect(unauthorized.status).toBe(403);
    expect(authorized.status).toBe(400);
  });
});
