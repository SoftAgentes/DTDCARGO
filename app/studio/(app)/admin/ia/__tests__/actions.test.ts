// @vitest-environment node
/**
 * SDD-0704 F1-A · Acciones de la pantalla «IA». Sin los dos candados (módulo admin y superadministrador) no tocan la
 * base; con ellos, validan los números y el motivo y llaman a la función de la 0570, que es la que decide (AAL2
 * incluida). El error de la base se convierte en un código, nunca en su texto.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const CUENTA = "10000000-0000-4000-8000-000000000001";

const m = vi.hoisted(() => ({
  modulo: null as string | null,
  superadmin: null as string | null,
  llamadas: [] as Array<{ fn: string; args: Record<string, unknown> }>,
  error: null as { code?: string; message?: string } | null,
}));

class Redireccion extends Error {
  constructor(readonly destino: string) {
    super(destino);
  }
}

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: (destino: string) => {
    throw new Redireccion(destino);
  },
}));
vi.mock("@/lib/db/server", () => ({
  createClient: async () => ({
    rpc: async (fn: string, args: Record<string, unknown>) => {
      m.llamadas.push({ fn, args });
      return { data: null, error: m.error };
    },
  }),
}));
vi.mock("@/lib/studio/rbac-guard", () => ({ moduleEditDenial: async () => m.modulo }));
vi.mock("@/lib/studio/platform-admin", () => ({ platformAdminDenial: async () => m.superadmin }));

import {
  guardarCuentaAction,
  guardarModeloAction,
  guardarTopeAction,
  quitarModeloAction,
  quitarTopeAction,
} from "../actions";

function form(campos: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
}

async function resultado(p: Promise<void>): Promise<{ tab: string | null; r: string | null }> {
  try {
    await p;
  } catch (e) {
    if (e instanceof Redireccion) {
      const u = new URL(e.destino, "http://x");
      expect(u.pathname).toBe("/studio/admin/ia");
      return { tab: u.searchParams.get("tab"), r: u.searchParams.get("r") };
    }
    throw e;
  }
  throw new Error("la acción no redirigió");
}

beforeEach(() => {
  m.modulo = null;
  m.superadmin = null;
  m.llamadas = [];
  m.error = null;
});

describe("candados", () => {
  it("sin el módulo admin o sin ser superadmin, no toca la base", async () => {
    m.modulo = "No tienes permiso";
    expect(await resultado(guardarTopeAction(form({ tope: "3", motivo: "bajar el tope" }))).then((x) => x.r)).toBe("sin_permiso");
    m.modulo = null;
    m.superadmin = "No eres superadministrador";
    expect((await resultado(guardarTopeAction(form({ tope: "3", motivo: "bajar el tope" })))).r).toBe("solo_superadmin");
    expect(m.llamadas).toHaveLength(0);
  });
});

describe("tope", () => {
  it("acepta la coma decimal y llama a ia_guardar_tope", async () => {
    expect(await resultado(guardarTopeAction(form({ tope: "2,50", motivo: "bajar el tope" })))).toEqual({ tab: "gasto", r: "ok_tope" });
    expect(m.llamadas).toEqual([{ fn: "ia_guardar_tope", args: { p_funcion: "oficina", p_tope_usd: 2.5, p_motivo: "bajar el tope" } }]);
  });

  it("un número que no se entiende o un motivo corto no llegan a la base", async () => {
    expect((await resultado(guardarTopeAction(form({ tope: "dos", motivo: "bajar el tope" })))).r).toBe("invalido");
    expect((await resultado(guardarTopeAction(form({ tope: "0", motivo: "bajar el tope" })))).r).toBe("invalido");
    expect((await resultado(guardarTopeAction(form({ tope: "3", motivo: "no" })))).r).toBe("motivo");
    expect((await resultado(guardarTopeAction(form({ tope: "3", motivo: "lo pidió ana@correo.com" })))).r).toBe("motivo_con_datos");
    expect(m.llamadas).toHaveLength(0);
  });

  it("si la base pide AAL2, el aviso lo dice con su código, sin el texto de la base", async () => {
    m.error = { code: "42501", message: "ia:requiere_aal2" };
    expect((await resultado(guardarTopeAction(form({ tope: "9", motivo: "subir el tope" })))).r).toBe("requiere_aal2");
    m.error = { code: "23514", message: 'new row violates check constraint "ia_topes_techo_oficina"' };
    expect((await resultado(guardarTopeAction(form({ tope: "40", motivo: "subir el tope" })))).r).toBe("sobre_el_techo");
    m.error = { code: "42883", message: "function does not exist" };
    expect((await resultado(quitarTopeAction(form({ motivo: "volver al entorno" })))).r).toBe("sin_migracion");
  });
});

describe("cuentas", () => {
  const base = { alias: "Oficina Anthropic", proveedor: "anthropic", uso: "oficina", tipo_cobro: "por_token", motivo: "alta de la oficina" };

  it("crea una cuenta por token sin tope de llamadas", async () => {
    expect((await resultado(guardarCuentaAction(form(base)))).r).toBe("ok_cuenta");
    expect(m.llamadas[0]).toEqual({
      fn: "ia_guardar_cuenta",
      args: { p_id: null, p_alias: "Oficina Anthropic", p_proveedor: "anthropic", p_uso: "oficina", p_tipo_cobro: "por_token", p_tope_llamadas: null, p_motivo: "alta de la oficina" },
    });
  });

  it("D-2: la cuenta de la Oficina no puede ser china (antes de la base)", async () => {
    for (const proveedor of ["zai", "deepseek"]) {
      expect((await resultado(guardarCuentaAction(form({ ...base, proveedor })))).r).toBe("oficina_china");
    }
    expect(m.llamadas).toHaveLength(0);
  });

  it("plan fijo exige un tope de llamadas entero", async () => {
    expect((await resultado(guardarCuentaAction(form({ ...base, uso: "erp", tipo_cobro: "plan_fijo" })))).r).toBe("plan_fijo_sin_tope");
    expect((await resultado(guardarCuentaAction(form({ ...base, uso: "erp", tipo_cobro: "plan_fijo", tope_llamadas: "1,5" })))).r).toBe("invalido");
    expect((await resultado(guardarCuentaAction(form({ ...base, uso: "erp", tipo_cobro: "plan_fijo", tope_llamadas: "150" })))).r).toBe("ok_cuenta");
    expect(m.llamadas.at(-1)?.args.p_tope_llamadas).toBe(150);
  });

  it("un alias con correo o un proveedor fuera de la lista no entran", async () => {
    expect((await resultado(guardarCuentaAction(form({ ...base, alias: "sam@correo.com" })))).r).toBe("alias_repetido");
    expect((await resultado(guardarCuentaAction(form({ ...base, proveedor: "gemini" })))).r).toBe("invalido");
    expect(m.llamadas).toHaveLength(0);
  });
});

describe("modelos", () => {
  it("guarda la tarifa con coma decimal", async () => {
    expect(
      (await resultado(guardarModeloAction(form({ cuenta: CUENTA, modelo: "claude-haiku-5-5", entrada: "1", salida: "5,25", motivo: "tarifa nueva" })))).r,
    ).toBe("ok_modelo");
    expect(m.llamadas[0]).toEqual({
      fn: "ia_guardar_modelo",
      args: { p_cuenta_id: CUENTA, p_modelo: "claude-haiku-5-5", p_tarifa_entrada: 1, p_tarifa_salida: 5.25, p_motivo: "tarifa nueva" },
    });
  });

  it("por token sin tarifa no llega a la base; plan fijo va sin tarifa", async () => {
    expect((await resultado(guardarModeloAction(form({ cuenta: CUENTA, modelo: "claude-haiku-5-5", motivo: "sin tarifa" })))).r).toBe("invalido");
    expect(m.llamadas).toHaveLength(0);
    expect((await resultado(guardarModeloAction(form({ cuenta: CUENTA, modelo: "glm-5.3", plan_fijo: "1", motivo: "plan fijo" })))).r).toBe("ok_modelo");
    expect(m.llamadas[0].args).toMatchObject({ p_tarifa_entrada: null, p_tarifa_salida: null });
  });

  it("un modelo fuera del catálogo vuelve con su código", async () => {
    m.error = { code: "23503", message: "violates foreign key constraint" };
    expect(
      (await resultado(guardarModeloAction(form({ cuenta: CUENTA, modelo: "gpt-x", entrada: "1", salida: "2", motivo: "fuera del catálogo" })))).r,
    ).toBe("fuera_del_catalogo");
  });

  it("quitar un modelo exige un id válido", async () => {
    expect((await resultado(quitarModeloAction(form({ id: "x", motivo: "quitar el modelo" })))).r).toBe("invalido");
    expect((await resultado(quitarModeloAction(form({ id: CUENTA, motivo: "quitar el modelo" })))).r).toBe("ok_modelo_quitado");
  });
});
