import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  getOperario: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/auth/operario-session", () => ({
  getCurrentOperario: () => mocks.getOperario(),
}));

vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => ({ rpc: mocks.rpc }),
}));

vi.mock("@/lib/studio/notifications/schedule-fanout", () => ({
  notaSinAviso: vi.fn(),
  scheduleReceiptInWarehouse: vi.fn(),
}));

import { receivePrealertaAction } from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getOperario.mockResolvedValue({
    operario_id: "operario-cn",
    tenant_id: "tenant-dtd",
    region: "cn",
  });
});

describe("receivePrealertaAction · taxonomía de fallos", () => {
  it("clasifica PGRST202 como permanente y manda a avisar, no a reintentar", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: {
        code: "PGRST202",
        message: "Could not find the function public.receive_prealerta_as_operario",
      },
    });

    await expect(
      receivePrealertaAction("DTD-B-000123", 2),
    ).resolves.toEqual({
      error:
        "La recepción no está disponible. Avisa al responsable; no la intentes de nuevo.",
      failureKind: "permanent",
    });
  });

  it("mantiene un fallo desconocido como temporal y permite reintento", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: "PGRST000", message: "Database connection failed" },
    });

    await expect(
      receivePrealertaAction("DTD-B-000123", 2),
    ).resolves.toEqual({
      error: "No se pudo recibir por un problema temporal. Intenta de nuevo.",
      failureKind: "transient",
    });
  });

  it("usa el código real P0134 para conservar el mensaje de negocio", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: "P0134", message: "business rule failed" },
    });

    await expect(
      receivePrealertaAction("DTD-B-000123", 2),
    ).resolves.toEqual({
      error: "No hay cajas para recibir en esa compra.",
    });
  });
});
