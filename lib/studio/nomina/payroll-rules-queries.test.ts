// @vitest-environment node
/**
 * SDD-0653 A2b · Las consultas de las reglas con y sin la migración 0556 (EN ESPERA).
 * Un Supabase de mentira que se comporta como PostgREST: sin la 0556, pedir una columna o llamar a la
 * función responde «inexistente» (42703 / 42883). Lo que se prueba es la degradación (la pantalla sigue
 * como en la fase A2a) y que guardar una versión nueva nunca deja al tenant sin versión vigente.
 */
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  COLUMNAS_0556,
  datosParaGuardar,
  faltaColumna,
  esConflictoConcurrente,
  faltaFuncion,
  MSG_AJUSTES_LIQUIDACION_NO_GUARDADOS,
  MSG_BASE_ACTUALIZANDO,
  MSG_GUARDADO_CONCURRENTE,
  getVigentePayrollRules,
  getVigentePayrollRulesConEstado,
  upsertPayrollRules,
} from "./payroll-rules-queries";
import { PAYROLL_RULES_DEFAULTS, type PayrollRulesInput } from "./payroll-rules-types";

type Fila = Record<string, unknown>;

const FALTA_COLUMNA = { code: "42703", message: "column nomina_payroll_rules.vigente_desde does not exist" };
const FALTA_FUNCION = { code: "42883", message: "function public.nomina_guardar_reglas(jsonb) does not exist" };

/** La fila vigente tal como la devuelve PostgREST: los numeric, como texto; lo no configurado, null. */
function filaVigente(conCampos0556: boolean, over: Fila = {}): Fila {
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
  if (!conCampos0556) return { ...base, ...over };
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
    ...over,
  };
}

interface Config {
  ampliada: boolean;
  vigente: boolean;
  /** Error que devuelve la función (null = guarda bien). */
  rpcError?: { code?: string; message: string } | null;
  /** El insert de los dos pasos falla con este error. */
  insertError?: { code?: string; message: string } | null;
  /** El update que restaura la versión archivada falla. */
  restauraFalla?: boolean;
  /** SDD-0658: el update que fija los ajustes de la liquidación falla. */
  ajustesFalla?: boolean;
  over?: Fila;
}

