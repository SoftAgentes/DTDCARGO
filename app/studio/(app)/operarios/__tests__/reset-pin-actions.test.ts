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
 *
 * SDD-0515: el motivo es un código de la lista (texto sólo con «Otro») y «Ver
 * PIN» confirma la contraseña. Para eso corre el `withPasswordConfirmedClient`
 * real sobre un doble de `@supabase/supabase-js` que hace de Supabase Auth: la
 * RPC sólo puede ir por el cliente recién confirmado, y la sesión nueva se
 * cierra siempre.
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
  /** Lo que devuelve la RPC cuando no hay error (el PIN de «Ver PIN»). */
  rpcData: null as unknown,
  fromCalls: [] as string[],
  randomIntCalls: [] as Array<[number, number]>,
  /** Valores forzados para randomInt; vacío = azar real de Node. */
  forced: [] as number[],
  sessionEmail: null as string | null,
  /** Cuentas de Supabase Auth: correo → contraseña e id. */
  accounts: new Map<string, { password: string; id: string }>(),
  /** Si no es null, Supabase Auth responde este error a todo inicio de sesión. */
  authError: null as { code?: string; message: string; status?: number } | null,
  /** Si no es null, la sesión nueva sale a nombre de este id (no el de la cuenta). */
  authUserOverride: null as string | null,
  clientsCreated: [] as Array<{ url: string; key: string; options: unknown }>,
  signInCalls: [] as Array<{ email: string; password: string }>,
  signOutCalls: [] as unknown[],
  /** RPC hechas con el cliente de la contraseña confirmada. */
  confirmedRpcCalls: [] as Array<{ fn: string; args: Record<string, unknown> }>,
  confirmedRpcResult: { data: null as unknown, error: null as { message: string; code?: string } | null },
  confirmedRpcThrows: false,
}));

// SDD-0622: los accesos adicionales de la persona se leen aparte, como los
// desvíos por rol; aquí no son el objeto de la prueba.
vi.mock("@/lib/studio/user-module-grants-queries", () => ({
  getMyModuleGrants: async () => ({}),
}));
vi.mock("next/cache", () => ({
  revalidatePath: (p: string) => mocks.revalidatePath(p),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

/** Doble de Supabase Auth para el cliente efímero de «Ver PIN». */
vi.mock("@supabase/supabase-js", () => ({
  createClient: (url: string, key: string, options: unknown) => {
    mocks.clientsCreated.push({ url, key, options });
    let session: { user: { id: string } } | null = null;
    return {
      auth: {
        signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
          mocks.signInCalls.push({ email, password });
          if (mocks.authError) return { data: { session: null, user: null }, error: mocks.authError };
          const account = mocks.accounts.get(email);
          if (!account || account.password !== password) {
            return {
              data: { session: null, user: null },
              error: { code: "invalid_credentials", message: "Invalid login credentials", status: 400 },
            };
          }
          const user = { id: mocks.authUserOverride ?? account.id };
          session = { user };
          return { data: { session: { access_token: "jwt-con-amr-password", user }, user }, error: null };
        },
        signOut: async (opts: unknown) => {
          mocks.signOutCalls.push(opts);
          session = null;
          return { error: null };
        },
      },
      rpc: async (fn: string, args: Record<string, unknown>) => {
        if (!session) throw new Error("RPC del cliente efímero sin sesión confirmada");
        mocks.confirmedRpcCalls.push({ fn, args: { ...args } });
        if (mocks.confirmedRpcThrows) throw new Error("red caída");
        return mocks.confirmedRpcResult;
      },
    };
  },
}));

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
        data: {
          user: mocks.sessionUserId
            ? { id: mocks.sessionUserId, email: mocks.sessionEmail ?? undefined }
            : null,
        },
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
      return { data: error ? null : mocks.rpcData, error };
    },
  }),
}));

import {
  createOperarioAction,
  generateOperarioPinAction,
  resetOperarioPinAction,
  viewOperarioPinAction,
} from "../actions";
import {
  OPERARIO_MOTIVO_CODE,
  OPERARIO_MOTIVO_MESSAGE,
  OPERARIO_PASSWORD_CODE,
  OPERARIO_PASSWORD_FAILURE_MESSAGE,
  OPERARIO_PASSWORD_MESSAGE,
  OPERARIO_PIN_IN_USE_CODE,
  OPERARIO_PIN_IN_USE_MESSAGE,
  OPERARIO_MOTIVOS,
  OPERARIO_PIN_MAX_ATTEMPTS,
  isValidOperarioPin,
} from "@/lib/studio/operario-pin";

