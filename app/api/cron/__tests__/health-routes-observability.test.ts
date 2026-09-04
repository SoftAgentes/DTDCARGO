import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  errorTable: null as string | null,
  rows: new Map<string, unknown[]>(),
  refreshFails: false,
  refresh: vi.fn(),
  classifyHealth: vi.fn(),
  buildAlert: vi.fn(),
}));

function queryFor(table: string) {
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq", "is", "in", "limit", "upsert"]) {
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

const admin = { from: (table: string) => queryFor(table) };

vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => admin }));
vi.mock("@/lib/studio/alta-health", () => ({
  ALTA_LOOKBACK_DAYS: 30,
  buildAltaHealthMessage: vi.fn(),
  listAltasSinAcceso: vi.fn(),
}));
vi.mock("@/lib/studio/new-client-notify", () => ({
  resolveAdminEntries: vi.fn(),
}));
vi.mock("@/lib/studio/telegram/alert-routing", () => ({
  dispatchTelegramAlert: vi.fn(),
}));
vi.mock("@/lib/studio/mail/send-email", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/studio/mail/mail-health", () => ({
  STUCK_MINUTES: 30,
  buildSupersedeIndex: vi.fn(() => new Map()),
  collectFailures: vi.fn(() => []),
  listMailHealthCandidates: vi.fn(),
  listRecentSuccesses: vi.fn(),
  markMailAlerted: vi.fn(),
}));
vi.mock("@/lib/studio/mail/mail-health-notify", () => ({
  notifyMailHealth: vi.fn(),
}));
vi.mock("@/lib/studio/kommo-contact-status", () => ({
  syncKommoContactStatus: vi.fn(),
}));
vi.mock("@/lib/news/ceo-brief", () => ({
  fetchCeoBriefKpis: vi.fn(),
  generateBriefText: vi.fn(),
  sendCeoBriefToTenant: vi.fn(),
}));
vi.mock("@/lib/studio/rate-types", () => ({ classifyRateExpiry: vi.fn() }));
vi.mock("@/lib/studio/rate-queries", () => ({
  listPublicRatesForExpiryAlert: vi.fn(),
  markRateExpiryAlertSent: vi.fn(),
}));
vi.mock("@/lib/studio/rate-expiry-notify", () => ({
  notifyRateExpiry: vi.fn(),
}));
vi.mock("@/lib/studio/searates/searates-api", () => ({
  getOceanRate: vi.fn(),
}));
vi.mock("@/lib/studio/searates/ocean-rates-queries", () => ({
  refreshOceanRates: (...args: unknown[]) => {
    if (mocks.refreshFails) {
      throw Object.assign(
        new Error("owner@example.com Bearer s3cret tenant/T1/private.json"),
        { code: "SEARATES500" },
      );
    }
    return mocks.refresh(...args);
  },
}));
vi.mock("@/lib/studio/searates/ocean-rates-alert", () => ({
  classifyRefreshHealth: mocks.classifyHealth,
  buildOceanRatesAlert: mocks.buildAlert,
}));
vi.mock("@/lib/studio/searates/ocean-rates-notify", () => ({
  notifyOceanRatesHealth: vi.fn(),
}));

import { GET as altaGET } from "../alta-health/route";
import { GET as mailGET } from "../mail-health/route";
import { GET as kommoGET } from "../kommo-contact-status/route";
import { GET as ceoGET } from "../ceo-brief/route";
import { GET as rateGET } from "../rate-expiry-alert/route";
import { GET as searatesGET } from "../searates-refresh/route";

type RouteCase = {
  name: string;
  component: string;
  get: (request: never) => Promise<Response>;
  failureEvent: string;
  expectedCounts: Record<string, number | string>;
};

const routes: RouteCase[] = [
  {
    name: "alta-health",
    component: "cron.alta-health",
    get: altaGET,
    failureEvent: "cron.read_failed",
    expectedCounts: {
      tenantCount: 0,
      affected: 0,
      notified: 0,
      mode: "live",
    },
  },
  {
    name: "mail-health",
    component: "cron.mail-health",
    get: mailGET,
    failureEvent: "cron.read_failed",
    expectedCounts: {
      tenantCount: 0,
      reviewed: 0,
      neverSent: 0,
      notDelivered: 0,
      mailSent: 0,
      telegramAttempted: 0,
      mode: "live",
    },
  },
  {
    name: "kommo-contact-status",
    component: "cron.kommo-contact-status",
    get: kommoGET,
    failureEvent: "cron.read_failed",
    expectedCounts: {
      tenantCount: 0,
      linked: 0,
      enqueued: 0,
      withBalance: 0,
      inTransit: 0,
      inert: 0,
      truncated: 0,
      mode: "live",
    },
  },
  {
    name: "ceo-brief",
    component: "cron.ceo-brief",
    get: ceoGET,
    failureEvent: "cron.read_failed",
    expectedCounts: { tenantCount: 0, sent: 0, failed: 0 },
  },
  {
    name: "rate-expiry-alert",
    component: "cron.rate-expiry-alert",
    get: rateGET,
    failureEvent: "cron.read_failed",
    expectedCounts: { processed: 0, sent: 0, failed: 0 },
  },
  {
    name: "searates-refresh",
    component: "cron.searates-refresh",
    get: searatesGET,
    failureEvent: "cron.refresh_failed",
    expectedCounts: {
      requested: 20,
      total: 20,
      succeeded: 18,
      noRate: 0,
      failed: 2,
      notified: 0,
      health: "degraded",
      mode: "live",
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
  mocks.errorTable = null;
  mocks.refreshFails = false;
  mocks.refresh.mockResolvedValue({
    requested: 20,
    total: 20,
    capped: false,
    ok: 18,
    no_rate: 0,
    error: 2,
    errorCodes: { graphql_error: 2 },
    upserted: true,
  });
  mocks.classifyHealth.mockReturnValue("degraded");
  mocks.buildAlert.mockReturnValue(null);
  process.env.CRON_SECRET = "s3cret";
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.CRON_SECRET;
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

  it("correlaciona el éxito y registra sólo agregados", async () => {
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

  it("correlaciona el fallo sin filtrar detalles", async () => {
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    if (route.name === "searates-refresh") mocks.refreshFails = true;
    else mocks.errorTable = "tenants";

    const response = await route.get(request(route.name) as never);

    expect(response.status).toBe(500);
    expect(response.headers.get("x-request-id")).toBe(`test-${route.name}`);
    const body = JSON.stringify(await response.json());
    const line = errorSpy.mock.calls[0]?.[0] as string;
    expect(JSON.parse(line)).toMatchObject({
      event: route.failureEvent,
      component: route.component,
      requestId: `test-${route.name}`,
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
