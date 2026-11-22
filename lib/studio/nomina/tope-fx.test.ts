// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  TOLERANCIA_TASA_DIAS,
  camposDeTasaParaSnapshot,
  diasNaturalesEntre,
  etiquetaDeTasa,
  faltaTasaDelCierre,
  hoyEnCaracas,
  resolverTasaDeTopes,
  tasaCongelada,
} from "./tope-fx";

/** Un cliente de Supabase de mentira: solo `rpc("fx_rate_on")`, que es lo que lee la tasa. */
function clienteConTasa(fila: { rate: number; source: string; valid_on: string } | null) {
  const rpc = vi.fn(async () =>
    fila ? { data: [fila], error: null } : { data: null, error: { message: "FX_RATE_MISSING" } },
  );
  return { supabase: { rpc } as unknown as SupabaseClient, rpc };
}

const REGLAS = { min_salary: 130, sso_cap_sm: 5, rpe_cap_sm: 10 };
const CIERRE = "2026-11-30"; // lunes
const DESPUES = "2026-12-02";

describe("resolverTasaDeTopes — con el período cerrado (SDD-0653 D6)", () => {
  it("pide la tasa del último día del período y la da por definitiva", async () => {
    const { supabase, rpc } = clienteConTasa({ rate: 130, source: "bcv", valid_on: CIERRE });
    const r = await resolverTasaDeTopes(supabase, "t1", REGLAS, CIERRE, DESPUES);
    expect(r).toEqual({ ok: true, tasa: { rate: 130, source: "bcv", validOn: CIERRE, provisional: false } });
    expect(rpc).toHaveBeenCalledWith("fx_rate_on", { p_tenant_id: "t1", p_currency: "VES", p_on: CIERRE });
  });

  it("acepta la del último día hábil anterior dentro de la tolerancia (fin de semana)", async () => {
    // El cierre cae en lunes; la última tasa es del viernes (3 días antes).
    const { supabase } = clienteConTasa({ rate: 130, source: "bcv", valid_on: "2026-11-27" });
    const r = await resolverTasaDeTopes(supabase, "t1", REGLAS, CIERRE, DESPUES);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.tasa.validOn).toBe("2026-11-27");
  });

  it("acepta exactamente el límite de la tolerancia", async () => {
    const { supabase } = clienteConTasa({ rate: 130, source: "bcv", valid_on: "2026-11-26" });
    expect(TOLERANCIA_TASA_DIAS).toBe(4);
    const r = await resolverTasaDeTopes(supabase, "t1", REGLAS, CIERRE, DESPUES);
    expect(r.ok).toBe(true);
  });

  it("rechaza una tasa más vieja que la tolerancia y dice qué fecha cargar", async () => {
    const { supabase } = clienteConTasa({ rate: 130, source: "bcv", valid_on: "2026-11-25" });
    const r = await resolverTasaDeTopes(supabase, "t1", REGLAS, CIERRE, DESPUES);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("2026-11-30");
      expect(r.error).toContain("4 días");
      expect(r.error).toContain("La última que hay es del 2026-11-25");
      expect(r.error).toContain("Admin › Tasas");
    }
  });

  it("rechaza una tasa de hace meses: fx_rate_on no limita la antigüedad, esto sí", async () => {
    const { supabase } = clienteConTasa({ rate: 90, source: "bcv", valid_on: "2026-06-30" });
    const r = await resolverTasaDeTopes(supabase, "t1", REGLAS, CIERRE, DESPUES);
    expect(r.ok).toBe(false);
  });

  it("sin ninguna tasa falla cerrado", async () => {
    const { supabase } = clienteConTasa(null);
    const r = await resolverTasaDeTopes(supabase, "t1", REGLAS, CIERRE, DESPUES);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("2026-11-30");
  });

  it("una tasa en cero no vale", async () => {
    const { supabase } = clienteConTasa({ rate: 0, source: "manual", valid_on: CIERRE });
    const r = await resolverTasaDeTopes(supabase, "t1", REGLAS, CIERRE, DESPUES);
    expect(r.ok).toBe(false);
  });

  it("el último día del período ya cuenta como cerrado", async () => {
    const { supabase } = clienteConTasa({ rate: 130, source: "bcv", valid_on: CIERRE });
    const r = await resolverTasaDeTopes(supabase, "t1", REGLAS, CIERRE, CIERRE);
    expect(r.ok && r.tasa.provisional).toBe(false);
  });
});

