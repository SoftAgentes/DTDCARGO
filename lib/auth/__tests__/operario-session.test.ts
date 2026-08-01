import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("login PIN de operario · SDD-0235", () => {
  it("vincula tenant, región y huella anti-abuso en el RPC privilegiado", () => {
    const session = source("lib/auth/operario-session.ts");
    expect(session).toContain("getRequestIp");
    expect(session).toContain("p_tenant_id");
    expect(session).toContain("p_region");
    expect(session).toContain("p_attempt_key");
  });

  it("cada superficie solicita solamente su región", () => {
    expect(source("app/m/cn/login/actions.ts")).toContain('signInWithPin(pin, "cn")');
    expect(source("app/m/ve/login/actions.ts")).toContain('signInWithPin(pin, "ve")');
  });
});
