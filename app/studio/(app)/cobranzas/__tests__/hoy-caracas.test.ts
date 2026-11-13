/**
 * SDD-0558 · Cobranzas usa la fecha de Caracas, la misma de
 * `client_outstanding` (0492), en la pantalla y en los recordatorios.
 *
 * 2026-06-02 02:00 UTC es 2026-06-01 22:00 en Caracas. Con el día de UTC, una
 * factura que vence el 1 de junio ya saldría vencida y entraría al
 * recordatorio; con el de Caracas, todavía no. Se prueba lo que la pantalla y
 * la acción le PASAN a la cola: el cálculo con ese día ya lo prueba
 * `receivables-queue.test.ts`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  receivablesQueue: vi.fn(async () => []),
  collectionKpis: vi.fn(async () => ({})),
  fundsSeparationSummary: vi.fn(async () => ({})),
  seleccionar: vi.fn(() => ({ aEnviar: [], omitidos: [] })),
  tasasVesPorFecha: vi.fn(async () => new Map()),
}));

vi.mock("@/lib/db/server", () => ({ createClient: async () => ({}) }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/studio/rbac-guard", () => ({
  moduleEditDenial: async () => null,
  moduleViewDenial: async () => null,
}));
vi.mock("@/lib/studio/payment-queries", () => ({
  receivablesQueue: mocks.receivablesQueue,
  collectionKpis: mocks.collectionKpis,
  fundsSeparationSummary: mocks.fundsSeparationSummary,
  listCashAccounts: async () => [],
  listUnidentifiedReceipts: async () => [],
}));
vi.mock("@/lib/studio/collections/recordatorios-queries", () => ({
  contextoDeEnvio: async () => ({}),
}));
vi.mock("@/lib/studio/collections/recordatorios", () => ({
  intersectarPedido: () => [],
  MOTIVO_LABEL: {},
  resumirSeleccion: () => ({}),
  seleccionarParaRecordatorio: mocks.seleccionar,
}));
vi.mock("@/lib/studio/fx-rates", () => ({ tasasVesPorFecha: mocks.tasasVesPorFecha }));
vi.mock("../_components/CobranzasClient", () => ({ CobranzasClient: () => null }));

import CobranzasPage from "../page";
import { previewRecordatorios } from "../actions";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-02T02:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("Cobranzas · «hoy» en Caracas (SDD-0558)", () => {
  it("la pantalla pasa el día de Caracas a la cola, a los KPI y al período de la separación", async () => {
    await CobranzasPage();
    expect(mocks.receivablesQueue).toHaveBeenCalledWith(expect.anything(), "2026-06-01");
    expect(mocks.collectionKpis).toHaveBeenCalledWith(expect.anything(), "2026-06-01");
    expect(mocks.fundsSeparationSummary).toHaveBeenCalledWith(expect.anything(), {
      from: "2026-06-01",
      to: "2026-06-01",
    });
  });

  it("SDD-0629 · la tasa del equivalente en Bs se pide para el día de Caracas, con el tenant de la cola", async () => {
    mocks.receivablesQueue.mockResolvedValueOnce([
      { invoice: { tenant_id: "t-1" } },
    ] as never);
    await CobranzasPage();
    expect(mocks.tasasVesPorFecha).toHaveBeenCalledWith(expect.anything(), "t-1", ["2026-06-01"]);
  });

  it("SDD-0629 · sin casos abiertos no se lee ninguna tasa", async () => {
    await CobranzasPage();
    expect(mocks.tasasVesPorFecha).not.toHaveBeenCalled();
  });

  it("la vista previa de recordatorios selecciona con el día de Caracas", async () => {
    await previewRecordatorios();
    expect(mocks.receivablesQueue).toHaveBeenCalledWith(expect.anything(), "2026-06-01");
    expect(mocks.seleccionar).toHaveBeenCalledWith([], "2026-06-01", {});
  });
});
