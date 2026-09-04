import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rows: new Map<string, unknown[]>(),
  errorTable: null as string | null,
  bitacora: vi.fn(),
  conversations: vi.fn(),
  sendEmail: vi.fn(),
  sendPortalInvite: vi.fn(),
}));

function queryFor(table: string) {
  const query: Record<string, unknown> = {};
  for (const method of [
    "select",
    "eq",
    "lte",
    "lt",
    "or",
    "order",
    "limit",
    "in",
    "is",
    "update",
  ]) {
    query[method] = () => query;
  }
  query.then = (
    resolve: (value: { data: unknown[] | null; error: unknown }) => unknown,
    reject: (reason: unknown) => unknown,
  ) =>
    Promise.resolve(
      mocks.errorTable === table
        ? {
            data: null,
            error: {
              code: "PGRST500",
              message:
                "owner@example.com Bearer s3cret tenant/T1/private.json",
            },
          }
        : { data: mocks.rows.get(table) ?? [], error: null },
    ).then(resolve, reject);
  return query;
}

const admin = {
  from: (table: string) => queryFor(table),
};

vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => admin }));
vi.mock("@/lib/studio/bitacora/dates", () => ({
  todayCaracasISO: () => "2026-09-04",
}));
vi.mock("@/lib/studio/bitacora/notify", () => ({
  runBitacoraDigestForTenant: mocks.bitacora,
}));
vi.mock("@/lib/studio/conversaciones/monthly-digest", () => ({
  runConversationDigestsForTenant: mocks.conversations,
}));
vi.mock("@/lib/studio/mail/send-email", () => ({
  sendEmail: mocks.sendEmail,
}));
vi.mock("@/lib/studio/portal-invite-email", () => ({
  sendPortalInviteEmail: mocks.sendPortalInvite,
}));

import { GET as bitacoraGET } from "../bitacora-digest/route";
import { GET as conversationGET } from "../conversation-digests/route";
import { GET as mailGET } from "../mail-scheduled/route";
import { GET as reminderGET } from "../portal-cold-reminder/route";

type RouteCase = {
  name: string;
  component: string;
  errorTable: string;
  get: (request: never) => Promise<Response>;
  expectedCounts: Record<string, number | string>;
};

const routes: RouteCase[] = [
  {
    name: "bitacora-digest",
    component: "cron.bitacora-digest",
    errorTable: "tenants",
    get: bitacoraGET,
    expectedCounts: {
      tenantCount: 1,
      persons: 2,
      pushed: 1,
      skipped: 1,
      failed: 0,
    },
  },
  {
    name: "conversation-digests",
    component: "cron.conversation-digests",
    errorTable: "tenants",
    get: conversationGET,
    expectedCounts: {
      tenantCount: 1,
      processed: 3,
      generated: 2,
      skipped: 1,
    },
  },
  {
    name: "mail-scheduled",
    component: "cron.mail-scheduled",
    errorTable: "mail_scheduled",
    get: mailGET,
    expectedCounts: { processed: 0, sent: 0, failed: 0 },
  },
  {
    name: "portal-cold-reminder",
    component: "cron.portal-cold-reminder",
    errorTable: "client_users",
    get: reminderGET,
    expectedCounts: {
      processed: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      skippedBurned: 0,
    },
  },
];

function request(name: string, authorization = "Bearer s3cret"): Request {
  return new Request(`https://dtdcargo.com/api/cron/${name}`, {
    headers: {
      authorization,
      "x-request-id": `test-${name}`,
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rows.clear();
  mocks.rows.set("tenants", [{ id: "T1" }]);
  mocks.errorTable = null;
  mocks.bitacora.mockResolvedValue({
    tenant_id: "T1",
    persons: 2,
    pushed: 1,
    skipped: 1,
  });
  mocks.conversations.mockResolvedValue({
    tenantId: "T1",
    processed: 3,
    generated: 2,
    skipped: 1,
  });
  mocks.sendEmail.mockResolvedValue({ ok: true, logId: "L1" });
  mocks.sendPortalInvite.mockResolvedValue({ ok: true });
  process.env.CRON_SECRET = "s3cret";
  process.env.PORTAL_COLD_REMINDER = "on";
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.CRON_SECRET;
  delete process.env.PORTAL_COLD_REMINDER;
});

describe.each(routes)("$name", (route) => {
  it("rechaza credencial incorrecta con correlación", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const response = await route.get(request(route.name, "Bearer incorrecto") as never);

    expect(response.status).toBe(403);
    expect(response.headers.get("x-request-id")).toBe(`test-${route.name}`);
    expect(JSON.parse(warn.mock.calls[0]?.[0] as string)).toMatchObject({
      event: "cron.authorization_denied",
      component: route.component,
      requestId: `test-${route.name}`,
    });
  });

  it("correlaciona el éxito y registra agregados", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    const response = await route.get(request(route.name) as never);

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBe(`test-${route.name}`);
    expect(JSON.parse(info.mock.calls[0]?.[0] as string)).toMatchObject({
      event: "cron.completed",
      component: route.component,
      requestId: `test-${route.name}`,
      ...route.expectedCounts,
    });
  });

  it("correlaciona un fallo de lectura sin filtrar detalles", async () => {
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mocks.errorTable = route.errorTable;

    const response = await route.get(request(route.name) as never);

    expect(response.status).toBe(500);
    expect(response.headers.get("x-request-id")).toBe(`test-${route.name}`);
    const body = JSON.stringify(await response.json());
    const line = errorSpy.mock.calls[0]?.[0] as string;
    expect(JSON.parse(line)).toMatchObject({
      event: "cron.read_failed",
      component: route.component,
      requestId: `test-${route.name}`,
      stage: "read",
    });
    for (const sentinel of [
      "owner@example.com",
      "s3cret",
      "tenant/T1/private.json",
    ]) {
      expect(line).not.toContain(sentinel);
      expect(body).not.toContain(sentinel);
    }
  });
});
