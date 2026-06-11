/**
 * Tests del anti-abuso de registerClientAction (SDD-0042 §10).
 *
 * Cubre las DOS capas que se agregaron ANTES del trabajo pesado:
 *   - honeypot: si el campo trampa llega no-vacío → rechazo benigno SIN escribir
 *     nada (ni clients, ni auth.createUser, ni storage.upload, ni throttle).
 *   - throttle por IP: con >= LIMIT intentos recientes para la IP → rechazo sin
 *     writes; por debajo del límite → registra el intento y PROCEDE al flujo
 *     pesado (next_markbox).
 *
 * El admin client (createAdminClient), `next/headers` y el welcome email se
 * mockean — sin red ni DB real. El fake admin registra cada operación por
 * (table, op) + las llamadas a rpc / storage.upload / auth.admin.createUser para
 * poder afirmar "no se escribió nada".
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Recorder de side-effects del fake admin client ──────────────────────────
type OpKey = string; // `${table}:${op}`
const ops = {
  calls: new Set<OpKey>(),
  throttleSelectCount: null as number | null, // count que devuelve el SELECT del throttle
  rpcNames: [] as string[],
  uploads: [] as string[],
  createUserCalls: 0,
  reset() {
    this.calls.clear();
    this.throttleSelectCount = null;
    this.rpcNames = [];
    this.uploads = [];
    this.createUserCalls = 0;
  },
};

const THROTTLE = "portal_registro_throttle";

/**
 * Builder chainable mínimo del admin client. `resolveFor(table, op)` decide el
 * valor terminal. Registra (table, op) en ops.calls.
 */
function makeAdmin() {
  function resolveFor(table: string, op: string): { data?: unknown; error?: unknown; count?: number } {
    ops.calls.add(`${table}:${op}`);
    if (table === THROTTLE && op === "select") {
      // Conteo de intentos recientes (head:true → solo count).
      return { count: ops.throttleSelectCount ?? 0, error: null };
    }
    if (table === "tenants" && op === "select") {
      return { data: { id: "tenant-1" }, error: null };
    }
    if (table === "clients" && op === "select") {
      // dedup → sin duplicado.
      return { data: null, error: null };
    }
    if (table === "clients" && op === "insert") {
      return { data: { id: "client-1" }, error: null };
    }
    // throttle insert, client_users insert, etc.
    return { data: null, error: null };
  }

  function builder(table: string) {
    const state = { table, op: "select" };
    let opSet = false;
    const setOp = (o: string) => {
      if (!opSet) {
        state.op = o;
        opSet = true;
      }
    };
    const resolve = () => Promise.resolve(resolveFor(state.table, state.op));
    const chain: Record<string, unknown> = {
      select: () => {
        setOp("select");
        return chain;
      },
      insert: (p: unknown) => {
        setOp("insert");
        void p;
        return chain;
      },
      eq: () => chain,
      is: () => chain,
      ilike: () => chain,
      gte: () => chain,
      order: () => chain,
      limit: () => chain,
      single: () => resolve(),
      maybeSingle: () => resolve(),
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        resolve().then(res, rej),
    };
    return chain;
  }

  return {
    from: (table: string) => builder(table),
    rpc: async (name: string) => {
      ops.rpcNames.push(name);
      // next_markbox devuelve un markbox válido.
      return { data: "DTD-0001", error: null };
    },
    storage: {
      from: () => ({
        upload: async (path: string) => {
          ops.uploads.push(path);
          return { error: null };
        },
        remove: async () => ({ error: null }),
      }),
    },
    auth: {
      admin: {
        createUser: async () => {
          ops.createUserCalls += 1;
          return { data: { user: { id: "auth-1" } }, error: null };
        },
      },
    },
  };
}

// ── Mocks (deben declararse antes de importar el SUT) ───────────────────────
let currentIp = "1.2.3.4";
vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (k: string) => (k === "x-forwarded-for" ? currentIp : null),
  }),
}));

vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => makeAdmin(),
}));

vi.mock("@/lib/studio/welcome-email", () => ({
  sendWelcomeEmail: async () => ({ ok: true }),
}));

vi.mock("@/lib/studio/new-client-notify", () => ({
  notifyNewClientToAdmin: async () => {},
}));

// Import del SUT después de los mocks.
import { registerClientAction } from "../actions";

