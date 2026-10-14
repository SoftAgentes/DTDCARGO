// @vitest-environment node
/**
 * SDD-0513 · Restablecer el PIN de un operario: generado por el servidor o
 * escrito a mano.
 *
 * El candado NO se dobla: corre el `moduleEditDenial` real de
 * lib/studio/rbac-guard.ts sobre un doble de Supabase que aplica de verdad los
 * filtros de `user_tenants` (`user_id` y `disabled_at`). Un doble que devolviera
 * la fila siempre dejaría pasar al usuario desactivado sin que nada fallara.
 *
 * Lo que se afirma:
 *  - admin y operations restablecen; los otros cinco roles, el usuario
 *    desactivado y la sesión vacía reciben la denegación, la RPC no se llama y
 *    NO se sortea ningún PIN (el sorteo va después del candado);
 *  - el PIN generado lo decide el servidor: un `pin` mandado en el formulario
 *    se ignora;
 *  - el PIN sale una vez en `pinReveal` y en la RPC, y en ningún otro lado:
 *    ni consola, ni otra RPC, ni tabla, ni revalidatePath;
 *  - el camino manual sigue funcionando y rechaza los PIN comunes con un
 *    mensaje en tuteo, sin llegar a la base.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const OPERARIO_ID = "50000000-0000-4000-8000-000000000001";
const TENANT_ID = "10000000-0000-4000-8000-000000000001";
const USER_ID = "20000000-0000-4000-8000-000000000001";
const DENIED = "No tienes permiso para realizar esta acción.";
const COMMON = "Ese PIN es muy fácil de adivinar. Usa otro o genera uno nuevo.";

type Membership = {
  user_id: string;
  tenant_id: string;
  role: string;
  disabled_at: string | null;
  warehouse_scope: string | null;
};

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn<(p: string) => void>(),
  sessionUserId: null as string | null,
  memberships: [] as Membership[],
  rpcCalls: [] as Array<{ fn: string; args: Record<string, unknown> }>,
  rpcError: null as { message: string; code?: string } | null,
  /** Respuestas por llamada, en orden; vacía = `rpcError` en todas. */
  rpcErrors: [] as Array<{ message: string; code?: string } | null>,
  fromCalls: [] as string[],
  randomIntCalls: [] as Array<[number, number]>,
  /** Valores forzados para randomInt; vacío = azar real de Node. */
  forced: [] as number[],
}));

vi.mock("next/cache", () => ({
  revalidatePath: (p: string) => mocks.revalidatePath(p),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  const randomInt = (min: number, max: number) => {
    mocks.randomIntCalls.push([min, max]);
    const next = mocks.forced.shift();
    return next ?? actual.randomInt(min, max);
  };
  return { ...actual, default: { ...actual, randomInt }, randomInt };
});

/** Doble mínimo de PostgREST: exige select() primero y aplica los filtros. */
function query(table: string) {
  let selected = false;
  const filters: Array<(row: Record<string, unknown>) => boolean> = [];
  const rows = (): Record<string, unknown>[] => {
    if (table === "user_tenants") return mocks.memberships.map((m) => ({ ...m }));
    if (table === "studio_role_module_overrides") return [];
    throw new Error(`Las actions de PIN no deben leer ${table}`);
  };
  const result = () => rows().filter((r) => filters.every((f) => f(r)));
  const builder = {
    select() {
      selected = true;
      return builder;
    },
    eq(col: string, value: unknown) {
      if (!selected) throw new Error(".eq() antes de .select()");
      filters.push((r) => r[col] === value);
      return builder;
    },
    is(col: string, value: null) {
      if (!selected) throw new Error(".is() antes de .select()");
      filters.push((r) => r[col] === value);
      return builder;
    },
    limit() {
      return builder;
    },
    async maybeSingle() {
      const out = result();
      return { data: out[0] ?? null, error: null };
    },
    returns() {
      return Promise.resolve({ data: result(), error: null });
    },
  };
  return builder;
}

vi.mock("@/lib/db/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: mocks.sessionUserId ? { id: mocks.sessionUserId } : null },
        error: null,
      }),
    },
    from(table: string) {
      mocks.fromCalls.push(table);
      return query(table);
    },
    rpc: async (fn: string, args: Record<string, unknown>) => {
      mocks.rpcCalls.push({ fn, args: { ...args } });
      const error = mocks.rpcErrors.length > 0 ? (mocks.rpcErrors.shift() ?? null) : mocks.rpcError;
      return { data: null, error };
    },
  }),
}));

