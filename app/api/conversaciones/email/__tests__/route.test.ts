// @vitest-environment node
/**
 * SDD-0523 — `RESEND_INBOUND_WEBHOOK_SECRET` vacía cae al secreto de delivery.
 *
 * Con `??`, una variable definida y vacía no caía a `RESEND_WEBHOOK_SECRET` y el
 * webhook quedaba en 503. Sin ninguno de los dos sigue fallando cerrado.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { verifyMock } = vi.hoisted(() => ({ verifyMock: vi.fn() }));

vi.mock("@/lib/studio/mail/resend-api", () => ({
  resendGetReceivedEmail: vi.fn(),
  verifyResendWebhookSignature: verifyMock,
}));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/studio/conversaciones/inbound-email", () => ({ ingestInboundEmail: vi.fn() }));

import { POST } from "../route";

function stubSecrets(inbound: string | undefined, delivery: string | undefined) {
  vi.stubEnv("RESEND_INBOUND_WEBHOOK_SECRET", inbound);
  vi.stubEnv("RESEND_WEBHOOK_SECRET", delivery);
}

function webhook() {
  return POST(
    new NextRequest("https://preview.example/api/conversaciones/email", {
      method: "POST",
      headers: {
        "svix-id": "msg_1",
        "svix-timestamp": "1760500000",
        "svix-signature": "v1,firma",
      },
      body: JSON.stringify({ type: "email.received", data: {} }),
    }),
  );
}

beforeEach(() => {
  verifyMock.mockReset();
  verifyMock.mockResolvedValue(false);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("secreto del webhook de correo entrante", () => {
  it.each([
    ["vacío", ""],
    ["con espacios", "  \t "],
    ["sin definir", undefined],
  ])("inbound %s → verifica con el secreto de delivery", async (_n, inbound) => {
    stubSecrets(inbound, "whsec_delivery");

    const response = await webhook();

    expect(response.status).toBe(401);
    expect(verifyMock).toHaveBeenCalledWith(expect.objectContaining({ secret: "whsec_delivery" }));
  });

  it("inbound definido → lo usa a él", async () => {
    stubSecrets("whsec_inbound", "whsec_delivery");

    await webhook();

    expect(verifyMock).toHaveBeenCalledWith(expect.objectContaining({ secret: "whsec_inbound" }));
  });

  it.each([
    ["los dos vacíos", "", ""],
    ["los dos con espacios", " ", "\n"],
    ["los dos sin definir", undefined, undefined],
  ])("%s → 503 sin verificar nada", async (_n, inbound, delivery) => {
    stubSecrets(inbound, delivery);

    const response = await webhook();

    expect(response.status).toBe(503);
    expect(verifyMock).not.toHaveBeenCalled();
  });
});
