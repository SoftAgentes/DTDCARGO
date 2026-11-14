// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock("@/lib/studio/fx/bcv-sync", async () => {
  const actual = await vi.importActual<typeof import("@/lib/studio/fx/bcv-sync")>("@/lib/studio/fx/bcv-sync");
  return { ...actual, syncBcvRates: mocks.run };
});
import { GET, maxDuration, runtime } from "../route";

function request(query = "", auth: string | null = "Bearer synthetic-cron-key") {
  return new NextRequest("http://127.0.0.1/api/cron/bcv-rates" + query,
    { headers: auth ? { authorization: auth } : {} });
}
beforeEach(() => {
  vi.stubEnv("CRON_SECRET", "synthetic-cron-key");
  vi.stubEnv("BCV_RATES_ENABLED", "false");
  vi.stubEnv("BCV_RATE_TENANT_IDS", "00000000-0000-4000-8000-00000000000a");
  mocks.run.mockReset().mockResolvedValue({ status: "DISABLED", reason: "DISABLED" });
});
afterEach(() => vi.unstubAllEnvs());

describe("B7/B16 · ruta cron header/query antes de IO", () => {
  it.each([null, "", "Bearer wrong", "Bearer synthetic-cron-key-extra", "synthetic-cron-key"])("auth %s no llama sync", async auth => {
    const result = await GET(request("?token=synthetic-cron-key", auth));
    expect(result.status).toBe(403); expect(mocks.run).not.toHaveBeenCalled();
    expect(JSON.stringify(await result.json())).not.toContain("synthetic-cron-key");
  });
  it("secreto ausente no autoriza bearer vacío", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(request("", "Bearer "))).status).toBe(403);
    expect(mocks.run).not.toHaveBeenCalled();
  });
  it.each(["?dryRun=", "?dryRun=0", "?dryRun=true", "?dryRun=01", "?dryRun=1&dryRun=1", "?tenant=x", "?token=x"])("rechaza %s antes de sync", async query => {
    expect((await GET(request(query))).status).toBe(400); expect(mocks.run).not.toHaveBeenCalled();
  });
  it.each(["true", "false"])("ensayo estricto no se vuelve writer con flag %s", async enabled => {
    vi.stubEnv("BCV_RATES_ENABLED", enabled);
    mocks.run.mockResolvedValue({ status: "CANDIDATE", reason: "CANDIDATE_VALIDATED" });
    const response = await GET(request("?dryRun=1"));
    expect(response.status).toBe(200);
    expect(mocks.run).toHaveBeenCalledWith(expect.objectContaining({ enabled: enabled === "true", dryRun: true }));
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("normal usa flag servidor y señal, sin scope del caller", async () => {
    await GET(request());
    expect(mocks.run).toHaveBeenCalledWith(expect.objectContaining({ enabled: false, dryRun: false,
      scope: "00000000-0000-4000-8000-00000000000a", signal: expect.any(AbortSignal) }));
    expect(maxDuration).toBe(60); expect(runtime).toBe("nodejs");
  });
  it.each([["PARTIAL", 207], ["REJECTED", 503], ["WAITING", 200]])("%s no se confunde con todos registrados", async (status, code) => {
    mocks.run.mockResolvedValue({ status, reason: "SQL_CONTRACT_UNAVAILABLE" });
    expect((await GET(request())).status).toBe(code);
  });
});
