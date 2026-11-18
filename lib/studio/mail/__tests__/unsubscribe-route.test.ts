// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { signUnsubscribeToken } from "../unsubscribe-token";

const SECRET = "test-unsubscribe-secret";
const updates: Array<{ table: string; values: Record<string, unknown> }> = [];

function makeAdmin() {
  return {
    from(table: string) {
      const chain = {
        update(values: Record<string, unknown>) {
          updates.push({ table, values });
          return chain;
        },
        eq() {
          return chain;
        },
        ilike() {
          return chain;
        },
        then(resolve: (value: { error: null }) => unknown) {
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

import { GET as getLegacy } from "@/app/api/email/unsubscribe/route";
import { GET as getPath } from "@/app/api/email/unsubscribe/[token]/route";

describe("rutas de baja firmada", () => {
  beforeEach(() => {
    updates.length = 0;
    process.env.EMAIL_UNSUBSCRIBE_SECRET = SECRET;
  });

  it("procesa el token cifrado transportado en la ruta", async () => {
    const token = signUnsubscribeToken({
      email: "Interno@DTDCargo.com",
      tenantId: "tenant-1",
      audience: "newsletter",
    }, SECRET);
    const request = new NextRequest(
      `https://preview.example/api/email/unsubscribe/${encodeURIComponent(token)}`,
    );

    const response = await getPath(request, {
      params: Promise.resolve({ token }),
    });

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "/email/baja?estado=actualidad",
    );
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      table: "newsletter_subscribers",
      values: { status: "unsubscribed", unsubscribe_reason: "signed_link" },
    });
  });

  it("conserva la ruta query para correos anteriores", async () => {
    const token = signUnsubscribeToken({
      email: "interno@dtdcargo.com",
      tenantId: "tenant-1",
      audience: "newsletter",
    }, SECRET);
    const request = new NextRequest(
      `https://preview.example/api/email/unsubscribe?token=${encodeURIComponent(token)}`,
    );

    const response = await getLegacy(request);

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "/email/baja?estado=actualidad",
    );
    expect(updates).toHaveLength(1);
  });
});
