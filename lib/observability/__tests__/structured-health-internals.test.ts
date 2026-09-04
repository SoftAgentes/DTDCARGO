import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const internalFiles = [
  "lib/studio/alta-health.ts",
  "lib/studio/telegram/alert-routing.ts",
  "lib/studio/mail/mail-health-notify.ts",
  "lib/studio/searates/ocean-rates-notify.ts",
  "lib/news/ceo-brief.ts",
];

const routeContracts = [
  {
    path: "app/api/cron/alta-health/route.ts",
    pattern: /listAltasSinAcceso\([\s\S]*?cron\.logger/,
  },
  {
    path: "app/api/cron/mail-health/route.ts",
    pattern: /notifyMailHealth\([^;]*cron\.logger/,
  },
  {
    path: "app/api/cron/searates-refresh/route.ts",
    pattern: /notifyOceanRatesHealth\([\s\S]*?cron\.logger/,
  },
  {
    path: "app/api/cron/ceo-brief/route.ts",
    pattern: /runForAllTenants\(cron\.logger/,
  },
];

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("observabilidad de internals de salud", () => {
  it.each(internalFiles)("elimina console libre en %s", (path) => {
    expect(source(path)).not.toMatch(/console\.(?:log|warn|error|info|debug)\s*\(/);
  });

  it.each(routeContracts)("propaga el correlador en $path", ({ path, pattern }) => {
    expect(source(path)).toMatch(pattern);
  });
});
