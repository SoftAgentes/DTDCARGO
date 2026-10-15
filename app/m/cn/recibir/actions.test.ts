import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  getOperario: vi.fn(),
  /** SDD-0524 · el camino feliz necesita `from`; los de error sólo `rpc`. */
  admin: null as unknown,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/auth/operario-session", () => ({
  getCurrentOperario: () => mocks.getOperario(),
}));

vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => mocks.admin ?? { rpc: mocks.rpc },
}));

// La nota es la REAL (es lo que se mide); el fan-out, un doble.
vi.mock("@/lib/studio/notifications/schedule-fanout", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/studio/notifications/schedule-fanout")>();
  return {
    notaSinAviso: vi.fn(),
    notaSinAvisoBodega: real.notaSinAvisoBodega,
    scheduleReceiptInWarehouse: vi.fn(),
  };
});

import { receivePrealertaAction } from "./actions";
import { scheduleReceiptInWarehouse } from "@/lib/studio/notifications/schedule-fanout";
import { dobleLectores } from "@/lib/studio/__tests__/lectores-admin-double";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.admin = null;
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

describe("receivePrealertaAction · aviso al cliente (SDD-0524)", () => {
  it("cuelga el aviso de la compra escaneada y deja en la bitácora el motivo REAL si no sale", async () => {
    const d = dobleLectores(
      {
        prealertas: [
          { id: "p-1", tenant_id: "tenant-dtd", code: "DTD-1004-0002", deleted_at: null },
          // Mismo código en otro tenant: el filtro lo deja fuera.
          { id: "p-x", tenant_id: "otro", code: "DTD-1004-0002", deleted_at: null },
        ],
        warehouse_receipt_events: [],
      },
      {
        receive_prealerta_as_operario: () => ({
          data: {
            receipt_id: "rec-9",
            receipt_code: "WR-2026-0009",
            prealerta_code: "DTD-1004-0002",
            client_markbox: "DTD-1004",
            received: 3,
            remaining: 0,
          },
          error: null,
        }),
      },
    );
    mocks.admin = d.client;
    vi.mocked(scheduleReceiptInWarehouse).mockResolvedValue({
      scheduled: 0,
      sinDestino: ["DTD-1004"],
      detalle: [{ markbox: "DTD-1004", motivo: "ya_avisado", ancla: "DTD-1004-0002" }],
    });

    const res = await receivePrealertaAction("DTD-B-000123", 3);
    expect(res.ok).toBe(true);

    // El aviso es fire-and-forget: se espera a que termine.
    await vi.waitFor(() => expect(d.store.warehouse_receipt_events).toHaveLength(1));
    expect(vi.mocked(scheduleReceiptInWarehouse).mock.calls[0][2]).toEqual([
      { markbox: "DTD-1004", prealertaId: "p-1", prealertaCode: "DTD-1004-0002" },
    ]);
    const nota = d.store.warehouse_receipt_events[0];
    expect(nota).toMatchObject({ tenant_id: "tenant-dtd", receipt_id: "rec-9", event_type: "note" });
    expect(String(nota.description)).toContain("DTD-1004-0002");
    expect(String(nota.description)).not.toContain("no tiene un envío abierto");
  });
});
