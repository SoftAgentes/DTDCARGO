// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { camposDeTasaParaSnapshot, resolverTasaDeTopes } from "./tope-fx";

/** Un cliente de Supabase de mentira: solo `rpc("fx_rate_on")`, que es lo que lee la tasa. */
function clienteConTasa(fila: { rate: number; source: string; valid_on: string } | null) {
  const rpc = vi.fn(async () =>
    fila ? { data: [fila], error: null } : { data: null, error: { message: "FX_RATE_MISSING" } },
  );
  return { supabase: { rpc } as unknown as SupabaseClient, rpc };
}

const REGLAS = { min_salary: 130, sso_cap_sm: 5, rpe_cap_sm: 10 };

describe("resolverTasaDeTopes (SDD-0653 D6)", () => {
  it("busca la tasa vigente al último día del período", async () => {
    const { supabase, rpc } = clienteConTasa({ rate: 130, source: "bcv", valid_on: "2026-11-17" });
    const r = await resolverTasaDeTopes(supabase, "t1", REGLAS, "2026-11-30");
    expect(r).toEqual({ ok: true, tasa: { rate: 130, source: "bcv", validOn: "2026-11-17" } });
    expect(rpc).toHaveBeenCalledWith("fx_rate_on", { p_tenant_id: "t1", p_currency: "VES", p_on: "2026-11-30" });
  });

  it("usa la tasa congelada del snapshot y no consulta de nuevo", async () => {
    const { supabase, rpc } = clienteConTasa({ rate: 999, source: "bcv", valid_on: "2026-11-30" });
    const r = await resolverTasaDeTopes(
      supabase,
      "t1",
      { ...REGLAS, cap_fx_rate: 130, cap_fx_source: "bcv", cap_fx_valid_on: "2026-11-17" },
      "2026-11-30",
    );
    expect(r).toEqual({ ok: true, tasa: { rate: 130, source: "bcv", validOn: "2026-11-17" } });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("sin tasa y con topes activos falla cerrado y dice qué cargar", async () => {
    const { supabase } = clienteConTasa(null);
    const r = await resolverTasaDeTopes(supabase, "t1", REGLAS, "2026-11-30");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("2026-11-30");
      expect(r.error).toContain("Admin › Tasas");
    }
  });

  it("una tasa en cero o negativa no vale", async () => {
    const { supabase } = clienteConTasa({ rate: 0, source: "manual", valid_on: "2026-11-17" });
    const r = await resolverTasaDeTopes(supabase, "t1", REGLAS, "2026-11-30");
    expect(r.ok).toBe(false);
  });

  it("con los topes desactivados no consulta ni pide tasa", async () => {
    const { supabase, rpc } = clienteConTasa(null);
    for (const reglas of [
      { min_salary: 0, sso_cap_sm: 5, rpe_cap_sm: 10 },
      { min_salary: 130, sso_cap_sm: 0, rpe_cap_sm: 0 },
    ]) {
      const r = await resolverTasaDeTopes(supabase, "t1", reglas, "2026-11-30");
      expect(r).toEqual({ ok: true, tasa: { rate: null, source: null, validOn: null } });
    }
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("camposDeTasaParaSnapshot", () => {
  it("congela tasa, fuente y fecha de valor", () => {
    expect(camposDeTasaParaSnapshot({ rate: 130, source: "bcv", validOn: "2026-11-17" })).toEqual({
      cap_fx_rate: 130,
      cap_fx_source: "bcv",
      cap_fx_valid_on: "2026-11-17",
    });
  });
  it("sin tasa no agrega nada al snapshot", () => {
    expect(camposDeTasaParaSnapshot({ rate: null, source: null, validOn: null })).toEqual({});
  });
});