import { createOperarioAction, generateOperarioPinAction, resetOperarioPinAction } from "../actions";
import {
  OPERARIO_PIN_IN_USE_CODE,
  OPERARIO_PIN_IN_USE_MESSAGE,
  OPERARIO_PIN_MAX_ATTEMPTS,
  isValidOperarioPin,
} from "@/lib/studio/operario-pin";

/** El rechazo de 0475 (SDD-0515) por PIN de otro operario activo del mismo tenant y región. */
const IN_USE = { code: OPERARIO_PIN_IN_USE_CODE, message: OPERARIO_PIN_IN_USE_MESSAGE };

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

function signIn(role: string, opts: { disabled?: boolean } = {}) {
  mocks.sessionUserId = USER_ID;
  mocks.memberships = [
    // Un compañero admin del mismo tenant, PRIMERO a propósito: si el gate o
    // el doble dejaran de filtrar por user_id, `limit(1)` tomaría SU rol y los
    // roles denegados pasarían.
    {
      user_id: "20000000-0000-4000-8000-0000000000ff",
      tenant_id: TENANT_ID,
      role: "admin",
      disabled_at: null,
      warehouse_scope: null,
    },
    {
      user_id: USER_ID,
      tenant_id: TENANT_ID,
      role,
      disabled_at: opts.disabled ? "2026-10-01T00:00:00Z" : null,
      warehouse_scope: null,
    },
  ];
}

const CONSOLE_METHODS = ["log", "info", "warn", "error", "debug", "trace"] as const;
let consoleSpies: Array<ReturnType<typeof vi.spyOn>> = [];

/** Todo lo que se escribió en consola, aplanado a texto. */
function consoleText(): string {
  return consoleSpies
    .flatMap((s) => s.mock.calls.flat())
    .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
    .join("\n");
}

