// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  hoyCaracas,
  programadaBadge,
  programadaErrorMessage,
  publicRateConflictMessage,
  validateRateInput,
  type RateInput,
} from "@/lib/studio/rate-types";
import { listRateSchedules } from "@/lib/studio/rate-queries";

/**
 * SDD-0478 · la ranura PROGRAMADA de la tarifa pública, del lado del Studio.
 * La mitad de base de datos se prueba contra el .sql real en
 * lib/studio/tarifa-programada.migration.test.ts.
 */

const HOY = "2026-11-20";

function programada(overrides: Partial<RateInput> = {}): Partial<RateInput> {
  return {
    service: "puerta_a_puerta_DDP",
    origin: "China",
    destination: "Venezuela",
    per_cbm: 900,
    flat_rate: null,
    min_charge: 50,
    transit_days: null,
    valid_from: "2026-11-30",
    valid_until: null,
    is_public: false,
    publica_programada: true,
    notes: null,
    ...overrides,
  };
}

describe("hoyCaracas", () => {
  it("usa el día de Venezuela, no el de UTC", () => {
    // 2026-11-30 02:00 UTC = 2026-11-29 22:00 en Caracas (UTC−4).
    expect(hoyCaracas(new Date("2026-11-30T02:00:00Z"))).toBe("2026-11-29");
    // 04:05 UTC = 00:05 en Caracas: la corrida del relevo ya es del día nuevo.
    expect(hoyCaracas(new Date("2026-11-30T04:05:00Z"))).toBe("2026-11-30");
  });
});

describe("validateRateInput · programada", () => {
  it("acepta una programada por CBM con fecha futura y conserva la marca", () => {
    const { input, fieldErrors } = validateRateInput(programada(), HOY);
    expect(fieldErrors).toBeUndefined();
    expect(input!.publica_programada).toBe(true);
    expect(input!.is_public).toBe(false);
  });

  it("sin la opción en el form (marca ausente) no inventa la columna", () => {
    const { input } = validateRateInput(programada({ publica_programada: undefined }), HOY);
    expect(input).toBeDefined();
    expect("publica_programada" in input!).toBe(false);
  });

  it("desmarcada viaja en false: así se suelta la programación", () => {
    const { input } = validateRateInput(programada({ publica_programada: false }), HOY);
    expect(input!.publica_programada).toBe(false);
  });

  it("no puede ser pública y programada a la vez", () => {
    const { fieldErrors } = validateRateInput(programada({ is_public: true }), HOY);
    expect(fieldErrors?.publica_programada).toMatch(/Elige una/);
  });

  it("sólo una tarifa por CBM se programa", () => {
    const { fieldErrors } = validateRateInput(
      programada({ service: "fcl_directo", per_cbm: null, flat_rate: 8500 }),
      HOY,
    );
    expect(fieldErrors?.publica_programada).toMatch(/por CBM/);
  });

  it("exige la fecha de arranque", () => {
    const { fieldErrors } = validateRateInput(programada({ valid_from: null }), HOY);
    expect(fieldErrors?.valid_from).toMatch(/desde qué día rige/);
  });

  it("hoy o antes no es programar: el precio de hoy se cambia editando la pública", () => {
    for (const valid_from of [HOY, "2026-11-01"]) {
      const { fieldErrors } = validateRateInput(programada({ valid_from }), HOY);
      expect(fieldErrors?.valid_from).toMatch(/fecha futura/);
    }
    const manana = validateRateInput(programada({ valid_from: "2026-11-21" }), HOY);
    expect(manana.fieldErrors).toBeUndefined();
  });

  it("la regla de fechas de siempre manda si 'desde' pasa a 'hasta'", () => {
    const { fieldErrors } = validateRateInput(
      programada({ valid_from: "2026-12-10", valid_until: "2026-12-01" }),
      HOY,
    );
    expect(fieldErrors?.valid_from).toMatch(/posterior/);
  });
});

