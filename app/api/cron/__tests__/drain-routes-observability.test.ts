import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  admin: { kind: "admin" },
  bug: vi.fn(),
  client: vi.fn(),
  push: vi.fn(),
  workflow: vi.fn(),
}));

vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => mocks.admin,
}));
vi.mock("@/lib/studio/notify/bug-notif-outbox", () => ({
  drainBugNotificationOutbox: mocks.bug,
}));
vi.mock("@/lib/studio/notifications/drain-client-notifications", () => ({
  drainClientNotifications: mocks.client,
}));
vi.mock("@/lib/studio/notify/operario-push-outbox", () => ({
  drainOperarioPushOutbox: mocks.push,
}));
vi.mock("@/lib/studio/workflow/workflow-drain", () => ({
  drainWorkflowRuns: mocks.workflow,
}));

import { GET as bugGET } from "../bug-notifications-drain/route";
import { GET as clientGET } from "../client-notifications-drain/route";
import { GET as pushGET } from "../push-drain/route";
import { GET as workflowGET } from "../workflow-drain/route";

type RouteCase = {
  name: string;
  component: string;
  get: (request: never) => Promise<Response>;
  drain: ReturnType<typeof vi.fn>;
  result: Record<string, unknown>;
  logCounts: Record<string, number>;
};

const routes: RouteCase[] = [
  {
    name: "bug-notifications-drain",
    component: "cron.bug-notifications-drain",
    get: bugGET,
    drain: mocks.bug,
    result: {
      email: { processed: 2, delivered: 1, failed: 1 },
      telegram: { processed: 3, delivered: 2, failed: 1 },
    },
    logCounts: { processed: 5, delivered: 3, failed: 2 },
  },
  {
    name: "client-notifications-drain",
    component: "cron.client-notifications-drain",
    get: clientGET,
    drain: mocks.client,
    result: { processed: 4, delivered: 2, skipped: 1, failed: 1 },
    logCounts: { processed: 4, delivered: 2, skipped: 1, failed: 1 },
  },
  {
    name: "push-drain",
    component: "cron.push-drain",
    get: pushGET,
    drain: mocks.push,
    result: { processed: 6, delivered: 5, failed: 1 },
    logCounts: { processed: 6, delivered: 5, failed: 1 },
  },
  {
    name: "workflow-drain",
    component: "cron.workflow-drain",
    get: workflowGET,
    drain: mocks.workflow,
    result: { processed: 7, noted: 2, deferred: 4, failed: 1 },
    logCounts: { processed: 7, noted: 2, deferred: 4, failed: 1 },
  },
];

function request(path: string, authorization = "Bearer s3cret"): Request {
  return new Request(`https://dtdcargo.com/api/cron/${path}`, {
    headers: {
      authorization,
      "x-request-id": `test-${path}`,
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "s3cret";
  for (const route of routes) route.drain.mockResolvedValue(route.result);
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.CRON_SECRET;
});

describe.each(routes)("$name", (route) => {
  it("rechaza sin credencial y devuelve correlación sin tocar el worker", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const response = await route.get(request(route.name, "Bearer incorrecto") as never);

    expect(response.status).toBe(403);
    expect(response.headers.get("x-request-id")).toBe(`test-${route.name}`);
    expect(route.drain).not.toHaveBeenCalled();
    expect(JSON.parse(warn.mock.calls[0]?.[0] as string)).toMatchObject({
      event: "cron.authorization_denied",
      component: route.component,
      requestId: `test-${route.name}`,
    });
  });

  it("correlaciona el éxito y registra sólo sus conteos", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    const response = await route.get(request(route.name) as never);

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBe(`test-${route.name}`);
    expect(await response.json()).toEqual({ ok: true, ...route.result });
    const correlatedLogger = expect.objectContaining({
      requestId: `test-${route.name}`,
    });
    if (route.name === "workflow-drain") {
      expect(route.drain).toHaveBeenCalledWith(mocks.admin, 100, correlatedLogger);
    } else if (
      route.name === "bug-notifications-drain" ||
      route.name === "client-notifications-drain" ||
      route.name === "push-drain"
    ) {
      expect(route.drain).toHaveBeenCalledWith(mocks.admin, correlatedLogger);
    } else {
      expect(route.drain).toHaveBeenCalledWith(mocks.admin);
    }
    expect(JSON.parse(info.mock.calls[0]?.[0] as string)).toMatchObject({
      event: "cron.completed",
      component: route.component,
      requestId: `test-${route.name}`,
      ...route.logCounts,
    });
  });

  it("contiene y redacta una excepción del worker", async () => {
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    route.drain.mockRejectedValue(
      Object.assign(
        new Error("owner@example.com Bearer s3cret tenant/T1/private.json"),
        { code: "DRAIN500" },
      ),
    );

    const response = await route.get(request(route.name) as never);

    expect(response.status).toBe(500);
    expect(response.headers.get("x-request-id")).toBe(`test-${route.name}`);
    const body = JSON.stringify(await response.json());
    const line = errorSpy.mock.calls[0]?.[0] as string;
    expect(JSON.parse(line)).toMatchObject({
      event: "cron.drain_failed",
      component: route.component,
      requestId: `test-${route.name}`,
      stage: "drain",
      error: { name: "Error", code: "DRAIN500" },
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
