// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// SDD-0369: funciones reales; sólo las fronteras de red están bloqueadas.
// Ningún caso lee credenciales del host ni inicia Playwright, Next o un seed.
const network = vi.hoisted(() => ({
  createClient: vi.fn(() => {
    throw new Error("TEST 0369: crear un cliente de red está prohibido");
  }),
  fetch: vi.fn(() => {
    throw new Error("TEST 0369: fetch está prohibido");
  }),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: network.createClient }));

type Environment = Record<string, string | undefined>;
let loadE2EEnvironment: typeof import("../e2e/sdd-0168-fixture").loadE2EEnvironment;
let preparePlaywrightRuntime: typeof import("../../playwright.config").preparePlaywrightRuntime;

const REF = "abcdefghijklmnopqrst";
const ORIGIN = "https://" + REF + ".supabase.co";
const OTHER_ORIGIN = "https://zyxwvutsrqponmlkjihg.supabase.co";
const ANON = "synthetic-anon-fixture-a";
const SERVICE = "synthetic-service-fixture-a";
const PASSWORD = "synthetic-password-0369";

function ephemeral(overrides: Environment = {}): Environment {
  return {
    E2E_ENVIRONMENT_KIND: "ephemeral",
    E2E_SUPABASE_PROJECT_REF: REF,
    E2E_EPHEMERAL_PROJECT_REF: REF,
    E2E_SUPABASE_URL: ORIGIN,
    E2E_SUPABASE_ANON_KEY: ANON,
    E2E_SUPABASE_SERVICE_ROLE_KEY: SERVICE,
    STUDIO_E2E_PASSWORD: PASSWORD,
    ...overrides,
  };
}

beforeAll(async () => {
  vi.stubGlobal("fetch", network.fetch);
  // La configuración ejecuta prepare() al importarse. Se carga con un objeto
  // sintético y se restaura la referencia original sin imprimir ni copiar sus valores.
  const originalEnvironment = process.env;
  process.env = {
    NODE_ENV: "test",
    BASE_URL: "http://127.0.0.1:43117",
    E2E_START_WEB_SERVER: "0",
  };
  try {
    ({ loadE2EEnvironment } = await import("../e2e/sdd-0168-fixture"));
    ({ preparePlaywrightRuntime } = await import("../../playwright.config"));
  } finally {
    process.env = originalEnvironment;
  }
  expect(network.createClient).not.toHaveBeenCalled();
  expect(network.fetch).not.toHaveBeenCalled();
});