beforeEach(() => {
  mocks.revalidatePath.mockReset();
  mocks.sessionUserId = null;
  mocks.memberships = [];
  mocks.rpcCalls = [];
  mocks.rpcError = null;
  mocks.rpcErrors = [];
  mocks.fromCalls = [];
  mocks.randomIntCalls = [];
  mocks.forced = [];
  consoleSpies = CONSOLE_METHODS.map((m) =>
    vi.spyOn(console, m).mockImplementation(() => undefined),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("generateOperarioPinAction · candado de rol", () => {
  it.each(["admin", "operations"])("%s restablece con un PIN válido sorteado en el servidor", async (role) => {
    signIn(role);
    const res = await generateOperarioPinAction({}, form({ operario_id: OPERARIO_ID }));

    expect(res.ok).toBe(true);
    expect(res.error).toBeUndefined();
    const pin = res.pinReveal!;
    expect(isValidOperarioPin(pin)).toBe(true);
    expect(mocks.rpcCalls).toEqual([
      { fn: "admin_reset_operario_pin", args: { p_operario_id: OPERARIO_ID, p_pin: pin } },
    ]);
    expect(mocks.randomIntCalls.length).toBeGreaterThanOrEqual(1);
    expect(mocks.randomIntCalls.every(([a, b]) => a === 0 && b === 10_000)).toBe(true);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/studio/operarios");
  });

  it.each(["commercial", "accounting", "warehouse", "support", "marketing"])(
    "%s no genera ni devuelve PIN, y la RPC no se llama",
    async (role) => {
      signIn(role);
      const res = await generateOperarioPinAction({}, form({ operario_id: OPERARIO_ID }));

      expect(res).toEqual({ error: DENIED });
      expect(mocks.rpcCalls).toEqual([]);
      expect(mocks.randomIntCalls).toEqual([]);
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    },
  );

  it("un operations DESACTIVADO queda fuera aunque haya un admin activo en el tenant", async () => {
    signIn("operations", { disabled: true });
    const res = await generateOperarioPinAction({}, form({ operario_id: OPERARIO_ID }));

    expect(res).toEqual({ error: DENIED });
    expect(mocks.rpcCalls).toEqual([]);
    expect(mocks.randomIntCalls).toEqual([]);
  });

  it("sin sesión no genera ni devuelve PIN", async () => {
    const res = await generateOperarioPinAction({}, form({ operario_id: OPERARIO_ID }));

    expect(res).toEqual({ error: DENIED });
    expect(mocks.rpcCalls).toEqual([]);
    expect(mocks.randomIntCalls).toEqual([]);
  });
});

describe("generateOperarioPinAction · el PIN lo decide el servidor", () => {
  it("ignora el pin que mande el formulario", async () => {
    signIn("admin");
    mocks.forced = [4827];
    const res = await generateOperarioPinAction(
      {},
      form({ operario_id: OPERARIO_ID, pin: "2580", pin_mode: "generar" }),
    );

    expect(res).toEqual({ ok: true, pinReveal: "4827" });
    expect(mocks.rpcCalls[0].args.p_pin).toBe("4827");
  });

  it("descarta un sorteo común antes de llamar a la base", async () => {
    signIn("admin");
    mocks.forced = [1234, 4827];
    const res = await generateOperarioPinAction({}, form({ operario_id: OPERARIO_ID }));

    expect(res.pinReveal).toBe("4827");
    expect(mocks.rpcCalls).toHaveLength(1);
    expect(mocks.rpcCalls[0].args.p_pin).toBe("4827");
  });

  it("sin operario no sortea ni llama a la base", async () => {
    signIn("admin");
    const res = await generateOperarioPinAction({}, form({}));

    expect(res).toEqual({ error: "Falta el operario." });
    expect(mocks.rpcCalls).toEqual([]);
    expect(mocks.randomIntCalls).toEqual([]);
  });

  it("si la base rechaza, no hay PIN en la respuesta ni se revalida", async () => {
    signIn("admin");
    mocks.forced = [4827];
    mocks.rpcError = { message: "Operario no encontrado", code: "P0014" };
    const res = await generateOperarioPinAction({}, form({ operario_id: OPERARIO_ID }));

    expect(res).toEqual({ error: "No se pudo restablecer el PIN: Operario no encontrado" });
    expect(JSON.stringify(res)).not.toContain("4827");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("el PIN no sale por ningún otro lado", () => {
  it("éxito: solo en pinReveal y en la RPC; nada en consola, tablas ni revalidatePath", async () => {
    signIn("operations");
    mocks.forced = [6083];
    const res = await generateOperarioPinAction({}, form({ operario_id: OPERARIO_ID }));
    expect(res.pinReveal).toBe("6083");

    expect(consoleText()).not.toContain("6083");
    // La única escritura es la RPC que guarda el hash; ninguna otra RPC
    // (auditoría incluida) recibe el valor.
    expect(mocks.rpcCalls.map((c) => c.fn)).toEqual(["admin_reset_operario_pin"]);
    // Solo se leen las tablas del candado; el doble no expone insert/update.
    expect(new Set(mocks.fromCalls)).toEqual(
      new Set(["user_tenants", "studio_role_module_overrides"]),
    );
    expect(JSON.stringify(mocks.revalidatePath.mock.calls)).not.toContain("6083");
  });

  it("error de la base: tampoco en consola", async () => {
    signIn("admin");
    mocks.forced = [6083];
    mocks.rpcError = { message: "boom", code: "XX000" };
    await generateOperarioPinAction({}, form({ operario_id: OPERARIO_ID }));

    expect(consoleText()).not.toContain("6083");
  });

  it("camino manual: el PIN escrito tampoco va a la consola", async () => {
    signIn("admin");
    await resetOperarioPinAction({}, form({ operario_id: OPERARIO_ID, pin: "7310" }));

    expect(consoleText()).not.toContain("7310");
  });
});

describe("resetOperarioPinAction · el camino manual se conserva", () => {
  it("guarda el PIN escrito y lo devuelve una vez", async () => {
    signIn("admin");
    const res = await resetOperarioPinAction({}, form({ operario_id: OPERARIO_ID, pin: "7310" }));

    expect(res).toEqual({ ok: true, pinReveal: "7310" });
    expect(mocks.rpcCalls).toEqual([
      { fn: "admin_reset_operario_pin", args: { p_operario_id: OPERARIO_ID, p_pin: "7310" } },
    ]);
    expect(mocks.randomIntCalls).toEqual([]);
  });

  it.each(["1234", "0000", "2580"])("rechaza el común %s en tuteo y sin llegar a la base", async (pin) => {
    signIn("admin");
    const res = await resetOperarioPinAction({}, form({ operario_id: OPERARIO_ID, pin }));

    expect(res).toEqual({ fieldErrors: { pin: COMMON } });
    expect(mocks.rpcCalls).toEqual([]);
  });

  it.each(["", "123", "12a4", "12345"])("rechaza el formato %j sin llegar a la base", async (pin) => {
    signIn("admin");
    const res = await resetOperarioPinAction({}, form({ operario_id: OPERARIO_ID, pin }));

    expect(res).toEqual({ fieldErrors: { pin: "El PIN tiene que ser de 4 dígitos." } });
    expect(mocks.rpcCalls).toEqual([]);
  });

  it("un rol sin permiso tampoco puede escribirlo a mano", async () => {
    signIn("marketing");
    const res = await resetOperarioPinAction({}, form({ operario_id: OPERARIO_ID, pin: "7310" }));

    expect(res).toEqual({ error: DENIED });
    expect(mocks.rpcCalls).toEqual([]);
  });
});

// ─── SDD-0515 · la base rechaza un PIN repetido (P0018, migr 0475) ──────────

describe("PIN repetido en el tenant y la región", () => {
  it("generado: si la base dice que ya lo usa otro operario, sortea otro distinto y lo guarda", async () => {
    signIn("operations");
    // El tercer sorteo repite el PIN rechazado: no se vuelve a proponer.
    mocks.forced = [4827, 4827, 6083];
    mocks.rpcErrors = [IN_USE, null];
    const res = await generateOperarioPinAction({}, form({ operario_id: OPERARIO_ID }));

    expect(res).toEqual({ ok: true, pinReveal: "6083" });
    expect(mocks.rpcCalls.map((c) => c.args.p_pin)).toEqual(["4827", "6083"]);
    expect(mocks.rpcCalls.every((c) => c.fn === "admin_reset_operario_pin" && c.args.p_operario_id === OPERARIO_ID)).toBe(true);
    // El PIN rechazado es el de OTRO operario: no sale por ningún lado.
    expect(JSON.stringify(res)).not.toContain("4827");
    expect(consoleText()).not.toContain("4827");
    expect(mocks.revalidatePath).toHaveBeenCalledTimes(1);
  });

  it(`generado: tras ${OPERARIO_PIN_MAX_ATTEMPTS} repetidos seguidos se rinde con el mensaje de la base y sin PIN`, async () => {
    signIn("admin");
    const tried = [4827, 6083, 7310, 5291, 3846];
    mocks.forced = [...tried];
    mocks.rpcErrors = tried.map(() => IN_USE);
    const res = await generateOperarioPinAction({}, form({ operario_id: OPERARIO_ID }));

    expect(res).toEqual({ error: `No se pudo restablecer el PIN: ${OPERARIO_PIN_IN_USE_MESSAGE}` });
    expect(mocks.rpcCalls).toHaveLength(OPERARIO_PIN_MAX_ATTEMPTS);
    for (const pin of tried) expect(JSON.stringify(res)).not.toContain(String(pin));
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("generado: un rechazo que no es por repetido no reintenta", async () => {
    signIn("admin");
    mocks.forced = [4827, 6083];
    mocks.rpcErrors = [{ code: "42501", message: "No tienes permiso para realizar esta acción" }];
    const res = await generateOperarioPinAction({}, form({ operario_id: OPERARIO_ID }));

    expect(res).toEqual({ error: "No se pudo restablecer el PIN: No tienes permiso para realizar esta acción" });
    expect(mocks.rpcCalls).toHaveLength(1);
  });

  it("escrito a mano: vuelve como error del campo PIN, sin reintentar ni revelar", async () => {
    signIn("admin");
    mocks.rpcErrors = [IN_USE];
    const res = await resetOperarioPinAction({}, form({ operario_id: OPERARIO_ID, pin: "7310" }));

    expect(res).toEqual({ fieldErrors: { pin: OPERARIO_PIN_IN_USE_MESSAGE } });
    expect(mocks.rpcCalls).toHaveLength(1);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("alta: el PIN que escribió el admin no se cambia por otro; vuelve como error del campo", async () => {
    signIn("admin");
    mocks.rpcErrors = [IN_USE];
    const res = await createOperarioAction({}, form({
      warehouse_id: "30000000-0000-4000-8000-000000000001",
      display_name: "Li Wei",
      pin: "7310",
      role: "operario",
    }));

    expect(res).toEqual({ fieldErrors: { pin: OPERARIO_PIN_IN_USE_MESSAGE } });
    expect(mocks.rpcCalls.map((c) => [c.fn, c.args.p_pin])).toEqual([["admin_create_operario", "7310"]]);
    expect(mocks.randomIntCalls).toEqual([]);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
