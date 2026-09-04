import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createComponentLogger,
  createRequestLogger,
} from "../structured-logger";

afterEach(() => {
  vi.restoreAllMocks();
});

function parseFirstCall(spy: ReturnType<typeof vi.spyOn>) {
  const line = spy.mock.calls[0]?.[0];
  expect(typeof line).toBe("string");
  return JSON.parse(line as string) as Record<string, unknown>;
}

describe("createRequestLogger", () => {
  it("conserva un request id valido y lo devuelve en la respuesta", () => {
    const logger = createRequestLogger(
      new Request("https://dtdcargo.com/api/cron/example", {
        headers: { "x-request-id": "cron-run_2026-09-04:01" },
      }),
      "cron.example",
    );

    const response = logger.withResponse(new Response(null, { status: 204 }));

    expect(logger.requestId).toBe("cron-run_2026-09-04:01");
    expect(response.headers.get("x-request-id")).toBe("cron-run_2026-09-04:01");
  });

  it("reemplaza ids inseguros y genera uno distinto por request", () => {
    const first = createRequestLogger(
      new Request("https://dtdcargo.com", {
        headers: { "x-request-id": "Bearer secret con espacios" },
      }),
      "cron.example",
    );
    const second = createRequestLogger(
      new Request("https://dtdcargo.com"),
      "cron.example",
    );

    expect(first.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(second.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(first.requestId).not.toBe(second.requestId);
  });

  it("emite JSON estable y solo campos operativos permitidos", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const logger = createRequestLogger(
      new Request("https://dtdcargo.com", {
        headers: { "x-request-id": "req-123" },
      }),
      "cron.purge-receipt-orphans",
    );

    logger.info("cron.completed", {
      mode: "dry-run",
      scanned: 17,
      deleted: 0,
      durationMs: 31,
      customerName: "No debe entrar",
    });

    const record = parseFirstCall(info);
    expect(record).toMatchObject({
      level: "info",
      event: "cron.completed",
      component: "cron.purge-receipt-orphans",
      requestId: "req-123",
      mode: "dry-run",
      scanned: 17,
      deleted: 0,
      durationMs: 31,
    });
    expect(record.timestamp).toEqual(expect.any(String));
    expect(record.customerName).toBe("[REDACTED]");
  });

  it("redacta secretos y resume errores sin mensaje ni stack", () => {
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const logger = createRequestLogger(
      new Request("https://dtdcargo.com"),
      "cron.purge-throttle",
    );
    const error = Object.assign(
      new Error("owner@example.com Bearer ultra-secret storage/T1/photo.jpg"),
      { code: "PGRST500" },
    );

    logger.error("cron.delete_failed", {
      status: 500,
      stage: "portal_throttle",
      authorization: "Bearer ultra-secret",
      email: "owner@example.com",
      apiKey: "api-ultra-secret",
      error,
    });

    const record = parseFirstCall(errorSpy);
    expect(record.authorization).toBe("[REDACTED]");
    expect(record.email).toBe("[REDACTED]");
    expect(record.apiKey).toBe("[REDACTED]");
    expect(record.error).toEqual({ name: "Error", code: "PGRST500" });
    const serialized = JSON.stringify(record);
    expect(serialized).not.toContain("owner@example.com");
    expect(serialized).not.toContain("ultra-secret");
    expect(serialized).not.toContain("storage/T1/photo.jpg");
  });
});

describe("createComponentLogger", () => {
  it("genera correlacion para trabajo interno sin Request", () => {
    const logger = createComponentLogger("internal.mail-health");

    expect(logger.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });
});