/** El rechazo de 0475 (SDD-0515) por PIN de otro operario activo del mismo tenant y región. */
const IN_USE = { code: OPERARIO_PIN_IN_USE_CODE, message: OPERARIO_PIN_IN_USE_MESSAGE };

/** SDD-0515: alta, restablecimiento y «Ver PIN» piden un motivo de la lista. */
const MOTIVO = "olvido";

/** El formulario con el motivo de siempre, salvo que el caso traiga el suyo (o `motivo: null`). */
function form(fields: Record<string, string | null>): FormData {
  const fd = new FormData();
  const withMotivo = "motivo" in fields ? fields : { ...fields, motivo: MOTIVO };
  for (const [k, v] of Object.entries(withMotivo)) if (v !== null) fd.set(k, v);
  return fd;
}

const EMAIL = "operaciones@example.test";
/** Con espacios a propósito: la contraseña viaja tal cual, sin recortar. */
const PASSWORD = " Clave-del-Studio 2026 ";

function signIn(role: string, opts: { disabled?: boolean } = {}) {
  mocks.sessionUserId = USER_ID;
  mocks.sessionEmail = EMAIL;
  mocks.accounts.set(EMAIL, { password: PASSWORD, id: USER_ID });
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
  mocks.rpcData = null;
  mocks.fromCalls = [];
  mocks.randomIntCalls = [];
  mocks.forced = [];
  mocks.sessionEmail = null;
  mocks.accounts = new Map();
  mocks.authError = null;
  mocks.authUserOverride = null;
  mocks.clientsCreated = [];
  mocks.signInCalls = [];
  mocks.signOutCalls = [];
  mocks.confirmedRpcCalls = [];
  mocks.confirmedRpcResult = { data: null, error: null };
  mocks.confirmedRpcThrows = false;
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://supabase.example.test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key-de-prueba");
  consoleSpies = CONSOLE_METHODS.map((m) =>
    vi.spyOn(console, m).mockImplementation(() => undefined),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
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
      { fn: "admin_reset_operario_pin", args: { p_operario_id: OPERARIO_ID, p_pin: pin, p_motivo: MOTIVO, p_motivo_texto: null, p_reactivar: false } },
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
      { fn: "admin_reset_operario_pin", args: { p_operario_id: OPERARIO_ID, p_pin: "7310", p_motivo: MOTIVO, p_motivo_texto: null, p_reactivar: false } },
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
    const res = await createOperarioAction({}, form({ ...ALTA, pin_mode: "manual", pin: "7310" }));

    expect(res).toEqual({ fieldErrors: { pin: OPERARIO_PIN_IN_USE_MESSAGE } });
    expect(mocks.rpcCalls.map((c) => [c.fn, c.args.p_pin])).toEqual([["admin_create_operario", "7310"]]);
    expect(mocks.randomIntCalls).toEqual([]);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

// ─── SDD-0515 · motivo obligatorio ──────────────────────────────────────────

const ALTA = {
  warehouse_id: "30000000-0000-4000-8000-000000000001",
  display_name: "Li Wei",
  role: "operario",
};

describe("motivo obligatorio (AUD-01)", () => {
  it.each([
    ["sin motivo", { motivo: null }, OPERARIO_MOTIVO_MESSAGE.codigo],
    ["vacío", { motivo: "   " }, OPERARIO_MOTIVO_MESSAGE.codigo],
    ["con un código que no está en la lista", { motivo: "inventado" }, OPERARIO_MOTIVO_MESSAGE.codigo],
    ["con el texto libre de antes", { motivo: "El operario olvidó su PIN" }, OPERARIO_MOTIVO_MESSAGE.codigo],
    ["«Otro» sin texto", { motivo: "otro" }, OPERARIO_MOTIVO_MESSAGE.length],
    ["«Otro» con 3 letras", { motivo: "otro", motivo_texto: "abc" }, OPERARIO_MOTIVO_MESSAGE.length],
    ["«Otro» con 201 letras", { motivo: "otro", motivo_texto: "x".repeat(201) }, OPERARIO_MOTIVO_MESSAGE.length],
  ])("generado %s: no sortea ni llama a la base", async (_label, fields, message) => {
    signIn("admin");
    const res = await generateOperarioPinAction({}, form({ operario_id: OPERARIO_ID, ...fields }));

    expect(res).toEqual({ fieldErrors: { motivo: message } });
    expect(mocks.rpcCalls).toEqual([]);
    expect(mocks.randomIntCalls).toEqual([]);
  });

  it.each(OPERARIO_MOTIVOS.filter((m) => m.value !== "otro").map((m) => m.value))(
    "el código %s llega a la RPC sin texto, aunque el formulario mande uno",
    async (codigo) => {
      signIn("admin");
      mocks.forced = [4827];
      const res = await generateOperarioPinAction({}, form({
        operario_id: OPERARIO_ID, motivo: codigo, motivo_texto: "esto no viaja",
      }));

      expect(res.ok).toBe(true);
      expect(mocks.rpcCalls[0].args).toMatchObject({ p_motivo: codigo, p_motivo_texto: null });
    },
  );

  it("«Otro» manda su texto recortado a la RPC", async () => {
    signIn("operations");
    const res = await resetOperarioPinAction({}, form({
      operario_id: OPERARIO_ID, pin: "7310", motivo: "otro", motivo_texto: "  Cambio de turno  ",
    }));

    expect(res.ok).toBe(true);
    expect(mocks.rpcCalls[0].args).toMatchObject({ p_motivo: "otro", p_motivo_texto: "Cambio de turno" });
  });

  it("escrito a mano: un texto de «Otro» con el PIN se rechaza antes de la base", async () => {
    signIn("admin");
    const res = await resetOperarioPinAction({}, form({
      operario_id: OPERARIO_ID, pin: "7310", motivo: "otro", motivo_texto: "Le dejé el 7310 que pidió",
    }));

    expect(res).toEqual({ fieldErrors: { motivo: OPERARIO_MOTIVO_MESSAGE.contains_pin } });
    expect(mocks.rpcCalls).toEqual([]);
  });

  it("el motivo llega a la RPC, y si la base lo rechaza vuelve al campo", async () => {
    signIn("operations");
    mocks.forced = [4827];
    mocks.rpcErrors = [{ code: OPERARIO_MOTIVO_CODE, message: OPERARIO_MOTIVO_MESSAGE.codigo }];
    const res = await generateOperarioPinAction({}, form({ operario_id: OPERARIO_ID }));

    expect(mocks.rpcCalls[0].args.p_motivo).toBe(MOTIVO);
    expect(res).toEqual({ fieldErrors: { motivo: OPERARIO_MOTIVO_MESSAGE.codigo } });
    expect(mocks.rpcCalls).toHaveLength(1);
  });

  it("alta sin motivo: no llama a la base", async () => {
    signIn("admin");
    const res = await createOperarioAction({}, form({ ...ALTA, motivo: "" }));

    expect(res).toEqual({ fieldErrors: { motivo: OPERARIO_MOTIVO_MESSAGE.codigo } });
    expect(mocks.rpcCalls).toEqual([]);
  });

  it("alta con «Otro»: el texto llega a la RPC", async () => {
    signIn("admin");
    mocks.forced = [4827];
    const res = await createOperarioAction({}, form({ ...ALTA, motivo: "otro", motivo_texto: "Refuerzo de temporada" }));

    expect(res.ok).toBe(true);
    expect(mocks.rpcCalls[0].args).toMatchObject({ p_motivo: "otro", p_motivo_texto: "Refuerzo de temporada" });
  });
});

describe("reactivar a un operario de baja (SDD-0515)", () => {
  it.each([
    ["generado", generateOperarioPinAction, {}],
    ["escrito a mano", resetOperarioPinAction, { pin: "7310", pin_mode: "manual" }],
  ] as const)("%s: `reactivar=1` llega como p_reactivar", async (_label, action, extra) => {
    signIn("admin");
    mocks.forced = [4827];
    const res = await action({}, form({ operario_id: OPERARIO_ID, reactivar: "1", ...extra }));

    expect(res.ok).toBe(true);
    expect(mocks.rpcCalls).toHaveLength(1);
    expect(mocks.rpcCalls[0].args.p_reactivar).toBe(true);
    expect(mocks.rpcCalls[0].args.p_motivo).toBe(MOTIVO);
  });
});

describe("alta con el PIN generado en el servidor (SDD-0515)", () => {
  it("por defecto el servidor sortea el PIN, ignora el del formulario y no usa Math.random", async () => {
    const mathRandom = vi.spyOn(Math, "random");
    signIn("operations");
    mocks.forced = [4827];
    const res = await createOperarioAction({}, form({ ...ALTA, pin: "2580" }));

    // El alta del Studio es de China: el PIN se muestra con /m/cn/login.
    expect(res).toEqual({ ok: true, pinReveal: "4827", region: "cn" });
    expect(mocks.rpcCalls).toEqual([{
      fn: "admin_create_operario",
      args: {
        p_tenant_id: TENANT_ID,
        p_warehouse_id: ALTA.warehouse_id,
        p_display_name: "Li Wei",
        p_display_name_cn: null,
        p_pin: "4827",
        p_role: "operario",
        p_motivo: MOTIVO,
        p_motivo_texto: null,
      },
    }]);
    expect(mathRandom).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/studio/operarios");
  });

  it("si el PIN generado está repetido, sortea otro y lo guarda", async () => {
    signIn("admin");
    mocks.forced = [4827, 6083];
    mocks.rpcErrors = [IN_USE, null];
    const res = await createOperarioAction({}, form(ALTA));

    expect(res).toEqual({ ok: true, pinReveal: "6083", region: "cn" });
    expect(mocks.rpcCalls.map((c) => c.args.p_pin)).toEqual(["4827", "6083"]);
    expect(consoleText()).not.toContain("4827");
  });

  it("un nombre repetido (P0013) no se reintenta con otro PIN", async () => {
    signIn("admin");
    mocks.forced = [4827, 6083];
    mocks.rpcErrors = [{ code: "P0013", message: "Ya existe un operario con ese nombre en ese warehouse" }];
    const res = await createOperarioAction({}, form(ALTA));

    expect(res).toEqual({ error: "No se pudo crear: Ya existe un operario con ese nombre en ese warehouse" });
    expect(mocks.rpcCalls).toHaveLength(1);
  });

  it("escrito a mano: un PIN común se rechaza en tuteo sin llegar a la base", async () => {
    signIn("admin");
    const res = await createOperarioAction({}, form({ ...ALTA, pin_mode: "manual", pin: "1234" }));

    expect(res).toEqual({ fieldErrors: { pin: COMMON } });
    expect(mocks.rpcCalls).toEqual([]);
  });

  it.each(["commercial", "support", "marketing"])("%s no crea operarios ni sortea", async (role) => {
    signIn(role);
    const res = await createOperarioAction({}, form(ALTA));

    expect(res).toEqual({ error: DENIED });
    expect(mocks.rpcCalls).toEqual([]);
    expect(mocks.randomIntCalls).toEqual([]);
  });
});

// ─── SDD-0515 · «Ver PIN» ────────────────────────────────────────────────────

/** El formulario de «Ver PIN»: el operario, el motivo y la contraseña. */
function verForm(fields: Record<string, string | null> = {}): FormData {
  return form({ operario_id: OPERARIO_ID, password: PASSWORD, ...fields });
}

/** Ni la contraseña ni el PIN salen por la consola ni por el resultado. */
function expectNoLeak(res: unknown, ...secrets: string[]) {
  for (const secret of [PASSWORD, PASSWORD.trim(), ...secrets]) {
    expect(consoleText()).not.toContain(secret);
    expect(JSON.stringify(res)).not.toContain(secret);
  }
}

describe("viewOperarioPinAction · contraseña confirmada y motivo", () => {
  it.each(["admin", "operations"])("%s ve el PIN: confirma la contraseña y la RPC va por esa sesión", async (role) => {
    signIn(role);
    mocks.confirmedRpcResult = { data: "6083", error: null };
    const res = await viewOperarioPinAction(verForm());

    expect(res).toEqual({ ok: true, pin: "6083" });
    // La contraseña llega a Supabase Auth tal cual, con el correo de la sesión.
    expect(mocks.signInCalls).toEqual([{ email: EMAIL, password: PASSWORD }]);
    // Un cliente que no guarda la sesión: ni cookies ni almacenamiento.
    expect(mocks.clientsCreated).toEqual([{
      url: "https://supabase.example.test",
      key: "anon-key-de-prueba",
      options: { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
    }]);
    expect(mocks.confirmedRpcCalls).toEqual([
      { fn: "admin_ver_operario_pin", args: { p_operario_id: OPERARIO_ID, p_motivo: MOTIVO, p_motivo_texto: null } },
    ]);
    // La sesión del navegador no llama a la RPC: sin la contraseña confirmada no hay PIN.
    expect(mocks.rpcCalls).toEqual([]);
    // La sesión nueva se cierra, y sólo ella.
    expect(mocks.signOutCalls).toEqual([{ scope: "local" }]);
    // Ver no cambia nada: no se revalida.
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    expect(consoleText()).not.toContain("6083");
    expectNoLeak(res);
  });

  it("«Otro» manda su texto; un código fijo, no", async () => {
    signIn("admin");
    mocks.confirmedRpcResult = { data: "6083", error: null };
    await viewOperarioPinAction(verForm({ motivo: "otro", motivo_texto: " Lo pidió el supervisor " }));
    await viewOperarioPinAction(verForm({ motivo: "revision_seguridad", motivo_texto: "no viaja" }));

    expect(mocks.confirmedRpcCalls.map((c) => c.args)).toEqual([
      { p_operario_id: OPERARIO_ID, p_motivo: "otro", p_motivo_texto: "Lo pidió el supervisor" },
      { p_operario_id: OPERARIO_ID, p_motivo: "revision_seguridad", p_motivo_texto: null },
    ]);
  });

  it.each(["commercial", "accounting", "warehouse", "support", "marketing"])(
    "%s no ve el PIN: ni se confirma la contraseña ni se llama a la RPC",
    async (role) => {
      signIn(role);
      mocks.confirmedRpcResult = { data: "6083", error: null };
      const res = await viewOperarioPinAction(verForm());

      expect(res).toEqual({ error: DENIED });
      expect(mocks.signInCalls).toEqual([]);
      expect(mocks.confirmedRpcCalls).toEqual([]);
      expect(mocks.rpcCalls).toEqual([]);
    },
  );

  it("un operations desactivado tampoco", async () => {
    signIn("operations", { disabled: true });
    expect(await viewOperarioPinAction(verForm())).toEqual({ error: DENIED });
    expect(mocks.signInCalls).toEqual([]);
  });

  it.each([
    ["sin motivo", { motivo: null }, OPERARIO_MOTIVO_MESSAGE.codigo],
    ["con un código inventado", { motivo: "inventado" }, OPERARIO_MOTIVO_MESSAGE.codigo],
    ["con «Otro» corto", { motivo: "otro", motivo_texto: "abc" }, OPERARIO_MOTIVO_MESSAGE.length],
    ["con «Otro» largo", { motivo: "otro", motivo_texto: "x".repeat(201) }, OPERARIO_MOTIVO_MESSAGE.length],
  ])("%s no pide la contraseña ni llama a la base", async (_label, fields, message) => {
    signIn("admin");
    const res = await viewOperarioPinAction(verForm(fields));

    expect(res).toEqual({ error: message, fieldError: "motivo" });
    expect(mocks.signInCalls).toEqual([]);
    expect(mocks.confirmedRpcCalls).toEqual([]);
  });

  it.each([["sin contraseña", null], ["con la contraseña vacía", ""]])("%s no llama a Supabase Auth", async (_label, password) => {
    signIn("admin");
    const res = await viewOperarioPinAction(verForm({ password }));

    expect(res).toEqual({ error: OPERARIO_PASSWORD_FAILURE_MESSAGE.empty, fieldError: "password" });
    expect(mocks.signInCalls).toEqual([]);
    expect(mocks.clientsCreated).toEqual([]);
  });

  it("con otra contraseña: no hay PIN, ni RPC, ni sesión que cerrar", async () => {
    signIn("admin");
    mocks.confirmedRpcResult = { data: "6083", error: null };
    const wrong = "otra-clave-cualquiera";
    const res = await viewOperarioPinAction(verForm({ password: wrong }));

    expect(res).toEqual({ error: OPERARIO_PASSWORD_FAILURE_MESSAGE.invalid, fieldError: "password" });
    expect(mocks.signInCalls).toEqual([{ email: EMAIL, password: wrong }]);
    expect(mocks.confirmedRpcCalls).toEqual([]);
    expect(mocks.signOutCalls).toEqual([]);
    expectNoLeak(res, wrong, "6083");
  });

  it("una contraseña con los espacios recortados no es la misma", async () => {
    signIn("admin");
    const res = await viewOperarioPinAction(verForm({ password: PASSWORD.trim() }));

    expect(res).toEqual({ error: OPERARIO_PASSWORD_FAILURE_MESSAGE.invalid, fieldError: "password" });
    expect(mocks.confirmedRpcCalls).toEqual([]);
  });

  it("si Supabase Auth no responde bien (límite de intentos), se dice y no hay PIN", async () => {
    signIn("admin");
    mocks.authError = { code: "over_request_rate_limit", message: "Request rate limit reached", status: 429 };
    const res = await viewOperarioPinAction(verForm());

    expect(res).toEqual({ error: OPERARIO_PASSWORD_FAILURE_MESSAGE.unavailable, fieldError: "password" });
    expect(mocks.confirmedRpcCalls).toEqual([]);
    expectNoLeak(res);
  });

  it("si la sesión nueva es de otra cuenta, no se usa y se cierra", async () => {
    signIn("admin");
    mocks.authUserOverride = "20000000-0000-4000-8000-0000000000ff";
    mocks.confirmedRpcResult = { data: "6083", error: null };
    const res = await viewOperarioPinAction(verForm());

    expect(res).toEqual({ error: OPERARIO_PASSWORD_FAILURE_MESSAGE.mismatch, fieldError: "password" });
    expect(mocks.confirmedRpcCalls).toEqual([]);
    expect(mocks.signOutCalls).toEqual([{ scope: "local" }]);
  });

  it("una cuenta sin correo no puede confirmar la contraseña", async () => {
    signIn("admin");
    mocks.sessionEmail = null;
    const res = await viewOperarioPinAction(verForm());

    expect(res).toEqual({ error: OPERARIO_PASSWORD_FAILURE_MESSAGE.noEmail, fieldError: "password" });
    expect(mocks.signInCalls).toEqual([]);
  });

  it("sin la configuración de Supabase, falla cerrado", async () => {
    signIn("admin");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    const res = await viewOperarioPinAction(verForm());

    expect(res).toEqual({ error: OPERARIO_PASSWORD_FAILURE_MESSAGE.unavailable, fieldError: "password" });
    expect(mocks.clientsCreated).toEqual([]);
  });

  it("si la base pide confirmar la contraseña (P0022), vuelve al campo de la contraseña", async () => {
    signIn("admin");
    mocks.confirmedRpcResult = { data: null, error: { code: OPERARIO_PASSWORD_CODE, message: OPERARIO_PASSWORD_MESSAGE } };
    const res = await viewOperarioPinAction(verForm());

    expect(res).toEqual({ error: OPERARIO_PASSWORD_MESSAGE, fieldError: "password" });
    expect(mocks.signOutCalls).toEqual([{ scope: "local" }]);
  });

  it("si la llamada revienta, la sesión nueva igual se cierra", async () => {
    signIn("admin");
    mocks.confirmedRpcThrows = true;
    await expect(viewOperarioPinAction(verForm())).rejects.toThrow("red caída");
    expect(mocks.signOutCalls).toEqual([{ scope: "local" }]);
    expect(consoleText()).not.toContain(PASSWORD.trim());
  });

  it("un PIN anterior a 0475 vuelve como null", async () => {
    signIn("admin");
    mocks.confirmedRpcResult = { data: null, error: null };
    expect(await viewOperarioPinAction(verForm())).toEqual({ ok: true, pin: null });
  });

  it("si la base rechaza, no hay PIN en la respuesta", async () => {
    signIn("admin");
    mocks.confirmedRpcResult = { data: "6083", error: { code: "P0014", message: "Operario no encontrado" } };
    const res = await viewOperarioPinAction(verForm());

    expect(res).toEqual({ error: "No se pudo mostrar el PIN: Operario no encontrado" });
    expect(JSON.stringify(res)).not.toContain("6083");
  });

  it("el motivo que la base rechaza vuelve marcado como error del motivo", async () => {
    signIn("admin");
    mocks.confirmedRpcResult = { data: null, error: { code: OPERARIO_MOTIVO_CODE, message: OPERARIO_MOTIVO_MESSAGE.contains_pin } };
    expect(await viewOperarioPinAction(verForm({ motivo: "otro", motivo_texto: "Confirmar el PIN" }))).toEqual({
      error: OPERARIO_MOTIVO_MESSAGE.contains_pin, fieldError: "motivo",
    });
  });
});
