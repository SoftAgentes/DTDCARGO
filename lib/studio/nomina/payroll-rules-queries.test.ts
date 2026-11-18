// @vitest-environment node
/**
 * SDD-0653 A2b · Las consultas de las reglas con y sin la migración 0556 (EN ESPERA).
 * Un Supabase de mentira que se comporta como PostgREST: sin la 0556, pedir una columna
 * nueva responde «columna inexistente» (42703). Lo que se prueba es la degradación: la
 * pantalla tiene que seguir funcionando como en la fase A2a.
 */
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  COLUMNAS_0556,
  faltaColumna,
  getVigentePayrollRules,
  getVigentePayrollRulesConEstado,
  upsertPayrollRules,
} from "./payroll-rules-queries";
import { PAYROLL_RULES_DEFAULTS, type PayrollRulesInput } from "./payroll-rules-types";

type Fila = Record<string, unknown>;

const FALTA = { code: "42703", message: 'column nomina_payroll_rules.vigente_desde does not exist' };

/** La fila vigente tal como la devuelve PostgREST: los numeric, como texto. */
function filaVigente(conCampos0556: boolean): Fila {
  const base: Fila = {
    id: "r-1",
    tenant_id: "t-1",
    version: 2,
    status: "vigente",
    pay_frequency: "mensual",
    day_method: "30",
    min_salary: "130.00",
    cestaticket: "40.00",
    bono_guerra: "90.00",
    sso_pct: "4.00",
    rpe_pct: "0.50",
    faov_pct: "1.00",
    sso_cap_sm: "5.00",
    rpe_cap_sm: "10.00",
    overtime_pct: "50.00",
    night_pct: "30.00",
    holiday_pct: "50.00",
    utilidades_days: 30,
    bono_vacacional_days: 15,
    vacaciones_days: 15,
    salarial_bonuses: [],
    notes: null,
    created_by: null,
    created_at: "2026-11-16T12:00:00Z",
    updated_at: "2026-11-16T12:00:00Z",
    deleted_at: null,
  };
  if (!conCampos0556) return base;
  return {
    ...base,
    vigente_desde: "2026-11-01",
    fuente_legal: "Decreto de prueba",
    ingreso_minimo_integral_usd: "240.00",
    cestaticket_moneda: "USD",
    bono_guerra_moneda: "USD",
    sso_patronal_pct: "9.00",
    rpe_patronal_pct: "2.00",
    faov_patronal_pct: "2.00",
    inces_patronal_pct: "2.00",
    inces_utilidades_pct: "0.50",
    pension_contrib_pct: "9.00",
    vacaciones_extra_max: 15,
    bono_vacacional_max_days: 30,
  };
}

function falso(cfg: { ampliada: boolean; vigente: boolean; insertFalla?: boolean }) {
  const log = { selects: [] as string[], inserts: [] as Fila[], updates: [] as Fila[] };
  const fila = cfg.vigente ? filaVigente(cfg.ampliada) : null;
  const cliente = {
    from: () => ({
      select(cols: string) {
        log.selects.push(cols);
        const pideNuevas = cols.includes("vigente_desde");
        const res = pideNuevas && !cfg.ampliada ? { data: null, error: FALTA } : { data: fila, error: null };
        const q: Record<string, unknown> = {};
        q.eq = () => q;
        q.is = () => q;
        q.maybeSingle = async () => res;
        return q;
      },
      update(v: Fila) {
        log.updates.push(v);
        const q: Record<string, unknown> = {};
        q.eq = () => q;
        q.then = (resolve: (r: { error: null }) => void) => resolve({ error: null });
        return q;
      },
      insert(v: Fila) {
        log.inserts.push(v);
        return {
          select: (cols: string) => ({
            single: async () => {
              const traeNuevas = "vigente_desde" in v || "sso_patronal_pct" in v;
              if (traeNuevas && (!cfg.ampliada || cfg.insertFalla)) return { data: null, error: FALTA };
              return { data: { ...filaVigente(cols.includes("vigente_desde")), version: v.version }, error: null };
            },
          }),
        };
      },
    }),
  };
  return { log, supabase: cliente as unknown as SupabaseClient };
}

