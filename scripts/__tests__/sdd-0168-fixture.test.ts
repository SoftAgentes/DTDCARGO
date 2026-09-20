// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import {
  E2E_CALCULATOR_SETTINGS_COLUMNS,
  E2E_PUBLIC_TENANT_SLUG,
  E2E_SCHEMA_PREFLIGHT_MAX_ATTEMPTS,
  E2E_SCHEMA_PREFLIGHT_RETRY_MS,
  SDD_0168_FIXTURE,
  applyE2ETier3FixtureAliases,
  buildE2ECalculatorSettings,
  buildE2ECalculatorSettingsBaseline,
  createE2EAdminClient,
  getE2ECommentBody,
  getE2EExpenseOccurredAt,
  getE2ESchemaRetryDelayMs,
  isRetryableE2ESchemaError,
  loadE2EEnvironment,
} from "../e2e/sdd-0168-fixture";
import { DEFAULT_PARAMS } from "../../lib/calculadora";

// Ninguna prueba de guards/entrypoint debe abrir un cliente ni enviar llaves.
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));

const NON_CANONICAL_URLS = [
  "https://ephemeralref.untrusted.invalid",
  "https://ephemeralref.supabase.co.untrusted.invalid",
  "https://reader@ephemeralref.supabase.co",
  "https://reader:offline@ephemeralref.supabase.co",
  "https://ephemeralref.supabase.co:8443",
  "https://ephemeralref.supabase.co:443",
  "https://ephemeralref.supabase.co/rest/v1",
  "https://ephemeralref.supabase.co/path/..",
  "https://ephemeralref.supabase.co?probe=1",
  "https://ephemeralref.supabase.co#probe",
  "https://ephemeralref.supabase.co?",
  "https://ephemeralref.supabase.co#",
  "http://ephemeralref.supabase.co",
] as const;

const KEYS = [
  "E2E_SUPABASE_PROJECT_REF",
  "E2E_SUPABASE_URL",
  "E2E_SUPABASE_ANON_KEY",
  "E2E_SUPABASE_SERVICE_ROLE_KEY",
  "STUDIO_E2E_PASSWORD",
  "E2E_ENVIRONMENT_KIND",
  "E2E_EPHEMERAL_PROJECT_REF",
  "E2E_PRODUCTION_CONFIRM_PROJECT_REF",
  "STUDIO_E2E_EMAIL",
  "STUDIO_E2E_EXPENSE_CODE",
  "STUDIO_E2E_PAYROLL_SETTLEMENT_CODE",
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
  vi.clearAllMocks();
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

  it.each(["https://ephemeralref.supabase.co", "https://ephemeralref.supabase.co/"])(
    "acepta el origen canónico con raíz opcional: %s",
    (url) => {
      process.env.E2E_SUPABASE_URL = url;
      expect(loadE2EEnvironment().supabaseUrl).toBe(url);
      expect(applyE2ETier3FixtureAliases()).toBe(true);
    },
  );

  it.each(NON_CANONICAL_URLS)("rechaza URL no canónica antes de crear cliente: %s", (url) => {
    process.env.E2E_SUPABASE_URL = url;
    delete process.env.STUDIO_E2E_EMAIL;
    expect(() => loadE2EEnvironment()).toThrow("E2E_SUPABASE_URL no corresponde");
    expect(() => applyE2ETier3FixtureAliases()).toThrow("E2E_SUPABASE_URL no corresponde");
    expect(() => createE2EAdminClient()).toThrow("E2E_SUPABASE_URL no corresponde");
    expect(createClient).not.toHaveBeenCalled();
    expect(process.env.STUDIO_E2E_EMAIL).toBeUndefined();
  });

  it.each(["production", "ref-mismatch", "origin-mismatch"])(
    "el entrypoint real del seed aborta sin crear cliente: %s",
    async (scenario) => {
      if (scenario === "production") {
        process.env.E2E_SUPABASE_PROJECT_REF = "xpfuzqombmjmxvprjgmi";
        process.env.E2E_SUPABASE_URL = "https://xpfuzqombmjmxvprjgmi.supabase.co";
        process.env.E2E_EPHEMERAL_PROJECT_REF = "xpfuzqombmjmxvprjgmi";
      } else if (scenario === "ref-mismatch") {
        process.env.E2E_EPHEMERAL_PROJECT_REF = "other";
      } else {
        process.env.E2E_SUPABASE_URL = "https://ephemeralref.untrusted.invalid";
      }
      const previousExitCode = process.exitCode;
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        vi.resetModules();
        await import("../seed-e2e");
        await vi.waitFor(() => expect(error).toHaveBeenCalled());
        expect(createClient).not.toHaveBeenCalled();
        expect(process.exitCode).toBe(1);
        expect(error).toHaveBeenCalledWith(expect.stringContaining("Seed E2E falló:"));
      } finally {
        process.exitCode = previousExitCode;
        error.mockRestore();
      }
    },
  );
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

describe("fixture determinista de calculadora", () => {
  it("traduce todos los defaults vigentes al contrato de calculator_settings", () => {
    expect(buildE2ECalculatorSettings(DEFAULT_PARAMS)).toEqual({
      peso_incluido_kg: 1000,
      recargo_excedente_kg: 2,
      descuento_valencia: 0,
      recargo_embalaje_especial: 50,
      recargo_bateria_mult: 1.5,
      threshold_casco_km: 200,
      tarifa_km_fuera_casco: 1,
      cbm_max_contenedor: 68,
      peso_max_contenedor_kg: 27000,
      peso_max_envio_kg: 9000,
    });
  });
});

