import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  E2E_SCHEMA_PREFLIGHT_MAX_ATTEMPTS,
  E2E_SCHEMA_PREFLIGHT_RETRY_MS,
  SDD_0168_FIXTURE,
  getE2EExpenseOccurredAt,
  getE2ESchemaRetryDelayMs,
  isRetryableE2ESchemaError,
  loadE2EEnvironment,
} from "../e2e/sdd-0168-fixture";

const KEYS = [
  "E2E_SUPABASE_PROJECT_REF",
  "E2E_SUPABASE_URL",
  "E2E_SUPABASE_ANON_KEY",
  "E2E_SUPABASE_SERVICE_ROLE_KEY",
  "STUDIO_E2E_PASSWORD",
  "E2E_ENVIRONMENT_KIND",
  "E2E_EPHEMERAL_PROJECT_REF",
  "E2E_PRODUCTION_CONFIRM_PROJECT_REF",
] as const;

const original = new Map<string, string | undefined>();

function setValidEnvironment() {
  process.env.E2E_SUPABASE_PROJECT_REF = "ephemeralref";
  process.env.E2E_SUPABASE_URL = "https://ephemeralref.supabase.co";
  process.env.E2E_SUPABASE_ANON_KEY = "synthetic-anon-key";
  process.env.E2E_SUPABASE_SERVICE_ROLE_KEY = "synthetic-service-role";
  process.env.STUDIO_E2E_PASSWORD = "synthetic-password";
  process.env.E2E_ENVIRONMENT_KIND = "ephemeral";
  process.env.E2E_EPHEMERAL_PROJECT_REF = "ephemeralref";
}

beforeEach(() => {
  for (const key of KEYS) original.set(key, process.env[key]);
  setValidEnvironment();
});

afterEach(() => {
  for (const key of KEYS) {
    const value = original.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  original.clear();
});

describe("loadE2EEnvironment", () => {
  it("acepta únicamente un project ref efímero confirmado", () => {
    expect(loadE2EEnvironment()).toMatchObject({
      projectRef: "ephemeralref",
      anonKey: "synthetic-anon-key",
      environmentKind: "ephemeral",
    });
  });

  it("exige una llave anon separada para lecturas authenticated", () => {
    delete process.env.E2E_SUPABASE_ANON_KEY;

    expect(() => loadE2EEnvironment()).toThrow(
      "Falta la variable obligatoria E2E_SUPABASE_ANON_KEY.",
    );
  });

  it("rechaza Producción aunque exista el escape hatch histórico", () => {
    process.env.E2E_SUPABASE_PROJECT_REF = "xpfuzqombmjmxvprjgmi";
    process.env.E2E_SUPABASE_URL =
      "https://xpfuzqombmjmxvprjgmi.supabase.co";
    process.env.E2E_EPHEMERAL_PROJECT_REF = "xpfuzqombmjmxvprjgmi";
    process.env.E2E_PRODUCTION_CONFIRM_PROJECT_REF =
      "xpfuzqombmjmxvprjgmi";

    expect(() => loadE2EEnvironment()).toThrow(
      "Las fixtures E2E están prohibidas en Supabase Producción.",
    );
  });

  it("rechaza entornos persistentes", () => {
    process.env.E2E_ENVIRONMENT_KIND = "preview";

    expect(() => loadE2EEnvironment()).toThrow(
      "E2E_ENVIRONMENT_KIND debe ser ephemeral.",
    );
  });

  it("rechaza una confirmación que no coincide con el project ref", () => {
    process.env.E2E_EPHEMERAL_PROJECT_REF = "otro-ref";

    expect(() => loadE2EEnvironment()).toThrow(
      "E2E_EPHEMERAL_PROJECT_REF no coincide",
    );
  });

  it("rechaza una URL que no corresponde al project ref", () => {
    process.env.E2E_SUPABASE_URL = "https://otro-ref.supabase.co";

    expect(() => loadE2EEnvironment()).toThrow(
      "E2E_SUPABASE_URL no corresponde",
    );
  });
});

describe("fixture determinista de gasto", () => {
  it("mantiene UUID y código estables para SDD-0243", () => {
    expect(SDD_0168_FIXTURE.expenseId).toBe(
      "02430000-0000-4000-8000-000000000001",
    );
    expect(SDD_0168_FIXTURE.expenseCode).toBe("EXP-E2E-0243");
  });

  it("fija el gasto al día 15 a las 12:00 UTC del mes suministrado", () => {
    expect(getE2EExpenseOccurredAt(new Date("2026-08-29T23:59:59.999Z"))).toBe(
      "2026-08-15T12:00:00.000Z",
    );
  });
});

describe("política de espera del esquema efímero", () => {
  it("reintenta únicamente errores compatibles con caché tardía", () => {
    expect(
      isRetryableE2ESchemaError({
        code: "PGRST204",
        message: "Could not find the column in the schema cache",
      }),
    ).toBe(true);
    expect(
      isRetryableE2ESchemaError({
        code: "42501",
        message: "permission denied",
      }),
    ).toBe(false);
  });

  it("acota el polling y termina sin reintento después del último intento", () => {
    expect(getE2ESchemaRetryDelayMs(1)).toBe(E2E_SCHEMA_PREFLIGHT_RETRY_MS);
    expect(
      getE2ESchemaRetryDelayMs(E2E_SCHEMA_PREFLIGHT_MAX_ATTEMPTS - 1),
    ).toBe(E2E_SCHEMA_PREFLIGHT_RETRY_MS);
    expect(getE2ESchemaRetryDelayMs(E2E_SCHEMA_PREFLIGHT_MAX_ATTEMPTS)).toBe(
      null,
    );
  });
});