// ── Helpers ─────────────────────────────────────────────────────────────────
/** FormData válida para el alta EXPRESS (persona): solo los 5 campos mínimos. */
function validForm(overrides: Record<string, string> = {}): FormData {
  const f = new FormData();
  f.set("kind", "persona");
  f.set("name", "Carlos Pérez");
  f.set("document", "V-12345678");
  f.set("email", "carlos@empresa.com");
  f.set("whatsapp", "+58 412 1668021");
  for (const [k, v] of Object.entries(overrides)) f.set(k, v);
  // Registro EXPRESS: la foto + dirección se difieren al perfil → no van en el alta.
  return f;
}

beforeEach(() => {
  ops.reset();
  currentIp = "1.2.3.4";
});

// ── Honeypot ────────────────────────────────────────────────────────────────
describe("registerClientAction · honeypot", () => {
  it("honeypot lleno → rechazo benigno y CERO writes", async () => {
    const res = await registerClientAction({}, validForm({ empresa_web: "http://spam.example" }));

    // Respuesta genérica que no revela la trampa.
    expect(res.error).toBeTruthy();
    expect(res.markbox).toBeUndefined();
    expect(res.ok).toBeUndefined();

    // NADA se escribió: ni clients, ni createUser, ni upload, ni throttle.
    expect(ops.calls.has("clients:insert")).toBe(false);
    expect(ops.createUserCalls).toBe(0);
    expect(ops.uploads).toHaveLength(0);
    expect(ops.rpcNames).toHaveLength(0); // ni siquiera next_markbox
    expect(ops.calls.has(`${THROTTLE}:insert`)).toBe(false);
    expect(ops.calls.has(`${THROTTLE}:select`)).toBe(false);
  });

  it("honeypot solo-espacios se trata como vacío → NO rechaza por honeypot", async () => {
    const res = await registerClientAction({}, validForm({ empresa_web: "   " }));
    // No es el error del honeypot; el flujo avanzó (pegó el throttle al menos).
    expect(res.error).not.toBe("No pudimos procesar tu registro. Prueba de nuevo.");
    expect(ops.calls.has(`${THROTTLE}:select`)).toBe(true);
  });
});

// ── Throttle por IP ──────────────────────────────────────────────────────────
describe("registerClientAction · throttle por IP", () => {
  it("en el límite (>= LIMIT) → rechazo amable sin writes", async () => {
    ops.throttleSelectCount = 5; // == REGISTRO_IP_LIMIT

    const res = await registerClientAction({}, validForm());

    expect(res.error).toMatch(/demasiados registros/i);
    expect(res.markbox).toBeUndefined();

    // Consultó el throttle pero NO insertó el intento ni hizo trabajo pesado.
    expect(ops.calls.has(`${THROTTLE}:select`)).toBe(true);
    expect(ops.calls.has(`${THROTTLE}:insert`)).toBe(false);
    expect(ops.rpcNames).toHaveLength(0);
    expect(ops.uploads).toHaveLength(0);
    expect(ops.calls.has("clients:insert")).toBe(false);
    expect(ops.createUserCalls).toBe(0);
  });

  it("por encima del límite → también rechaza", async () => {
    ops.throttleSelectCount = 9;
    const res = await registerClientAction({}, validForm());
    expect(res.error).toMatch(/demasiados registros/i);
    expect(ops.calls.has(`${THROTTLE}:insert`)).toBe(false);
  });

  it("por debajo del límite → registra el intento y PROCEDE al trabajo pesado", async () => {
    ops.throttleSelectCount = 2; // < REGISTRO_IP_LIMIT

    await registerClientAction({}, validForm());

    // Registró el intento y avanzó: resolvió tenant + next_markbox_service + insert.
    // (Express: ya NO sube foto al alta → no se chequea storage.upload.)
    expect(ops.calls.has(`${THROTTLE}:insert`)).toBe(true);
    expect(ops.rpcNames).toContain("next_markbox_service");
    expect(ops.calls.has("clients:insert")).toBe(true);
  });

  it("sin x-forwarded-for usa 'unknown' pero igual consulta el throttle", async () => {
    currentIp = "";
    ops.throttleSelectCount = 0;
    await registerClientAction({}, validForm());
    expect(ops.calls.has(`${THROTTLE}:select`)).toBe(true);
    expect(ops.calls.has(`${THROTTLE}:insert`)).toBe(true);
  });
});
