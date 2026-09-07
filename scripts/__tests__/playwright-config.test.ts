import { describe, expect, it } from "vitest";
import {
  preparePlaywrightRuntime,
  resolvePlaywrightRuntime,
  resolvePlaywrightWorkers,
} from "../../playwright.config";

describe("resolvePlaywrightRuntime", () => {
  it("usa localhost y levanta el webServer por defecto", () => {
    expect(resolvePlaywrightRuntime({})).toEqual({
      port: 3001,
      baseURL: "http://localhost:3001",
      startWebServer: true,
    });
  });

  it("respeta un BASE_URL remoto sin levantar el webServer", () => {
    expect(
      resolvePlaywrightRuntime({
        BASE_URL: "https://preview.dtdcargo.example",
      }),
    ).toMatchObject({
      baseURL: "https://preview.dtdcargo.example",
      startWebServer: false,
    });
  });

  it("permite levantar el webServer contra localhost de forma explícita", () => {
    expect(
      resolvePlaywrightRuntime({
        BASE_URL: "http://localhost:43117",
        E2E_PORT: "43117",
        E2E_START_WEB_SERVER: "1",
      }),
    ).toEqual({
      port: 43117,
      baseURL: "http://localhost:43117",
      startWebServer: true,
    });
  });

  it("prepara automáticamente los aliases Tier 3 en un branch efímero válido", () => {
    const env = {
      E2E_SUPABASE_PROJECT_REF: "ephemeralref",
      E2E_SUPABASE_URL: "https://ephemeralref.supabase.co",
      E2E_SUPABASE_ANON_KEY: "synthetic-anon-key",
      E2E_SUPABASE_SERVICE_ROLE_KEY: "synthetic-service-role",
      STUDIO_E2E_PASSWORD: "synthetic-password",
      E2E_ENVIRONMENT_KIND: "ephemeral",
      E2E_EPHEMERAL_PROJECT_REF: "ephemeralref",
    };

    preparePlaywrightRuntime(env);

    expect(env).toMatchObject({
      STUDIO_E2E_EMAIL: "sdd0168-admin@example.com",
      STUDIO_E2E_EXPENSE_CODE: "EXP-E2E-0243",
      STUDIO_E2E_PAYROLL_SETTLEMENT_CODE: "LIQ-E2E-0226",
    });
  });
});

describe("resolvePlaywrightWorkers", () => {
  it("acota la concurrencia local general a ocho workers", () => {
    expect(resolvePlaywrightWorkers({})).toBe(8);
  });

  it("serializa por defecto CI y los branches efímeros", () => {
    expect(resolvePlaywrightWorkers({ CI: "1" })).toBe(1);
    expect(
      resolvePlaywrightWorkers({ E2E_ENVIRONMENT_KIND: "ephemeral" }),
    ).toBe(1);
  });

  it("serializa el mismo kind con espacios que acepta el guard efímero", () => {
    expect(
      resolvePlaywrightWorkers({ E2E_ENVIRONMENT_KIND: " ephemeral " }),
    ).toBe(1);
  });

  it("acepta un override explícito y rechaza valores fuera del contrato", () => {
    expect(resolvePlaywrightWorkers({ E2E_WORKERS: "4" })).toBe(4);
    expect(() => resolvePlaywrightWorkers({ E2E_WORKERS: "0" })).toThrow(
      "entre 1 y 32",
    );
    expect(() => resolvePlaywrightWorkers({ E2E_WORKERS: "muchos" })).toThrow(
      "entero entre 1 y 32",
    );
  });
});
