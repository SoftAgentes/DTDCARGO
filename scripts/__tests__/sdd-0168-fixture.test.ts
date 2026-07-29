import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadE2EEnvironment } from "../e2e/sdd-0168-fixture";

const KEYS = [
  "E2E_SUPABASE_PROJECT_REF",
  "E2E_SUPABASE_URL",
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
      environmentKind: "ephemeral",
    });
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
