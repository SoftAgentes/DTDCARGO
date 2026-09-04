import { afterEach, describe, expect, it, vi } from "vitest";
import { createEdgeRequestLogger } from "../structured-logger";

afterEach(() => {
  vi.restoreAllMocks();
});
function parseFirstCall(spy: ReturnType<typeof vi.spyOn>) {
  const line = spy.mock.calls[0]?.[0];
  expect(typeof line).toBe("string");
  return JSON.parse(line as string) as Record<string, unknown>;
}

describe("createEdgeRequestLogger", () => {
  it("conserva un request id valido y lo devuelve en la respuesta", () => {
    const logger = createEdgeRequestLogger(
      new Request("https://project.supabase.co/functions/v1/kommo-sync", {
        headers: { "x-request-id": "edge-run_2026-09-04:01" },
      }),
      "edge.kommo-sync",
    );

    const response = logger.withResponse(new Response(null, { status: 204 }));

    expect(logger.requestId).toBe("edge-run_2026-09-04:01");
    expect(response.headers.get("x-request-id")).toBe("edge-run_2026-09-04:01");
  });

  it("reemplaza ids inseguros", () => {
    const logger = createEdgeRequestLogger(
      new Request("https://project.supabase.co", {
        headers: { "x-request-id": "Bearer secreto con espacios" },
      }),
      "edge.kommo-webhook",
    );

    expect(logger.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("emite JSON con metricas allowlisted", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const logger = createEdgeRequestLogger(
      new Request("https://project.supabase.co", {
        headers: { "x-request-id": "req-123" },
      }),
      "edge.kommo-writeback",
    );

    logger.info("edge.completed", {
      mode: "dry-run",
      processed: 17,
      skipped: 4,
      customerName: "No debe entrar",
      payload: { email: "owner@example.com" },
    });

    const record = parseFirstCall(info);
    expect(record).toMatchObject({
      level: "info",
      event: "edge.completed",
      component: "edge.kommo-writeback",
      requestId: "req-123",
      mode: "dry-run",
      processed: 17,
      skipped: 4,
      customerName: "[REDACTED]",
      payload: "[REDACTED]",
    });
  });

  it("redacta secretos, identidad y errores crudos", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const logger = createEdgeRequestLogger(
      new Request("https://project.supabase.co"),
      "edge.kommo-push-client",
    );
    const error = Object.assign(
      new Error("owner@example.com Bearer secreto tenants/T1/clientes/88"),
      { code: "PGRST500" },
    );

    logger.error("edge.run_failed", {
      status: 500,
      stage: "database",
      authorization: "Bearer secreto",
      tenantId: "T1",
      clientId: "88",
      leadId: 99,
      error,
    });

    const record = parseFirstCall(errorSpy);
    expect(record.authorization).toBe("[REDACTED]");
    expect(record.tenantId).toBe("[REDACTED]");
    expect(record.clientId).toBe("[REDACTED]");
    expect(record.leadId).toBe("[REDACTED]");
    expect(record.error).toEqual({ name: "Error", code: "PGRST500" });
    const serialized = JSON.stringify(record);
    expect(serialized).not.toContain("owner@example.com");
    expect(serialized).not.toContain("Bearer secreto");
    expect(serialized).not.toContain("tenants/T1/clientes/88");
  });
});