describe("registro auditable de la escritura fuera del fixture", () => {
  const TENANT_ID = "0dtd0000-0000-4000-8000-000000000001";

  it("cubre exactamente las columnas que el seed sobrescribe", () => {
    expect([...E2E_CALCULATOR_SETTINGS_COLUMNS]).toEqual(
      Object.keys(buildE2ECalculatorSettings(DEFAULT_PARAMS)),
    );
  });

  it("emite los valores previos de las diez columnas antes de sobrescribir", () => {
    const previous = {
      peso_incluido_kg: 500,
      recargo_excedente_kg: 2,
      descuento_valencia: 50,
      recargo_embalaje_especial: 50,
      recargo_bateria_mult: 1.3,
      threshold_casco_km: 200,
      tarifa_km_fuera_casco: 1,
      cbm_max_contenedor: 68,
      peso_max_contenedor_kg: 27000,
      peso_max_envio_kg: 9000,
      // Una columna ajena no se filtra al registro.
      tenant_id: TENANT_ID,
    };

    const baseline = buildE2ECalculatorSettingsBaseline(TENANT_ID, previous);

    expect(baseline).toEqual({
      step: "calculator-settings-baseline",
      tenantSlug: E2E_PUBLIC_TENANT_SLUG,
      tenantId: TENANT_ID,
      previous: {
        peso_incluido_kg: 500,
        recargo_excedente_kg: 2,
        descuento_valencia: 50,
        recargo_embalaje_especial: 50,
        recargo_bateria_mult: 1.3,
        threshold_casco_km: 200,
        tarifa_km_fuera_casco: 1,
        cbm_max_contenedor: 68,
        peso_max_contenedor_kg: 27000,
        peso_max_envio_kg: 9000,
      },
    });
    // El registro sirve para diagnosticar: los defaults históricos de 0103
    // quedan distinguibles de los vigentes que el seed va a escribir.
    expect(baseline.previous).not.toEqual(
      buildE2ECalculatorSettings(DEFAULT_PARAMS),
    );
    expect(JSON.parse(JSON.stringify(baseline))).toEqual(baseline);
  });

  it("conserva la clave con null cuando la fila previa no existe o está incompleta", () => {
    expect(buildE2ECalculatorSettingsBaseline(TENANT_ID, null).previous).toEqual(
      Object.fromEntries(
        E2E_CALCULATOR_SETTINGS_COLUMNS.map((column) => [column, null]),
      ),
    );
    expect(
      buildE2ECalculatorSettingsBaseline(TENANT_ID, { peso_incluido_kg: 0 })
        .previous,
    ).toMatchObject({ peso_incluido_kg: 0, descuento_valencia: null });
  });

  it("nombra el único tenant ajeno al fixture que el seed puede tocar", () => {
    expect(E2E_PUBLIC_TENANT_SLUG).toBe("dtd");
    expect(E2E_PUBLIC_TENANT_SLUG).not.toBe(SDD_0168_FIXTURE.tenantSlug);
  });
});

describe("aliases Playwright del fixture Tier 3", () => {
  it("hidrata los tres aliases desde el fixture efímero validado", () => {
    delete process.env.STUDIO_E2E_EMAIL;
    delete process.env.STUDIO_E2E_EXPENSE_CODE;
    delete process.env.STUDIO_E2E_PAYROLL_SETTLEMENT_CODE;

    expect(applyE2ETier3FixtureAliases()).toBe(true);
    expect(process.env).toMatchObject({
      STUDIO_E2E_EMAIL: SDD_0168_FIXTURE.adminEmail,
      STUDIO_E2E_EXPENSE_CODE: SDD_0168_FIXTURE.expenseCode,
      STUDIO_E2E_PAYROLL_SETTLEMENT_CODE:
        SDD_0168_FIXTURE.payrollSettlementCode,
    });
  });

  it("rechaza un alias manual que apunte fuera del fixture sembrado", () => {
    process.env.STUDIO_E2E_EXPENSE_CODE = "EXP-OTRO";

    expect(() => applyE2ETier3FixtureAliases()).toThrow(
      "STUDIO_E2E_EXPENSE_CODE no coincide con el fixture SDD-0168",
    );
  });

  it.each(["STUDIO_E2E_EMAIL", "STUDIO_E2E_PAYROLL_SETTLEMENT_CODE"])(
    "rechaza el alias divergente %s",
    (key) => {
      process.env[key] = "OTHER-FIXTURE";
      expect(() => applyE2ETier3FixtureAliases()).toThrow(`${key} no coincide`);
      expect(createClient).not.toHaveBeenCalled();
    },
  );

  it("no altera una corrida Playwright sin guard efímero", () => {
    delete process.env.E2E_ENVIRONMENT_KIND;
    delete process.env.STUDIO_E2E_EMAIL;

    expect(applyE2ETier3FixtureAliases()).toBe(false);
    expect(process.env.STUDIO_E2E_EMAIL).toBeUndefined();
  });
});

describe("identidad del comentario E2E", () => {
  it("genera un cuerpo único por proyecto, retry y repetición", () => {
    const bodies = [
      getE2ECommentBody("chromium", 0, 0),
      getE2ECommentBody("mobile-safari", 0, 0),
      getE2ECommentBody("chromium", 1, 0),
      getE2ECommentBody("chromium", 0, 1),
    ];

    expect(new Set(bodies).size).toBe(bodies.length);
  });

  it("conserva la mención al final para que el picker pueda resolverla", () => {
    expect(getE2ECommentBody("mobile-chrome", 0, 0)).toMatch(
      /@Mention E\.$/,
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
