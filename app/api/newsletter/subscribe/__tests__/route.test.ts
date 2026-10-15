// @vitest-environment node
/**
 * SDD-0523 — la sal del hash de IP del newsletter no puede quedar vacía.
 *
 * Con `??`, `NEWSLETTER_IP_HASH_SECRET=` vacía dejaba la sal en `""` y el hash
 * de la IP de consentimiento se revertía probando las direcciones IPv4.
 */
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { upserts } = vi.hoisted(() => ({
  upserts: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        gte: () => chain,
        order: () => chain,
        limit: () => chain,
        insert: async () => ({ error: null }),
        upsert: async (row: Record<string, unknown>) => {
          upserts.push(row);
          return { error: null };
        },
        maybeSingle: async () => ({
          data: table === "tenants" ? { id: "tenant-1" } : null,
          error: null,
        }),
        then: (resolve: (value: { count: number; error: null }) => unknown) =>
          Promise.resolve({ count: 0, error: null }).then(resolve),
      };
      return chain;
    },
  }),
}));

import { POST } from "../route";

const IP = "203.0.113.7";

type Secrets = {
  newsletter: string | undefined;
  unsubscribe: string | undefined;
  serviceRole: string | undefined;
};

function stubSecrets({ newsletter, unsubscribe, serviceRole }: Secrets) {
  vi.stubEnv("NEWSLETTER_IP_HASH_SECRET", newsletter);
  vi.stubEnv("EMAIL_UNSUBSCRIBE_SECRET", unsubscribe);
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", serviceRole);
  vi.stubEnv("REQUEST_IP_HEADER", undefined);
}

function hashCon(salt: string) {
  return createHash("sha256").update(`${salt}:${IP}`).digest("hex");
}

async function suscribir() {
  const response = await POST(
    new NextRequest("https://preview.example/api/newsletter/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json", "x-real-ip": IP },
      body: JSON.stringify({ email: "lector@ejemplo.com", consent: true }),
    }),
  );
  expect(response.status).toBe(200);
  expect(upserts).toHaveLength(1);
  return upserts[0].consent_ip_hash;
}

beforeEach(() => {
  upserts.length = 0;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("sal del hash de IP del newsletter", () => {
  it.each<[string, Secrets, string]>([
    ["dedicada vacía → secreto de baja", { newsletter: "", unsubscribe: "baja", serviceRole: "svc" }, "baja"],
    ["dedicada con espacios → secreto de baja", { newsletter: "  ", unsubscribe: "baja", serviceRole: "svc" }, "baja"],
    ["dedicada y de baja vacías → service role", { newsletter: "", unsubscribe: "", serviceRole: "svc" }, "svc"],
    ["dedicada y de baja con espacios → service role", { newsletter: "\t", unsubscribe: " ", serviceRole: "svc" }, "svc"],
    ["sin definir → service role", { newsletter: undefined, unsubscribe: undefined, serviceRole: "svc" }, "svc"],
    ["dedicada definida → dedicada", { newsletter: "sal", unsubscribe: "baja", serviceRole: "svc" }, "sal"],
    ["todas vacías → respaldo local de siempre", { newsletter: "", unsubscribe: "", serviceRole: "" }, "newsletter-local"],
    ["todas sin definir → respaldo local de siempre", { newsletter: undefined, unsubscribe: undefined, serviceRole: undefined }, "newsletter-local"],
  ])("%s", async (_nombre, secrets, sal) => {
    stubSecrets(secrets);
    const hash = await suscribir();
    expect(hash).toBe(hashCon(sal));
    expect(hash).not.toBe(hashCon(""));
  });
});
