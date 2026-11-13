/**
 * SDD-0629 · La tasa del portal se lee con el admin client SOLO para el tenant
 * del principal: la única RPC es `fx_rate_on` con ese `p_tenant_id`, nunca se
 * toca otra tabla, y sin tenant no se crea el admin client.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

// Como en pending-acceptance.test.ts: crear el admin client falla (sin la clave).
const h = vi.hoisted(() => ({
  crearAdmin: vi.fn((): never => {
    throw new Error("falta SUPABASE_SERVICE_ROLE_KEY");
  }),
}));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => h.crearAdmin() }));
const crearAdmin = h.crearAdmin;

import { tasasReferencialesDelPortal } from "../tasa-referencial";

type Llamada = { rpc?: string; from?: string; args?: Record<string, unknown> };

/** Doble que guarda tasas de DOS tenants y filtra como `fx_rate_on`. */
function dobleAdmin() {
  const llamadas: Llamada[] = [];
  const filas = [
    { tenant_id: "t-propio", rate: 36.5, source: "bcv", valid_on: "2026-11-13" },
    { tenant_id: "t-ajeno", rate: 99, source: "bcv", valid_on: "2026-11-13" },
  ];
  const db = {
    rpc: async (rpc: string, args: Record<string, unknown>) => {
      llamadas.push({ rpc, args });
      const fila = filas.find((f) => f.tenant_id === args.p_tenant_id && f.valid_on <= String(args.p_on));
      return fila
        ? { data: [{ rate: fila.rate, source: fila.source, valid_on: fila.valid_on }], error: null }
        : { data: null, error: { code: "22023", message: "FX_RATE_MISSING" } };
    },
    from: (tabla: string) => {
      llamadas.push({ from: tabla });
      throw new Error("no debe leer tablas");
    },
  } as unknown as SupabaseClient;
  return { db, llamadas };
}

// Con llaves: un beforeEach que devuelve una función la corre como limpieza.
beforeEach(() => {
  crearAdmin.mockClear();
});

describe("tasasReferencialesDelPortal", () => {
  it("solo pide fx_rate_on del tenant dado y no ve la tasa de otro tenant", async () => {
    const { db, llamadas } = dobleAdmin();
    const m = await tasasReferencialesDelPortal("t-propio", ["2026-11-13"], db);
    expect(m.get("2026-11-13")).toEqual({ rate: 36.5, source: "bcv", validOn: "2026-11-13" });
    expect(llamadas).toEqual([
      { rpc: "fx_rate_on", args: { p_tenant_id: "t-propio", p_currency: "VES", p_on: "2026-11-13" } },
    ]);
  });

  it("un tenant sin tasas da null, aunque otro tenant tenga", async () => {
    const { db } = dobleAdmin();
    const m = await tasasReferencialesDelPortal("t-sin-tasas", ["2026-11-13"], db);
    expect(m.get("2026-11-13")).toBeNull();
  });

  it.each([null, undefined, "", "   "])("sin tenant (%s) no crea el admin client ni lee nada", async (t) => {
    const m = await tasasReferencialesDelPortal(t, ["2026-11-13"]);
    expect(m.size).toBe(0);
    expect(crearAdmin).not.toHaveBeenCalled();
  });

  it("si el admin client no se puede crear, «tasa no disponible» (mapa vacío)", async () => {
    const m = await tasasReferencialesDelPortal("t-propio", ["2026-11-13"]);
    expect(m.size).toBe(0);
    expect(crearAdmin).toHaveBeenCalledTimes(1);
  });
});