describe("resolverTasaDeTopes — con el período en curso", () => {
  it("usa la tasa de hoy como PROVISIONAL y no la congela", async () => {
    const { supabase, rpc } = clienteConTasa({ rate: 128, source: "bcv", valid_on: "2026-11-17" });
    const r = await resolverTasaDeTopes(supabase, "t1", REGLAS, CIERRE, "2026-11-17");
    expect(r).toEqual({ ok: true, tasa: { rate: 128, source: "bcv", validOn: "2026-11-17", provisional: true } });
    expect(rpc).toHaveBeenCalledWith("fx_rate_on", { p_tenant_id: "t1", p_currency: "VES", p_on: "2026-11-17" });
    if (r.ok) expect(camposDeTasaParaSnapshot(r.tasa)).toEqual({});
  });

  it("también exige que la tasa de hoy no sea vieja", async () => {
    const { supabase } = clienteConTasa({ rate: 128, source: "bcv", valid_on: "2026-11-01" });
    const r = await resolverTasaDeTopes(supabase, "t1", REGLAS, CIERRE, "2026-11-17");
    expect(r.ok).toBe(false);
  });
});

describe("resolverTasaDeTopes — congelada y sin topes", () => {
  it("usa la tasa congelada del snapshot y no consulta de nuevo", async () => {
    const { supabase, rpc } = clienteConTasa({ rate: 999, source: "bcv", valid_on: CIERRE });
    const r = await resolverTasaDeTopes(
      supabase,
      "t1",
      { ...REGLAS, cap_fx_rate: 130, cap_fx_source: "bcv", cap_fx_valid_on: CIERRE },
      CIERRE,
      "2026-11-17",
    );
    expect(r).toEqual({ ok: true, tasa: { rate: 130, source: "bcv", validOn: CIERRE, provisional: false } });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("con los topes desactivados no consulta ni pide tasa", async () => {
    const { supabase, rpc } = clienteConTasa(null);
    for (const reglas of [
      { min_salary: 0, sso_cap_sm: 5, rpe_cap_sm: 10 },
      { min_salary: 130, sso_cap_sm: 0, rpe_cap_sm: 0 },
    ]) {
      const r = await resolverTasaDeTopes(supabase, "t1", reglas, CIERRE, DESPUES);
      expect(r).toEqual({ ok: true, tasa: { rate: null, source: null, validOn: null, provisional: false } });
    }
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("lo que se congela y lo que bloquea la confirmación", () => {
  it("una tasa definitiva congela tasa, fuente y fecha de valor", () => {
    expect(
      camposDeTasaParaSnapshot({ rate: 130, source: "bcv", validOn: CIERRE, provisional: false }),
    ).toEqual({ cap_fx_rate: 130, cap_fx_source: "bcv", cap_fx_valid_on: CIERRE });
  });

  it("una provisional o ninguna tasa no congela nada", () => {
    expect(camposDeTasaParaSnapshot({ rate: 130, source: "bcv", validOn: CIERRE, provisional: true })).toEqual({});
    expect(camposDeTasaParaSnapshot({ rate: null, source: null, validOn: null, provisional: false })).toEqual({});
  });

  it("faltaTasaDelCierre: con topes activos y sin tasa congelada, el corte es provisional", () => {
    expect(faltaTasaDelCierre(REGLAS)).toBe(true);
    expect(faltaTasaDelCierre({ ...REGLAS, cap_fx_rate: 130 })).toBe(false);
    expect(faltaTasaDelCierre({ min_salary: 0, sso_cap_sm: 5, rpe_cap_sm: 10 })).toBe(false);
    expect(tasaCongelada({ cap_fx_rate: "130" })).toBe(true);
    expect(tasaCongelada({})).toBe(false);
  });

  it("etiquetaDeTasa muestra la fecha y marca la provisional", () => {
    expect(etiquetaDeTasa({ rate: 130, source: "bcv", validOn: CIERRE, provisional: false })).toBe("BCV del 2026-11-30");
    expect(etiquetaDeTasa({ rate: 128, source: "bcv", validOn: "2026-11-17", provisional: true })).toBe(
      "PROVISIONAL BCV del 2026-11-17",
    );
    expect(etiquetaDeTasa({ rate: 130, source: "manual", validOn: CIERRE, provisional: false })).toBe("manual del 2026-11-30");
  });
});

describe("fechas", () => {
  it("diasNaturalesEntre cuenta días naturales y avisa si la fecha no vale", () => {
    expect(diasNaturalesEntre("2026-11-27", "2026-11-30")).toBe(3);
    expect(diasNaturalesEntre("2026-11-30", "2026-11-30")).toBe(0);
    expect(diasNaturalesEntre("2026-12-01", "2026-11-30")).toBe(-1);
    expect(Number.isNaN(diasNaturalesEntre("xx", "2026-11-30"))).toBe(true);
  });

  it("hoyEnCaracas usa la hora de Caracas, no la UTC", () => {
    // 2026-11-18 02:00 UTC = 2026-11-17 22:00 en Caracas (UTC-4).
    expect(hoyEnCaracas(new Date("2026-11-18T02:00:00Z"))).toBe("2026-11-17");
  });
});