afterEach(() => {
  expect(network.createClient).not.toHaveBeenCalled();
  expect(network.fetch).not.toHaveBeenCalled();
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("destino Supabase efímero: origen exacto antes de cualquier efecto", () => {
  it.each([ORIGIN, ORIGIN + "/", ORIGIN + ":443/"])("acepta el endpoint HTTPS canónico %s", (url) => {
    const env = ephemeral({ E2E_SUPABASE_URL: url });
    const before = { ...env };

    expect(loadE2EEnvironment(env)).toMatchObject({
      projectRef: REF,
      anonKey: ANON,
      serviceRoleKey: SERVICE,
      environmentKind: "ephemeral",
    });
    expect(new URL(loadE2EEnvironment(env).supabaseUrl).origin).toBe(ORIGIN);
    expect(env).toStrictEqual(before);
  });

  const unsafeUrls = [
    ["primer label igual, dominio ajeno", "https://" + REF + ".example.invalid"],
    ["sufijo añadido al dominio", ORIGIN + ".example.invalid"],
    ["TLD diferente", "https://" + REF + ".supabase.com"],
    ["usuario y contraseña", "https://synthetic:credential@" + REF + ".supabase.co"],
    ["ruta de API", ORIGIN + "/rest/v1"],
    ["query", ORIGIN + "?fixture=1"],
    ["fragmento", ORIGIN + "#fixture"],
    ["puerto no estándar", ORIGIN + ":8443"],
    ["punto final de hostname", ORIGIN + "."],
    ["HTTP", "http://" + REF + ".supabase.co"],
    ["loopback", "https://127.0.0.1"],
    ["URL inválida", "not-a-url"],
  ] as const;

  it.each(unsafeUrls)("rechaza %s sin mutar el entorno", (_label, url) => {
    const env = ephemeral({ E2E_SUPABASE_URL: url });
    const before = { ...env };

    expect(() => loadE2EEnvironment(env)).toThrow();
    expect(env).toStrictEqual(before);
  });

  it.each(["fixture_ref", "-fixture", "fixture-"])("rechaza ref malformado %s", (ref) => {
    const env = ephemeral({
      E2E_SUPABASE_PROJECT_REF: ref,
      E2E_EPHEMERAL_PROJECT_REF: ref,
      E2E_SUPABASE_URL: "https://" + ref + ".supabase.co",
    });
    const before = { ...env };

    expect(() => loadE2EEnvironment(env)).toThrow();
    expect(env).toStrictEqual(before);
  });

  it("mantiene el rechazo de confirmación ajena sin efectos", () => {
    const env = ephemeral({ E2E_EPHEMERAL_PROJECT_REF: "zyxwvutsrqponmlkjihg" });
    const before = { ...env };

    expect(() => loadE2EEnvironment(env)).toThrow();
    expect(env).toStrictEqual(before);
  });
});

describe("Next local y fixture efímero usan un único destino", () => {
  it("deriva URL, anon y service-role ausentes del entorno E2E validado", () => {
    const env = ephemeral();

    expect(preparePlaywrightRuntime(env)).toEqual({
      port: 3001,
      baseURL: "http://localhost:3001",
      startWebServer: true,
    });
    expect(env).toMatchObject({
      NEXT_PUBLIC_SUPABASE_URL: ORIGIN,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON,
      SUPABASE_SERVICE_ROLE_KEY: SERVICE,
      STUDIO_E2E_EMAIL: "sdd0168-admin@example.com",
      STUDIO_E2E_EXPENSE_CODE: "EXP-E2E-0243",
      STUDIO_E2E_PAYROLL_SETTLEMENT_CODE: "LIQ-E2E-0226",
    });
    expect(env.E2E_LOCAL_SUPABASE_DENY_SERVER).toBeUndefined();
    expect(env.E2E_SUPABASE_DENY_PORT).toBeUndefined();
  });

  it("preserva valores Next ya coherentes y es idempotente", () => {
    const env = ephemeral({
      NEXT_PUBLIC_SUPABASE_URL: ORIGIN,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON,
      SUPABASE_SERVICE_ROLE_KEY: SERVICE,
    });

    const runtime = preparePlaywrightRuntime(env);
    const prepared = { ...env };

    expect(preparePlaywrightRuntime(env)).toEqual(runtime);
    expect(env).toStrictEqual(prepared);
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe(ORIGIN);
    expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe(ANON);
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBe(SERVICE);
    expect(env.E2E_LOCAL_SUPABASE_DENY_SERVER).toBeUndefined();
  });

  it("acepta una URL Next equivalente con barra y puerto HTTPS estándar", () => {
    const env = ephemeral({
      NEXT_PUBLIC_SUPABASE_URL: ORIGIN + ":443/",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON,
      SUPABASE_SERVICE_ROLE_KEY: SERVICE,
    });

    expect(preparePlaywrightRuntime(env).startWebServer).toBe(true);
    expect(new URL(env.NEXT_PUBLIC_SUPABASE_URL!).origin).toBe(ORIGIN);
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBe(SERVICE);
  });

  it("la pareja pública parcial falla sin dejar aliases preparados", () => {
    const env = ephemeral({ NEXT_PUBLIC_SUPABASE_URL: ORIGIN });
    const before = { ...env };

    expect(() => preparePlaywrightRuntime(env)).toThrow();
    expect(env).toStrictEqual(before);
  });

  const mixed: Array<[string, Environment]> = [
    ["URL pública ajena", {
      NEXT_PUBLIC_SUPABASE_URL: OTHER_ORIGIN,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON,
    }],
    ["anon ajena", {
      NEXT_PUBLIC_SUPABASE_URL: ORIGIN,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "synthetic-anon-other",
    }],
    ["pareja pública ajena", {
      NEXT_PUBLIC_SUPABASE_URL: OTHER_ORIGIN,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "synthetic-anon-other",
    }],
    ["service-role ajena con pareja ausente", {
      SUPABASE_SERVICE_ROLE_KEY: "synthetic-service-other",
    }],
    ["service-role ajena con pareja coherente", {
      NEXT_PUBLIC_SUPABASE_URL: ORIGIN,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON,
      SUPABASE_SERVICE_ROLE_KEY: "synthetic-service-other",
    }],
  ];

  it.each(mixed)("rechaza %s antes de modificar aliases o env", (_label, declared) => {
    const env = ephemeral(declared);
    const before = { ...env };

    expect(() => preparePlaywrightRuntime(env)).toThrow();
    expect(env).toStrictEqual(before);
  });

  it("un alias inválido no deja aliases anteriores ni configuración Next parciales", () => {
    const env = ephemeral({ STUDIO_E2E_EXPENSE_CODE: "EXP-SYNTHETIC-OTHER" });
    const before = { ...env };

    expect(() => preparePlaywrightRuntime(env)).toThrow();
    expect(env).toStrictEqual(before);
  });

  it("rechaza el flag deny-only heredado en una corrida ephemeral", () => {
    const env = ephemeral({
      E2E_LOCAL_SUPABASE_DENY_SERVER: "1",
      E2E_SUPABASE_DENY_PORT: "13001",
    });
    const before = { ...env };

    expect(() => preparePlaywrightRuntime(env)).toThrow();
    expect(env).toStrictEqual(before);
  });

  it("rechaza un endpoint E2E ajeno antes de hidratar aliases", () => {
    const env = ephemeral({
      E2E_SUPABASE_URL: "https://" + REF + ".example.invalid",
    });
    const before = { ...env };

    expect(() => preparePlaywrightRuntime(env)).toThrow();
    expect(env).toStrictEqual(before);
  });
});

describe("compatibilidad de modos sin atribuir configuración al Next remoto", () => {
  it("preserva íntegra la configuración no-ephemeral completa", () => {
    const env: Environment = {
      NEXT_PUBLIC_SUPABASE_URL: OTHER_ORIGIN,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "synthetic-anon-existing",
      SUPABASE_SERVICE_ROLE_KEY: "synthetic-service-existing",
    };
    const before = { ...env };

    expect(preparePlaywrightRuntime(env).startWebServer).toBe(true);
    expect(env).toStrictEqual(before);
  });

  it("conserva deny-only local cuando no existe entorno Supabase", () => {
    const env: Environment = {};

    expect(preparePlaywrightRuntime(env).startWebServer).toBe(true);
    expect(env).toMatchObject({
      E2E_LOCAL_SUPABASE_DENY_SERVER: "1",
      E2E_SUPABASE_DENY_PORT: "13001",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:13001",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "e2e-local-anon-key-not-a-secret",
    });
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
    expect(env.STUDIO_E2E_EMAIL).toBeUndefined();
  });

  it("Preview sin fixture no recibe variables ni claves locales", () => {
    const env: Environment = { BASE_URL: "https://preview.example.invalid" };
    const before = { ...env };

    expect(preparePlaywrightRuntime(env)).toMatchObject({
      baseURL: "https://preview.example.invalid",
      startWebServer: false,
    });
    expect(env).toStrictEqual(before);
  });

  it("Preview con fixture validado no inyecta configuración del Next remoto", () => {
    const env = ephemeral({ BASE_URL: "https://preview.example.invalid" });

    expect(preparePlaywrightRuntime(env).startWebServer).toBe(false);
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBeUndefined();
    expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBeUndefined();
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
    expect(env.E2E_LOCAL_SUPABASE_DENY_SERVER).toBeUndefined();
  });

  it("Preview tampoco admite incoherencia declarada aunque no pueda verificar su backend real", () => {
    const env = ephemeral({
      BASE_URL: "https://preview.example.invalid",
      NEXT_PUBLIC_SUPABASE_URL: OTHER_ORIGIN,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "synthetic-anon-other",
    });
    const before = { ...env };

    expect(() => preparePlaywrightRuntime(env)).toThrow();
    expect(env).toStrictEqual(before);
  });
});
