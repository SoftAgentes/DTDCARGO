/**
 * Tests del throttle por IP de /verificar (migr 0169). El admin client se
 * inyecta como fake estructural — sin red ni DB real.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  isVerifyThrottled,
  VERIFY_IP_LIMIT,
  type ThrottleDb,
} from "./verify-throttle";

let selectResult: { count: number | null; error: unknown } = { count: 0, error: null };
let insertCalls = 0;

function fakeDb(): ThrottleDb {
  return {
    from() {
      const chain = {
        select: () => chain,
        eq: () => chain,
        gte: () => chain,
        insert: async () => {
          insertCalls++;
          return { error: null };
        },
        // thenable: `await chain` resuelve al resultado del SELECT
        then: (res: (v: { count: number | null; error: unknown }) => unknown) =>
          res(selectResult),
      };
      return chain as unknown as ReturnType<ThrottleDb["from"]>;
    },
  };
}

beforeEach(() => {
  selectResult = { count: 0, error: null };
  insertCalls = 0;
});

describe("isVerifyThrottled", () => {
  it("bajo el límite → false y registra el intento", async () => {
    selectResult = { count: 3, error: null };
    expect(await isVerifyThrottled(fakeDb(), "1.2.3.4")).toBe(false);
    expect(insertCalls).toBe(1);
  });

  it("en el límite → true y NO registra (no consume DB de más)", async () => {
    selectResult = { count: VERIFY_IP_LIMIT, error: null };
    expect(await isVerifyThrottled(fakeDb(), "1.2.3.4")).toBe(true);
    expect(insertCalls).toBe(0);
  });

  it("sobre el límite → true", async () => {
    selectResult = { count: VERIFY_IP_LIMIT + 50, error: null };
    expect(await isVerifyThrottled(fakeDb(), "1.2.3.4")).toBe(true);
    expect(insertCalls).toBe(0);
  });

  it("error de lectura del throttle → fail-open (false) e igual registra", async () => {
    selectResult = { count: null, error: { message: "boom" } };
    expect(await isVerifyThrottled(fakeDb(), "1.2.3.4")).toBe(false);
    expect(insertCalls).toBe(1);
  });
});
