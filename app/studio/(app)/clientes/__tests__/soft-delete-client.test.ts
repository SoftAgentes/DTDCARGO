/**
 * SDD-0469 · Borrado auditado de un cliente (sobre SDD-0467, que revoca su
 * acceso al Portal).
 *
 * El evento y la revocación viven en la base (migr 0455 y 0454, en la misma
 * transacción de la RPC). La acción garantiza el contrato de cara al Studio:
 * - borra por id con la RPC auditada, nunca con un UPDATE directo;
 * - el motivo es opcional; si viene, cumple los límites de AUD-01;
 * - «cero filas» (ya borrado, de otro tenant o inexistente) es un error, nunca `ok`;
 * - si la base rechaza, no revalida y el mensaje no promete un borrado a medias.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const CLIENT_ID = "40000000-0000-4000-8000-000000000001";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn<(p: string) => void>(),
  moduleEditDenial: vi.fn<() => Promise<string | null>>(),
  rpcResult: { data: true as unknown, error: null as { message: string; code?: string } | null },
  rpcCalls: [] as Array<{ fn: string; args: Record<string, unknown> }>,
  fromCalls: [] as string[],
}));

vi.mock("next/cache", () => ({ revalidatePath: (p: string) => mocks.revalidatePath(p) }));
vi.mock("@/lib/studio/rbac-guard", () => ({ moduleEditDenial: () => mocks.moduleEditDenial() }));
vi.mock("@/lib/db/server", () => ({
  createClient: async () => ({
    rpc: async (fn: string, args: Record<string, unknown>) => {
      mocks.rpcCalls.push({ fn, args });
      return mocks.rpcResult;
    },
    from(table: string) {
      mocks.fromCalls.push(table);
      throw new Error(`softDeleteClientAction no debe escribir ${table} directo`);
    },
  }),
}));

import { softDeleteClientAction } from "../actions";

const NOT_FOUND =
  "No se eliminó ningún cliente: ya estaba eliminado, no existe o no tienes acceso a él. Recarga la lista.";
const DB_ERROR =
  "No se pudo confirmar el borrado. Recarga la lista: si el cliente sigue ahí, conserva su acceso al Portal y puedes intentarlo de nuevo.";

describe("softDeleteClientAction (SDD-0469)", () => {
  beforeEach(() => {
    mocks.revalidatePath.mockReset();
    mocks.moduleEditDenial.mockReset();
    mocks.moduleEditDenial.mockResolvedValue(null);
    mocks.rpcResult = { data: true, error: null };
    mocks.rpcCalls = [];
    mocks.fromCalls = [];
  });

  it("borra por id con la RPC auditada, pasa el motivo recortado y revalida el listado", async () => {
    const res = await softDeleteClientAction(CLIENT_ID, "  Ficha duplicada de DTD-0001  ");

    expect(res).toEqual({ ok: true });
    expect(mocks.rpcCalls).toEqual([
      {
        fn: "soft_delete_client_with_audit_reason",
        args: { p_client_id: CLIENT_ID, p_reason: "Ficha duplicada de DTD-0001" },
      },
    ]);
    expect(mocks.fromCalls).toEqual([]);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/studio/clientes");
  });

  it.each([["vacío", ""], ["espacios", "    "], ["saltos y tabuladores", "\n\t \n"], ["omitido", undefined]])(
    "sin motivo (%s) manda p_reason NULL: el evento lleva el motivo por defecto",
    async (_label, reason) => {
      const res = await softDeleteClientAction(CLIENT_ID, reason as string | undefined);

      expect(res).toEqual({ ok: true });
      expect(mocks.rpcCalls).toHaveLength(1);
      expect(mocks.rpcCalls[0].args).toEqual({ p_client_id: CLIENT_ID, p_reason: null });
    },
  );

  it.each([
    ["false (ya borrado, de otro tenant o inexistente)", false],
    ["null", null],
    ["el texto 'true'", "true"],
    ["1", 1],
    ["undefined", undefined],
  ])("si la RPC devuelve %s no hay ok: error claro y sin revalidar", async (_label, data) => {
    mocks.rpcResult = { data, error: null };

    const res = await softDeleteClientAction(CLIENT_ID, "Motivo válido");

    expect(res.ok).toBeUndefined();
    expect(res.error).toBe(NOT_FOUND);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("si la base rechaza (evento o revocación fallidos) no revalida y no promete un borrado", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.rpcResult = { data: null, error: { message: "auditoría rota a propósito", code: "P0001" } };

    const res = await softDeleteClientAction(CLIENT_ID, "Motivo válido");

    expect(res.ok).toBeUndefined();
    expect(res.error).toBe(DB_ERROR);
    // Un error puede llegar después del COMMIT (red): el mensaje no afirma que no se borró nada.
    expect(res.error).not.toMatch(/no se borró nada/i);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith("[softDeleteClientAction]", "auditoría rota a propósito");
    consoleError.mockRestore();
  });

  it.each([["a"], ["abc"], ["  ab  "]])("un motivo escrito de menos de 4 caracteres (%j) no toca la base", async (reason) => {
    const res = await softDeleteClientAction(CLIENT_ID, reason);

    expect(res).toEqual({
      error: "El motivo es opcional, pero si lo escribes debe tener al menos 4 caracteres.",
    });
    expect(mocks.rpcCalls).toHaveLength(0);
  });

  it("un motivo de más de 1000 caracteres no toca la base", async () => {
    const res = await softDeleteClientAction(CLIENT_ID, "m".repeat(1001));

    expect(res).toEqual({ error: "El motivo no puede superar 1000 caracteres." });
    expect(mocks.rpcCalls).toHaveLength(0);
  });

  it("los límites de 4 y 1000 caracteres llegan a la RPC", async () => {
    await softDeleteClientAction(CLIENT_ID, "Dupl");
    await softDeleteClientAction(CLIENT_ID, "m".repeat(1000));

    expect(mocks.rpcCalls.map((call) => call.args.p_reason)).toEqual(["Dupl", "m".repeat(1000)]);
  });

  it.each([["un Shipping Mark", "DTD-1234"], ["vacío", ""], ["uuid truncado", CLIENT_ID.slice(0, 35)]])(
    "un id que no es uuid (%s) no toca la base",
    async (_label, id) => {
      const res = await softDeleteClientAction(id, "Motivo válido");

      expect(res).toEqual({ error: "No se pudo identificar al cliente. Recarga la lista e inténtalo de nuevo." });
      expect(mocks.rpcCalls).toHaveLength(0);
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    },
  );

  it("sin permiso de edición no toca la base, aunque el id y el motivo sean inválidos", async () => {
    mocks.moduleEditDenial.mockResolvedValue("No tienes permiso para realizar esta acción.");

    const res = await softDeleteClientAction("DTD-1234", "ab");

    expect(res).toEqual({ error: "No tienes permiso para realizar esta acción." });
    expect(mocks.rpcCalls).toHaveLength(0);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
