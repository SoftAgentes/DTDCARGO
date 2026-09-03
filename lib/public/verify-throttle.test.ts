/**
 * SDD-0375: contrato RPC sin red. La concurrencia real vive en
 * scripts/check-public-verify-concurrency.mjs; --legacy reproduce el defecto.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isVerifyThrottled, type ThrottleDb } from "./verify-throttle";

const SYNTHETIC_IP = "198.51.100.37";
const EXTERNAL_SECRET = `external-error ${SYNTHETIC_IP} DTD-SYNTHETIC-SECRET`;
const rpc = vi.fn();
const legacyInsert = vi.fn();
const from = vi.fn();

function fakeDb(): ThrottleDb {
  // El legado es funcional para que RED sea una regresión causal, no un import
  // inexistente ni un mock incompleto. Nunca debe usarse tras SDD-0375.
  const chain = {
    select: () => chain,
    eq: () => chain,
    gte: () => chain,
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ count: 0, error: null }).then(resolve),
    insert: legacyInsert,
  };
  from.mockReturnValue(chain);
  return { rpc, from } as unknown as ThrottleDb;
}

function expectNoLegacyFallback() {
  expect(from).not.toHaveBeenCalled();
  expect(legacyInsert).not.toHaveBeenCalled();
}

function expectGenericWarning() {
  expect(console.warn).toHaveBeenCalled();
  const logs = JSON.stringify(vi.mocked(console.warn).mock.calls);
  expect(logs).not.toContain(SYNTHETIC_IP);
  expect(logs).not.toContain("DTD-SYNTHETIC-SECRET");
  expect(logs).not.toContain("external-error");
}

beforeEach(() => {
  vi.resetAllMocks();
  rpc.mockResolvedValue({ data: true, error: null });
  legacyInsert.mockResolvedValue({ error: null });
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("isVerifyThrottled · reserva RPC confirmada", () => {
  it("permite únicamente una reserva confirmada true y nunca hace count+insert", async () => {
    expect(await isVerifyThrottled(fakeDb(), SYNTHETIC_IP)).toBe(false);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("reserve_public_verify_attempt", { p_ip: SYNTHETIC_IP });
    expectNoLegacyFallback();
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("FALSE por cupo agotado o entrada inválida bloquea sin fallback ni error operativo", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    expect(await isVerifyThrottled(fakeDb(), SYNTHETIC_IP)).toBe(true);
    expectNoLegacyFallback();
    expect(console.warn).not.toHaveBeenCalled();
  });

  it.each(["2001:0DB8:0000:0000:0000:0000:0000:0037", "unknown"])(
    "conserva la clave textual %s para que la RPC decida sin normalizar históricos",
    async (ip) => {
      rpc.mockResolvedValue({ data: false, error: null });
      expect(await isVerifyThrottled(fakeDb(), ip)).toBe(true);
      expect(rpc).toHaveBeenCalledExactlyOnceWith("reserve_public_verify_attempt", { p_ip: ip });
      expectNoLegacyFallback();
    },
  );

  it.each([
    ["null", null],
    ["ausente", undefined],
    ["array", []],
    ["booleano suelto", true],
    ["objeto vacío", {}],
    ["data null", { data: null, error: null }],
    ["data ausente", { error: null }],
    ["data array", { data: [true], error: null }],
    ["data objeto", { data: { reserved: true }, error: null }],
    ["data string", { data: "true", error: null }],
    ["data número", { data: 1, error: null }],
    ["error ausente", { data: true }],
    ["error undefined", { data: true, error: undefined }],
    ["error false", { data: true, error: false }],
    ["error externo", { data: null, error: { message: EXTERNAL_SECRET } }],
    ["true acompañado de error", { data: true, error: { message: EXTERNAL_SECRET } }],
  ])("respuesta %s bloquea con diagnóstico genérico y sin fallback", async (_case, response) => {
    rpc.mockResolvedValue(response);
    expect(await isVerifyThrottled(fakeDb(), SYNTHETIC_IP)).toBe(true);
    expect(rpc).toHaveBeenCalledTimes(1);
    expectNoLegacyFallback();
    expectGenericWarning();
  });

  it("RPC rechazada bloquea sin revelar el error del proveedor", async () => {
    rpc.mockRejectedValue(new Error(EXTERNAL_SECRET));
    expect(await isVerifyThrottled(fakeDb(), SYNTHETIC_IP)).toBe(true);
    expectNoLegacyFallback();
    expectGenericWarning();
  });

  it("excepción síncrona al invocar RPC también bloquea", async () => {
    rpc.mockImplementation(() => { throw new Error(EXTERNAL_SECRET); });
    expect(await isVerifyThrottled(fakeDb(), SYNTHETIC_IP)).toBe(true);
    expectNoLegacyFallback();
    expectGenericWarning();
  });
});