describe("programadaBadge", () => {
  it("antes de su día dice cuándo entra", () => {
    expect(programadaBadge("2026-11-30", HOY)).toEqual({
      label: "Programada · 30/11",
      tone: "info",
    });
  });
  it("el día de arranque no alarma", () => {
    expect(programadaBadge(HOY, HOY)).toEqual({ label: "Programada · hoy", tone: "info" });
  });
  it("ningún texto excede el más largo medido para la columna de 170px", () => {
    // «Programada · sin fecha» mide 146px en Nunito Sans 700 a 10,5px: es el
    // techo medido. Un texto más largo que ése necesita medirse otra vez.
    const techo = "Programada · sin fecha".length;
    for (const v of [null, "2026-11-19", HOY, "2026-11-30", "2026-12-31"]) {
      expect(programadaBadge(v, HOY).label.length).toBeLessThanOrEqual(techo);
    }
  });
  it("si su día pasó y sigue marcada, el relevo no corrió: alarma", () => {
    expect(programadaBadge("2026-11-19", HOY)).toEqual({
      label: "Programada · no entró",
      tone: "danger",
    });
  });
});

describe("mensajes de la ranura", () => {
  it("traduce los rechazos de la 0459 y deja pasar lo demás", () => {
    expect(
      programadaErrorMessage({
        code: "23505",
        message: 'duplicate key value violates unique constraint "rates_one_programada_per_tenant_modo"',
      }),
    ).toMatch(/Ya hay otra tarifa programada/);
    expect(
      programadaErrorMessage({
        code: "23514",
        message: 'new row for relation "rates" violates check constraint "rates_publica_programada_check"',
      }),
    ).toMatch(/precio por CBM/);
    expect(
      programadaErrorMessage({
        code: "23514",
        message: "Una tarifa en borrador no puede programarse como la pública del sitio: publícala primero",
      }),
    ).toMatch(/borrador/);
    expect(
      programadaErrorMessage({
        code: "23514",
        message: "Sólo una tarifa de la lista de la casa puede programarse como la pública del sitio",
      }),
    ).toMatch(/lista de la casa puede programarse/);
    // El singleton de la pública y el aviso del aliado NO son de la ranura.
    expect(
      programadaErrorMessage({
        code: "23505",
        message: 'duplicate key value violates unique constraint "rates_one_public_cbm_per_tenant_modo"',
      }),
    ).toBeNull();
    expect(
      programadaErrorMessage({
        code: "23514",
        message: "Sólo una tarifa de la lista de la casa puede ser la pública del sitio",
      }),
    ).toBeNull();
    expect(programadaErrorMessage(null)).toBeNull();
  });

  it("el aviso de segunda pública sigue, y con la ranura dice cómo cargar la próxima", () => {
    expect(publicRateConflictMessage(false)).toMatch(/Desmárcala primero/);
    expect(publicRateConflictMessage(true)).toMatch(/márcala como «Programada»/);
  });
});

describe("listRateSchedules", () => {
  function cliente(result: { data: unknown; error: unknown }) {
    const eq = vi.fn(async () => result);
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    return { client: { from } as unknown as SupabaseClient, from, select, eq };
  }

  it("lee sólo las programadas, en una consulta aparte de RATE_COLUMNS", async () => {
    const c = cliente({ data: [{ id: "r1", valid_from: "2026-11-30" }], error: null });
    const r = await listRateSchedules(c.client);
    expect(c.from).toHaveBeenCalledWith("rates");
    expect(c.select).toHaveBeenCalledWith("id, valid_from");
    expect(c.eq).toHaveBeenCalledWith("publica_programada", true);
    expect(r).toEqual({ disponible: true, programadas: [{ id: "r1", valid_from: "2026-11-30" }] });
  });

  it("sin la columna (migr 0459 sin aplicar) la pantalla no se cae: esconde la opción", async () => {
    const c = cliente({
      data: null,
      error: { code: "42703", message: "column rates.publica_programada does not exist" },
    });
    expect(await listRateSchedules(c.client)).toEqual({ disponible: false, programadas: [] });
  });
});
