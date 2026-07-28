import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const WEBHOOK_SECRET_BYTES = Buffer.from("resend-webhook-test-secret");
const WEBHOOK_SECRET = `whsec_${WEBHOOK_SECRET_BYTES.toString("base64")}`;

type DbCall = {
  table: string;
  operation: string;
  values?: Record<string, unknown>;
  filters: Array<[string, unknown]>;
};

const calls: DbCall[] = [];
let mailLogFixture: {
  id: string;
  tenant_id: string;
  to_email: string;
  template_id: null;
  status: string;
  metadata: Record<string, unknown>;
};

function makeAdmin() {
  return {
    from(table: string) {
      const state: DbCall = { table, operation: "select", filters: [] };
      const chain = {
        select() {
          state.operation = "select";
          return chain;
        },
        update(values: Record<string, unknown>) {
          state.operation = "update";
          state.values = values;
          return chain;
        },
        eq(column: string, value: unknown) {
          state.filters.push([column, value]);
          return chain;
        },
        maybeSingle() {
          if (table === "mail_logs") {
            return Promise.resolve({
              data: mailLogFixture,
              error: null,
            });
          }
          return Promise.resolve({ data: null, error: null });
        },
        then(resolve: (value: { error: null }) => unknown) {
          calls.push({
            ...state,
            filters: [...state.filters],
            values: state.values ? { ...state.values } : undefined,
          });
          return Promise.resolve({ error: null }).then(resolve);
        },
      };
      return chain;
    },
  };
}

vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => makeAdmin(),
}));

vi.mock("@/lib/studio/newsletter/sender", () => ({
  refreshCampaignCounters: vi.fn(),
}));

import { POST } from "../route";

function signedRequest(body: string): NextRequest {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const id = "msg_test_newsletter_delivery";
  const signature = createHmac("sha256", WEBHOOK_SECRET_BYTES)
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");

  return new NextRequest("https://dtdcargo.com/api/webhooks/resend", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "svix-id": id,
      "svix-timestamp": timestamp,
      "svix-signature": `v1,${signature}`,
    },
    body,
  });
}

describe("webhook Resend · entrega de prueba del newsletter", () => {
  beforeEach(() => {
    calls.length = 0;
    mailLogFixture = {
      id: "log-1",
      tenant_id: "tenant-1",
      to_email: "Interno@DTDCargo.com",
      template_id: null,
      status: "sent",
      metadata: {
        newsletter_campaign_id: "campaign-1",
        newsletter_test: true,
      },
    };
    process.env.RESEND_WEBHOOK_SECRET = WEBHOOK_SECRET;
  });

  it("actualiza last_delivered_at por tenant y correo normalizado", async () => {
    const deliveredAt = "2026-07-22T21:11:42.839Z";
    const response = await POST(signedRequest(JSON.stringify({
      type: "email.delivered",
      created_at: deliveredAt,
      data: { email_id: "resend-1" },
    })));

    expect(response.status).toBe(200);
    const subscriberUpdate = calls.find((call) =>
      call.table === "newsletter_subscribers" && call.operation === "update"
    );
    expect(subscriberUpdate).toEqual({
      table: "newsletter_subscribers",
      operation: "update",
      values: { last_delivered_at: deliveredAt },
      filters: [
        ["tenant_id", "tenant-1"],
        ["email", "interno@dtdcargo.com"],
      ],
    });
  });

  it("conserva la correlación por subscriber_id de campañas reales", async () => {
    mailLogFixture.metadata = {
      newsletter_campaign_id: "campaign-1",
      newsletter_recipient_id: "recipient-1",
      newsletter_subscriber_id: "subscriber-1",
    };
    const deliveredAt = "2026-07-22T21:15:00.000Z";

    const response = await POST(signedRequest(JSON.stringify({
      type: "email.delivered",
      created_at: deliveredAt,
      data: { email_id: "resend-2" },
    })));

    expect(response.status).toBe(200);
    const subscriberUpdate = calls.find((call) =>
      call.table === "newsletter_subscribers" && call.operation === "update"
    );
    expect(subscriberUpdate).toMatchObject({
      values: { last_delivered_at: deliveredAt },
      filters: [
        ["tenant_id", "tenant-1"],
        ["id", "subscriber-1"],
      ],
    });
  });
});
