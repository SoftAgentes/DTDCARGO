import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  maybeSingle: vi.fn(),
  moduleEditDenial: vi.fn(async () => null),
  revalidatePath: vi.fn(),
}));

const query = {
  update: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  maybeSingle: mocks.maybeSingle,
};
query.update.mockReturnValue(query);
query.eq.mockReturnValue(query);
query.select.mockReturnValue(query);

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/db/server", () => ({
  createClient: vi.fn(async () => ({ from: vi.fn(() => query) })),
}));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/studio/rbac-guard", () => ({
  capabilityDenial: vi.fn(),
  moduleEditDenial: mocks.moduleEditDenial,
}));
vi.mock("@/lib/studio/bitacora/notify", () => ({
  notifyBitacoraTaskAssigned: vi.fn(),
}));

import { moveTaskAction } from "../actions";

describe("moveTaskAction · DND-01", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    query.update.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.select.mockReturnValue(query);
  });

  it("rechaza un estado de origen inválido antes de escribir", async () => {
    const result = await moveTaskAction("task-1", "hecho", "inventado");
    expect(result).toEqual({ error: "Estado de origen inválido." });
    expect(query.update).not.toHaveBeenCalled();
  });

  it("condiciona el update por id y estado esperado", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { id: "task-1" }, error: null });
    const result = await moveTaskAction("task-1", "hecho", "pendiente");
    expect(result).toEqual({ ok: true });
    expect(query.eq).toHaveBeenNthCalledWith(1, "id", "task-1");
    expect(query.eq).toHaveBeenNthCalledWith(2, "estado", "pendiente");
    expect(query.select).toHaveBeenCalledWith("id");
  });

  it("devuelve conflicto cuando otra sesión ya cambió la tarea", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    const result = await moveTaskAction("task-1", "hecho", "pendiente");
    expect(result.error).toContain("cambió en otra sesión");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
