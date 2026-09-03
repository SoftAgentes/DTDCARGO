/**
 * SDD-0374: fake estructural sin DB/red. El fallo seguro no convierte
 * count + insert en una reserva atómica; la carrera se reproduce abajo.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isVerifyThrottled, VERIFY_IP_LIMIT, VERIFY_WINDOW_MINUTES, type ThrottleDb } from "./verify-throttle";

const SYNTHETIC_IP = "198.51.100.37";
const EXTERNAL_SECRET = `external-error ${SYNTHETIC_IP} DTD-SYNTHETIC-SECRET`;
let selectResult: unknown;
let insertResult: unknown;
let readThrows: boolean;
let insertThrows: boolean;
const insert = vi.fn();
const select = vi.fn();
const eq = vi.fn();
const gte = vi.fn();

function fakeDb(): ThrottleDb {
  return {
    from() {
      const chain = {
        select: (...args: unknown[]) => { select(...args); return chain; },
        eq: (...args: unknown[]) => { eq(...args); return chain; },
        gte: (...args: unknown[]) => { gte(...args); return chain; },
        insert: async (row: unknown) => {
          insert(row);
          if (insertThrows) throw new Error(EXTERNAL_SECRET);
          return insertResult;
        },
        then: (resolve: (value: unknown) => unknown, reject?: (error: unknown) => unknown) => {
          const result = readThrows ? Promise.reject(new Error(EXTERNAL_SECRET)) : Promise.resolve(selectResult);
          return result.then(resolve, reject);
        },
      };
      return chain as unknown as ReturnType<ThrottleDb["from"]>;
    },
  };
}

function expectGenericWarning() {
  expect(console.warn).toHaveBeenCalled();
  const logs = JSON.stringify(vi.mocked(console.warn).mock.calls);
  expect(logs).not.toContain(SYNTHETIC_IP);
  expect(logs).not.toContain("DTD-SYNTHETIC-SECRET");
  expect(logs).not.toContain("external-error");
}

beforeEach(() => {
  selectResult = { count: 0, error: null };
  insertResult = { error: null };
  readThrows = false;
  insertThrows = false;
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-03T18:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("isVerifyThrottled · sólo habilita tras lectura y reserva confirmadas", () => {
  it.each([0, 3, VERIFY_IP_LIMIT - 1])("count %i permite y registra exactamente un intento", async (count) => {
    selectResult = { count, error: null };
    expect(await isVerifyThrottled(fakeDb(), SYNTHETIC_IP)).toBe(false);
    expect(insert).toHaveBeenCalledExactlyOnceWith({ ip: SYNTHETIC_IP });
    expect(console.warn).not.toHaveBeenCalled();
  });

  it.each([VERIFY_IP_LIMIT, VERIFY_IP_LIMIT + 1, 90])("count %i bloquea sin insertar", async (count) => {
    selectResult = { count, error: null };
    expect(await isVerifyThrottled(fakeDb(), SYNTHETIC_IP)).toBe(true);
    expect(insert).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("conserva count exacto por IP y ventana de30minutos", async () => {
    expect(VERIFY_WINDOW_MINUTES).toBe(30);
    expect(VERIFY_IP_LIMIT).toBe(40);
    await isVerifyThrottled(fakeDb(), SYNTHETIC_IP);
    expect(select).toHaveBeenCalledExactlyOnceWith("id", { count: "exact", head: true });
    expect(eq).toHaveBeenCalledExactlyOnceWith("ip", SYNTHETIC_IP);
    expect(gte).toHaveBeenCalledExactlyOnceWith("created_at", "2026-09-03T17:30:00.000Z");
  });
});

describe("isVerifyThrottled · lectura incierta cierra el acceso", () => {
  it("error de lectura antes fail-open ahora bloquea sin insertar", async () => {
    selectResult = { count: null, error: { message: EXTERNAL_SECRET } };
    expect(await isVerifyThrottled(fakeDb(), SYNTHETIC_IP)).toBe(true);
    expect(insert).not.toHaveBeenCalled();
    expectGenericWarning();
  });

  it.each([
    ["null count", { count: null, error: null }],
    ["count ausente", { error: null }],
    ["negativo", { count: -1, error: null }],
    ["fraccional", { count: 1.5, error: null }],
    ["NaN", { count: NaN, error: null }],
    ["Infinity", { count: Infinity, error: null }],
    ["string", { count: "0", error: null }],
    ["boolean", { count: false, error: null }],
    ["error ausente", { count: 0 }],
    ["respuesta null", null],
    ["respuesta ausente", undefined],
    ["respuesta array", []],
    ["count válido con error", { count: 0, error: { message: EXTERNAL_SECRET } }],
  ])("lectura %s bloquea sin throw y sin INSERT", async (_case, response) => {
    selectResult = response;
    expect(await isVerifyThrottled(fakeDb(), SYNTHETIC_IP)).toBe(true);
    expect(insert).not.toHaveBeenCalled();
    expectGenericWarning();
  });

  it("SELECT rechazado se convierte en bloqueo con aviso genérico", async () => {
    readThrows = true;
    expect(await isVerifyThrottled(fakeDb(), SYNTHETIC_IP)).toBe(true);
    expect(insert).not.toHaveBeenCalled();
    expectGenericWarning();
  });

  it("excepción síncrona al crear consulta también bloquea", async () => {
    const broken = { from: () => { throw new Error(EXTERNAL_SECRET); } } as ThrottleDb;
    expect(await isVerifyThrottled(broken, SYNTHETIC_IP)).toBe(true);
    expect(insert).not.toHaveBeenCalled();
    expectGenericWarning();
  });
});

describe("isVerifyThrottled · escritura sin confirmación no habilita verificación", () => {
  it.each([
    ["error explícito", { error: { message: EXTERNAL_SECRET } }],
    ["respuesta ausente", undefined],
    ["respuesta null", null],
    ["objeto sin error", {}],
    ["error undefined", { error: undefined }],
    ["error false", { error: false }],
    ["array", []],
    ["respuesta true", true],
  ])("INSERT %s bloquea después de un único intento", async (_case, response) => {
    insertResult = response;
    expect(await isVerifyThrottled(fakeDb(), SYNTHETIC_IP)).toBe(true);
    expect(insert).toHaveBeenCalledTimes(1);
    expectGenericWarning();
  });

  it("INSERT rechazado se convierte en bloqueo con aviso genérico", async () => {
    insertThrows = true;
    expect(await isVerifyThrottled(fakeDb(), SYNTHETIC_IP)).toBe(true);
    expect(insert).toHaveBeenCalledTimes(1);
    expectGenericWarning();
  });
});

describe("residuo documentado · count e insert NO constituyen reserva atómica", () => {
  it("dos solicitudes concurrentes consumen último cupo: residuo conservado, no cierre SEC03", async () => {
    let storedAttempts = VERIFY_IP_LIMIT - 1;
    let readers = 0;
    let releaseReaders!: () => void;
    const bothRead = new Promise<void>((resolve) => { releaseReaders = resolve; });
    const db = {
      from() {
        const chain = {
          select: () => chain,
          eq: () => chain,
          gte: () => chain,
          insert: async () => { storedAttempts++; return { error: null }; },
          then: (resolve: (value: unknown) => unknown, reject?: (error: unknown) => unknown) => {
            // Ambas lecturas observan39 antes de permitir cualquier INSERT.
            const observedCount = storedAttempts;
            readers++;
            if (readers === 2) releaseReaders();
            return bothRead.then(() => ({ count: observedCount, error: null })).then(resolve, reject);
          },
        };
        return chain;
      },
    } as unknown as ThrottleDb;

    const results = await Promise.all([
      isVerifyThrottled(db, SYNTHETIC_IP),
      isVerifyThrottled(db, SYNTHETIC_IP),
    ]);

    expect(results).toEqual([false, false]);
    expect(storedAttempts).toBe(VERIFY_IP_LIMIT + 1);
    expect(console.warn).not.toHaveBeenCalled();
  });
});