const entrada = (over: Partial<PayrollRulesInput> = {}): PayrollRulesInput => ({
  ...PAYROLL_RULES_DEFAULTS,
  min_salary: 130,
  ...over,
});

describe("lectura de las reglas vigentes", () => {
  it("con la 0556 trae las columnas nuevas y convierte los numeric", async () => {
    const { supabase, log } = falso({ ampliada: true, vigente: true });
    const { rules, ampliada } = await getVigentePayrollRulesConEstado(supabase);
    expect(ampliada).toBe(true);
    expect(log.selects).toHaveLength(1);
    expect(log.selects[0]).toContain("vigente_desde");
    expect(rules).toMatchObject({
      version: 2,
      min_salary: 130,
      vigente_desde: "2026-11-01",
      fuente_legal: "Decreto de prueba",
      ingreso_minimo_integral_usd: 240,
      cestaticket_moneda: "USD",
      bono_guerra_moneda: "USD",
      sso_patronal_pct: 9,
      pension_contrib_pct: 9,
      vacaciones_extra_max: 15,
      bono_vacacional_max_days: 30,
    });
  });

  it("SIN la 0556 reintenta con las columnas de siempre: la pantalla funciona como en la fase A2a", async () => {
    const { supabase, log } = falso({ ampliada: false, vigente: true });
    const { rules, ampliada } = await getVigentePayrollRulesConEstado(supabase);
    expect(ampliada).toBe(false);
    expect(log.selects).toHaveLength(2);
    expect(log.selects[1]).not.toContain("vigente_desde");
    expect(rules).toMatchObject({ version: 2, min_salary: 130, cestaticket: 40, bono_guerra: 90 });
    for (const c of COLUMNAS_0556) expect(rules, c).not.toHaveProperty(c);
  });

  it("sin la 0556 y sin versión guardada sabe igual que la base no está ampliada", async () => {
    const { supabase } = falso({ ampliada: false, vigente: false });
    const r = await getVigentePayrollRulesConEstado(supabase);
    expect(r).toEqual({ rules: null, ampliada: false });
  });

  it("un error que no es de columna no reintenta ni inventa reglas", async () => {
    const cliente = {
      from: () => ({
        select: () => {
          const q: Record<string, unknown> = {};
          q.eq = () => q;
          q.is = () => q;
          q.maybeSingle = async () => ({ data: null, error: { code: "42501", message: "permission denied" } });
          return q;
        },
      }),
    } as unknown as SupabaseClient;
    const antes = console.error;
    console.error = () => {};
    try {
      expect(await getVigentePayrollRulesConEstado(cliente)).toEqual({ rules: null, ampliada: true });
    } finally {
      console.error = antes;
    }
  });

  it("getVigentePayrollRules devuelve solo las reglas", async () => {
    const { supabase } = falso({ ampliada: true, vigente: true });
    expect((await getVigentePayrollRules(supabase))?.version).toBe(2);
  });

  it("una moneda desconocida en la base se lee como bolívares, sin fecha inventada", async () => {
    const fila = { ...filaVigente(true), cestaticket_moneda: "EUR", bono_guerra_moneda: null, vigente_desde: null };
    const cliente = {
      from: () => ({
        select: () => {
          const q: Record<string, unknown> = {};
          q.eq = () => q;
          q.is = () => q;
          q.maybeSingle = async () => ({ data: fila, error: null });
          return q;
        },
      }),
    } as unknown as SupabaseClient;
    const { rules } = await getVigentePayrollRulesConEstado(cliente);
    expect(rules?.cestaticket_moneda).toBe("VES");
    expect(rules?.bono_guerra_moneda).toBe("VES");
    expect(rules?.vigente_desde).toBeNull();
  });
});

