import { describe, expect, it } from "vitest";
import {
  preparePlaywrightRuntime,
  resolvePlaywrightExecutionLimits,
  resolveLocalSupabaseDenyPort,
  resolvePlaywrightRuntime,
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

  it("acota la concurrencia local y el tiempo total de la suite", () => {
    expect(resolvePlaywrightExecutionLimits({})).toEqual({
      globalTimeout: 8 * 60_000,
      workers: 8,
    });
    expect(resolvePlaywrightExecutionLimits({ CI: "1" })).toEqual({
      globalTimeout: 8 * 60_000,
      workers: 1,
    });
  });

  it("acepta límites E2E explícitos y rechaza valores inseguros", () => {
    expect(
      resolvePlaywrightExecutionLimits({
        E2E_GLOBAL_TIMEOUT_MS: "600000",
        E2E_WORKERS: "4",
      }),
    ).toEqual({ globalTimeout: 600_000, workers: 4 });

    expect(() =>
      resolvePlaywrightExecutionLimits({ E2E_WORKERS: "0" }),
    ).toThrow(/E2E_WORKERS/);
    expect(() =>
      resolvePlaywrightExecutionLimits({ E2E_GLOBAL_TIMEOUT_MS: "30000" }),
    ).toThrow(/E2E_GLOBAL_TIMEOUT_MS/);
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
      NEXT_PUBLIC_SUPABASE_URL: "https://ephemeralref.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "synthetic-anon-key",
    });
  });

  it("inyecta un stub deny-only sólo para el webServer local sin entorno", () => {
    const env: Record<string, string | undefined> = {};

    expect(preparePlaywrightRuntime(env)).toEqual({
      port: 3001,
      baseURL: "http://localhost:3001",
      startWebServer: true,
    });
    expect(env).toMatchObject({
      E2E_LOCAL_SUPABASE_DENY_SERVER: "1",
      E2E_SUPABASE_DENY_PORT: "13001",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:13001",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "e2e-local-anon-key-not-a-secret",
    });
  });

  it("resuelve un puerto deny-only distinto y acepta un override explícito", () => {
    expect(resolveLocalSupabaseDenyPort({}, 3001)).toBe(13001);
    expect(resolveLocalSupabaseDenyPort({}, 60_000)).toBe(50_000);
    expect(
      resolveLocalSupabaseDenyPort({ E2E_SUPABASE_DENY_PORT: "43118" }, 43117),
    ).toBe(43118);
  });

  it("respeta la configuración Supabase pública completa", () => {
    const env = {
      NEXT_PUBLIC_SUPABASE_URL: "https://configured.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "configured-anon-key",
    };

    preparePlaywrightRuntime(env);

    expect(env).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: "https://configured.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "configured-anon-key",
    });
  });

  it("no inyecta configuración local al probar un servidor remoto", () => {
    const env: Record<string, string | undefined> = {
      BASE_URL: "https://preview.dtdcargo.example",
    };

    preparePlaywrightRuntime(env);

    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBeUndefined();
    expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBeUndefined();
  });

  it("falla temprano si la configuración pública está incompleta", () => {
    expect(() =>
      preparePlaywrightRuntime({
        NEXT_PUBLIC_SUPABASE_URL: "https://configured.supabase.co",
      }),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  });
});
