import { once } from "node:events";
import { afterEach, describe, expect, it } from "vitest";
import { createSupabaseDenyServer } from "../e2e/supabase-deny-server.mjs";

describe("supabase-deny-server", () => {
  let server;

  afterEach(async () => {
    if (!server?.listening) return;
    server.close();
    await once(server, "close");
  });

  it("sólo expone salud y rechaza lecturas y escrituras sin conservar datos", async () => {
    server = createSupabaseDenyServer();
    server.listen(0, "127.0.0.1");
    await once(server, "listening");

    const address = server.address();
    expect(address).toBeTypeOf("object");
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const health = await fetch(`${baseUrl}/__health`);
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ mode: "deny-only", ok: true });

    for (const request of [
      fetch(`${baseUrl}/auth/v1/user`),
      fetch(`${baseUrl}/rest/v1/rpc/example`, {
        body: JSON.stringify({ value: "must-not-persist" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    ]) {
      const response = await request;
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({
        code: "E2E_SUPABASE_UNAVAILABLE",
        message: "Supabase no está configurado en este E2E local.",
      });
    }
  });
});
