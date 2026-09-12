/**
 * SDD-0375: contrato RPC sin red. La concurrencia real vive en
 * scripts/check-public-verify-concurrency.mjs; --legacy reproduce el defecto.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isVerifyThrottled,
  VERIFY_IP_LIMIT,
  VERIFY_WINDOW_MINUTES,
  type ThrottleDb,
} from "./verify-throttle";

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

// L17 (importación sobre main): la suite previa de main probaba el contador
// separado de 0169 (count+insert con fail-open). Sus escenarios se conservan
// sobre el contrato RPC; el de error invierte su expectativa por SDD-0375 §6.
describe("isVerifyThrottled · escenarios de la suite previa (0169) sobre la RPC", () => {
  it("bajo el límite → false; el intento lo registra la propia RPC, sin insert aparte", async () => {
    expect(await isVerifyThrottled(fakeDb(), "1.2.3.4")).toBe(false);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("reserve_public_verify_attempt", { p_ip: "1.2.3.4" });
    expectNoLegacyFallback();
  });

  it("en el límite o sobre él → true y NO registra fuera de la RPC", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    expect(await isVerifyThrottled(fakeDb(), "1.2.3.4")).toBe(true);
    expect(rpc).toHaveBeenCalledTimes(1);
    expectNoLegacyFallback();
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("error del throttle: antes fail-open (false); ahora bloquea (true) sin registrar por fallback", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await isVerifyThrottled(fakeDb(), "1.2.3.4")).toBe(true);
    expectNoLegacyFallback();
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it("las constantes exportadas describen el cupo fijo que aplica la RPC 0426", () => {
    const sql = readFileSync(
      join(process.cwd(), "supabase", "migrations", "0426_public_verify_atomic_reservation.sql"),
      "utf8",
    );
    expect(sql).toMatch(new RegExp(String.raw`\blimit ${VERIFY_IP_LIMIT}\b`));
    expect(sql).toContain(`if v_count >= ${VERIFY_IP_LIMIT} then return false; end if;`);
    expect(sql).toContain(`interval '${VERIFY_WINDOW_MINUTES} minutes'`);
  });
});

describe("isVerifyThrottled · RPC ausente o con error de base", () => {
  it.each([
    ["PGRST202", "función fuera de la caché de esquema: caché desactualizada o DROP FUNCTION"],
    ["42883", "función inexistente en PostgreSQL"],
    ["42501", "EXECUTE no concedido al rol que llama"],
    ["55P03", "lock_timeout de 2 s bajo contención de la misma IP"],
    ["25000", "transacción fuera de READ COMMITTED"],
    ["P0001", "INSERT no confirmado dentro de la RPC"],
  ])("%s (%s) bloquea sin fallback ni detalle del proveedor en logs", async (code) => {
    rpc.mockResolvedValue({
      data: null,
      error: { code, message: EXTERNAL_SECRET, details: EXTERNAL_SECRET, hint: null },
    });
    expect(await isVerifyThrottled(fakeDb(), SYNTHETIC_IP)).toBe(true);
    expect(rpc).toHaveBeenCalledTimes(1);
    expectNoLegacyFallback();
    expectGenericWarning();
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain(code);
  });
});

describe("isVerifyThrottled · verificaciones simultáneas", () => {
  it("cada llamada decide sólo por su reserva; el último cupo lo arbitra la RPC", async () => {
    rpc
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: false, error: null });
    const db = fakeDb();
    const results = await Promise.all([
      isVerifyThrottled(db, SYNTHETIC_IP),
      isVerifyThrottled(db, SYNTHETIC_IP),
    ]);
    expect(results).toEqual([false, true]);
    expect(rpc).toHaveBeenCalledTimes(2);
    expectNoLegacyFallback();
  });
});
