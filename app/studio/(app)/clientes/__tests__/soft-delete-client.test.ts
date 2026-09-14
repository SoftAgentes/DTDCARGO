/**
 * SDD-0467 · Borrar un cliente revoca su acceso al Portal.
 *
 * La revocación vive en la base (trigger de la migr 0454, en la misma
 * transacción del UPDATE). Lo que la acción tiene que garantizar es el contrato
 * de cara al Studio: si el UPDATE falla —incluida una revocación que falla—, no
 * se revalida nada y el operador ve un error que no promete un borrado a medias.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn<(p: string) => void>(),
  moduleEditDenial: vi.fn<() => Promise<string | null>>(),
  updateResult: { error: null as { message: string } | null },
  calls: [] as Array<{ table: string; payload: Record<string, unknown>; eq: [string, unknown] }>,
}));

vi.mock("next/cache", () => ({ revalidatePath: (p: string) => mocks.revalidatePath(p) }));
vi.mock("@/lib/studio/rbac-guard", () => ({ moduleEditDenial: () => mocks.moduleEditDenial() }));
vi.mock("@/lib/db/server", () => ({
  createClient: async () => ({
    from(table: string) {
      return {
        update(payload: Record<string, unknown>) {
          return {
            eq: async (column: string, value: unknown) => {
              mocks.calls.push({ table, payload, eq: [column, value] });
              return mocks.updateResult;
            },
          };
        },
      };
    },
  }),
}));

import { softDeleteClientAction } from "../actions";

describe("softDeleteClientAction (SDD-0467)", () => {
  beforeEach(() => {
    mocks.revalidatePath.mockReset();
    mocks.moduleEditDenial.mockReset();
    mocks.moduleEditDenial.mockResolvedValue(null);
    mocks.updateResult = { error: null };
    mocks.calls = [];
  });

  it("borra con un solo UPDATE de deleted_at por Shipping Mark y revalida el listado", async () => {
    const res = await softDeleteClientAction("DTD-1234");

    expect(res).toEqual({ ok: true });
    expect(mocks.calls).toHaveLength(1);
    expect(mocks.calls[0].table).toBe("clients");
    expect(Object.keys(mocks.calls[0].payload)).toEqual(["deleted_at"]);
    expect(Number.isNaN(Date.parse(String(mocks.calls[0].payload.deleted_at)))).toBe(false);
    expect(mocks.calls[0].eq).toEqual(["markbox", "DTD-1234"]);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/studio/clientes");
  });

  it("si la revocación falla en la base, devuelve el error, no revalida y no promete un borrado", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.updateResult = { error: { message: "acceso al Portal sobre un cliente inexistente o borrado" } };

    const res = await softDeleteClientAction("DTD-1234");

    expect(res.ok).toBeUndefined();
    expect(res.error).toBe(
      "No se pudo eliminar el cliente ni revocar su acceso al Portal. No se borró nada; intenta de nuevo.",
    );
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(
      "[softDeleteClientAction]",
      "acceso al Portal sobre un cliente inexistente o borrado",
    );
    consoleError.mockRestore();
  });

  it("sin permiso de edición no toca la base", async () => {
    mocks.moduleEditDenial.mockResolvedValue("No tienes permiso para editar clientes.");

    const res = await softDeleteClientAction("DTD-1234");

    expect(res).toEqual({ error: "No tienes permiso para editar clientes." });
    expect(mocks.calls).toHaveLength(0);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