function falso(cfg: Config) {
  const log = {
    selects: [] as string[],
    inserts: [] as Fila[],
    updates: [] as { set: Fila; filtros: [string, unknown][] }[],
    rpcs: [] as { nombre: string; args: Fila }[],
  };
  const fila = cfg.vigente ? filaVigente(cfg.ampliada, cfg.over) : null;
  const cliente = {
    rpc: async (nombre: string, args: Fila) => {
      log.rpcs.push({ nombre, args });
      if (!cfg.ampliada) return { data: null, error: FALTA_FUNCION };
      if (cfg.rpcError) return { data: null, error: cfg.rpcError };
      return { data: "r-nueva", error: null };
    },
    from: () => ({
      select(cols: string) {
        log.selects.push(cols);
        const pideNuevas = cols.includes("vigente_desde");
        const res = pideNuevas && !cfg.ampliada ? { data: null, error: FALTA_COLUMNA } : { data: fila, error: null };
        const q: Record<string, unknown> = {};
        q.eq = () => q;
        q.is = () => q;
        q.maybeSingle = async () => res;
        q.single = async () => ({ data: filaVigente(pideNuevas, { id: "r-nueva", version: 3 }), error: null });
        return q;
      },
      update(set: Fila) {
        const entrada = { set, filtros: [] as [string, unknown][] };
        log.updates.push(entrada);
        const q: Record<string, unknown> = {};
        q.eq = (col: string, v: unknown) => {
          entrada.filtros.push([col, v]);
          return q;
        };
        q.then = (resolve: (r: { error: { message: string } | null }) => void) =>
          resolve({
            error:
              (cfg.restauraFalla && set.status === "vigente") || (cfg.ajustesFalla && "prestaciones_method" in set)
                ? { message: "sin conexión" }
                : null,
          });
        return q;
      },
      insert(v: Fila) {
        log.inserts.push(v);
        return {
          select: () => ({
            single: async () =>
              cfg.insertError
                ? { data: null, error: cfg.insertError }
                : { data: filaVigente(false, { id: "r-nueva", version: v.version }), error: null },
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
  cestaticket_moneda: null,
  bono_guerra_moneda: null,
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
      inces_utilidades_pct: 0.5,
      pension_contrib_pct: 9,
      vacaciones_extra_max: 15,
      bono_vacacional_max_days: 30,
    });
  });

  it("una versión que no configuró los aportes y escalas los lee como null, nunca como cero", async () => {
    const sinConfigurar = {
      ingreso_minimo_integral_usd: null,
      sso_patronal_pct: null,
      rpe_patronal_pct: null,
      faov_patronal_pct: null,
      inces_patronal_pct: null,
      inces_utilidades_pct: null,
      pension_contrib_pct: null,
      vacaciones_extra_max: null,
      bono_vacacional_max_days: null,
      vigente_desde: null,
      cestaticket_moneda: "VES",
      bono_guerra_moneda: "VES",
    };
    const { supabase } = falso({ ampliada: true, vigente: true, over: sinConfigurar });
    const { rules } = await getVigentePayrollRulesConEstado(supabase);
    for (const c of COLUMNAS_0556) {
      if (c === "fuente_legal" || c.endsWith("_moneda")) continue;
      expect(rules, c).toHaveProperty(c, null);
    }
    expect(rules?.cestaticket_moneda).toBe("VES");
    expect(rules?.bono_guerra_moneda).toBe("VES");
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
    expect(await getVigentePayrollRulesConEstado(supabase)).toEqual({ rules: null, ampliada: false });
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
    const { supabase } = falso({
      ampliada: true,
      vigente: true,
      over: { cestaticket_moneda: "EUR", bono_guerra_moneda: null, vigente_desde: null },
    });
    const { rules } = await getVigentePayrollRulesConEstado(supabase);
    expect(rules?.cestaticket_moneda).toBe("VES");
    expect(rules?.bono_guerra_moneda).toBe("VES");
    expect(rules?.vigente_desde).toBeNull();
  });
});

describe("guardar una versión nueva (con la 0556: una función, una transacción)", () => {
  it("llama a nomina_guardar_reglas con los datos y lee la versión nueva; no archiva ni inserta por su cuenta", async () => {
    const { supabase, log } = falso({ ampliada: true, vigente: true });
    const r = await upsertPayrollRules(
      supabase,
      "t-1",
      entrada({ vigente_desde: "2026-11-10", fuente_legal: "Decreto de prueba", ingreso_minimo_integral_usd: 240 }),
      "u-1",
    );
    expect(r.error).toBeNull();
    expect(r.ampliada).toBe(true);
    expect(r.data?.version).toBe(3);
    expect(log.rpcs).toHaveLength(1);
    expect(log.rpcs[0].nombre).toBe("nomina_guardar_reglas");
    expect(log.rpcs[0].args.p_datos).toMatchObject({
      min_salary: 130,
      vigente_desde: "2026-11-10",
      fuente_legal: "Decreto de prueba",
      ingreso_minimo_integral_usd: 240,
      sso_patronal_pct: 9,
      pension_contrib_pct: 9,
    });
    // No archiva por su cuenta (la atomicidad es de la función). El único update es el de SDD-0658: fija los
    // ajustes de la liquidación en la versión recién creada.
    expect(log.updates).toHaveLength(1);
    expect(log.updates[0].set).not.toHaveProperty("status");
    expect(log.updates[0].filtros).toEqual([["id", "r-nueva"]]);
    expect(log.inserts).toHaveLength(0);
  });

  it("los datos no llevan tenant, autor ni versión: la función los toma de la sesión", () => {
    const datos = datosParaGuardar(entrada());
    for (const c of ["tenant_id", "created_by", "version", "status", "id"]) expect(datos, c).not.toHaveProperty(c);
  });

  it("una moneda que no llega NO se manda (la función hereda la de la vigente); nunca se impone USD", () => {
    const sin = datosParaGuardar(entrada({ cestaticket_moneda: null, bono_guerra_moneda: null }));
    expect(sin).not.toHaveProperty("cestaticket_moneda");
    expect(sin).not.toHaveProperty("bono_guerra_moneda");
    const con = datosParaGuardar(entrada({ cestaticket_moneda: "VES", bono_guerra_moneda: "USD" }));
    expect(con).toMatchObject({ cestaticket_moneda: "VES", bono_guerra_moneda: "USD" });
  });

  it("editar una versión en VES sin tocar la moneda conserva VES: el payload no la cambia a USD", () => {
    // El formulario manda la moneda de la versión que se edita (VES); y si no la mandara, no se manda nada.
    expect(datosParaGuardar(entrada({ cestaticket_moneda: "VES" })).cestaticket_moneda).toBe("VES");
    expect(datosParaGuardar(entrada({ cestaticket_moneda: null }))).not.toHaveProperty("cestaticket_moneda");
  });

  it("sin vigente_desde no manda la fecha: la función pone hoy en Caracas (no la fecha del servidor)", () => {
    expect(datosParaGuardar(entrada({ vigente_desde: null }))).not.toHaveProperty("vigente_desde");
  });

  it("lo no configurado viaja como null, no como cero", () => {
    const datos = datosParaGuardar(entrada({ sso_patronal_pct: null, vacaciones_extra_max: null, ingreso_minimo_integral_usd: null }));
    expect(datos).toMatchObject({ sso_patronal_pct: null, vacaciones_extra_max: null, ingreso_minimo_integral_usd: null });
  });

  it("si la función falla (un CHECK, un desborde) devuelve el error y dice que la versión vigente no cambió", async () => {
    const { supabase, log } = falso({
      ampliada: true,
      vigente: true,
      rpcError: { code: "23514", message: 'new row violates check constraint "nomina_payroll_rules_pension_contrib_tope"' },
    });
    const r = await upsertPayrollRules(supabase, "t-1", entrada(), "u-1");
    expect(r.data).toBeNull();
    expect(r.error).toContain("pension_contrib_tope");
    expect(r.error).toContain("La versión vigente no cambió");
    // La app no archivó nada por su cuenta: la atomicidad es de la función.
    expect(log.updates).toHaveLength(0);
  });

  it("una versión guardada que no se puede releer lo dice", async () => {
    const cliente = {
      rpc: async () => ({ data: "r-9", error: null }),
      from: () => ({
        select(cols: string) {
          const q: Record<string, unknown> = {};
          q.eq = () => q;
          q.is = () => q;
          q.maybeSingle = async () => ({ data: filaVigente(true), error: null });
          q.single = async () => ({ data: null, error: { message: "boom", code: cols ? "XX000" : "" } });
          return q;
        },
        update: () => ({ eq: async () => ({ error: null }) }),
      }),
    } as unknown as SupabaseClient;
    const r = await upsertPayrollRules(cliente, "t-1", entrada(), null);
    expect(r.data).toBeNull();
    expect(r.error).toContain("se guardaron");
  });
});

describe("guardar una versión nueva SIN la 0556 (dos pasos, con restauración)", () => {
  it("archiva, inserta solo las columnas de siempre y avisa que no está ampliada", async () => {
    const { supabase, log } = falso({ ampliada: false, vigente: true });
    const r = await upsertPayrollRules(supabase, "t-1", entrada({ fuente_legal: "no se guarda" }), "u-1");
    expect(r.error).toBeNull();
    expect(r.ampliada).toBe(false);
    expect(log.rpcs).toHaveLength(0);
    expect(log.updates[0]).toMatchObject({ set: { status: "archivada" } });
    for (const c of COLUMNAS_0556) expect(log.inserts[0], c).not.toHaveProperty(c);
    expect(log.inserts[0]).toMatchObject({ version: 3, min_salary: 130, status: "vigente", created_by: "u-1" });
  });

  it("la primera versión (sin vigente) es la 1 y no archiva nada", async () => {
    const { supabase, log } = falso({ ampliada: false, vigente: false });
    const r = await upsertPayrollRules(supabase, "t-1", entrada(), null);
    expect(r.error).toBeNull();
    expect(log.updates).toHaveLength(0);
    expect(log.inserts[0]).toMatchObject({ version: 1 });
  });

  it("si el insert falla RESTAURA la versión archivada: el tenant no se queda sin vigente", async () => {
    const { supabase, log } = falso({
      ampliada: false,
      vigente: true,
      insertError: { code: "23514", message: "violates check constraint" },
    });
    const r = await upsertPayrollRules(supabase, "t-1", entrada(), null);
    expect(r.data).toBeNull();
    expect(r.error).toContain("violates check constraint");
    expect(r.error).toContain("La versión 2 sigue vigente");
    expect(log.updates).toHaveLength(2);
    expect(log.updates[0].set).toEqual({ status: "archivada" });
    expect(log.updates[1].set).toEqual({ status: "vigente" });
    expect(log.updates[1].filtros).toContainEqual(["id", "r-1"]);
    expect(log.updates[1].filtros).toContainEqual(["status", "archivada"]);
  });

  it("si ni la restauración se pudo, el error lo dice con todas sus letras", async () => {
    const { supabase } = falso({
      ampliada: false,
      vigente: true,
      insertError: { message: "numeric field overflow" },
      restauraFalla: true,
    });
    const r = await upsertPayrollRules(supabase, "t-1", entrada(), null);
    expect(r.error).toContain("numeric field overflow");
    expect(r.error).toContain("tampoco se pudo restaurar la versión 2");
  });

  it("sin versión previa y con el insert fallido no hay nada que restaurar", async () => {
    const { supabase, log } = falso({ ampliada: false, vigente: false, insertError: { message: "boom" } });
    const r = await upsertPayrollRules(supabase, "t-1", entrada(), null);
    expect(r.error).toContain("boom");
    expect(log.updates).toHaveLength(0);
  });

  it("B1: si la lectura vio las columnas pero la función no está (desarme parcial o caché vieja), NO degrada: error y no guarda nada", async () => {
    for (const rpcError of [FALTA_FUNCION, { code: "PGRST202", message: "Could not find the function public.nomina_guardar_reglas(p_datos) in the schema cache" }]) {
      const { supabase, log } = falso({ ampliada: true, vigente: true, rpcError });
      const r = await upsertPayrollRules(supabase, "t-1", entrada(), "u-1");
      expect(r.data).toBeNull();
      expect(r.error).toBe(MSG_BASE_ACTUALIZANDO);
      expect(r.error).toBe("La base se está actualizando; recarga e inténtalo de nuevo.");
      expect(r.ampliada).toBe(true);
      expect(log.rpcs).toHaveLength(1);
      // Ni archivó ni insertó: la versión vigente no se tocó.
      expect(log.updates).toHaveLength(0);
      expect(log.inserts).toHaveLength(0);
    }
  });

  it("B4: dos guardados simultáneos (23505 de la función) dicen que otra persona guardó al mismo tiempo", async () => {
    const { supabase, log } = falso({
      ampliada: true,
      vigente: true,
      rpcError: { code: "23505", message: 'duplicate key value violates unique constraint "nomina_payroll_rules_one_vigente"' },
    });
    const r = await upsertPayrollRules(supabase, "t-1", entrada(), "u-1");
    expect(r.data).toBeNull();
    expect(r.error).toBe(MSG_GUARDADO_CONCURRENTE);
    expect(r.error).toBe("Otra persona guardó al mismo tiempo; recarga.");
    expect(log.updates).toHaveLength(0);
    expect(log.inserts).toHaveLength(0);
  });

  it("B4: sin la 0556, un insert que choca (23505) dice lo mismo y NO intenta restaurar (ya hay una vigente: la de la otra persona)", async () => {
    const { supabase, log } = falso({
      ampliada: false,
      vigente: true,
      insertError: { code: "23505", message: "duplicate key value violates unique constraint" },
    });
    const r = await upsertPayrollRules(supabase, "t-1", entrada(), "u-1");
    expect(r.data).toBeNull();
    expect(r.error).toBe(MSG_GUARDADO_CONCURRENTE);
    // Solo el archivado propio; nada de volver a dejar vigente la archivada.
    expect(log.updates).toHaveLength(1);
    expect(log.updates[0].set).toEqual({ status: "archivada" });
  });
});

describe("esConflictoConcurrente", () => {
  it("reconoce la violación de unicidad por código o por mensaje, y nada más", () => {
    expect(esConflictoConcurrente({ code: "23505", message: "x" })).toBe(true);
    expect(esConflictoConcurrente({ code: null, message: 'duplicate key value violates unique constraint "x"' })).toBe(true);
    expect(esConflictoConcurrente({ code: "23514", message: "violates check constraint" })).toBe(false);
    expect(esConflictoConcurrente({ code: "42501", message: "sin acceso a las reglas de nómina" })).toBe(false);
    expect(esConflictoConcurrente(null)).toBe(false);
  });
});

describe("COLUMNAS_0556, faltaColumna y faltaFuncion", () => {
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

  it("reconoce «función inexistente» y no confunde un error de la función con que falte", () => {
    expect(faltaFuncion({ code: "42883", message: "x" })).toBe(true);
    expect(faltaFuncion({ code: "PGRST202", message: "x" })).toBe(true);
    expect(faltaFuncion({ code: null, message: "Could not find the function public.nomina_guardar_reglas(p_datos) in the schema cache" })).toBe(true);
    expect(faltaFuncion({ code: "23514", message: "violates check constraint" })).toBe(false);
    expect(faltaFuncion({ code: "42501", message: "sin acceso a las reglas de nómina" })).toBe(false);
    expect(faltaFuncion(null)).toBe(false);
  });
});


describe("SDD-0658 · ajustes de la liquidación (columnas de la 0179)", () => {
  const AJUSTES_VIGENTES = {
    prestaciones_method: "retroactivo",
    prestaciones_interest_pct: "12.50",
    ajena_78_incluye_92: true,
  };

  it("la lectura los pide y los convierte (antes no se pedían y el finiquito usaba los de fábrica)", async () => {
    for (const ampliada of [true, false]) {
      const { supabase, log } = falso({ ampliada, vigente: true, over: AJUSTES_VIGENTES });
      const rules = await getVigentePayrollRules(supabase);
      expect(log.selects.at(-1)).toContain("prestaciones_method");
      expect(log.selects.at(-1)).toContain("prestaciones_interest_pct");
      expect(log.selects.at(-1)).toContain("ajena_78_incluye_92");
      expect(rules?.prestaciones_method).toBe("retroactivo");
      expect(rules?.prestaciones_interest_pct).toBe(12.5);
      expect(rules?.ajena_78_incluye_92).toBe(true);
    }
  });

  it("un método desconocido en la base se lee como «mejor», nunca como texto libre", async () => {
    const { supabase } = falso({ ampliada: true, vigente: true, over: { prestaciones_method: "otro" } });
    expect((await getVigentePayrollRules(supabase))?.prestaciones_method).toBe("mejor");
  });

  it("con la 0556: guardar otra cosa conserva los ajustes de la versión vigente", async () => {
    const { supabase, log } = falso({ ampliada: true, vigente: true, over: AJUSTES_VIGENTES });
    const r = await upsertPayrollRules(supabase, "t-1", entrada(), "u-1");
    expect(r.error).toBeNull();
    const fijado = log.updates.find((u) => "prestaciones_method" in u.set);
    expect(fijado?.set).toEqual({
      prestaciones_method: "retroactivo",
      prestaciones_interest_pct: 12.5,
      ajena_78_incluye_92: true,
    });
    expect(fijado?.filtros).toContainEqual(["id", "r-nueva"]);
  });

  it("con la 0556: lo que llega en el formulario manda sobre lo vigente", async () => {
    const { supabase, log } = falso({ ampliada: true, vigente: true, over: AJUSTES_VIGENTES });
    await upsertPayrollRules(
      supabase,
      "t-1",
      entrada({ prestaciones_method: "garantia", prestaciones_interest_pct: 0, ajena_78_incluye_92: false }),
      "u-1",
    );
    expect(log.updates.find((u) => "prestaciones_method" in u.set)?.set).toEqual({
      prestaciones_method: "garantia",
      prestaciones_interest_pct: 0,
      ajena_78_incluye_92: false,
    });
  });

  it("con la 0556: si fijar los ajustes falla, lo dice y no da el guardado por bueno", async () => {
    const { supabase } = falso({ ampliada: true, vigente: true, over: AJUSTES_VIGENTES, ajustesFalla: true });
    const r = await upsertPayrollRules(supabase, "t-1", entrada(), "u-1");
    expect(r.data).toBeNull();
    expect(r.error).toBe(MSG_AJUSTES_LIQUIDACION_NO_GUARDADOS);
  });

  it("sin la 0556: el insert de la versión nueva los lleva", async () => {
    const { supabase, log } = falso({ ampliada: false, vigente: true, over: AJUSTES_VIGENTES });
    await upsertPayrollRules(supabase, "t-1", entrada(), "u-1");
    expect(log.inserts[0]).toMatchObject({
      prestaciones_method: "retroactivo",
      prestaciones_interest_pct: 12.5,
      ajena_78_incluye_92: true,
    });
  });

  it("sin versión vigente: los valores con que nace la columna (0179)", async () => {
    const { supabase, log } = falso({ ampliada: false, vigente: false });
    await upsertPayrollRules(supabase, "t-1", entrada(), "u-1");
    expect(log.inserts[0]).toMatchObject({
      prestaciones_method: "mejor",
      prestaciones_interest_pct: 0,
      ajena_78_incluye_92: false,
    });
  });
});
