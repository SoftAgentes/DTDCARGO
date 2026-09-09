import { cpus } from "node:os";
import { describe, expect, it } from "vitest";
import playwrightConfig, {
  E2E_LOCAL_WORKERS_CAP,
  preparePlaywrightRuntime,
  resolvePlaywrightRuntime,
  resolvePlaywrightWorkers,
  resolveWebkitProjectWorkers,
} from "../../playwright.config";

// Default histórico de Playwright antes de que este SDD fijara la clave:
// `workers: "50%"` (playwright/lib/common/index.js:587) resuelto por
// `resolveWorkers` (678-682) como `max(1, floor(cpus * 0.5))`.
const playwrightDefaultWorkers = (cores: number) =>
  Math.max(1, Math.floor(cores * 0.5));

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
  it.each([
    [1, 1],
    [2, 1],
    [4, 2],
    [8, 4],
    [12, 6],
    [16, 8],
    [22, 8],
    [64, 8],
  ])(
    "acota la corrida local a la mitad de %i núcleos con tope de ocho",
    (cores, expected) => {
      const workers = resolvePlaywrightWorkers({}, cores);
      expect(workers).toBe(expected);
      // Invariante del SDD: acotar nunca puede SUBIR la concurrencia respecto
      // del default que regía antes de fijar la clave.
      expect(workers).toBeLessThanOrEqual(playwrightDefaultWorkers(cores));
      expect(workers).toBeLessThanOrEqual(E2E_LOCAL_WORKERS_CAP);
    },
  );

  it.each([0, -4, Number.NaN, Number.POSITIVE_INFINITY])(
    "resuelve un worker cuando el conteo de núcleos no es utilizable: %s",
    (cores) => {
      expect(resolvePlaywrightWorkers({}, cores)).toBe(1);
    },
  );

  it("usa los núcleos reales de la máquina cuando no se le pasa un conteo", () => {
    expect(resolvePlaywrightWorkers({})).toBe(
      Math.min(E2E_LOCAL_WORKERS_CAP, playwrightDefaultWorkers(cpus().length)),
    );
  });

  it("serializa por defecto CI y los branches efímeros", () => {
    expect(resolvePlaywrightWorkers({ CI: "1" })).toBe(1);
    expect(
      resolvePlaywrightWorkers({ E2E_ENVIRONMENT_KIND: "ephemeral" }),
    ).toBe(1);
  });

  it("serializa CI y efímero sin importar cuántos núcleos tenga la máquina", () => {
    expect(resolvePlaywrightWorkers({ CI: "1" }, 64)).toBe(1);
    expect(
      resolvePlaywrightWorkers({ E2E_ENVIRONMENT_KIND: "ephemeral" }, 64),
    ).toBe(1);
  });

  it("serializa el mismo kind con espacios que acepta el guard efímero", () => {
    expect(
      resolvePlaywrightWorkers({ E2E_ENVIRONMENT_KIND: " ephemeral " }),
    ).toBe(1);
  });

  it("acepta un override explícito y rechaza valores fuera del contrato", () => {
    expect(resolvePlaywrightWorkers({ E2E_WORKERS: "4" })).toBe(4);
    // El override es la única vía para pedir más de lo que da la máquina.
    expect(resolvePlaywrightWorkers({ E2E_WORKERS: "16" }, 2)).toBe(16);
    expect(() => resolvePlaywrightWorkers({ E2E_WORKERS: "0" })).toThrow(
      "entre 1 y 32",
    );
    expect(() => resolvePlaywrightWorkers({ E2E_WORKERS: "muchos" })).toThrow(
      "entero entre 1 y 32",
    );
  });
});

describe("resolveWebkitProjectWorkers", () => {
  it("serializa WebKit móvil en Windows y no lo limita en otras plataformas", () => {
    expect(resolveWebkitProjectWorkers("win32")).toBe(1);
    for (const platform of ["linux", "darwin", "freebsd"] as const) {
      expect(resolveWebkitProjectWorkers(platform)).toBeUndefined();
    }
  });

  it("aplica el límite sólo al proyecto mobile-safari del config publicado", () => {
    const projects = playwrightConfig.projects ?? [];
    expect(projects.map((project) => project.name)).toEqual([
      "chromium",
      "mobile-chrome",
      "mobile-safari",
    ]);

    const byName = new Map(projects.map((project) => [project.name, project]));
    // Playwright honra el límite por proyecto: TestProject.workers
    // (playwright/types/test.d.ts:744) se registra en
    // _workerLimitPerProjectId (lib/runner/index.js:5071-5072) y acota los
    // trabajadores reales en la línea 6062.
    const webkit = byName.get("mobile-safari");
    // La clave existe en toda plataforma (defineConfig con un solo argumento
    // devuelve el mismo objeto): fuera de Windows vale undefined, y si alguien
    // borrara la línea esta aserción lo detecta igual en Linux o macOS.
    expect(webkit && "workers" in webkit).toBe(true);
    expect(webkit?.workers).toBe(process.platform === "win32" ? 1 : undefined);
    expect(webkit?.workers).toBe(resolveWebkitProjectWorkers());

    for (const name of ["chromium", "mobile-chrome"] as const) {
      expect(byName.get(name)?.workers).toBeUndefined();
      expect("workers" in (byName.get(name) ?? {})).toBe(false);
    }
  });
});
