/**
 * guardarEstadoGuiaAction (SDD-0589, 9.3): guarda solo la fila propia, con el estado
 * validado, y rechaza lo que no se puede leer.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  user: { id: "u1" } as { id: string } | null,
  tenant: "t1" as string | null,
  upsertError: null as { message: string } | null,
  upsert: vi.fn(),
}));

vi.mock("@/lib/db/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: db.user } }) },
    rpc: async (nombre: string) =>
      nombre === "get_user_tenant_id"
        ? { data: db.tenant, error: db.tenant ? null : { message: "sin tenant" } }
        : { data: null, error: { message: "otra rpc" } },
    from: (tabla: string) => ({
      upsert: async (fila: unknown, opciones: unknown) => {
        db.upsert(tabla, fila, opciones);
        return { error: db.upsertError };
      },
    }),
  }),
}));

import { guardarEstadoGuiaAction } from "./guia-actions";

beforeEach(() => {
  db.user = { id: "u1" };
  db.tenant = "t1";
  db.upsertError = null;
  db.upsert.mockClear();
});

describe("guardarEstadoGuiaAction", () => {
  it("guarda la fila propia con el estado validado", async () => {
    const r = await guardarEstadoGuiaAction(
      JSON.stringify({ v: 1, recorridos: { dashboard: { pasoId: "D2", terminado: false }, inventado: { pasoId: "X" } } }),
    );
    expect(r).toEqual({ ok: true });
    expect(db.upsert).toHaveBeenCalledWith(
      "user_guide_prefs",
      { tenant_id: "t1", user_id: "u1", state: { v: 1, recorridos: { dashboard: { pasoId: "D2", terminado: false, noMostrar: false } } } },
      { onConflict: "tenant_id,user_id" },
    );
  });

  it("rechaza lo que no es JSON o es demasiado largo, sin tocar la base", async () => {
    expect(await guardarEstadoGuiaAction("{roto")).toEqual({ error: "Estado inválido." });
    // JSON válido, pero más largo que el tope: se rechaza antes de parsear.
    const largo = JSON.stringify({ v: 1, recorridos: {}, relleno: "x".repeat(20_000) });
    expect(await guardarEstadoGuiaAction(largo)).toEqual({ error: "Estado inválido." });
    expect(db.upsert).not.toHaveBeenCalled();
  });

  it("sin sesión o sin tenant no guarda", async () => {
    db.user = null;
    expect(await guardarEstadoGuiaAction("{}")).toEqual({ error: "Inicia sesión primero." });
    db.user = { id: "u1" };
    db.tenant = null;
    expect(await guardarEstadoGuiaAction("{}")).toEqual({ error: "Sin tenant asignado." });
    expect(db.upsert).not.toHaveBeenCalled();
  });

  it("si la base rechaza, lo dice sin detalles", async () => {
    db.upsertError = { message: 'relation "user_guide_prefs" does not exist' };
    expect(await guardarEstadoGuiaAction("{}")).toEqual({ error: "No se pudo guardar." });
  });
});