describe("guardar una versión nueva", () => {
  it("con la 0556 archiva la vigente e inserta la versión 3 con vigencia, fuente, monedas y aportes", async () => {
    const { supabase, log } = falso({ ampliada: true, vigente: true });
    const r = await upsertPayrollRules(
      supabase,
      "t-1",
      entrada({ vigente_desde: "2026-12-01", fuente_legal: "Decreto de prueba", ingreso_minimo_integral_usd: 240 }),
      "u-1",
    );
    expect(r.error).toBeNull();
    expect(r.ampliada).toBe(true);
    expect(log.updates).toEqual([{ status: "archivada" }]);
    expect(log.inserts).toHaveLength(1);
    expect(log.inserts[0]).toMatchObject({
      version: 3,
      vigente_desde: "2026-12-01",
      fuente_legal: "Decreto de prueba",
      ingreso_minimo_integral_usd: 240,
      cestaticket_moneda: "USD",
      sso_patronal_pct: 9,
      pension_contrib_pct: 9,
      vacaciones_extra_max: 15,
    });
    for (const c of COLUMNAS_0556) expect(log.inserts[0], c).toHaveProperty(c);
  });

  it("sin vigente_desde deja que la base ponga la fecha de hoy (no manda null)", async () => {
    const { supabase, log } = falso({ ampliada: true, vigente: true });
    await upsertPayrollRules(supabase, "t-1", entrada({ vigente_desde: null }), null);
    expect(log.inserts[0]).not.toHaveProperty("vigente_desde");
    expect(log.inserts[0]).toHaveProperty("fuente_legal", null);
  });

  it("SIN la 0556 inserta solo las columnas de siempre y avisa que no está ampliada", async () => {
    const { supabase, log } = falso({ ampliada: false, vigente: true });
    const r = await upsertPayrollRules(supabase, "t-1", entrada({ fuente_legal: "no se guarda" }), "u-1");
    expect(r.error).toBeNull();
    expect(r.ampliada).toBe(false);
    for (const c of COLUMNAS_0556) expect(log.inserts[0], c).not.toHaveProperty(c);
    expect(log.inserts[0]).toMatchObject({ version: 3, min_salary: 130, status: "vigente" });
  });

  it("la primera versión (sin vigente) es la 1 y no archiva nada", async () => {
    const { supabase, log } = falso({ ampliada: true, vigente: false });
    const r = await upsertPayrollRules(supabase, "t-1", entrada(), null);
    expect(r.error).toBeNull();
    expect(log.updates).toHaveLength(0);
    expect(log.inserts[0]).toMatchObject({ version: 1 });
  });

  it("si la base pierde las columnas entre la lectura y el insert (un desarme), reintenta sin ellas", async () => {
    const { supabase, log } = falso({ ampliada: true, vigente: true, insertFalla: true });
    const r = await upsertPayrollRules(supabase, "t-1", entrada({ vigente_desde: "2026-12-01" }), null);
    expect(r.error).toBeNull();
    expect(r.ampliada).toBe(false);
    expect(log.inserts).toHaveLength(2);
    expect(log.inserts[0]).toHaveProperty("vigente_desde", "2026-12-01");
    expect(log.inserts[1]).not.toHaveProperty("vigente_desde");
  });
});

describe("COLUMNAS_0556 y faltaColumna", () => {
  it("son 13, sin repetidas", () => {
    expect(COLUMNAS_0556).toHaveLength(13);
    expect(new Set(COLUMNAS_0556).size).toBe(13);
  });

  it("reconoce «columna inexistente» de Postgres y de PostgREST, y nada más", () => {
    expect(faltaColumna({ code: "42703", message: "x" })).toBe(true);
    expect(faltaColumna({ code: "PGRST204", message: "x" })).toBe(true);
    expect(faltaColumna({ code: null, message: "column nomina_payroll_rules.fuente_legal does not exist" })).toBe(true);
    expect(faltaColumna({ code: null, message: "Could not find the 'fuente_legal' column of 'nomina_payroll_rules'" })).toBe(true);
    expect(faltaColumna({ code: "42501", message: "permission denied for table nomina_payroll_rules" })).toBe(false);
    expect(faltaColumna({ code: "23505", message: "duplicate key" })).toBe(false);
    expect(faltaColumna(null)).toBe(false);
  });
});
